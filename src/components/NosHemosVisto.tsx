// src/components/NosHemosVisto.tsx
// Registrar una quedada fuera de la app (o el punto de partida: "nos vimos el 13 de julio").
// Basta con que una la registre.
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { usePerfiles } from '../lib/perfiles';
import { hoyISO } from '../lib/rachas';
import { Avatar } from './Avatar';

export default function NosHemosVisto({ onHecho, onCerrar, preseleccion }: {
  onHecho: () => void;
  onCerrar: () => void;
  preseleccion?: string;
}) {
  const { perfiles } = usePerfiles();
  const [miId, setMiId] = useState<string | null>(null);
  const [fecha, setFecha] = useState(hoyISO());
  const [elegidas, setElegidas] = useState<Set<string>>(new Set(preseleccion ? [preseleccion] : []));
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setMiId(data.user?.id ?? null)); }, []);

  const alternar = (id: string) =>
    setElegidas((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!miId) return;
    if (elegidas.size === 0) { setError('Elige al menos a una amiga'); return; }
    if (fecha > hoyISO()) { setError('La fecha no puede ser futura'); return; }
    setError(null);
    setGuardando(true);

    const { data: q, error: e1 } = await supabase.from('quedadas')
      .insert({ fecha, nota: nota.trim() || null }).select('id').single();
    if (e1 || !q) { setError('No se ha podido guardar'); setGuardando(false); return; }

    const filas = [miId, ...elegidas].map((usuaria_id) => ({ quedada_id: q.id, usuaria_id }));
    const { error: e2 } = await supabase.from('quedada_participantes').insert(filas);
    if (e2) {
      await supabase.from('quedadas').delete().eq('id', q.id);
      setError('No se ha podido guardar');
      setGuardando(false);
      return;
    }
    onHecho();
  }

  return (
    <form onSubmit={guardar} style={{
      display: 'flex', flexDirection: 'column', gap: 14, padding: 16,
      border: '1px solid #ddd', borderRadius: 16, background: 'var(--fondo-tarjeta, #f4f4f6)',
    }}>
      <strong style={{ fontSize: 17 }}>Nos hemos visto ✓</strong>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        ¿Cuándo?
        <input id="quedada-fecha" type="date" value={fecha} max={hoyISO()}
               onChange={(e) => setFecha(e.target.value)} style={{ font: 'inherit', padding: 8 }} />
      </label>

      <div>
        ¿Con quién?
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
          {perfiles.filter((p) => p.id !== miId).map((p) => (
            <button key={p.id} type="button" onClick={() => alternar(p.id)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px 4px 4px', borderRadius: 99,
              border: elegidas.has(p.id) ? '2px solid #7b2f63' : '1px solid #ccc',
              background: elegidas.has(p.id) ? '#f3e6ef' : 'transparent', font: 'inherit', cursor: 'pointer',
            }}>
              <Avatar perfil={p} tam={28} /> {p.nombre}
            </button>
          ))}
        </div>
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        Nota (opcional)
        <input id="quedada-nota" value={nota} onChange={(e) => setNota(e.target.value)}
               placeholder="Café en la plaza" style={{ font: 'inherit', padding: 8 }} />
      </label>

      {error && <p style={{ color: '#c5221f', margin: 0 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={guardando} style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: '#7b2f63', color: '#fff', font: 'inherit', fontWeight: 600 }}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" onClick={onCerrar} style={{ padding: 12, borderRadius: 12, border: '1px solid #ccc', background: 'transparent', font: 'inherit' }}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
