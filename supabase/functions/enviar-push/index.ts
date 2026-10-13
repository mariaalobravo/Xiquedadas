// supabase/functions/enviar-push/index.ts
// La disparan los avisos de la base de datos (avisar_push): planes, respuestas, anulaciones y deudas.
// Desplegar:  npx supabase functions deploy enviar-push --no-verify-jwt --use-api
import { autorizada, notificar, sb } from '../_shared/push.ts';

async function nombreDe(id: string) {
  const { data } = await sb.from('perfiles').select('nombre').eq('id', id).maybeSingle();
  return data?.nombre ?? 'Alguien';
}

Deno.serve(async (req) => {
  if (!autorizada(req)) return new Response('no', { status: 401 });

  const { table, type, record, old_record } = await req.json(); // mismo formato que un Database Webhook

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

  if (table === 'anulaciones') {
    const { data: plan } = await sb.from('planes').select('titulo, creadora').eq('id', record.plan_id).maybeSingle();
    if (plan) {
      const quien = await nombreDe(record.solicitante);
      const url = `/plan/${record.plan_id}`;

      // Nueva petición → a la creadora, para que la apruebe
      if (type === 'INSERT' && record.estado === 'pendiente')
        await notificar({
          title: record.tipo === 'borrarme' ? `${quien} pide borrarse` : `${quien} propone cancelar el plan`,
          body: `«${plan.titulo}»: ${record.motivo}`, url,
        }, { soloA: [plan.creadora] });

      // Resuelta (aprobada al momento si la pidió la creadora, o aprobada/rechazada después)
      const resuelta = (type === 'INSERT' && record.estado === 'aprobada')
        || (type === 'UPDATE' && old_record?.estado === 'pendiente' && record.estado !== 'pendiente');
      if (resuelta) {
        if (record.estado === 'aprobada' && record.tipo === 'cancelar')
          await notificar({ title: 'Plan cancelado ❌', body: `«${plan.titulo}»: ${record.motivo}`, url },
                          { excluir: record.solicitante });
        if (record.estado === 'aprobada' && record.tipo === 'borrarme')
          await notificar({ title: `${quien} no podrá ir`, body: `«${plan.titulo}»`, url },
                          { excluir: record.solicitante });
        if (type === 'UPDATE')
          await notificar({
            title: record.estado === 'aprobada' ? 'Petición aprobada ✅' : 'Petición rechazada',
            body: `«${plan.titulo}»`, url,
          }, { soloA: [record.solicitante] });
      }
    }
  }

  if (table === 'deudas' && type === 'INSERT') {
    const [deudora, acreedora] = await Promise.all([nombreDe(record.deudora), nombreDe(record.acreedora)]);
    await notificar({ title: `${deudora} te debe una cerveza 🍺`, body: 'Por faltar sin justificar. Márcala como saldada cuando te la pague.', url: '/xiques' },
                    { soloA: [record.acreedora] });
    await notificar({ title: `Debes una cerveza a ${acreedora} 🍺`, body: 'Por faltar a un plan sin justificar.', url: '/xiques' },
                    { soloA: [record.deudora] });
  }

  return new Response('ok');
});
