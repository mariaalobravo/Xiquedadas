// src/pages/Planes.tsx — ruta / (pantalla principal)
// Tres apartados: Por responder (propuestas), Próximos (quién va a cada plan) y Pasados (marcar asistencia).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useMiId, type Plan, type Respuesta } from '../lib/planes';
import { C, btnPrimario, pagina } from '../lib/ui';
import TarjetaPlan from '../components/TarjetaPlan';

type Apartado = 'responder' | 'proximos' | 'pasados';
const DIAS_PASADOS = 14;

export default function Planes() {
  const miId = useMiId();
  const [apartado, setApartado] = useState<Apartado>('responder');
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [respuestas, setRespuestas] = useState<Respuesta[]>([]);
  const [asistencia, setAsistencia] = useState<{ plan_id: string; usuaria_id: string }[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const desde = new Date(Date.now() - DIAS_PASADOS * 86_400_000).toISOString();
    const { data: p, error: e } = await supabase.from('planes').select('*')
      .neq('estado', 'anulado').gte('inicio', desde).order('inicio');
    if (e) { setError('No se han podido cargar los planes.'); setCargando(false); return; }
    const ids = (p ?? []).map((x) => x.id);
    const [r, a] = ids.length
      ? await Promise.all([
          supabase.from('respuestas').select('plan_id, usuaria_id, estado').in('plan_id', ids),
          supabase.from('asistencia').select('plan_id, usuaria_id').in('plan_id', ids),
        ])
      : [{ data: [] }, { data: [] }];
    setPlanes((p ?? []) as Plan[]);
    setRespuestas((r.data ?? []) as Respuesta[]);
    setAsistencia((a.data ?? []) as { plan_id: string; usuaria_id: string }[]);
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Si otra crea un plan o responde, se actualiza solo
  useEffect(() => {
    const canal = supabase.channel('planes-lista')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planes' }, () => cargar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'respuestas' }, () => cargar())
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [cargar]);

  const ahora = new Date();
  const respDe = (id: string) => respuestas.filter((r) => r.plan_id === id);
  const voy = (id: string) => respuestas.some((r) => r.plan_id === id && r.usuaria_id === miId && r.estado === 'acepta');

  const listas = useMemo(() => {
    const porResponder = planes
      .filter((p) => p.estado === 'propuesto' && new Date(p.fecha_limite) > ahora)
      .sort((a, b) => a.fecha_limite.localeCompare(b.fecha_limite));
    const proximos = planes.filter((p) => new Date(p.inicio) > ahora && p.estado !== 'cerrado');
    const pasados = planes.filter((p) => new Date(p.inicio) <= ahora && p.estado === 'confirmado').reverse();
    return { porResponder, proximos, pasados };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planes, respuestas]);

  const sinContestar = listas.porResponder.filter((p) => !respuestas.some((r) => r.plan_id === p.id && r.usuaria_id === miId)).length;
  const faltaAsistencia = (p: Plan) => {
    const aceptan = respDe(p.id).filter((r) => r.estado === 'acepta').length;
    const marcadas = asistencia.filter((a) => a.plan_id === p.id).length;
    return voy(p.id) && marcadas < aceptan;
  };

  const lista = apartado === 'responder' ? listas.porResponder : apartado === 'proximos' ? listas.proximos : listas.pasados;
  const VACIO: Record<Apartado, string> = {
    responder: 'No hay propuestas abiertas. ¡Propón tú algo!',
    proximos: 'No hay planes a la vista.',
    pasados: `No hay planes en los últimos ${DIAS_PASADOS} días.`,
  };

  const pestana = (id: Apartado, texto: string, n?: number) => (
    <button onClick={() => setApartado(id)} aria-pressed={apartado === id} style={{
      flex: 1, padding: '8px 4px', borderRadius: 10, border: 'none', font: 'inherit', fontSize: 14, cursor: 'pointer',
      background: apartado === id ? C.blanco : 'transparent', fontWeight: apartado === id ? 700 : 500,
      boxShadow: apartado === id ? '0 1px 3px rgba(0,0,0,.12)' : 'none',
    }}>
      {texto}{!!n && <span style={{ marginLeft: 6, background: C.morado, color: C.blanco, borderRadius: 99, padding: '0 7px', fontSize: 12 }}>{n}</span>}
    </button>
  );

  return (
    <main style={pagina}>
      <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: '#ececf1' }}>
        {pestana('responder', 'Por responder', sinContestar)}
        {pestana('proximos', 'Próximos')}
        {pestana('pasados', 'Pasados', listas.pasados.filter(faltaAsistencia).length)}
      </div>

      {error && <p style={{ margin: 0, color: C.error }}>{error}</p>}
      {!cargando && lista.length === 0 && <p style={{ margin: 0, color: C.suave, textAlign: 'center', padding: 24 }}>{VACIO[apartado]}</p>}

      {lista.map((p) => (
        <TarjetaPlan key={p.id} plan={p} respuestas={respDe(p.id)} miId={miId} onCambio={cargar}
          aviso={apartado === 'pasados' && faltaAsistencia(p) ? 'Falta marcar quién fue: entra en el plan.' : undefined} />
      ))}

      <Link to="/plan/nuevo" style={{
        ...btnPrimario, position: 'fixed', right: 16, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)',
        textDecoration: 'none', borderRadius: 99, boxShadow: '0 4px 12px rgba(123,47,99,.35)', zIndex: 5,
      }}>
        + Nuevo plan
      </Link>
    </main>
  );
}
