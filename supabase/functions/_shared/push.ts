// supabase/functions/_shared/push.ts — envío de notificaciones (lo usan varias funciones)
import webpush from 'npm:web-push@3';
import { createClient } from 'npm:@supabase/supabase-js@2';

webpush.setVapidDetails(
  'mailto:mariaalobravo@gmail.com', // [FALTA] tu correo de contacto
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!
);

export const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

export const autorizada = (req: Request) =>
  req.headers.get('x-webhook-secret') === Deno.env.get('WEBHOOK_SECRET');

export async function notificar(
  msg: { title: string; body: string; url?: string },
  opts: { excluir?: string; soloA?: string[] } = {}
) {
  let q = sb.from('suscripciones_push').select('*');
  if (opts.excluir) q = q.neq('usuaria_id', opts.excluir);
  if (opts.soloA) {
    if (opts.soloA.length === 0) return;
    q = q.in('usuaria_id', opts.soloA);
  }
  const { data: subs } = await q;

  await Promise.all((subs ?? []).map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(msg)
      );
    } catch (e: any) {
      if (e.statusCode === 404 || e.statusCode === 410) // suscripción caducada
        await sb.from('suscripciones_push').delete().eq('id', s.id);
    }
  }));
}
