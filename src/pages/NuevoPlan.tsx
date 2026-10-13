// src/pages/NuevoPlan.tsx — ruta /plan/nuevo
// Admite ?fecha=YYYY-MM-DD&franja=tarde (desde la encuesta) y ?con=<id> (desde Mis xiques).
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { usePerfiles } from '../lib/perfiles';
import { FilaAvatares } from '../components/Avatar';
import { HORA_FRANJA, aInputLocal, franjaDeHora, type Franja } from '../lib/planes';
import { C, btnPrimario, campo, etiqueta, pagina } from '../lib/ui';

function manana() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return aInputLocal(d).slice(0, 10);
}

// Por defecto: 24 h antes del plan; si no da tiempo, 1 h antes; y nunca antes de dentro de 30 min
function limitePorDefecto(inicio: Date) {
  const minimo = Date.now() + 30 * 60_000;
  let t = inicio.getTime() - 24 * 3_600_000;
  if (t < minimo) t = inicio.getTime() - 3_600_000;
  if (t < minimo) t = Math.min(minimo, inicio.getTime());
  return aInputLocal(new Date(t));
}

function lunesDe(fecha: string) {
  const d = new Date(fecha + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export default function NuevoPlan() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { porId } = usePerfiles();

  const franjaParam = params.get('franja') as Franja | null;
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [lugar, setLugar] = useState('');
  const [fecha, setFecha] = useState(params.get('fecha') ?? manana());
  const [hora, setHora] = useState(franjaParam ? HORA_FRANJA[franjaParam] : '20:00');
  const [horaFin, setHoraFin] = useState('');
  const [limite, setLimite] = useState('');
  const [limiteTocado, setLimiteTocado] = useState(false);
  const [pueden, setPueden] = useState<string[] | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inicio = useMemo(() => new Date(`${fecha}T${hora}`), [fecha, hora]);

  // Título sugerido si vienes de "Proponer plan con…"
  const con = params.get('con');
  const nombreCon = con ? porId(con)?.nombre : undefined;
  useEffect(() => { if (nombreCon && !titulo) setTitulo(`Plan con ${nombreCon}`); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [nombreCon]);

  // Fecha límite automática mientras no la cambies a mano
  useEffect(() => { if (!limiteTocado && !isNaN(inicio.getTime())) setLimite(limitePorDefecto(inicio)); }, [inicio, limiteTocado]);

  // Quién puede según la encuesta de esa semana
  useEffect(() => {
    let cancelado = false;
    (async () => {
      setPueden(null);
      const { data: enc } = await supabase.from('encuestas').select('id').eq('semana_inicio', lunesDe(fecha)).maybeSingle();
      if (!enc) return;
      const { data } = await supabase.from('disponibilidad').select('usuaria_id')
        .eq('encuesta_id', enc.id).eq('dia', fecha).eq('franja', franjaDeHora(hora));
      if (!cancelado) setPueden((data ?? []).map((d) => d.usuaria_id));
    })();
    return () => { cancelado = true; };
  }, [fecha, hora]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const lim = new Date(limite);
    if (!titulo.trim()) return setError('Ponle un título al plan.');
    if (inicio <= new Date()) return setError('La fecha del plan tiene que ser futura.');
    if (!(lim > new Date())) return setError('La fecha límite para responder tiene que ser futura.');
    if (lim > inicio) return setError('La fecha límite tiene que ser antes del plan.');
    let fin: string | null = null;
    if (horaFin) {
      const f = new Date(`${fecha}T${horaFin}`);
      if (f <= inicio) f.setDate(f.getDate() + 1); // termina después de medianoche
      fin = f.toISOString();
    }

    setGuardando(true);
    const { data, error } = await supabase.from('planes').insert({
      titulo: titulo.trim(),
      descripcion: descripcion.trim() || null,
      lugar: lugar.trim() || null,
      inicio: inicio.toISOString(),
      fin,
      fecha_limite: lim.toISOString(),
    }).select('id').single();
    setGuardando(false);
    if (error || !data) return setError('No se ha podido crear el plan. Inténtalo otra vez.');
    navigate(`/plan/${data.id}`, { replace: true });
  }

  return (
    <main style={pagina}>
      <h1 style={{ margin: 0, fontSize: 26 }}>Nuevo plan</h1>
      <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label style={etiqueta}>Título
          <input id="plan-titulo" style={campo} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Cena en casa de Carmen" maxLength={80} />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ ...etiqueta, gridColumn: '1 / -1' }}>Día
            <input id="plan-fecha" type="date" style={campo} value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </label>
          <label style={etiqueta}>Empieza
            <input id="plan-hora" type="time" style={campo} value={hora} onChange={(e) => setHora(e.target.value)} />
          </label>
          <label style={etiqueta}>Termina (opcional)
            <input id="plan-fin" type="time" style={campo} value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
          </label>
        </div>

        {pueden && (
          <div style={{ fontSize: 14, background: C.moradoSuave, padding: 10, borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Según la encuesta, esa {franjaDeHora(hora)}:</span>
            <FilaAvatares ids={pueden} tam={26} />
          </div>
        )}

        <label style={etiqueta}>Lugar (opcional)
          <input id="plan-lugar" style={campo} value={lugar} onChange={(e) => setLugar(e.target.value)} placeholder="Bar La Esquina" />
        </label>

        <label style={etiqueta}>Descripción (opcional)
          <textarea id="plan-descripcion" style={{ ...campo, minHeight: 90, resize: 'vertical' }} value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)} placeholder="Cada una trae algo de picar…" />
        </label>

        <label style={etiqueta}>Fecha límite para responder
          <input id="plan-limite" type="datetime-local" style={campo} value={limite}
                 onChange={(e) => { setLimite(e.target.value); setLimiteTocado(true); }} />
          <span style={{ fontSize: 13, color: C.suave }}>Por defecto, 24 h antes del plan. Después solo podrán apuntarse, no borrarse.</span>
        </label>

        {error && <p style={{ margin: 0, color: C.error }}>{error}</p>}

        <button type="submit" disabled={guardando} style={{ ...btnPrimario, opacity: guardando ? 0.6 : 1 }}>
          {guardando ? 'Creando…' : 'Proponer plan'}
        </button>
      </form>
    </main>
  );
}
