// supabase/functions/encuestas/index.ts  (v2)
// La llama pg_cron cada hora. Calcula la hora de Madrid y decide qué toca:
//  domingo 10:00 → abrir la encuesta de la semana siguiente y avisar a todas
//  domingo 14:00 → 1.er recordatorio a quien no ha respondido
//  domingo 23:00 → 2.º recordatorio
//  lunes (primera ejecución) → racha: cuenta quien contestó antes de que acabara el domingo
//  cada día → los días que ya han pasado quedan cerrados (lo hace la base de datos);
//             la encuesta entera se cierra cuando acaba su domingo
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

  // 1) Cerrar las encuestas cuya semana ya ha terminado (su domingo es anterior a hoy)
  await sb.from('encuestas').update({ estado: 'cerrada' })
    .eq('estado', 'abierta').lt('semana_inicio', sumarDias(fecha, -6));

  // 2) Lunes: racha de la encuesta que empieza hoy (contestada antes de que acabara el domingo)
  if (dia === 'Mon') {
    const { data: marcada } = await sb.from('encuestas').update({ racha_procesada: true })
      .eq('semana_inicio', fecha).eq('racha_procesada', false).select('id');
    if (marcada?.length) {
      const corte = new Date();               // la primera ejecución del lunes, ~00:00
      const { data: resp } = await sb.from('respuestas_encuesta')
        .select('usuaria_id, creada_en').eq('encuesta_id', marcada[0].id);
      const aTiempo = (resp ?? [])
        .filter((r) => new Date(r.creada_en) <= corte)
        .map((r) => r.usuaria_id);
      await cerrarEventoRacha(aTiempo, 'la encuesta semanal');
    }
    return new Response('ok');
  }

  if (dia !== 'Sun') return new Response('nada que hacer');

  // 3) Domingo: encuesta de la semana que empieza mañana
  const lunes = sumarDias(fecha, 1);

  if (hora >= 10) {
    const { data: creada } = await sb.from('encuestas')
      .upsert({ semana_inicio: lunes }, { onConflict: 'semana_inicio', ignoreDuplicates: true })
      .select().maybeSingle();
    if (creada)
      await notificar({ title: 'Encuesta semanal 📅', body: '¿Qué días puedes salir esta semana?', url: '/encuesta' });
  }

  const { data: enc } = await sb.from('encuestas')
    .select('*').eq('semana_inicio', lunes).eq('estado', 'abierta').maybeSingle();
  if (!enc) return new Response('sin encuesta abierta');

  // 4) Recordatorios del domingo (solo a quien no ha respondido).
  //    Si alguno se saltó, se envía solo el más reciente.
  const RECORDATORIOS = [
    { campo: 'recordatorio_dom14', hora: 14, title: 'Encuesta semanal 📅', body: '¿Ya has marcado qué días puedes esta semana?' },
    { campo: 'recordatorio_dom',   hora: 23, title: 'Último aviso 🔥', body: 'Contesta la encuesta antes de medianoche para no perder tu racha' },
  ] as const;
  const vencidos = RECORDATORIOS.filter((r) => hora >= r.hora);
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
