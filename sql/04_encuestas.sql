-- 04_encuestas.sql — encuesta semanal de disponibilidad

-- Una encuesta por semana
create table encuestas (
  id uuid primary key default gen_random_uuid(),
  semana_inicio date not null unique,          -- lunes de la semana que se encuesta
  estado text not null default 'abierta' check (estado in ('abierta','cerrada')),
  recordatorio_dom14 boolean not null default false,  -- domingo 14:00
  recordatorio_dom boolean not null default false,    -- domingo 23:00
  recordatorio_lun boolean not null default false,    -- lunes 14:00
  created_at timestamptz not null default now()
);

-- Franjas (mañana / tarde / noche) de cada día en que cada una puede
create table disponibilidad (
  encuesta_id uuid references encuestas on delete cascade,
  usuaria_id uuid default auth.uid() references perfiles,
  dia date not null,
  franja text not null check (franja in ('mañana','tarde','noche')),
  primary key (encuesta_id, usuaria_id, dia, franja)
);

-- Marca de "ya he respondido" (aunque no pueda ningún día)
create table respuestas_encuesta (
  encuesta_id uuid references encuestas on delete cascade,
  usuaria_id uuid default auth.uid() references perfiles,
  comentario text,
  respondida_en timestamptz not null default now(),
  primary key (encuesta_id, usuaria_id)
);

-- Resumen: cuántas pueden cada día/franja y quiénes
create view resumen_encuesta with (security_invoker = true) as
select d.encuesta_id, d.dia, d.franja,
       count(*) as total,
       array_agg(p.nombre order by p.nombre) as quienes
from disponibilidad d join perfiles p on p.id = d.usuaria_id
group by d.encuesta_id, d.dia, d.franja;

alter table encuestas enable row level security;
alter table disponibilidad enable row level security;
alter table respuestas_encuesta enable row level security;

create policy "leer" on encuestas for select to authenticated using (true);
create policy "leer" on disponibilidad for select to authenticated using (true);
create policy "leer" on respuestas_encuesta for select to authenticated using (true);

create policy "mi disponibilidad" on disponibilidad for all to authenticated
  using (usuaria_id = auth.uid()
         and exists (select 1 from encuestas e where e.id = encuesta_id and e.estado = 'abierta'))
  with check (usuaria_id = auth.uid()
         and exists (select 1 from encuestas e where e.id = encuesta_id and e.estado = 'abierta'));

create policy "mi respuesta" on respuestas_encuesta for all to authenticated
  using (usuaria_id = auth.uid()) with check (usuaria_id = auth.uid());

-- Nadie crea encuestas desde la app: las crea la Edge Function `encuestas`.
