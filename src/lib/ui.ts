// src/lib/ui.ts — colores y estilos comunes de la app
import type { CSSProperties } from 'react';

export const C = {
  morado: '#7b2f63',
  moradoSuave: '#f3e6ef',
  borde: '#e3e3e8',
  suave: '#6b6b6b',
  fondo: '#faf9fb',
  blanco: '#ffffff',
  error: '#c5221f',
  ok: '#1e8e3e',
  okSuave: '#e6f4ea',
  aviso: '#8a5300',
  avisoSuave: '#fdf1dd',
};

export const pagina: CSSProperties = {
  padding: 16, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560, margin: '0 auto',
};

export const tarjeta: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 10, padding: 14,
  borderRadius: 16, border: `1px solid ${C.borde}`, background: C.blanco,
};

export const btnPrimario: CSSProperties = {
  padding: '12px 16px', borderRadius: 12, border: 'none', background: C.morado,
  color: C.blanco, font: 'inherit', fontWeight: 600, cursor: 'pointer',
};

export const btnSecundario: CSSProperties = {
  padding: '12px 16px', borderRadius: 12, border: `1px solid ${C.borde}`, background: C.blanco,
  color: 'inherit', font: 'inherit', cursor: 'pointer',
};

export const campo: CSSProperties = {
  font: 'inherit', padding: 10, borderRadius: 10, border: `1px solid ${C.borde}`, background: C.blanco, width: '100%',
};

export const etiqueta: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 15 };

export const chip = (fondo: string, color: string): CSSProperties => ({
  alignSelf: 'flex-start', fontSize: 12, fontWeight: 700, padding: '3px 8px',
  borderRadius: 99, background: fondo, color, textTransform: 'uppercase', letterSpacing: '0.04em',
});
