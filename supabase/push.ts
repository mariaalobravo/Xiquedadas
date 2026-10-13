// supabase/functions/enviar-push/index.ts
// La disparan los Database Webhooks (planes, respuestas, anulaciones, deudas).
// Desplegar:  npx supabase functions deploy enviar-push --no-verify-jwt --use-api
import { autorizada, notificar, sb } from '../_shared/push.ts';

async function nombreDe(id: string) {
  const { data } = await sb.from('perfiles').select('nombre').eq('id', id).maybeSingle();
  return data?.nombre ?? 'Alguien';
}

Deno.serve(async (req) => {
  if (!autorizada(req)) return new Response('no', { status: 401 });

  const { table, type, record } = await req.json(); // payload de Database Webhook

  if (table === 'planes' && type === 'INSERT')
    await notificar({ title: 'Nuevo plan 🎉', body: record.titulo, url: `/plan/${record.id}` },
                    { excluir: record.creadora });

  if (table === 'respuestas' && record.estado === 'acepta') {
    const { data: plan } = await sb.from('planes').select('creadora, titulo').eq('id', record.plan_id).maybeSingle();
    // La creadora se apunta sola al crear el plan: no se avisa de eso
    if (plan && plan.creadora !== record.usuaria_id)
      await notificar({ title: `${await nombreDe(record.usuaria_id)} se apunta 🙌`, body: plan.titulo, url: `/plan/${record.plan_id}` },
                      { excluir: record.usuaria_id });
  }

  if (table === 'anulaciones' && type === 'INSERT')
    await notificar({ title: 'Petición de anulación', body: record.motivo, url: `/plan/${record.plan_id}` },
                    { excluir: record.solicitante });

  if (table === 'deudas' && type === 'INSERT') {
    const [deudora, acreedora] = await Promise.all([nombreDe(record.deudora), nombreDe(record.acreedora)]);
    await notificar({ title: `${deudora} te debe una cerveza 🍺`, body: 'Por faltar sin justificar. Márcala como saldada cuando te la pague.', url: '/xiques' },
                    { soloA: [record.acreedora] });
    await notificar({ title: `Debes una cerveza a ${acreedora} 🍺`, body: 'Por faltar a un plan sin justificar.', url: '/xiques' },
                    { soloA: [record.deudora] });
  }

  return new Response('ok');
});
