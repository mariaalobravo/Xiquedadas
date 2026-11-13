// src/lib/fotos.ts — fotos de las quedadas (v2). Máximo 3 por plan o quedada.
import { supabase } from './supabase';

export const BUCKET_FOTOS = 'fotos';
export const MAX_FOTOS = 3;

export type Foto = { id: string; autora: string; path: string; created_at: string; url?: string };

// Reduce la foto a máx. 1600 px de lado → JPEG ligero (las del iPhone ocupan varios MB)
export async function reducir(file: File, lado = 1600): Promise<Blob> {
  const bmp = await createImageBitmap(file); // respeta la orientación de la foto
  const escala = Math.min(1, lado / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * escala);
  canvas.height = Math.round(bmp.height * escala);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error('No se ha podido procesar la foto'))), 'image/jpeg', 0.82)
  );
}

export async function urlsFirmadas(paths: string[], segundos = 3600) {
  const mapa = new Map<string, string>();
  if (!paths.length) return mapa;
  const { data } = await supabase.storage.from(BUCKET_FOTOS).createSignedUrls(paths, segundos);
  (data ?? []).forEach((f) => f.path && f.signedUrl && mapa.set(f.path, f.signedUrl));
  return mapa;
}

type Destino = { planId?: string; quedadaId?: string };

export async function cargarFotos({ planId, quedadaId }: Destino): Promise<Foto[]> {
  let q = supabase.from('fotos').select('id, autora, path, created_at').order('created_at');
  q = planId ? q.eq('plan_id', planId) : q.eq('quedada_id', quedadaId!);
  const { data } = await q;
  const fotos = (data ?? []) as Foto[];
  const urls = await urlsFirmadas(fotos.map((f) => f.path));
  return fotos.map((f) => ({ ...f, url: urls.get(f.path) }));
}

export async function subirFoto(file: File, miId: string, { planId, quedadaId }: Destino) {
  const blob = await reducir(file);
  const path = `${miId}/${crypto.randomUUID()}.jpg`;
  const { error: e1 } = await supabase.storage.from(BUCKET_FOTOS).upload(path, blob, { contentType: 'image/jpeg' });
  if (e1) throw new Error('No se ha podido subir la foto.');
  const { error: e2 } = await supabase.from('fotos').insert({ plan_id: planId ?? null, quedada_id: quedadaId ?? null, path });
  if (e2) {
    await supabase.storage.from(BUCKET_FOTOS).remove([path]);
    throw new Error(e2.message.includes('3 fotos') ? 'Esta quedada ya tiene 3 fotos.' : 'No se ha podido guardar la foto.');
  }
}

export async function borrarFoto(f: Foto) {
  const { error } = await supabase.from('fotos').delete().eq('id', f.id);
  if (error) throw new Error('No se ha podido borrar la foto.');
  await supabase.storage.from(BUCKET_FOTOS).remove([f.path]);
}
