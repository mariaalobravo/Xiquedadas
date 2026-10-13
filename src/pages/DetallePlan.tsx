// src/pages/DetallePlan.tsx — ruta /plan/:id
// Toda la información de un plan: quién va, responder, pedir anulación (borrarme / cancelar),
// aprobarla si eres la creadora y, cuando ya ha empezado, marcar quién fue.
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { usePerfiles } from '../lib/perfiles';
import { Avatar, FilaAvatares } from '../components/Avatar';
import {
  ESTADO_PLAN, cuentaAtras, fmtCorto, fmtFechaLarga, fmtHora, responder, useMiId, type Plan, type Respuesta,
} from '../lib/planes';
import { C, btnPrimario, btnSecundario, campo, chip, pagina, tarjeta } from '../lib/ui';

type Anulacion = {
  id: string; solicitante: string; motivo: string; tipo: 'borrarme' | 'cancelar';
  estado: 'pendiente' | 'aprobada' | 'rechazada'; created_at: string;
};
type EstadoAsistencia = 'asistio' | 'justificada' | 'injustificada';
type Deuda = { deudora: string; acreedora: string; cervezas: number; saldada_en: string | null };

const ASISTENCIA: Record<EstadoAsistencia, { texto: string; icono: string; color: string }> = {
  asistio: { texto: 'Fue', icono: '✅', color: C.ok },
  justificada: { texto: 'Justificada', icono: '🟡', color: C.aviso },
  injustificada: { texto: 'Sin justificar', icono: '🍺', color: C.error },
};

export default function DetallePlan() {
  const { id } = useParams<{ id: string }>();
  const miId = useMiId();
  const { perfiles, porId } = usePerfiles();

  const [plan, setPlan] = useState<Plan | null | undefined>(undefined);
  const [respuestas, setRespuestas] = useState<Respuesta[]>([]);
  const [anulaciones, setAnulaciones] = useState<Anulacion[]>([]);
  const [asistencia, setAsistencia] = useState<Record<string, EstadoAsistencia>>({});
  const [deudas, setDeudas] = useState<Deuda[]>([]);
  const [formulario, setFormulario] = useState<'borrarme' | 'cancelar' | null>(null);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!id) return;
    const [p, r, a, s, d] = await Promise.all([
      supabase.from('planes').select('*').eq('id', id).maybeSingle(),
      supabase.from('respuestas').select('plan_id, usuaria_id, estado').eq('plan_id', id),
      supabase.from('anulaciones').select('*').eq('plan_id', id).order('created_at', { ascending: false }),
      supabase.from('asistencia').select('usuaria_id, estado').eq('plan_id', id),
      supabase.from('deudas').select('deudora, acreedora, cervezas, saldada_en').eq('plan_id', id),
    ]);
    setPlan((p.data ?? null) as Plan | null);
    setRespuestas((r.data ?? []) as Respuesta[]);
    setAnulaciones((a.data ?? []) as Anulacion[]);
    setAsistencia(Object.fromEntries((s.data ?? []).map((x) => [x.usuaria_id, x.estado])));
    setDeudas((d.data ?? []) as Deuda[]);
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    if (!id) return;
    const canal = supabase.channel(`plan-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'respuestas', filter: `plan_id=eq.${id}` }, () => cargar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'anulaciones', filter: `plan_id=eq.${id}` }, () => cargar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planes', filter: `id=eq.${id}` }, () => cargar())
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [id, cargar]);

  if (plan === undefined) return null;
  if (plan === null) return <main style={pagina}><p>Este plan no existe.</p><Link to="/">Volver a planes</Link></main>;

  const ahora = new Date();
  const est = ESTADO_PLAN[plan.estado];
  const soyCreadora = plan.creadora === miId;
  const empezado = new Date(plan.inicio) <= ahora;
  const abierto = plan.estado === 'propuesto' && new Date(plan.fecha_limite) > ahora;
  const vivo = !empezado && (plan.estado === 'propuesto' || plan.estado === 'confirmado');

  const aceptan = respuestas.filter((r) => r.estado === 'acepta').map((r) => r.usuaria_id);
  const rechazan = respuestas.filter((r) => r.estado === 'rechaza').map((r) => r.usuaria_id);
  const sinResponder = perfiles.map((p) => p.id).filter((pid) => !respuestas.some((r) => r.usuaria_id === pid));
  const mia = respuestas.find((r) => r.usuaria_id === miId)?.estado;
  const voy = mia === 'acepta';
  const pendientes = anulaciones.filter((a) => a.estado === 'pendiente');
  const tengoPendiente = (tipo: Anulacion['tipo']) => pendientes.some((a) => a.solicitante === miId && a.tipo === tipo);
  const nombre = (uid: string) => porId(uid)?.nombre ?? 'Alguien';

  async function hacer(accion: () => Promise<unknown>) {
    setError(null);
    setOcupado(true);
    try { await accion(); await cargar(); }
    catch (e: any) { setError(e.message ?? 'Algo ha fallado. Inténtalo otra vez.'); }
    finally { setOcupado(false); }
  }

  const contestar = (estado: 'acepta' | 'rechaza') => hacer(() => responder(plan.id, miId!, estado));

  const pedirAnulacion = () => hacer(async () => {
    if (!formulario) return;
    if (!motivo.trim()) throw new Error('Cuenta brevemente el motivo.');
    const { error } = await supabase.from('anulaciones').insert({ plan_id: plan.id, motivo: motivo.trim(), tipo: formulario });
    if (error) throw new Error('No se ha podido enviar la petición.');
    setFormulario(null);
    setMotivo('');
  });

  const resolver = (anId: string, estado: 'aprobada' | 'rechazada') => hacer(async () => {
    const { error } = await supabase.from('anulaciones').update({ estado }).eq('id', anId);
    if (error) throw new Error('No se ha podido guardar.');
  });

  const marcar = (uid: string, estado: EstadoAsistencia) => hacer(async () => {
    const { error } = await supabase.from('asistencia').upsert({ plan_id: plan.id, usuaria_id: uid, estado }, { onConflict: 'plan_id,usuaria_id' });
    if (error) throw new Error('No se ha podido marcar la asistencia.');
  });

  const botonResp = (activo: boolean, color: string): React.CSSProperties => ({
    flex: 1, padding: 12, borderRadius: 12, font: 'inherit', fontWeight: 600, cursor: 'pointer',
    border: activo ? `2px solid ${color}` : `1px solid ${C.borde}`, background: activo ? color : C.blanco, color: activo ? C.blanco : 'inherit',
  });

  return (
    <main style={pagina}>
      <Link to="/" style={{ color: C.morado, textDecoration: 'none', fontSize: 15 }}>← Planes</Link>

      {/* Cabecera */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={chip(est.fondo, est.color)}>{est.texto}</span>
        <h1 style={{ margin: 0, fontSize: 26, lineHeight: 1.2 }}>{plan.titulo}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: C.suave }}>
          {porId(plan.creadora) && <Avatar perfil={porId(plan.creadora)!} tam={24} />}
          Propuesto por {soyCreadora ? 'ti' : nombre(plan.creadora)}
        </div>
        <div style={{ fontSize: 16 }}>
          <div style={{ textTransform: 'capitalize' }}>🗓️ {fmtFechaLarga(plan.inicio)}</div>
          <div>🕒 {fmtHora(plan.inicio)}{plan.fin && ` – ${fmtHora(plan.fin)}`}</div>
          {plan.lugar && <div>📍 {plan.lugar}</div>}
        </div>
        {plan.descripcion && <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{plan.descripcion}</p>}
        {abierto && (
          <div style={{ fontSize: 14, background: C.avisoSuave, color: C.aviso, padding: '8px 10px', borderRadius: 10 }}>
            ⏳ {cuentaAtras(plan.fecha_limite)} para responder (hasta el {fmtCorto(plan.fecha_limite)})
          </div>
        )}
      </section>

      {/* Mi respuesta */}
      {vivo && miId && (
        <section style={tarjeta}>
          <strong>¿Vas?</strong>
          {abierto ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button disabled={ocupado} onClick={() => contestar('acepta')} style={botonResp(voy, C.ok)}>{voy ? '✓ Voy' : 'Acepto'}</button>
              <button disabled={ocupado} onClick={() => contestar('rechaza')} style={botonResp(mia === 'rechaza', C.suave)}>{mia === 'rechaza' ? '✗ No puedo' : 'No puedo'}</button>
            </div>
          ) : voy ? (
            <>
              <span style={{ color: C.ok, fontWeight: 600 }}>✓ Vas a este plan</span>
              {!tengoPendiente('borrarme') && formulario !== 'borrarme' && (
                <button onClick={() => setFormulario('borrarme')} style={{ ...btnSecundario, alignSelf: 'flex-start' }}>
                  Ya no puedo ir…
                </button>
              )}
            </>
          ) : (
            <button disabled={ocupado} onClick={() => contestar('acepta')} style={{ ...btnPrimario, alignSelf: 'flex-start' }}>Me apunto</button>
          )}
        </section>
      )}

      {/* Quién va */}
      <section style={tarjeta}>
        <strong>Quién va</strong>
        <FilaAvatares ids={aceptan} tam={34} texto="van" />
        {rechazan.length > 0 && <span style={{ fontSize: 14, color: C.suave }}>No pueden: {rechazan.map(nombre).join(', ')}</span>}
        {plan.estado === 'propuesto' && sinResponder.length > 0 && (
          <span style={{ fontSize: 14, color: C.suave }}>Sin responder: {sinResponder.map(nombre).join(', ')}</span>
        )}
      </section>

      {/* Anulaciones */}
      {(vivo || anulaciones.length > 0) && (
        <section style={tarjeta}>
          <strong>Anulaciones</strong>

          {pendientes.map((a) => (
            <div key={a.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, borderRadius: 10, background: C.avisoSuave }}>
              <span>
                <b>{nombre(a.solicitante)}</b> {a.tipo === 'borrarme' ? 'pide borrarse del plan' : 'propone cancelar el plan'}: «{a.motivo}»
              </span>
              {soyCreadora ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button disabled={ocupado} onClick={() => resolver(a.id, 'aprobada')} style={{ ...btnPrimario, flex: 1 }}>Aprobar</button>
                  <button disabled={ocupado} onClick={() => resolver(a.id, 'rechazada')} style={{ ...btnSecundario, flex: 1 }}>Rechazar</button>
                </div>
              ) : (
                <span style={{ fontSize: 13, color: C.aviso }}>Pendiente de que {nombre(plan.creadora)} lo apruebe.</span>
              )}
            </div>
          ))}

          {formulario && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 14 }}>
                {formulario === 'borrarme'
                  ? `Si ${soyCreadora ? 'lo confirmas' : `${nombre(plan.creadora)} lo aprueba`}, quedarás fuera del plan y no contará como falta.`
                  : soyCreadora ? 'El plan se cancelará para todas.' : `Si ${nombre(plan.creadora)} lo aprueba, el plan se cancelará para todas.`}
              </span>
              <textarea id="anulacion-motivo" style={{ ...campo, minHeight: 70 }} value={motivo} onChange={(e) => setMotivo(e.target.value)}
                        placeholder={formulario === 'borrarme' ? 'Me ha surgido…' : 'Va a llover, cierra el sitio…'} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button disabled={ocupado} onClick={pedirAnulacion} style={{ ...btnPrimario, flex: 1 }}>
                  {soyCreadora ? 'Confirmar' : 'Enviar petición'}
                </button>
                <button onClick={() => { setFormulario(null); setMotivo(''); }} style={btnSecundario}>Cancelar</button>
              </div>
            </div>
          )}

          {vivo && !formulario && voy && !tengoPendiente('cancelar') && (
            <button onClick={() => setFormulario('cancelar')} style={{ ...btnSecundario, alignSelf: 'flex-start', color: C.error }}>
              {soyCreadora ? 'Cancelar el plan' : 'Proponer cancelar el plan'}
            </button>
          )}

          {anulaciones.filter((a) => a.estado !== 'pendiente').map((a) => (
            <span key={a.id} style={{ fontSize: 13, color: C.suave }}>
              {a.estado === 'aprobada' ? '✅' : '❌'} {nombre(a.solicitante)} · {a.tipo === 'borrarme' ? 'borrarse' : 'cancelar el plan'} · «{a.motivo}» · {a.estado}
            </span>
          ))}
        </section>
      )}

      {/* Asistencia: cuando el plan ya ha empezado, lo marca cualquiera que fue */}
      {empezado && plan.estado !== 'anulado' && aceptan.length > 0 && (
        <section style={tarjeta}>
          <strong>¿Quién fue?</strong>
          {voy ? (
            <span style={{ fontSize: 13, color: C.suave }}>
              "Sin justificar" genera una cerveza 🍺 para cada una de las que fueron. Mejor marcar a todas a la vez.
            </span>
          ) : (
            <span style={{ fontSize: 13, color: C.suave }}>Solo pueden marcarlo las que aceptaron el plan.</span>
          )}
          {aceptan.map((uid) => {
            const p = porId(uid);
            const actual = asistencia[uid];
            return (
              <div key={uid} style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 6, borderTop: `1px solid ${C.borde}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {p && <Avatar perfil={p} tam={28} />}
                  <span style={{ flex: 1 }}>{nombre(uid)}</span>
                  {actual && <span style={{ fontSize: 13, color: ASISTENCIA[actual].color }}>{ASISTENCIA[actual].icono} {ASISTENCIA[actual].texto}</span>}
                </div>
                {voy && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(Object.keys(ASISTENCIA) as EstadoAsistencia[]).map((e) => (
                      <button key={e} disabled={ocupado || actual === e} onClick={() => marcar(uid, e)} style={{
                        flex: 1, padding: '6px 4px', borderRadius: 8, font: 'inherit', fontSize: 13, cursor: 'pointer',
                        border: actual === e ? `2px solid ${ASISTENCIA[e].color}` : `1px solid ${C.borde}`, background: C.blanco,
                      }}>
                        {ASISTENCIA[e].icono} {ASISTENCIA[e].texto}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {deudas.length > 0 && (
            <div style={{ fontSize: 14, background: C.avisoSuave, padding: 10, borderRadius: 10 }}>
              {deudas.map((d, i) => (
                <div key={i}>{nombre(d.deudora)} debe {'🍺'.repeat(d.cervezas)} a {nombre(d.acreedora)}{d.saldada_en && ' · saldada ✓'}</div>
              ))}
            </div>
          )}
        </section>
      )}

      {error && <p style={{ margin: 0, color: C.error }}>{error}</p>}
    </main>
  );
}
