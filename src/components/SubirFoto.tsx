// src/components/SubirFoto.tsx  (ponlo en la pantalla de Ajustes / Perfil)
import { useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { subirMiFoto, usePerfiles } from '../lib/perfiles';
import { Avatar } from './Avatar';

export default function SubirFoto() {
  const { porId, recargar } = usePerfiles();
  const [miId, setMiId] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  if (miId === null) supabase.auth.getUser().then(({ data }) => setMiId(data.user?.id ?? ''));
  const yo = miId ? porId(miId) : undefined;

  async function alElegir(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir la misma foto
    if (!file) return;
    setError(null);
    setSubiendo(true);
    try {
      await subirMiFoto(file);
      await recargar();
    } catch (err: any) {
      setError(err.message ?? 'No se pudo subir la foto');
    } finally {
      setSubiendo(false);
    }
  }

  if (!yo) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <Avatar perfil={yo} tam={112} />
      {/* En iOS, accept="image/*" ofrece "Fototeca" y "Hacer foto" y convierte HEIC a JPEG */}
      <input ref={input} type="file" accept="image/*" hidden onChange={alElegir} />
      <button onClick={() => input.current?.click()} disabled={subiendo}
              style={{ padding: '10px 18px', borderRadius: 12, border: '1px solid #ccc', font: 'inherit' }}>
        {subiendo ? 'Subiendo…' : yo.foto ? 'Cambiar foto' : 'Añadir foto'}
      </button>
      {error && <p style={{ color: '#c5221f', margin: 0 }}>{error}</p>}
    </div>
  );
}
