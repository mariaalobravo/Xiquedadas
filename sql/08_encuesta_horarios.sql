-- 08_encuesta_horarios.sql — SOLO si ya ejecutaste 04_encuestas.sql antes del cambio de horarios.
-- Añade la marca del recordatorio del domingo a las 14:00.
alter table encuestas add column if not exists recordatorio_dom14 boolean not null default false;
