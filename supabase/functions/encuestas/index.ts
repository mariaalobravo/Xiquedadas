// supabase/functions/encuestas/index.ts
// La llama pg_cron cada hora. Calcula la hora de Madrid y decide qué toca:
//  domingo 10:00 → abrir encuesta de la semana siguiente y avisar a todas
//  domingo 14:00 → 1.er recordatorio a quien no ha respondido
//  domingo 23:00 → 2.º recordatorio
//  lunes   14:00 → 3.er recordatorio
//  lunes   17:00 → cerrar
// Al cerrar, actualiza las rachas de respuesta (contestar la encuesta también suma).
// Desplegar:  npx supabase functions deploy encuestas --no-verify-jwt --use-api
import { autorizada, notificar, sb } from '../_shared/push.ts';
import { cerrarEventoRacha } from '../_shared/rachas.ts';

function ahoraMadrid() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Madrid', weekday: 'short', hour: '2-digit', hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date()).map((x) => [x.type, x.value])
  );
  return { dia: p.weekday, hora: Number(p.hour), fecha: `${p.year}-${p.month}-${p.day}` };
}

const sumarDias = (iso: string, n: number) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

async function pendientes(encuestaId: string) {
  const [{ data: todas }, { data: resp }] = await Promise.all([
    sb.from('perfiles').select('id'),
    sb.from('respuestas_encuesta').select('usuaria_id').eq('encuesta_id', encuestaId),
  ]);
  const ya = new Set((resp ?? []).map((r) => r.usuaria_id));
  return (todas ?? []).map((p) => p.id).filter((id) => !ya.has(id));
}

Deno.serve(async (req) => {
  if (!autorizada(req)) return new Response('no', { status: 401 });

  const { dia, hora, fecha } = ahoraMadrid();

  // Domingo: la encuesta es para la semana que empieza mañana.
  // Lunes: es la de la semana en curso (empieza hoy).
  const lunes = dia === 'Sun' ? sumarDias(fecha, 1) : dia === 'Mon' ? fecha : null;
  if (!lunes) return new Response('nada que hacer');

  // 1) Domingo ≥ 10:00 → crear encuesta y avisar
  if (dia === 'Sun' && hora >= 10) {
    const { data: creada } = await sb.from('encuestas')
      .upsert({ semana_inicio: lunes }, { onConflict: 'semana_inicio', ignoreDuplicates: true })
      .select().maybeSingle();
    if (creada) // solo si se acaba de crear
      await notificar({ title: 'Encuesta semanal 📅', body: '¿Qué días puedes salir esta semana?', url: '/encuesta' });
  }

  const { data: enc } = await sb.from('encuestas')
    .select('*').eq('semana_inicio', lunes).eq('estado', 'abierta').maybeSingle();
  if (!enc) return new Response('sin encuesta abierta');

  // 2) Lunes ≥ 17:00 → cerrar (va antes que los recordatorios para no avisar justo al cerrar)
  if (dia === 'Mon' && hora >= 17) {
    const { data: cerrada } = await sb.from('encuestas').update({ estado: 'cerrada' })
      .eq('id', enc.id).eq('estado', 'abierta').select('id');
    if (cerrada?.length) {
      const { data: resp } = await sb.from('respuestas_encuesta').select('usuaria_id').eq('encuesta_id', enc.id);
      await cerrarEventoRacha((resp ?? []).map((r) => r.usuaria_id), 'la encuesta semanal');
      await notificar({ title: 'Encuesta cerrada', body: 'Mira qué días cuadran a más gente', url: '/encuesta' });
    }
    return new Response('ok');
  }

  // 3) Recordatorios, solo a quien no ha respondido.
  //    Si alguno se saltó (por ejemplo, una ejecución fallida), se envía solo el más reciente.
  const RECORDATORIOS = [
    { campo: 'recordatorio_dom14', dia: 'Sun', hora: 14, title: 'Encuesta semanal 📅', body: '¿Ya has marcado qué días puedes esta semana?' },
    { campo: 'recordatorio_dom',   dia: 'Sun', hora: 23, title: 'Recordatorio', body: 'Aún no has rellenado la encuesta de la semana' },
    { campo: 'recordatorio_lun',   dia: 'Mon', hora: 14, title: 'Último aviso 🍽️', body: 'La encuesta se cierra hoy a las 17:00' },
  ] as const;
  const momento = (d: string, h: number) => (d === 'Mon' ? 24 : 0) + h;
  const vencidos = RECORDATORIOS.filter((r) => momento(dia, hora) >= momento(r.dia, r.hora));
  const toca = [...vencidos].reverse().find((r) => !enc[r.campo]);

  if (toca) {
    await notificar({ title: toca.title, body: toca.body, url: '/encuesta' },
                    { soloA: await pendientes(enc.id) });
    await sb.from('encuestas')
      .update(Object.fromEntries(vencidos.map((r) => [r.campo, true])))
      .eq('id', enc.id);
  }

  return new Response('ok');
});
