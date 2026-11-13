// src/pages/Ocupaciones.tsx — ruta /ocupaciones (v2)
// Tus viajes, clases, trabajo… Si coinciden con un plan, las demás verán que no puedes y por qué
// (o solo "ocupada" si la marcas como privada). Se pueden repetir cada semana.
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { cap, fmtHora, useMiId } from '../lib/planes';
import { hoyISO } from '../lib/rachas';
import { C, btnPrimario, btnSecundario, campo, etiqueta, pagina, tarjeta } from '../lib/ui';

type Ocupacion = {
  id: string; titulo: string; inicio: string; fin: string;
  todo_el_dia: boolean; privada: boolean; repite_hasta: string | null;
};

const TZ = 'Europe/Madrid';
const fmtDia = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ });
const fmtFecha = (yyyymmdd: string) => new Date(yyyymmdd + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
const diaSemana = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { weekday: 'long', timeZone: TZ });

function describir(o: Ocupacion) {
  if (o.todo_el_dia) {
    const ultimo = new Date(new Date(o.fin).getTime() - 1);
    const mismoDia = fmtDia(o.inicio) === fmtDia(ultimo.toISOString());
    return mismoDia ? `${fmtDia(o.inicio)}, todo el día` : `Del ${fmtDia(o.inicio)} al ${fmtDia(ultimo.toISOString())}`;
  }
  if (o.repite_hasta) return `Cada ${diaSemana(o.inicio)} de ${fmtHora(o.inicio)} a ${fmtHora(o.fin)}, hasta el ${fmtFecha(o.repite_hasta)}`;
  return `${fmtDia(o.inicio)}, de ${fmtHora(o.inicio)} a ${fmtHora(o.fin)}`;
}

export default function Ocupaciones() {
  const miId = useMiId();
  const [params] = useSearchParams();
  const [lista, setLista] = useState<Ocupacion[]>([]);
  const [borrando, setBorrando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Formulario
  const [titulo, setTitulo] = useState('');
  const [todoElDia, setTodoElDia] = useState(true);
  const [desde, setDesde] = useState(params.get('fecha') ?? hoyISO());
  const [hasta, setHasta] = useState(params.get('fecha') ?? hoyISO());
  const [horaIni, setHoraIni] = useState('17:00');
  const [horaFin, setHoraFin] = useState('19:00');
  const [repetir, setRepetir] = useState(false);
  const [repiteHasta, setRepiteHasta] = useState('');
  const [privada, setPrivada] = useState(false);

  const cargar = useCallback(async () => {
    if (!miId) return;
    const hoy = new Date(hoyISO() + 'T00:00:00').toISOString();
    const { data } = await supabase.from('ocupaciones').select('*')
      .eq('usuaria_id', miId)
      .or(`fin.gte."${hoy}",repite_hasta.gte.${hoyISO()}`)
      .order('inicio');
    setLista((data ?? []) as Ocupacion[]);
  }, [miId]);
  useEffect(() => { cargar(); }, [cargar]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!titulo.trim()) return setError('Escribe qué es (por ejemplo, "Viaje a Sevilla").');

    let inicio: Date, fin: Date;
    if (todoElDia) {
      if (!desde || !hasta || hasta < desde) return setError('Revisa las fechas: el último día no puede ser antes del primero.');
      inicio = new Date(`${desde}T00:00`);
      fin = new Date(`${hasta}T00:00`);
      fin.setDate(fin.getDate() + 1); // incluye el último día entero
    } else {
      if (!desde || !horaIni || !horaFin) return setError('Pon el día y las horas.');
      inicio = new Date(`${desde}T${horaIni}`);
      fin = new Date(`${desde}T${horaFin}`);
      if (fin <= inicio) fin.setDate(fin.getDate() + 1); // termina pasada la medianoche
    }
    if (repetir && (!repiteHasta || repiteHasta < desde)) return setError('Pon hasta qué fecha se repite.');

    setGuardando(true);
    const { error } = await supabase.from('ocupaciones').insert({
      titulo: titulo.trim(), inicio: inicio.toISOString(), fin: fin.toISOString(),
      todo_el_dia: todoElDia, privada, repite_hasta: repetir ? repiteHasta : null,
    });
    setGuardando(false);
    if (error) return setError(`No se ha podido guardar (${error.message}).`);
    setTitulo(''); setRepetir(false); setRepiteHasta(''); setPrivada(false);
    cargar();
  }

  async function borrar(id: string) {
    const { error } = await supabase.from('ocupaciones').delete().eq('id', id);
    if (error) return setError('No se ha podido borrar.');
    setBorrando(null);
    cargar();
  }

  const casilla = (id: string, marcada: boolean, cambiar: (v: boolean) => void, texto: string, ayuda?: string) => (
    <label htmlFor={id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
      <input id={id} type="checkbox" checked={marcada} onChange={(e) => cambiar(e.target.checked)} style={{ width: 20, height: 20, accentColor: C.morado, marginTop: 1 }} />
      <span style={{ display: 'flex', flexDirection: 'column' }}>
        <span>{texto}</span>
        {ayuda && <span style={{ fontSize: 13, color: C.suave }}>{ayuda}</span>}
      </span>
    </label>
  );

  return (
    <main style={pagina}>
      <Link to="/calendario" style={{ color: C.morado, textDecoration: 'none', fontSize: 15 }}>← Calendario</Link>
      <header>
        <h1 style={{ margin: 0, fontSize: 26 }}>Mis ocupaciones 🧳</h1>
        <p style={{ margin: '4px 0 0', color: C.suave }}>Viajes, clases, trabajo… Si coinciden con un plan, las demás verán que no puedes.</p>
      </header>

      <form onSubmit={guardar} style={tarjeta}>
        <strong>Añadir</strong>
        <label style={etiqueta}>¿Qué es?
          <input id="ocupacion-titulo" style={campo} value={titulo} maxLength={80} onChange={(e) => setTitulo(e.target.value)} placeholder="Viaje a Sevilla, clase de inglés…" />
        </label>

        {casilla('ocupacion-todo-dia', todoElDia, setTodoElDia, 'Todo el día', 'Para viajes o días completos')}

        {todoElDia ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={etiqueta}>Desde
              <input id="ocupacion-desde" type="date" style={campo} value={desde} onChange={(e) => { setDesde(e.target.value); if (hasta < e.target.value) setHasta(e.target.value); }} />
            </label>
            <label style={etiqueta}>Hasta (incluido)
              <input id="ocupacion-hasta" type="date" style={campo} value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} />
            </label>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={{ ...etiqueta, gridColumn: '1 / -1' }}>Día
              <input id="ocupacion-dia" type="date" style={campo} value={desde} onChange={(e) => setDesde(e.target.value)} />
            </label>
            <label style={etiqueta}>De
              <input id="ocupacion-hora-ini" type="time" style={campo} value={horaIni} onChange={(e) => setHoraIni(e.target.value)} />
            </label>
            <label style={etiqueta}>A
              <input id="ocupacion-hora-fin" type="time" style={campo} value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
            </label>
          </div>
        )}

        {casilla('ocupacion-repetir', repetir, setRepetir, 'Se repite cada semana', 'Por ejemplo, una clase todos los martes')}
        {repetir && (
          <label style={etiqueta}>Hasta el
            <input id="ocupacion-repite-hasta" type="date" style={campo} value={repiteHasta} min={desde} onChange={(e) => setRepiteHasta(e.target.value)} />
          </label>
        )}

        {casilla('ocupacion-privada', privada, setPrivada, 'Privada', 'Las demás solo verán que estás ocupada, no el motivo')}

        {error && <p style={{ margin: 0, color: C.error }}>{error}</p>}
        <button type="submit" disabled={guardando} style={btnPrimario}>{guardando ? 'Guardando…' : 'Guardar ocupación'}</button>
      </form>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <strong>Próximas</strong>
        {lista.length === 0 && <span style={{ color: C.suave }}>No tienes nada apuntado.</span>}
        {lista.map((o) => (
          <article key={o.id} style={{ ...tarjeta, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 22 }}>{o.repite_hasta ? '🔁' : o.todo_el_dia ? '🧳' : '🕒'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{o.titulo}{o.privada && <span style={{ fontSize: 12, color: C.suave }}> · 🔒 privada</span>}</div>
              <div style={{ fontSize: 13, color: C.suave }}>{cap(describir(o))}</div>
            </div>
            {borrando === o.id ? (
              <span style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => borrar(o.id)} style={{ ...btnSecundario, padding: '6px 10px', color: C.error }}>Borrar</button>
                <button onClick={() => setBorrando(null)} style={{ ...btnSecundario, padding: '6px 10px' }}>No</button>
              </span>
            ) : (
              <button onClick={() => setBorrando(o.id)} aria-label={`Borrar ${o.titulo}`} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: C.suave }}>✕</button>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
