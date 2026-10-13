-- 02_permisos.sql — Row Level Security
-- Regla base: toda usuaria con sesión lee todo y solo modifica lo suyo.

alter table perfiles enable row level security;
alter table planes enable row level security;
alter table respuestas enable row level security;
alter table anulaciones enable row level security;
alter table asistencia enable row level security;
alter table normas enable row level security;
alter table suscripciones_push enable row level security;

-- Lectura para todas las del grupo
create policy "leer" on perfiles for select to authenticated using (true);
create policy "leer" on planes for select to authenticated using (true);
create policy "leer" on respuestas for select to authenticated using (true);
create policy "leer" on anulaciones for select to authenticated using (true);
create policy "leer" on asistencia for select to authenticated using (true);
create policy "leer" on normas for select to authenticated using (true);

-- Escritura solo de lo propio
create policy "crear plan" on planes for insert to authenticated with check (creadora = auth.uid());
create policy "editar plan" on planes for update to authenticated using (creadora = auth.uid());
create policy "responder" on respuestas for all to authenticated
  using (usuaria_id = auth.uid()) with check (usuaria_id = auth.uid());
create policy "pedir anulación" on anulaciones for insert to authenticated with check (solicitante = auth.uid());
create policy "mis suscripciones" on suscripciones_push for all to authenticated
  using (usuaria_id = auth.uid()) with check (usuaria_id = auth.uid());

-- [FALTA] Políticas para aprobar anulaciones, marcar asistencia y editar normas:
-- decidir con el grupo quién puede (la creadora del plan, votación…).
