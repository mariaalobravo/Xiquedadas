// src/components/TarjetaPlan.tsx — un plan en la lista, con respuesta rápida
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FilaAvatares } from './Avatar';
import { C, chip, tarjeta } from '../lib/ui';
import { ESTADO_PLAN, cuentaAtras, fmtCorto, responder, type Plan, type Respuesta } from '../lib/planes';

export default function TarjetaPlan({ plan, respuestas, miId, onCambio, aviso }: {
  plan: Plan;
  respuestas: Respuesta[];
  miId: string | null;
  onCambio: () => void;
  aviso?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const aceptan = respuestas.filter((r) => r.estado === 'acepta').map((r) => r.usuaria_id);
  const mia = respuestas.find((r) => r.usuaria_id === miId)?.estado;
  const abierto = plan.estado === 'propuesto' && new Date(plan.fecha_limite) > new Date();
  const futuro = new Date(plan.inicio) > new Date();
  const est = ESTADO_PLAN[plan.estado];

  async function contestar(estado: 'acepta' | 'rechaza') {
    if (!miId) return;
    setError(null);
    setOcupado(true);
    try { await responder(plan.id, miId, estado); onCambio(); }
    catch (e: any) { setError(e.message); }
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

      {aviso && <div style={{ fontSize: 14, background: C.avisoSuave, color: C.aviso, padding: '8px 10px', borderRadius: 10 }}>{aviso}</div>}

      {futuro && plan.estado !== 'anulado' && (abierto ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <button disabled={ocupado} onClick={() => contestar('acepta')} style={botonResp(mia === 'acepta', C.ok)}>
            {mia === 'acepta' ? '✓ Voy' : 'Acepto'}
          </button>
          <button disabled={ocupado} onClick={() => contestar('rechaza')} style={botonResp(mia === 'rechaza', C.suave)}>
            {mia === 'rechaza' ? '✗ No puedo' : 'No puedo'}
          </button>
        </div>
      ) : mia === 'acepta' ? (
        <span style={{ fontSize: 14, color: C.ok, fontWeight: 600 }}>✓ Vas</span>
      ) : (
        <button disabled={ocupado} onClick={() => contestar('acepta')} style={{ ...botonResp(false, C.ok), flex: 'none', alignSelf: 'flex-start' }}>
          Me apunto
        </button>
      ))}

      {error && <p style={{ margin: 0, color: C.error, fontSize: 14 }}>{error}</p>}
    </article>
  );
}
