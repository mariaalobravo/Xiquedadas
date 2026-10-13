// src/pages/Calendario.tsx — ruta /calendario
// Vista semanal y diaria. Morado fuerte: planes a los que vas. Morado claro: el resto.
// Toca un hueco libre para proponer un plan ese día y a esa hora.
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { aInputLocal, franjaDeHora, useMiId, type Plan } from '../lib/planes';
import { C, pagina } from '../lib/ui';

export default function Calendario() {
  const navigate = useNavigate();
  const miId = useMiId();

  const eventos: EventSourceFunc = useCallback(async (info: { start: Date; end: Date }): Promise<EventInput[]> => {
    const { data: planes } = await supabase.from('planes').select('*')
      .neq('estado', 'anulado')
      .gte('inicio', info.start.toISOString()).lt('inicio', info.end.toISOString());
    const lista = (planes ?? []) as Plan[];
    const ids = lista.map((p) => p.id);
    const { data: mias } = ids.length && miId
      ? await supabase.from('respuestas').select('plan_id').eq('usuaria_id', miId).eq('estado', 'acepta').in('plan_id', ids)
      : { data: [] as { plan_id: string }[] };
    const voy = new Set((mias ?? []).map((m) => m.plan_id));

    return lista.map((p) => {
      const fin = p.fin ?? new Date(new Date(p.inicio).getTime() + 2 * 3_600_000).toISOString();
      const mio = voy.has(p.id);
      return {
        id: p.id,
        title: (p.estado === 'propuesto' ? '❓ ' : '') + p.titulo,
        start: p.inicio,
        end: fin,
        backgroundColor: mio ? C.morado : '#d9b8cf',
        borderColor: mio ? C.morado : '#c9a3bd',
        textColor: mio ? C.blanco : '#3d1631',
      };
    });
  }, [miId]);

  return (
    <main style={{ ...pagina, maxWidth: 900 }}>
      <FullCalendar
        key={miId ?? 'sin-sesion'}
        plugins={[timeGridPlugin, interactionPlugin, classicThemePlugin]}
        initialView="timeGridWeek"
        locale={esLocale}
        firstDay={1}
        headerToolbar={{ left: 'prev,next today', center: 'title', right: 'timeGridWeek,timeGridDay' }}
        titleFormat={{ day: 'numeric', month: 'short' }}
        allDaySlot={false}
        slotMinTime="08:00:00"
        slotMaxTime="24:00:00"
        nowIndicator
        height="auto"
        events={eventos}
        eventClick={(info) => navigate(`/plan/${info.event.id}`)}
        dateClick={(info) => {
          if (info.date < new Date()) return;
          const local = aInputLocal(info.date);
          navigate(`/plan/nuevo?fecha=${local.slice(0, 10)}&franja=${franjaDeHora(local.slice(11, 16))}`);
        }}
      />
      <p style={{ margin: 0, fontSize: 13, color: C.suave }}>
        <span style={{ color: C.morado }}>■</span> vas · <span style={{ color: '#d9b8cf' }}>■</span> otros planes · ❓ aún en propuesta
      </p>
    </main>
  );
}
