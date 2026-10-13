// src/pages/Encuesta.tsx — ruta /encuesta
// Encuesta semanal por franjas (mañana / tarde / noche).
// Los resultados se ven en todo momento, también mientras está abierta.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { usePerfiles } from '../lib/perfiles';
import { Avatar, FilaAvatares } from '../components/Avatar';

const FRANJAS = ['mañana', 'tarde', 'noche'] as const;
type Franja = (typeof FRANJAS)[number];
type Encuesta = { id: string; semana_inicio: string; estado: 'abierta' | 'cerrada' };
type Disp = { usuaria_id: string; dia: string; franja: Franja };

const clave = (dia: string, franja: string) => `${dia}|${franja}`;

function diasDeLaSemana(lunes: string) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}
const etiquetaDia = (iso: string) =>
  new Date(iso + 'T00:00:00Z').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });

export default function EncuestaPage() {
  const { perfiles, porId } = usePerfiles();
  const navigate = useNavigate();
  const [miId, setMiId] = useState<string | null>(null);
  const [enc, setEnc] = useState<Encuesta | null | undefined>(undefined);
  const [disp, setDisp] = useState<Disp[]>([]);
  const [respondieron, setRespondieron] = useState<string[]>([]);
  const [borrador, setBorrador] = useState<Set<string>>(new Set());
  const [cambios, setCambios] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const cargar = useCallback(async (encId?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    setMiId(user?.id ?? null);

    let e = enc;
    if (!encId) {
      const { data } = await supabase.from('encuestas').select('*')
        .order('semana_inicio', { ascending: false }).limit(1).maybeSingle();
      e = data as Encuesta | null;
      setEnc(e);
    }
    const id = encId ?? e?.id;
    if (!id) return;

    const [d, r] = await Promise.all([
      supabase.from('disponibilidad').select('usuaria_id, dia, franja').eq('encuesta_id', id),
      supabase.from('respuestas_encuesta').select('usuaria_id').eq('encuesta_id', id),
    ]);
    const filas = (d.data ?? []) as Disp[];
    setDisp(filas);
    setRespondieron((r.data ?? []).map((x) => x.usuaria_id));
    if (!cambios) setBorrador(new Set(filas.filter((f) => f.usuaria_id === user?.id).map((f) => clave(f.dia, f.franja))));
  }, [enc, cambios]);

  useEffect(() => { cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // Resultados en directo: si otra responde, se actualiza
  useEffect(() => {
    if (!enc) return;
    const canal = supabase.channel('encuesta')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'disponibilidad' }, () => cargar(enc.id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'respuestas_encuesta' }, () => cargar(enc.id))
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [enc, cargar]);

  // Quién puede en cada día/franja (sin contarme a mí: lo mío sale del borrador)
  const porCelda = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const f of disp) {
      if (f.usuaria_id === miId) continue;
      const k = clave(f.dia, f.franja);
      m.set(k, [...(m.get(k) ?? []), f.usuaria_id]);
    }
    if (miId) for (const k of borrador) m.set(k, [...(m.get(k) ?? []), miId]);
    return m;
  }, [disp, borrador, miId]);

  const mejores = useMemo(() => {
    const lista = [...porCelda.entries()].sort((a, b) => b[1].length - a[1].length);
    const max = lista[0]?.[1].length ?? 0;
    return max > 0 ? lista.filter(([, ids]) => ids.length === max).slice(0, 3) : [];
  }, [porCelda]);

  if (enc === undefined) return null;
  if (enc === null) return <main style={{ padding: 16 }}><h1>Encuesta semanal</h1><p>La próxima encuesta se abre el domingo a las 10:00.</p></main>;

  const abierta = enc.estado === 'abierta';
  const dias = diasDeLaSemana(enc.semana_inicio);
  const total = perfiles.length || 7;
  const yaRespondi = !!miId && respondieron.includes(miId);
  const faltan = perfiles.filter((p) => !respondieron.includes(p.id));

  function alternar(k: string) {
    if (!abierta) return;
    setBorrador((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
    setCambios(true);
    setMensaje(null);
  }

  async function guardar(ningunDia = false) {
    if (!miId || !enc) return;
    setGuardando(true);
    const elegidas = ningunDia ? new Set<string>() : borrador;
    const { error: e1 } = await supabase.from('disponibilidad').delete().eq('encuesta_id', enc.id).eq('usuaria_id', miId);
    const filas = [...elegidas].map((k) => { const [dia, franja] = k.split('|'); return { encuesta_id: enc.id, usuaria_id: miId, dia, franja }; });
    const { error: e2 } = filas.length ? await supabase.from('disponibilidad').insert(filas) : { error: null };
    const { error: e3 } = await supabase.from('respuestas_encuesta')
      .upsert({ encuesta_id: enc.id, usuaria_id: miId, respondida_en: new Date().toISOString() }, { onConflict: 'encuesta_id,usuaria_id' });
    setGuardando(false);
    if (e1 || e2 || e3) { setMensaje('No se ha podido guardar. Inténtalo otra vez.'); return; }
    if (ningunDia) setBorrador(new Set());
    setCambios(false);
    setMensaje(ningunDia ? 'Guardado: esta semana no puedes ningún día.' : 'Guardado ✓');
    cargar(enc.id);
  }

  return (
    <main style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560, margin: '0 auto' }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 28 }}>Encuesta semanal</h1>
        <p style={{ margin: '4px 0 0', color: '#6b6b6b' }}>
          Semana del {etiquetaDia(dias[0])} al {etiquetaDia(dias[6])} ·{' '}
          {abierta ? 'se cierra el lunes a las 17:00' : 'cerrada'}
        </p>
      </header>

      {abierta && <p style={{ margin: 0 }}>Toca las franjas en las que puedes salir. Los números son cuántas pueden, tú incluida.</p>}

      {/* Cuadrícula: días × franjas */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 6, width: '100%' }}>
          <thead>
            <tr>
              <th />
              {FRANJAS.map((f) => <th key={f} style={{ fontSize: 13, color: '#6b6b6b', textTransform: 'capitalize' }}>{f}</th>)}
            </tr>
          </thead>
          <tbody>
            {dias.map((dia) => (
              <tr key={dia}>
                <td style={{ fontSize: 14, whiteSpace: 'nowrap', textTransform: 'capitalize' }}>{etiquetaDia(dia)}</td>
                {FRANJAS.map((fr) => {
                  const k = clave(dia, fr);
                  const ids = porCelda.get(k) ?? [];
                  const mia = borrador.has(k);
                  const intensidad = ids.length / total;
                  return (
                    <td key={fr}>
                      <button
                        onClick={() => alternar(k)}
                        disabled={!abierta}
                        aria-pressed={mia}
                        title={ids.map((id) => porId(id)?.nombre).filter(Boolean).join(', ') || 'Nadie todavía'}
                        style={{
                          width: '100%', minWidth: 64, height: 48, borderRadius: 10, font: 'inherit', cursor: abierta ? 'pointer' : 'default',
                          border: mia ? '2px solid #7b2f63' : '1px solid #ddd',
                          background: `rgba(123, 47, 99, ${0.08 + intensidad * 0.6})`,
                          color: intensidad > 0.55 ? '#fff' : 'inherit', fontWeight: 600,
                        }}>
                        {mia && '✓ '}{ids.length}/{total}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {abierta && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => guardar()} disabled={guardando || (!cambios && yaRespondi)}
                  style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: '#7b2f63', color: '#fff', font: 'inherit', fontWeight: 600, opacity: guardando || (!cambios && yaRespondi) ? 0.5 : 1 }}>
            {guardando ? 'Guardando…' : yaRespondi ? 'Guardar cambios' : 'Enviar mi disponibilidad'}
          </button>
          <button onClick={() => guardar(true)} disabled={guardando}
                  style={{ padding: 12, borderRadius: 12, border: '1px solid #ccc', background: 'transparent', font: 'inherit' }}>
            No puedo ningún día
          </button>
        </div>
      )}
      {mensaje && <p style={{ margin: 0 }}>{mensaje}</p>}

      {/* Mejores opciones hasta ahora */}
      {mejores.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{abierta ? 'Lo que mejor cuadra por ahora' : 'Lo que mejor cuadra'}</h2>
          {mejores.map(([k, ids]) => {
            const [dia, fr] = k.split('|');
            return (
              <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 12, border: '1px solid #e3e3e8' }}>
                <strong style={{ textTransform: 'capitalize' }}>{etiquetaDia(dia)} · {fr}</strong>
                <FilaAvatares ids={ids} tam={30} />
                <button onClick={() => navigate(`/plan/nuevo?fecha=${dia}&franja=${fr}`)}
                        style={{ alignSelf: 'flex-start', padding: '8px 12px', borderRadius: 10, border: '1px solid #7b2f63', background: 'transparent', color: '#7b2f63', font: 'inherit', fontWeight: 600 }}>
                  Proponer plan este día
                </button>
              </div>
            );
          })}
        </section>
      )}

      {/* Quién falta */}
      {abierta && faltan.length > 0 && (
        <section>
          <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>Faltan por responder ({faltan.length})</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {faltan.map((p) => (
              <span key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Avatar perfil={p} tam={28} /> {p.nombre}
              </span>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
