-- 01_esquema.sql — tablas base, vistas y trigger de perfiles
-- Pegar en Supabase → SQL Editor

-- Perfiles (uno por usuaria, se crea solo al registrarse)
create table perfiles (
  id uuid primary key references auth.users on delete cascade,
  nombre text not null
);

create function public.crear_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into perfiles (id, nombre)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email,'@',1)));
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users for each row execute function public.crear_perfil();

-- Planes
create table planes (
  id uuid primary key default gen_random_uuid(),
  creadora uuid not null default auth.uid() references perfiles,
  titulo text not null,
  descripcion text,
  inicio timestamptz not null,
  fin timestamptz,
  fecha_limite timestamptz not null,
  estado text not null default 'propuesto'
    check (estado in ('propuesto','confirmado','cerrado','anulado')),
  recordatorio_enviado boolean not null default false,
  created_at timestamptz not null default now(),
  check (fecha_limite <= inicio)
);

-- Quién acepta / rechaza
create table respuestas (
  plan_id uuid references planes on delete cascade,
  usuaria_id uuid default auth.uid() references perfiles,
  estado text not null check (estado in ('acepta','rechaza')),
  updated_at timestamptz not null default now(),
  primary key (plan_id, usuaria_id)
);

-- Peticiones de anulación
create table anulaciones (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references planes on delete cascade,
  solicitante uuid not null default auth.uid() references perfiles,
  motivo text not null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente','aprobada','rechazada')),
  created_at timestamptz not null default now()
);

-- Asistencia (para las consecuencias)
create table asistencia (
  plan_id uuid references planes on delete cascade,
  usuaria_id uuid references perfiles,
  estado text not null check (estado in ('asistio','justificada','injustificada')),
  primary key (plan_id, usuaria_id)
);

-- Normas / consecuencias acordadas
create table normas (
  id serial primary key,
  texto text not null,
  orden int not null default 0
);

-- Suscripciones push (una por dispositivo)
create table suscripciones_push (
  id uuid primary key default gen_random_uuid(),
  usuaria_id uuid not null default auth.uid() references perfiles on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- Vista "planes aceptados y por quién"
create view planes_aceptados with (security_invoker = true) as
select p.*, array_agg(pf.nombre order by pf.nombre) as aceptadas
from planes p
join respuestas r on r.plan_id = p.id and r.estado = 'acepta'
join perfiles pf on pf.id = r.usuaria_id
group by p.id;

-- Faltas injustificadas por persona
create view faltas with (security_invoker = true) as
select usuaria_id, count(*) as injustificadas
from asistencia where estado = 'injustificada'
group by usuaria_id;
