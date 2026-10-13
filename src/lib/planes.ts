// src/lib/planes.ts — tipos y utilidades de planes
// Supone que todas usáis el móvil en hora de España (las fechas se muestran en Europe/Madrid).
import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { C } from './ui';

export type EstadoPlan = 'propuesto' | 'confirmado' | 'cerrado' | 'anulado';
export type Plan = {
  id: string; creadora: string; titulo: string; descripcion: string | null; lugar: string | null;
  inicio: string; fin: string | null; fecha_limite: string; estado: EstadoPlan; created_at: string;
};
export type Respuesta = { plan_id: string; usuaria_id: string; estado: 'acepta' | 'rechaza' };
export type Franja = 'mañana' | 'tarde' | 'noche';

const TZ = 'Europe/Madrid';

export const fmtFechaLarga = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ });
export const fmtHora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
export const fmtCorto = (iso: string) =>
  `${new Date(iso).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ })} · ${fmtHora(iso)}`;

// "quedan 3 días" / "quedan 5 h" / "quedan 20 min"
export function cuentaAtras(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'plazo cerrado';
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return `quedan ${Math.max(1, Math.round(ms / 60_000))} min`;
  if (h < 48) return `quedan ${h} h`;
  return `quedan ${Math.floor(h / 24)} días`;
}

export const HORA_FRANJA: Record<Franja, string> = { mañana: '11:00', tarde: '18:00', noche: '21:00' };
export const franjaDeHora = (hora: string): Franja => {
  const h = Number(hora.slice(0, 2));
  return h < 14 ? 'mañana' : h < 20 ? 'tarde' : 'noche';
};

// Valor para <input type="datetime-local"> en hora local
export function aInputLocal(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const ESTADO_PLAN: Record<EstadoPlan, { texto: string; fondo: string; color: string }> = {
  propuesto: { texto: 'Propuesta', fondo: C.avisoSuave, color: C.aviso },
  confirmado: { texto: 'Confirmado', fondo: C.okSuave, color: C.ok },
  cerrado: { texto: 'Sin gente', fondo: '#eee', color: C.suave },
  anulado: { texto: 'Cancelado', fondo: '#fce8e6', color: C.error },
};

export function useMiId() {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setId(data.session?.user.id ?? null));
  }, []);
  return id;
}

export async function responder(planId: string, miId: string, estado: 'acepta' | 'rechaza') {
  const { error } = await supabase.from('respuestas').upsert(
    { plan_id: planId, usuaria_id: miId, estado, updated_at: new Date().toISOString() },
    { onConflict: 'plan_id,usuaria_id' }
  );
  if (error) {
    throw new Error(estado === 'rechaza'
      ? 'Ya ha pasado la fecha límite: para borrarte, pide anulación desde el plan.'
      : 'No se ha podido guardar tu respuesta.');
  }
}
