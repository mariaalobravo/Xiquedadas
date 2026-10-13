// src/lib/perfiles.tsx
// Carga los perfiles con su foto (URL firmada) una sola vez y los comparte en toda la app.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';

export type Perfil = { id: string; nombre: string; avatar_path: string | null; foto: string | null };

const BUCKET = 'avatares';
const DURACION_URL = 60 * 60 * 24; // 24 h

// Mismos colores que la pantalla de entrada (para el círculo con inicial cuando no hay foto)
export const COLORES: Record<string, string> = {
  Irene: '#F28B82', María: '#FBBC04', Carmen: '#81C995', Cristina: '#78D9EC',
  Sabela: '#A7B4FA', Helí: '#D7AEFB', Sara: '#FDCFE8',
};

async function cargarPerfiles(): Promise<Perfil[]> {
  const { data: perfiles, error } = await supabase.from('perfiles').select('id, nombre, avatar_path');
  if (error) throw error;

  const paths = (perfiles ?? []).map((p) => p.avatar_path).filter(Boolean) as string[];
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, DURACION_URL);
    (data ?? []).forEach((f) => f.path && f.signedUrl && urls.set(f.path, f.signedUrl));
  }
  return (perfiles ?? []).map((p) => ({ ...p, foto: p.avatar_path ? urls.get(p.avatar_path) ?? null : null }));
}

// Recorta al centro en cuadrado y reduce a `lado` px → JPEG ligero
async function redimensionar(file: File, lado = 400): Promise<Blob> {
  const bmp = await createImageBitmap(file); // respeta la orientación EXIF
  const s = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = lado;
  canvas.getContext('2d')!.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, lado, lado);
  return new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo procesar la imagen'))), 'image/jpeg', 0.85)
  );
}

export async function subirMiFoto(file: File) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No has iniciado sesión');

  const blob = await redimensionar(file);
  const path = `${user.id}/${Date.now()}.jpg`; // nombre nuevo cada vez → sin caché vieja

  const { error: eUp } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
  if (eUp) throw eUp;

  const { data: yo } = await supabase.from('perfiles').select('avatar_path').eq('id', user.id).single();
  const { error: eUpd } = await supabase.from('perfiles').update({ avatar_path: path }).eq('id', user.id);
  if (eUpd) throw eUpd;

  if (yo?.avatar_path) await supabase.storage.from(BUCKET).remove([yo.avatar_path]); // borra la anterior
}

type Ctx = { perfiles: Perfil[]; porId: (id: string) => Perfil | undefined; recargar: () => Promise<void> };
const PerfilesCtx = createContext<Ctx | null>(null);

export function PerfilesProvider({ children }: { children: ReactNode }) {
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const recargar = useCallback(async () => setPerfiles(await cargarPerfiles()), []);

  useEffect(() => {
    recargar();
    // Si alguien cambia su foto, se actualiza para todas
    const canal = supabase
      .channel('perfiles')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'perfiles' }, () => recargar())
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [recargar]);

  const porId = useCallback((id: string) => perfiles.find((p) => p.id === id), [perfiles]);
  return <PerfilesCtx.Provider value={{ perfiles, porId, recargar }}>{children}</PerfilesCtx.Provider>;
}

export function usePerfiles() {
  const ctx = useContext(PerfilesCtx);
  if (!ctx) throw new Error('usePerfiles debe usarse dentro de <PerfilesProvider>');
  return ctx;
}
