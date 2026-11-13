// src/components/TarjetaPlan.tsx — un plan en la lista, con respuesta rápida
// v2: motivo opcional al decir que no, quién no puede (motivo u ocupación) y horario de llegada resumido
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FilaAvatares } from './Avatar';
import MotivoNoPuedo from './MotivoNoPuedo';
import { usePerfiles } from '../lib/perfiles';
import { C, chip, tarjeta } from '../lib/ui';
import {
  ESTADO_PLAN, cuentaAtras, fmtCorto, fmtHora, responder, textoOcupada, type Ocupada, type Plan, type Respuesta,
} from '../lib/planes';

export default function TarjetaPlan({ plan, respuestas, miId, onCambio, aviso, ocupadas = [] }: {
  plan: Plan;
  respuestas: Respuesta[];
  miId: string | null;
  onCambio: () => void;
  aviso?: string;
  ocupadas?: Ocupada[];
}) {
  const { porId } = usePerfiles();
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [pidiendoMotivo, setPidiendoMotivo] = useState(false);

  const aceptanR = respuestas.filter((r) => r.estado === 'acepta');
  const aceptan = aceptanR.map((r) => r.usuaria_id);
  const mia = respuestas.find((r) => r.usuaria_id === miId);
  const abierto = plan.estado === 'propuesto' && new Date(plan.fecha_limite) > new Date();
  const futuro = new Date(plan.inicio) > new Date();
  const est = ESTADO_PLAN[plan.estado];
  const nombre = (id: string) => porId(id)?.nombre ?? 'Alguien';
  const miOcupacion = ocupadas.find((o) => o.usuaria_id === miId);

  // Quién no puede y por qué: motivo escrito, o si no, su ocupación
  const noPueden = [
    ...respuestas.filter((r) => r.estado === 'rechaza').map((r) => {
      const oc = ocupadas.find((o) => o.usuaria_id === r.usuaria_id);
      return { id: r.usuaria_id, texto: r.motivo || (oc ? textoOcupada(oc) : '') };
    }),
    // sin responder pero con una ocupación a esa hora
    ...ocupadas
      .filter((o) => !respuestas.some((r) => r.usuaria_id === o.usuaria_id))
      .filter((o, i, arr) => arr.findIndex((x) => x.usuaria_id === o.usuaria_id) === i)
      .map((o) => ({ id: o.usuaria_id, texto: textoOcupada(o) })),
  ];

  // Resumen de llegadas tardías
  const tarde = aceptanR.filter((r) => r.llegada && new Date(r.llegada) > new Date(plan.inicio));

  async function contestar(estado: 'acepta' | 'rechaza') {
    if (!miId) return;
    setError(null);
    setOcupado(true);
    try {
      await responder(plan.id, miId, estado);
      setPidiendoMotivo(estado === 'rechaza');
      onCambio();
    } catch (e: any) { setError(e.message); }
    finally { setOcupado(false); }
  }

  const botonResp = (activo: boolean, color: string) => ({
    flex: 1, padding: 10, borderRadius: 10, font: 'inherit', fontWeight: 600, cursor: 'pointer',
    border: activo ? `2px solid ${color}` : `1px solid ${C.borde}`,
    background: activo ? color : C.blanco, color: activo ? C.blanco : 'inherit',
  });

  return (
    <article style={tarjeta}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={chip(est.fondo, est.color)}>{est.texto}</span>
        {abierto && <span style={{ fontSize: 13, color: C.suave }}>⏳ {cuentaAtras(plan.fecha_limite)} para responder</span>}
      </div>

      <Link to={`/plan/${plan.id}`} style={{ color: 'inherit', textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <strong style={{ fontSize: 18 }}>{plan.titulo}</strong>
        <span style={{ fontSize: 14, color: C.suave, textTransform: 'capitalize' }}>
          {fmtCorto(plan.inicio)}{plan.lugar && ` · 📍 ${plan.lugar}`}
        </span>
      </Link>

      <FilaAvatares ids={aceptan} tam={30} texto="van" />

      {tarde.length > 0 && (
        <span style={{ fontSize: 13, color: C.suave }}>
          🕒 {tarde.map((r) => `${nombre(r.usuaria_id)} llega a las ${fmtHora(r.llegada!)}`).join(' · ')}
        </span>
      )}

      {noPueden.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 13, color: C.suave }}>
          {noPueden.map((n) => (
            <span key={n.id}>🚫 {nombre(n.id)} no puede{n.texto && `: ${n.texto}`}</span>
          ))}
        </div>
      )}

      {aviso && <div style={{ fontSize: 14, background: C.avisoSuave, color: C.aviso, padding: '8px 10px', borderRadius: 10 }}>{aviso}</div>}

      {futuro && plan.estado !== 'anulado' && (abierto ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <button disabled={ocupado} onClick={() => contestar('acepta')} style={botonResp(mia?.estado === 'acepta', C.ok)}>
            {mia?.estado === 'acepta' ? '✓ Voy' : 'Acepto'}
          </button>
          <button disabled={ocupado} onClick={() => contestar('rechaza')} style={botonResp(mia?.estado === 'rechaza', C.suave)}>
            {mia?.estado === 'rechaza' ? '✗ No puedo' : 'No puedo'}
          </button>
        </div>
      ) : mia?.estado === 'acepta' ? (
        <span style={{ fontSize: 14, color: C.ok, fontWeight: 600 }}>✓ Vas</span>
      ) : (
        <button disabled={ocupado} onClick={() => contestar('acepta')} style={{ ...botonResp(false, C.ok), flex: 'none', alignSelf: 'flex-start' }}>
          Me apunto
        </button>
      ))}

      {pidiendoMotivo && miId && (
        <MotivoNoPuedo planId={plan.id} miId={miId} inicial={mia?.motivo ?? miOcupacion?.titulo}
                       onHecho={() => { setPidiendoMotivo(false); onCambio(); }} />
      )}

      {error && <p style={{ margin: 0, color: C.error, fontSize: 14 }}>{error}</p>}
    </article>
  );
}
