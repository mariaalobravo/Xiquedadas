-- 09_planes_anulaciones_normas.sql — lo que necesitan las pantallas de planes, detalle y normas.
-- Ejecutar DESPUÉS de 01–08 y del SQL de avisos (avisar_push) de la fase 5.
--
-- Decisiones del grupo:
--  · Anulación = dos cosas: "borrarme yo" de un plan que acepté, o "cancelar el plan entero".
--  · La aprueba la creadora del plan. Si la pide ella misma, se aplica directamente.
--  · La asistencia la puede marcar cualquiera que fue (aceptó el plan), cuando ya ha empezado.
--  · Las normas las puede editar cualquiera.

------------------------------------------------------------------
-- 1) Lugar del plan
------------------------------------------------------------------
alter table planes add column if not exists lugar text;

------------------------------------------------------------------
-- 2) Respuestas: libres hasta la fecha límite; después solo se puede APUNTAR (no borrarse).
--    Para borrarse después de la fecha límite hay que pedir anulación.
------------------------------------------------------------------
drop policy if exists "responder" on respuestas;

create policy "contestar" on respuestas for insert to authenticated
  with check (
    respuestas.usuaria_id = auth.uid()
    and exists (select 1 from planes p
                where p.id = respuestas.plan_id
                  and p.estado in ('propuesto', 'confirmado')
                  and p.inicio > now()
                  and (now() < p.fecha_limite or respuestas.estado = 'acepta'))
  );

create policy "cambiar respuesta" on respuestas for update to authenticated
  using (respuestas.usuaria_id = auth.uid())
  with check (
    respuestas.usuaria_id = auth.uid()
    and exists (select 1 from planes p
                where p.id = respuestas.plan_id
                  and p.estado in ('propuesto', 'confirmado')
                  and p.inicio > now()
                  and (now() < p.fecha_limite or respuestas.estado = 'acepta'))
  );

------------------------------------------------------------------
-- 3) Anulaciones: tipo, aprobación por la creadora y efectos
------------------------------------------------------------------
alter table anulaciones add column if not exists tipo text not null default 'cancelar'
  check (tipo in ('borrarme', 'cancelar'));
alter table anulaciones add column if not exists resuelta_en timestamptz;

-- Antes de guardar: autoaprobar si la pide la creadora; no reabrir las ya resueltas
create function public.anulacion_antes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and old.estado <> 'pendiente' then
    new.estado := old.estado;
    new.resuelta_en := old.resuelta_en;
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.estado := case
      when exists (select 1 from planes p where p.id = new.plan_id and p.creadora = new.solicitante)
      then 'aprobada' else 'pendiente' end;
  end if;

  if new.estado <> 'pendiente' then
    new.resuelta_en := now();
  end if;
  return new;
end $$;

create trigger anulacion_antes before insert or update on anulaciones
for each row execute function public.anulacion_antes();

-- Después de aprobar: aplicar el efecto
create function public.anulacion_aplicar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.estado = 'aprobada' and (tg_op = 'INSERT' or old.estado <> 'aprobada') then
    if new.tipo = 'borrarme' then
      insert into respuestas (plan_id, usuaria_id, estado)
      values (new.plan_id, new.solicitante, 'rechaza')
      on conflict (plan_id, usuaria_id) do update set estado = 'rechaza', updated_at = now();
    else
      update planes set estado = 'anulado' where id = new.plan_id;
    end if;
  end if;
  return new;
end $$;

create trigger anulacion_aplicar after insert or update on anulaciones
for each row execute function public.anulacion_aplicar();

-- Solo la creadora del plan resuelve (y solo puede tocar el estado)
revoke update on anulaciones from authenticated;
grant update (estado) on anulaciones to authenticated;
create policy "resolver anulación" on anulaciones for update to authenticated
  using (exists (select 1 from planes p where p.id = anulaciones.plan_id and p.creadora = auth.uid()))
  with check (exists (select 1 from planes p where p.id = anulaciones.plan_id and p.creadora = auth.uid()));

-- Avisos también cuando se aprueba o rechaza
drop trigger if exists push_anulaciones on anulaciones;
create trigger push_anulaciones after insert or update on anulaciones
  for each row execute function public.avisar_push();

------------------------------------------------------------------
-- 4) Asistencia: la marca cualquiera que fue, una vez empezado el plan
------------------------------------------------------------------
drop policy if exists "marcar asistencia" on asistencia;
create policy "marcar asistencia" on asistencia for all to authenticated
  using (exists (
    select 1 from planes p
    join respuestas r on r.plan_id = p.id
    where p.id = asistencia.plan_id and p.inicio < now()
      and r.usuaria_id = auth.uid() and r.estado = 'acepta'))
  with check (exists (
    select 1 from planes p
    join respuestas r on r.plan_id = p.id
    where p.id = asistencia.plan_id and p.inicio < now()
      and r.usuaria_id = auth.uid() and r.estado = 'acepta'));

------------------------------------------------------------------
-- 5) Normas: las edita cualquiera; se guarda quién y cuándo
------------------------------------------------------------------
alter table normas add column if not exists actualizada_por uuid references perfiles default auth.uid();
alter table normas add column if not exists actualizada_en timestamptz not null default now();

create function public.norma_editada() returns trigger
language plpgsql as $$
begin
  new.actualizada_por := coalesce(auth.uid(), new.actualizada_por);
  new.actualizada_en := now();
  return new;
end $$;

create trigger norma_editada before update on normas
for each row execute function public.norma_editada();

create policy "editar normas" on normas for all to authenticated using (true) with check (true);

-- Normas iniciales (solo si la tabla está vacía). Se pueden cambiar desde la app.
insert into normas (texto, orden)
select * from (values
  ('Si faltas a un plan sin justificar, debes una cerveza 🍺 a cada una de las que fueron.', 1),
  ('Si aceptaste un plan y ya no puedes ir, pide borrarte desde el plan antes de que empiece: así no cuenta como falta.', 2),
  ('Contestar a los planes y a la encuesta del domingo suma racha 🔥. Tienes un comodín 🧊 al mes.', 3)
) as v(texto, orden)
where not exists (select 1 from normas);
