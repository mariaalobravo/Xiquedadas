// src/lib/rachas.ts — utilidades de fechas y rachas (todo en hora de Madrid)

const DIA = 86_400_000;

// Hoy en Madrid como 'YYYY-MM-DD'
export function hoyISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
}

const aMs = (iso: string) => Date.parse(iso.slice(0, 10) + 'T00:00:00Z');

// Días entre una fecha 'YYYY-MM-DD' y hoy
export function diasDesde(iso: string) {
  return Math.round((aMs(hoyISO()) - aMs(iso)) / DIA);
}

// '13 de julio' (y el año si no es el actual)
export function fechaLarga(iso: string) {
  const d = new Date(aMs(iso));
  const mismoAno = iso.slice(0, 4) === hoyISO().slice(0, 4);
  return d.toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', ...(mismoAno ? {} : { year: 'numeric' }), timeZone: 'UTC',
  });
}

// Verde < 2 semanas, amarillo 2–6 semanas, rojo > 6 semanas o sin datos
export type Nivel = 'verde' | 'amarillo' | 'rojo';
export function nivelDias(dias: number | null): Nivel {
  if (dias === null || dias > 42) return 'rojo';
  if (dias >= 14) return 'amarillo';
  return 'verde';
}
export const COLOR_NIVEL: Record<Nivel, string> = { verde: '#1e8e3e', amarillo: '#e3a008', rojo: '#d93025' };
export const EMOJI_NIVEL: Record<Nivel, string> = { verde: '🟩', amarillo: '🟨', rojo: '🟥' };

// Semanas seguidas (hasta esta semana o la anterior) en las que os habéis visto.
// `semanas` son los lunes de cada semana con al menos un encuentro.
export function semanasSeguidas(semanas: string[]) {
  const set = new Set(semanas.map((s) => s.slice(0, 10)));
  const hoy = aMs(hoyISO());
  const diaSemana = (new Date(hoy).getUTCDay() + 6) % 7; // 0 = lunes
  let lunes = hoy - diaSemana * DIA;
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

  if (!set.has(iso(lunes))) lunes -= 7 * DIA; // esta semana aún puede llegar
  let n = 0;
  while (set.has(iso(lunes))) { n++; lunes -= 7 * DIA; }
  return n;
}

// Hitos de la racha de respuesta
export function emojiRacha(n: number) {
  if (n >= 50) return '👑';
  if (n >= 25) return '💎';
  if (n >= 10) return '⭐';
  if (n >= 5) return '🔥';
  return '';
}
