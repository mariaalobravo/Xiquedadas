// src/components/MotivoNoPuedo.tsx — motivo opcional al decir "no puedo" (v2)
import { useState } from 'react';
import { guardarMotivo } from '../lib/planes';
import { C, campo } from '../lib/ui';

export default function MotivoNoPuedo({ planId, miId, inicial, onHecho }: {
  planId: string; miId: string; inicial?: string | null; onHecho: () => void;
}) {
  const [texto, setTexto] = useState(inicial ?? '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setGuardando(true);
    setError(null);
    try { await guardarMotivo(planId, miId, texto); onHecho(); }
    catch (e: any) { setError(e.message); }
    finally { setGuardando(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10, borderRadius: 10, background: '#f4f4f6' }}>
      <label htmlFor={`motivo-${planId}`} style={{ fontSize: 14 }}>¿Por qué no puedes? <span style={{ color: C.suave }}>(opcional)</span></label>
      <div style={{ display: 'flex', gap: 6 }}>
        <input id={`motivo-${planId}`} value={texto} maxLength={140} onChange={(e) => setTexto(e.target.value)}
               placeholder="Tengo examen, estoy fuera…" style={{ ...campo, flex: 1, minWidth: 0 }} />
        <button onClick={guardar} disabled={guardando} style={{
          padding: '0 14px', borderRadius: 10, border: 'none', background: C.morado, color: C.blanco, font: 'inherit', fontWeight: 600,
        }}>{guardando ? '…' : 'Guardar'}</button>
      </div>
      <button onClick={onHecho} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0, color: C.suave, font: 'inherit', fontSize: 13, textDecoration: 'underline', cursor: 'pointer' }}>
        Ahora no
      </button>
      {error && <span style={{ color: C.error, fontSize: 13 }}>{error}</span>}
    </div>
  );
}
