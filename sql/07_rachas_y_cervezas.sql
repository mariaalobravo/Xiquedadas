-- 07_rachas_y_cervezas.sql — rachas, comodín, quedadas espontáneas, "Mis xiques",
-- pestaña del grupo y cervezas por faltas injustificadas.
-- Ejecutar DESPUÉS de 01–05.

------------------------------------------------------------------
-- 0) Ajustes en respuestas y planes
------------------------------------------------------------------

-- Cuándo se contestó por primera vez (para saber si fue antes de la fecha límite).
-- Cambiar la respuesta después no modifica esta fecha.
alter table respuestas add column creada_en timestamptz not null default now();

-- Quien crea un plan cuenta como que lo acepta.
create function public.creadora_acepta() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into respuestas (plan_id, usuaria_id, estado)
  values (new.id, new.creadora, 'acepta')
  on conflict do nothing;
  return new;
end $$;

create trigger plan_creado after insert on planes
for each row execute function public.creadora_acepta();

------------------------------------------------------------------
-- 1) Racha de respuesta + comodín (1 al mes)
------------------------------------------------------------------
create table rachas (
  usuaria_id uuid primary key references perfiles on delete cascade,
  actual int not null default 0,
  mejor int not null default 0,
  comodin_usado_mes date,              -- día 1 del mes en que se gastó el comodín
  updated_at timestamptz not null default now()
);

insert into rachas (usuaria_id) select id from perfiles on conflict do nothing;

create function public.crear_racha() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into rachas (usuaria_id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger perfil_creado after insert on perfiles
for each row execute function public.crear_racha();

alter table rachas enable row level security;
create policy "leer" on rachas for select to authenticated using (true);
-- Nadie la modifica desde la app: solo las funciones del servidor.

-- Se llama cuando se cierra un plan o una encuesta.
-- `respondieron` = quienes contestaron a tiempo.
-- Devuelve qué le ha pasado a cada una: suma | comodin | rota | nada
create function public.cerrar_evento_racha(respondieron uuid[])
returns table (out_usuaria uuid, out_resultado text)
language plpgsql security definer set search_path = public as $$
declare
  mes date := date_trunc('month', now() at time zone 'Europe/Madrid')::date;
  r record;
begin
  for r in select * from rachas for update loop
    out_usuaria := r.usuaria_id;
    if r.usuaria_id = any(respondieron) then
      update rachas set actual = actual + 1, mejor = greatest(mejor, actual + 1), updated_at = now()
        where rachas.usuaria_id = r.usuaria_id;
      out_resultado := 'suma';
    elsif r.actual = 0 then
      out_resultado := 'nada';                           -- no había racha que perder
    elsif r.comodin_usado_mes is distinct from mes then
      update rachas set comodin_usado_mes = mes, updated_at = now()
        where rachas.usuaria_id = r.usuaria_id;
      out_resultado := 'comodin';                        -- se gasta solo y la racha sigue
    else
      update rachas set actual = 0, updated_at = now()
        where rachas.usuaria_id = r.usuaria_id;
      out_resultado := 'rota';
    end if;
    return next;
  end loop;
end $$;

revoke execute on function public.cerrar_evento_racha(uuid[]) from public, anon, authenticated;

------------------------------------------------------------------
-- 2) Quedadas espontáneas ("Nos hemos visto ✓") — basta con que una las registre.
--    También sirven para poner el punto de partida: "nos vimos el 13 de julio".
------------------------------------------------------------------
create table quedadas (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  nota text,
  registrada_por uuid not null default auth.uid() references perfiles on delete cascade,
  created_at timestamptz not null default now()
);

create table quedada_participantes (
  quedada_id uuid references quedadas on delete cascade,
  usuaria_id uuid references perfiles on delete cascade,
  primary key (quedada_id, usuaria_id)
);

alter table quedadas enable row level security;
alter table quedada_participantes enable row level security;

create policy "leer" on quedadas for select to authenticated using (true);
create policy "registrar" on quedadas for insert to authenticated with check (registrada_por = auth.uid());
create policy "borrar la mía" on quedadas for delete to authenticated using (registrada_por = auth.uid());

create policy "leer" on quedada_participantes for select to authenticated using (true);
create policy "añadir a la mía" on quedada_participantes for insert to authenticated
  with check (exists (select 1 from quedadas q where q.id = quedada_id and q.registrada_por = auth.uid()));
create policy "quitar de la mía" on quedada_participantes for delete to authenticated
  using (exists (select 1 from quedadas q where q.id = quedada_id and q.registrada_por = auth.uid()));

------------------------------------------------------------------
-- 3) Asistencia: la marca la creadora del plan (supuesto, ver guía)
------------------------------------------------------------------
create policy "marcar asistencia" on asistencia for all to authenticated
  using (exists (select 1 from planes p where p.id = plan_id and p.creadora = auth.uid()))
  with check (exists (select 1 from planes p where p.id = plan_id and p.creadora = auth.uid()));

------------------------------------------------------------------
-- 4) Cervezas 🍺: falta injustificada → debes una a cada una de las que sí fueron
------------------------------------------------------------------
create table deudas (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references planes on delete cascade,
  deudora uuid not null references perfiles on delete cascade,
  acreedora uuid not null references perfiles on delete cascade,
  cervezas int not null default 1 check (cervezas > 0),
  creada_en timestamptz not null default now(),
  saldada_en timestamptz,
  unique (plan_id, deudora, acreedora)
);

alter table deudas enable row level security;
create policy "leer" on deudas for select to authenticated using (true);

-- Solo la que recibe la cerveza puede marcarla como saldada (y solo ese campo)
revoke update on deudas from authenticated;
grant update (saldada_en) on deudas to authenticated;
create policy "saldar" on deudas for update to authenticated
  using (acreedora = auth.uid()) with check (acreedora = auth.uid());

create function public.falta_a_cervezas() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Si se corrige y deja de ser injustificada, se borran las deudas sin saldar de ese plan
  if tg_op = 'UPDATE' and old.estado = 'injustificada' and new.estado <> 'injustificada' then
    delete from deudas
    where plan_id = new.plan_id and deudora = new.usuaria_id and saldada_en is null;
  end if;

  if new.estado = 'injustificada' and (tg_op = 'INSERT' or old.estado <> 'injustificada') then
    -- Una cerveza para cada una que aceptó y fue
    insert into deudas (plan_id, deudora, acreedora)
    select new.plan_id, new.usuaria_id, r.usuaria_id
    from respuestas r
    left join asistencia a on a.plan_id = r.plan_id and a.usuaria_id = r.usuaria_id
    where r.plan_id = new.plan_id
      and r.estado = 'acepta'
      and r.usuaria_id <> new.usuaria_id
      and coalesce(a.estado, 'asistio') = 'asistio'
    on conflict do nothing;

    -- Faltar sin justificar rompe la racha de respuesta
    update rachas set actual = 0, updated_at = now() where usuaria_id = new.usuaria_id;
  end if;
  return new;
end $$;

create trigger asistencia_marcada after insert or update on asistencia
for each row execute function public.falta_a_cervezas();

------------------------------------------------------------------
-- 5) Vistas
------------------------------------------------------------------

-- Todas las veces que dos personas han coincidido (planes pasados + quedadas)
create view encuentros with (security_invoker = true) as
select a.usuaria_id as yo, b.usuaria_id as otra,
       (p.inicio at time zone 'Europe/Madrid')::date as fecha
from planes p
join respuestas a on a.plan_id = p.id and a.estado = 'acepta'
join respuestas b on b.plan_id = p.id and b.estado = 'acepta' and b.usuaria_id <> a.usuaria_id
left join asistencia aa on aa.plan_id = p.id and aa.usuaria_id = a.usuaria_id
left join asistencia ab on ab.plan_id = p.id and ab.usuaria_id = b.usuaria_id
where p.inicio < now()
  and p.estado <> 'anulado'
  and coalesce(aa.estado, 'asistio') = 'asistio'
  and coalesce(ab.estado, 'asistio') = 'asistio'
union all
select a.usuaria_id, b.usuaria_id, q.fecha
from quedadas q
join quedada_participantes a on a.quedada_id = q.id
join quedada_participantes b on b.quedada_id = q.id and b.usuaria_id <> a.usuaria_id;

-- "Mis xiques": SOLO los datos de quien la consulta
create view mis_xiques with (security_invoker = true) as
select pf.id as otra,
       pf.nombre,
       max(e.fecha) as ultima_vez,
       count(e.fecha) filter (where e.fecha >= date_trunc('year', now())::date) as veces_este_ano,
       coalesce(array_agg(distinct date_trunc('week', e.fecha)::date)
                filter (where e.fecha is not null), '{}') as semanas
from perfiles pf
left join encuentros e on e.otra = pf.id and e.yo = auth.uid()
where pf.id <> auth.uid()
group by pf.id, pf.nombre;

-- Mis cervezas pendientes (las que debo y las que me deben)
create view mis_cervezas with (security_invoker = true) as
select d.id, d.deudora, d.acreedora, d.cervezas, d.creada_en,
       p.titulo, (p.inicio at time zone 'Europe/Madrid')::date as fecha_plan,
       case when d.deudora = auth.uid() then 'debo' else 'me_deben' end as sentido
from deudas d
left join planes p on p.id = d.plan_id
where d.saldada_en is null
  and auth.uid() in (d.deudora, d.acreedora);

-- Pestaña del grupo: cuánto hace que cada una no va a un plan de la app
create view resumen_grupo with (security_invoker = true) as
with idas as (
  select r.usuaria_id, (p.inicio at time zone 'Europe/Madrid')::date as fecha
  from planes p
  join respuestas r on r.plan_id = p.id and r.estado = 'acepta'
  left join asistencia a on a.plan_id = p.id and a.usuaria_id = r.usuaria_id
  where p.inicio < now() and p.estado <> 'anulado'
    and coalesce(a.estado, 'asistio') = 'asistio'
)
select pf.id, pf.nombre,
       max(i.fecha) as ultimo_plan,
       count(i.fecha) filter (where i.fecha >= date_trunc('year', now())::date) as planes_este_ano,
       coalesce(ra.actual, 0) as racha,
       coalesce(ra.mejor, 0) as mejor_racha,
       ra.comodin_usado_mes is distinct from date_trunc('month', now() at time zone 'Europe/Madrid')::date
         as comodin_disponible
from perfiles pf
left join idas i on i.usuaria_id = pf.id
left join rachas ra on ra.usuaria_id = pf.id
group by pf.id, pf.nombre, ra.actual, ra.mejor, ra.comodin_usado_mes;
