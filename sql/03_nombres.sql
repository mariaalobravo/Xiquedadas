-- 03_nombres.sql — asignar nombres a los perfiles (después de invitar a cada amiga)
-- Los nombres deben coincidir EXACTAMENTE con los de Entrada.tsx (tildes incluidas).
-- [FALTA] poner el correo real de cada una.

update perfiles p set nombre = v.nombre
from (values
  ('irene@...',    'Irene'),
  ('maria@...',    'María'),
  ('carmen@...',   'Carmen'),
  ('cristina@...', 'Cristina'),
  ('sabela@...',   'Sabela'),
  ('heli@...',     'Helí'),
  ('sara@...',     'Sara')
) as v(email, nombre)
join auth.users u on u.email = v.email
where p.id = u.id;

alter table perfiles add constraint nombre_unico unique (nombre);
