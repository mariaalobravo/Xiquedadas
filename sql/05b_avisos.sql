-- 05b_avisos.sql — conecta la base de datos con la función enviar-push (sustituye <ref> y <secreto>)
create extension if not exists pg_net;

create or replace function public.avisar_push() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://<ref>.supabase.co/functions/v1/enviar-push',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-webhook-secret', '<secreto>'),
    body := jsonb_build_object(
      'type', tg_op, 'table', tg_table_name, 'schema', tg_table_schema,
      'record', to_jsonb(new),
      'old_record', case when tg_op = 'UPDATE' then to_jsonb(old) end)
  );
  return new;
end $$;

create trigger push_planes after insert on planes
  for each row execute function public.avisar_push();
create trigger push_respuestas after insert or update on respuestas
  for each row execute function public.avisar_push();
create trigger push_anulaciones after insert on anulaciones
  for each row execute function public.avisar_push();
