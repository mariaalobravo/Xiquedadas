// supabase/functions/recordatorios/index.ts
// La llama pg_cron cada hora:
//  1) avisa a quien no ha respondido cuando quedan < 24 h para la fecha límite
//     (recordándole la racha que se juega)
//  2) cierra los planes vencidos y actualiza las rachas de respuesta
// Desplegar:  npx supabase functions deploy recordatorios --no-verify-jwt --use-api
import { autorizada, notificar, sb } from '../_shared/push.ts';
import { cerrarEventoRacha } from '../_shared/rachas.ts';

async function sinResponder(planId: string) {
  const [{ data: todas }, { data: resp }] = await Promise.all([
    sb.from('perfiles').select('id'),
    sb.from('respuestas').select('usuaria_id').eq('plan_id', planId),
  ]);
  const ya = new Set((resp ?? []).map((r) => r.usuaria_id));
  return (todas ?? []).map((p) => p.id).filter((id) => !ya.has(id));
}

Deno.serve(async (req) => {
  if (!autorizada(req)) return new Response('no', { status: 401 });

  const ahora = new Date();
  const en24h = new Date(ahora.getTime() + 24 * 3600 * 1000);

  // 1) Recordatorio de fecha límite, personalizado con la racha de cada una
  const { data: proximos } = await sb.from('planes').select('*')
    .eq('estado', 'propuesto').eq('recordatorio_enviado', false)
    .gt('fecha_limite', ahora.toISOString()).lte('fecha_limite', en24h.toISOString());

  for (const p of proximos ?? []) {
    const pendientes = await sinResponder(p.id);
    const { data: rachas } = pendientes.length
      ? await sb.from('rachas').select('usuaria_id, actual').in('usuaria_id', pendientes)
      : { data: [] };
    const racha = new Map((rachas ?? []).map((r) => [r.usuaria_id, r.actual]));

    for (const id of pendientes) {
      const n = racha.get(id) ?? 0;
      await notificar(
        {
          title: 'Último día para responder ⏳',
          body: n > 0 ? `${p.titulo} · Contesta o pierdes tu racha de ${n} 🔥` : p.titulo,
          url: `/plan/${p.id}`,
        },
        { soloA: [id] }
      );
    }
    await sb.from('planes').update({ recordatorio_enviado: true }).eq('id', p.id);
  }

  // 2) Cierre de planes vencidos
  const { data: vencidos } = await sb.from('planes').select('*')
    .eq('estado', 'propuesto').lte('fecha_limite', ahora.toISOString());

  for (const p of vencidos ?? []) {
    const { data: resp } = await sb.from('respuestas')
      .select('usuaria_id, estado, creada_en').eq('plan_id', p.id);

    const aceptan = (resp ?? []).filter((r) => r.estado === 'acepta').length;
    const nuevo = aceptan > 0 ? 'confirmado' : 'cerrado';

    // Solo lo procesa una vez aunque dos ejecuciones coincidan
    const { data: cambiado } = await sb.from('planes').update({ estado: nuevo })
      .eq('id', p.id).eq('estado', 'propuesto').select('id');
    if (!cambiado?.length) continue;

    // Racha: cuenta quien contestó (sí o no) antes de la fecha límite
    const aTiempo = (resp ?? [])
      .filter((r) => new Date(r.creada_en) <= new Date(p.fecha_limite))
      .map((r) => r.usuaria_id);
    await cerrarEventoRacha(aTiempo, `«${p.titulo}»`);

    if (nuevo === 'confirmado')
      await notificar({ title: 'Plan confirmado ✅', body: p.titulo, url: `/plan/${p.id}` });
  }

  return new Response('ok');
});
