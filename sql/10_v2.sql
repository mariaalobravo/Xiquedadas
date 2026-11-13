-- 10_v2.sql — Xiquedadas v2
-- Ejecutar una sola vez en el SQL Editor, DESPUÉS de todo lo de la v1 (01–09).
--   1) Encuesta que se cierra día a día
--   2) Motivo opcional al decir "no puedo"
--   3) Ocupaciones (viajes, clases…), privadas opcionales y repetibles cada semana
--   4) Fotos de cada quedada (máx. 3) y álbum
--   5) Hora de llegada de cada una

------------------------------------------------------------------
-- 1) ENCUESTA DÍA A DÍA
--    · Cada día se puede marcar mientras no haya pasado (hora de Madrid).
--    · La encuesta sigue abierta toda la semana y se cierra al acabar el domingo.
--    · Para la racha cuenta haber contestado antes de que acabe el domingo de apertura.
------------------------------------------------------------------
alter table encuestas add column if not exists racha_procesada boolean not null default false;
alter table respuestas_encuesta add column if not exists creada_en timestamptz not null default now();

drop policy if exists "mi disponibilidad" on disponibilidad;
create policy "mi disponibilidad" on disponibilidad for all to authenticated
  using (
    disponibilidad.usuaria_id = auth.uid()
    and disponibilidad.dia >= (now() at time zone 'Europe/Madrid')::date
    and exists (select 1 from encuestas e where e.id = disponibilidad.encuesta_id and e.estado = 'abierta'))
  with check (
    disponibilidad.usuaria_id = auth.uid()
    and disponibilidad.dia >= (now() at time zone 'Europe/Madrid')::date
    and exists (select 1 from encuestas e where e.id = disponibilidad.encuesta_id and e.estado = 'abierta'));

-- Las encuestas que ya se habían cerrado el lunes con la v1 se reabren si su semana no ha acabado
update encuestas set estado = 'abierta'
where estado = 'cerrada' and semana_inicio + 6 >= (now() at time zone 'Europe/Madrid')::date;

------------------------------------------------------------------
-- 2) MOTIVO OPCIONAL AL DECIR "NO PUEDO"
------------------------------------------------------------------
alter table respuestas add column if not exists motivo text
  check (motivo is null or char_length(motivo) <= 140);

------------------------------------------------------------------
-- 5) HORA DE LLEGADA (null = a la hora del plan)
------------------------------------------------------------------
alter table respuestas add column if not exists llegada timestamptz;

------------------------------------------------------------------
-- 3) OCUPACIONES
--    Cada una solo ve y edita las suyas en la tabla.
--    Las demás las ven a través de ocupaciones_en(), que oculta el motivo si es privada.
------------------------------------------------------------------
create table if not exists ocupaciones (
  id uuid primary key default gen_random_uuid(),
  usuaria_id uuid not null default auth.uid() references perfiles on delete cascade,
  titulo text not null check (char_length(titulo) between 1 and 80),
  inicio timestamptz not null,
  fin timestamptz not null,
  todo_el_dia boolean not null default false,
  privada boolean not null default false,
  repite_hasta date,                       -- null = no se repite; si no, cada semana hasta esa fecha (incluida)
  created_at timestamptz not null default now(),
  check (fin > inicio)
);

alter table ocupaciones enable row level security;
create policy "mis ocupaciones" on ocupaciones for all to authenticated
  using (usuaria_id = auth.uid()) with check (usuaria_id = auth.uid());

-- Todas las ocupaciones (con sus repeticiones semanales) que se solapan con [desde, hasta).
-- Las repeticiones se calculan en hora de Madrid, así una clase a las 17:00 sigue a las 17:00 tras el cambio de hora.
create or replace function public.ocupaciones_en(desde timestamptz, hasta timestamptz)
returns table (
  ocupacion_id uuid, usuaria_id uuid, titulo text, privada boolean,
  todo_el_dia boolean, inicio timestamptz, fin timestamptz
)
language sql stable security definer set search_path = public as $$
  select o.id, o.usuaria_id,
         case when o.privada and o.usuaria_id is distinct from auth.uid() then null else o.titulo end,
         o.privada, o.todo_el_dia,
         ((o.inicio at time zone 'Europe/Madrid') + make_interval(days => 7 * n)) at time zone 'Europe/Madrid',
         ((o.fin    at time zone 'Europe/Madrid') + make_interval(days => 7 * n)) at time zone 'Europe/Madrid'
  from ocupaciones o
  cross join lateral generate_series(
    0,
    case when o.repite_hasta is null then 0
         else greatest(0, (o.repite_hasta - (o.inicio at time zone 'Europe/Madrid')::date) / 7) end
  ) as n
  where auth.uid() is not null
    and ((o.inicio at time zone 'Europe/Madrid') + make_interval(days => 7 * n)) at time zone 'Europe/Madrid' < hasta
    and ((o.fin    at time zone 'Europe/Madrid') + make_interval(days => 7 * n)) at time zone 'Europe/Madrid' > desde
$$;

revoke execute on function public.ocupaciones_en(timestamptz, timestamptz) from public, anon;
grant execute on function public.ocupaciones_en(timestamptz, timestamptz) to authenticated;

------------------------------------------------------------------
-- 4) FOTOS (máx. 3 por plan o por quedada espontánea)
------------------------------------------------------------------
create table if not exists fotos (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references planes on delete cascade,
  quedada_id uuid references quedadas on delete cascade,
  autora uuid not null default auth.uid() references perfiles on delete cascade,
  path text not null unique,
  created_at timestamptz not null default now(),
  check ((plan_id is null) <> (quedada_id is null))   -- o de un plan o de una quedada
);

alter table fotos enable row level security;
create policy "ver fotos" on fotos for select to authenticated using (true);

-- Sube quien fue: aceptó el plan (ya empezado y no cancelado) o participó en la quedada
create policy "subir foto" on fotos for insert to authenticated
  with check (
    fotos.autora = auth.uid()
    and (
      (fotos.plan_id is not null and exists (
        select 1 from planes p join respuestas r on r.plan_id = p.id
        where p.id = fotos.plan_id and p.inicio < now() and p.estado <> 'anulado'
          and r.usuaria_id = auth.uid() and r.estado = 'acepta'))
      or
      (fotos.quedada_id is not null and exists (
        select 1 from quedada_participantes qp
        where qp.quedada_id = fotos.quedada_id and qp.usuaria_id = auth.uid()))
    ));

create policy "borrar mi foto" on fotos for delete to authenticated using (fotos.autora = auth.uid());

-- Límite de 3 fotos por plan / quedada
create or replace function public.max_tres_fotos() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext(coalesce(new.plan_id, new.quedada_id)::text));
  if (select count(*) from fotos
      where (new.plan_id is not null and plan_id = new.plan_id)
         or (new.quedada_id is not null and quedada_id = new.quedada_id)) >= 3 then
    raise exception 'Esta quedada ya tiene 3 fotos' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists fotos_max_tres on fotos;
create trigger fotos_max_tres before insert on fotos
for each row execute function public.max_tres_fotos();

-- Bucket privado para las fotos (cada una sube a su carpeta <su id>/…)
insert into storage.buckets (id, name, public) values ('fotos', 'fotos', false)
on conflict (id) do nothing;

create policy "ver fotos quedadas" on storage.objects for select to authenticated
  using (bucket_id = 'fotos');
create policy "subir fotos quedadas" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "borrar fotos quedadas" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Álbum: planes pasados (no cancelados) y quedadas espontáneas, con su número de fotos y portada
create or replace view album with (security_invoker = true) as
select 'plan'::text as tipo, p.id, p.titulo, (p.inicio at time zone 'Europe/Madrid')::date as fecha,
       (select count(*) from fotos f where f.plan_id = p.id) as n_fotos,
       (select f.path from fotos f where f.plan_id = p.id order by f.created_at limit 1) as portada
from planes p
where p.inicio < now() and p.estado in ('confirmado', 'propuesto')
union all
select 'quedada', q.id, coalesce(nullif(q.nota, ''), 'Quedada'), q.fecha,
       (select count(*) from fotos f where f.quedada_id = q.id),
       (select f.path from fotos f where f.quedada_id = q.id order by f.created_at limit 1)
from quedadas q;
