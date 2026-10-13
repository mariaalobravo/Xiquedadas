// src/pages/Grupo.tsx — ruta /grupo
// Pestaña general: cuánto hace que cada una no va a un plan de la app, y sus rachas.
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { usePerfiles } from '../lib/perfiles';
import { Avatar } from '../components/Avatar';
import { COLOR_NIVEL, diasDesde, emojiRacha, fechaLarga, nivelDias } from '../lib/rachas';

type Fila = {
  id: string; nombre: string; ultimo_plan: string | null; planes_este_ano: number;
  racha: number; mejor_racha: number; comodin_disponible: boolean;
};

function textoUltimoPlan(iso: string | null) {
  if (!iso) return 'Todavía no ha ido a ningún plan';
  const d = diasDesde(iso);
  if (d === 0) return 'Último plan: hoy';
  if (d === 1) return 'Último plan: ayer';
  return `Último plan: hace ${d} días (${fechaLarga(iso)})`;
}

export default function Grupo() {
  const { porId } = usePerfiles();
  const [filas, setFilas] = useState<Fila[]>([]);
  const [miId, setMiId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMiId(data.user?.id ?? null));
    supabase.from('resumen_grupo').select('*').then(({ data, error }) => {
      if (error) { setError('No se ha podido cargar el grupo'); return; }
      // Primero quien hace más que no va a un plan
      const orden = (f: Fila) => (f.ultimo_plan ? diasDesde(f.ultimo_plan) : 1e9);
      setFilas([...(data as Fila[])].sort((a, b) => orden(b) - orden(a)));
    });
  }, []);

  return (
    <main style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560, margin: '0 auto' }}>
      <h1 style={{ margin: 0, fontSize: 28 }}>El grupo</h1>
      <p style={{ margin: 0, color: '#6b6b6b' }}>Cuánto hace que cada una no va a un plan.</p>
      {error && <p style={{ color: '#c5221f', margin: 0 }}>{error}</p>}

      {filas.map((f) => {
        const p = porId(f.id);
        const nivel = nivelDias(f.ultimo_plan ? diasDesde(f.ultimo_plan) : null);
        return (
          <article key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, border: '1px solid #e3e3e8' }}>
            {p && <Avatar perfil={p} tam={48} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLOR_NIVEL[nivel], flexShrink: 0 }} />
                <strong>{f.nombre}{f.id === miId && ' (tú)'}</strong>
              </div>
              <div style={{ fontSize: 15 }}>{textoUltimoPlan(f.ultimo_plan)}</div>
              <div style={{ fontSize: 13, color: '#6b6b6b' }}>
                {f.planes_este_ano} {f.planes_este_ano === 1 ? 'plan' : 'planes'} este año
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 14, whiteSpace: 'nowrap' }}>
              <div><strong>{f.racha}</strong> {emojiRacha(f.racha) || '🔥'}</div>
              {f.comodin_disponible && <div title="Comodín disponible este mes">🧊</div>}
            </div>
          </article>
        );
      })}
    </main>
  );
}
