// src/pages/Calendario.tsx — ruta /calendario
// Vista semanal y diaria. Morado fuerte: planes a los que vas. Morado claro: el resto.
// v2: en gris, tus ocupaciones (viajes, clases…); opcionalmente, también las de todas.
// Toca un hueco libre para proponer un plan ese día y a esa hora.
import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
// FullCalendar 7: todo viene dentro de @fullcalendar/react (plugins, idioma y tema)
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/react/timegrid';
import interactionPlugin from '@fullcalendar/react/interaction';
import classicThemePlugin from '@fullcalendar/react/themes/classic';
import esLocale from '@fullcalendar/react/locales/es';
import type { EventInput, EventSourceFunc } from '@fullcalendar/react';
import '@fullcalendar/react/skeleton.css';
import '@fullcalendar/react/themes/classic/theme.css';
import '@fullcalendar/react/themes/classic/palette.css';
import { supabase } from '../lib/supabase';
import { usePerfiles } from '../lib/perfiles';
import { aInputLocal, franjaDeHora, ocupacionesEn, textoOcupada, useMiId, type Plan } from '../lib/planes';
import { C, btnSecundario, pagina } from '../lib/ui';

const GRIS = '#e6e4ea';
const GRIS_TEXTO = '#4a4552';

export default function Calendario() {
  const navigate = useNavigate();
  const miId = useMiId();
  const { porId } = usePerfiles();
  const [verTodas, setVerTodas] = useState(false);

  const eventos: EventSourceFunc = useCallback(async (info: { start: Date; end: Date }): Promise<EventInput[]> => {
    const [{ data: planes }, ocupaciones] = await Promise.all([
      supabase.from('planes').select('*')
        .neq('estado', 'anulado')
        .gte('inicio', info.start.toISOString()).lt('inicio', info.end.toISOString()),
      ocupacionesEn(info.start, info.end),
    ]);
    const lista = (planes ?? []) as Plan[];
    const ids = lista.map((p) => p.id);
    const { data: mias } = ids.length && miId
      ? await supabase.from('respuestas').select('plan_id').eq('usuaria_id', miId).eq('estado', 'acepta').in('plan_id', ids)
      : { data: [] as { plan_id: string }[] };
    const voy = new Set((mias ?? []).map((m) => m.plan_id));

    const evPlanes: EventInput[] = lista.map((p) => {
      const fin = p.fin ?? new Date(new Date(p.inicio).getTime() + 2 * 3_600_000).toISOString();
      const mio = voy.has(p.id);
      return {
        id: p.id,
        title: (p.estado === 'propuesto' ? '❓ ' : '') + p.titulo,
        start: p.inicio,
        end: fin,
        // FullCalendar 7 usa color + contrastColor (backgroundColor/textColor ya no existen)
        color: mio ? C.morado : '#d9b8cf',
        contrastColor: mio ? C.blanco : '#3d1631',
      };
    });

    const evOcupaciones: EventInput[] = ocupaciones
      .filter((o) => verTodas || o.usuaria_id === miId)
      .map((o, i) => ({
        id: `ocupacion-${o.ocupacion_id}-${i}`,
        title: o.usuaria_id === miId ? `🧳 ${o.titulo}` : `🧳 ${porId(o.usuaria_id)?.nombre ?? '¿?'}: ${textoOcupada(o)}`,
        start: o.inicio,
        end: o.fin,
        allDay: o.todo_el_dia,
        color: GRIS,
        contrastColor: GRIS_TEXTO,
        extendedProps: { ocupacion: true },
      }));

    return [...evOcupaciones, ...evPlanes];
  }, [miId, verTodas, porId]);

  return (
    <main style={{ ...pagina, maxWidth: 900 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link to="/ocupaciones" style={{ ...btnSecundario, textDecoration: 'none', padding: '8px 12px', fontSize: 14 }}>🧳 Mis ocupaciones</Link>
        <button onClick={() => setVerTodas((v) => !v)} aria-pressed={verTodas} style={{
          ...btnSecundario, padding: '8px 12px', fontSize: 14,
          background: verTodas ? C.moradoSuave : C.blanco, borderColor: verTodas ? C.morado : C.borde,
        }}>
          {verTodas ? '✓ ' : ''}Ver ocupaciones de todas
        </button>
      </div>

      <FullCalendar
        key={`${miId ?? 'sin-sesion'}-${verTodas}`}
        plugins={[timeGridPlugin, interactionPlugin, classicThemePlugin]}
        initialView="timeGridWeek"
        locale={esLocale}
        firstDay={1}
        headerToolbar={{ left: 'prev,next today', center: 'title', right: 'timeGridWeek,timeGridDay' }}
        titleFormat={{ day: 'numeric', month: 'short' }}
        allDaySlot
        slotMinTime="08:00:00"
        slotMaxTime="24:00:00"
        nowIndicator
        height="auto"
        events={eventos}
        eventClick={(info) => {
          if (info.event.extendedProps.ocupacion) navigate('/ocupaciones');
          else navigate(`/plan/${info.event.id}`);
        }}
        dateClick={(info) => {
          if (info.date < new Date() && !info.allDay) return;
          const local = aInputLocal(info.date);
          if (info.allDay) navigate(`/ocupaciones?fecha=${local.slice(0, 10)}`);
          else navigate(`/plan/nuevo?fecha=${local.slice(0, 10)}&franja=${franjaDeHora(local.slice(11, 16))}`);
        }}
      />
      <p style={{ margin: 0, fontSize: 13, color: C.suave }}>
        <span style={{ color: C.morado }}>■</span> vas · <span style={{ color: '#d9b8cf' }}>■</span> otros planes ·{' '}
        <span style={{ color: '#c9c5cf' }}>■</span> ocupaciones · ❓ aún en propuesta. Toca un hueco para proponer un plan,
        o la fila de "todo el día" para apuntar una ocupación.
      </p>
    </main>
  );
}
