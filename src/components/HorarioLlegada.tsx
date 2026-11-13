// src/components/HorarioLlegada.tsx — a qué hora llega cada una (v2)
import { useState } from 'react';
import { usePerfiles } from '../lib/perfiles';
import { Avatar } from './Avatar';
import { fmtHora, guardarLlegada, type Plan, type Respuesta } from '../lib/planes';
import { C, campo } from '../lib/ui';

// Agrupa a las que van por hora de llegada (null = a la hora del plan)
export function HorarioLlegada({ plan, aceptan }: { plan: Plan; aceptan: Respuesta[] }) {
  const { porId } = usePerfiles();
  const grupos = new Map<number, string[]>();
  for (const r of aceptan) {
    const t = new Date(r.llegada ?? plan.inicio).getTime();
    grupos.set(t, [...(grupos.get(t) ?? []), r.usuaria_id]);
  }
  const filas = [...grupos.entries()].sort((a, b) => a[0] - b[0]);
  if (!filas.length) return <span style={{ fontSize: 14, color: C.suave }}>Nadie se ha apuntado todavía</span>;

  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
      {filas.map(([t, ids], i) => (
        <li key={t} style={{ display: 'grid', gridTemplateColumns: '58px 18px 1fr', alignItems: 'stretch', minHeight: 44 }}>
          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: i === 0 ? C.morado : '#3d1631', paddingTop: 10 }}>
            {fmtHora(new Date(t).toISOString())}
          </span>
          {/* línea de tiempo */}
          <span style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 8, top: i === 0 ? 16 : 0, bottom: i === filas.length - 1 ? 'calc(100% - 16px)' : 0, width: 2, background: C.moradoSuave }} />
            <span style={{ position: 'absolute', left: 3, top: 11, width: 12, height: 12, borderRadius: '50%', background: C.morado, border: `2px solid ${C.blanco}` }} />
          </span>
          <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, padding: '6px 0' }}>
            {ids.map((id) => {
              const p = porId(id);
              return (
                <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f4f4f6', borderRadius: 99, padding: '2px 10px 2px 2px', fontSize: 14 }}>
                  {p && <Avatar perfil={p} tam={24} />} {p?.nombre ?? '¿?'}
                </span>
              );
            })}
          </span>
        </li>
      ))}
    </ol>
  );
}

// Para elegir mi hora de llegada
export function MiLlegada({ plan, miId, llegada, onCambio }: {
  plan: Plan; miId: string; llegada: string | null | undefined; onCambio: () => void;
}) {
  const inicio = new Date(plan.inicio);
  const actual = llegada ? new Date(llegada) : inicio;
  const [otraHora, setOtraHora] = useState(false);
  const [hora, setHora] = useState(fmtHora(actual.toISOString()));
  const [error, setError] = useState<string | null>(null);

  async function guardar(fecha: Date | null) {
    setError(null);
    try {
      await guardarLlegada(plan.id, miId, fecha && fecha.getTime() !== inicio.getTime() ? fecha.toISOString() : null);
      setOtraHora(false);
      onCambio();
    } catch (e: any) { setError(e.message); }
  }

  // "20:30" → fecha del plan a esa hora; si es antes del inicio, se entiende que es pasada la medianoche
  function desdeTexto(hhmm: string) {
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date(inicio);
    d.setHours(h, m, 0, 0);
    if (d < inicio) d.setDate(d.getDate() + 1);
    return d;
  }

  const opciones = [
    { texto: `A las ${fmtHora(plan.inicio)}`, fecha: null as Date | null },
    { texto: '+30 min', fecha: new Date(inicio.getTime() + 30 * 60_000) },
    { texto: '+1 h', fecha: new Date(inicio.getTime() + 60 * 60_000) },
    { texto: '+2 h', fecha: new Date(inicio.getTime() + 120 * 60_000) },
  ];
  const elegida = (f: Date | null) => (f ? f.getTime() : inicio.getTime()) === actual.getTime();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 14 }}>¿A qué hora llegas?</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {opciones.map((o) => (
          <button key={o.texto} onClick={() => guardar(o.fecha)} aria-pressed={elegida(o.fecha)} style={{
            padding: '6px 12px', borderRadius: 99, font: 'inherit', fontSize: 14, cursor: 'pointer',
            border: elegida(o.fecha) ? `2px solid ${C.morado}` : `1px solid ${C.borde}`,
            background: elegida(o.fecha) ? C.moradoSuave : C.blanco, fontWeight: elegida(o.fecha) ? 700 : 400,
          }}>{o.texto}</button>
        ))}
        <button onClick={() => setOtraHora(true)} style={{ padding: '6px 12px', borderRadius: 99, border: `1px solid ${C.borde}`, background: C.blanco, font: 'inherit', fontSize: 14, cursor: 'pointer' }}>
          Otra hora…
        </button>
      </div>
      {otraHora && (
        <div style={{ display: 'flex', gap: 6 }}>
          <input id={`llegada-${plan.id}`} type="time" value={hora} onChange={(e) => setHora(e.target.value)} style={{ ...campo, width: 'auto' }} />
          <button onClick={() => hora && guardar(desdeTexto(hora))} style={{ padding: '0 14px', borderRadius: 10, border: 'none', background: C.morado, color: C.blanco, font: 'inherit', fontWeight: 600 }}>
            Guardar
          </button>
        </div>
      )}
      {!elegida(null) && <span style={{ fontSize: 13, color: C.suave }}>Llegas a las {fmtHora(actual.toISOString())}</span>}
      {error && <span style={{ fontSize: 13, color: C.error }}>{error}</span>}
    </div>
  );
}
