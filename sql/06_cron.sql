-- 06_cron.sql — tareas programadas (antes: activar pg_cron y pg_net en Database → Extensions)
-- Sustituye <ref> por la referencia del proyecto y <secreto> por tu WEBHOOK_SECRET.
-- (Más adelante, guarda el secreto en Supabase Vault en vez de dejarlo escrito aquí.)

-- Cada hora: recordatorios de fecha límite y cierre de planes vencidos
select cron.schedule('recordatorios', '0 * * * *', $$
  select net.http_post(
    url := 'https://<ref>.supabase.co/functions/v1/recordatorios',
    headers := jsonb_build_object('Content-Type','application/json','x-webhook-secret','<secreto>'),
    body := '{}'::jsonb
  );
$$);

-- Cada hora: la función decide (en hora de Madrid) si toca abrir encuesta,
-- recordar o cerrar. pg_cron va en UTC, por eso no se programa a hora fija.
select cron.schedule('encuestas', '0 * * * *', $$
  select net.http_post(
    url := 'https://<ref>.supabase.co/functions/v1/encuestas',
    headers := jsonb_build_object('Content-Type','application/json','x-webhook-secret','<secreto>'),
    body := '{}'::jsonb
  );
$$);
