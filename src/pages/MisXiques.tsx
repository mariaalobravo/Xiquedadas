// src/pages/MisXiques.tsx — ruta /xiques
// Cada una ve SOLO sus datos: cuánto hace que no ve a cada amiga, racha por pareja y cervezas.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { usePerfiles } from '../lib/perfiles';
import { Avatar } from '../components/Avatar';
import NosHemosVisto from '../components/NosHemosVisto';
import { COLOR_NIVEL, diasDesde, emojiRacha, fechaLarga, nivelDias, semanasSeguidas } from '../lib/rachas';

type Fila = { otra: string; nombre: string; ultima_vez: string | null; veces_este_ano: number; semanas: string[] };
type Deuda = { id: string; deudora: string; acreedora: string; cervezas: number; titulo: string | null; fecha_plan: string | null; sentido: 'debo' | 'me_deben' };
type MiRacha = { actual: number; mejor: number; comodin_disponible: boolean };

function textoUltimaVez(dias: number | null, iso: string | null) {
  if (dias === null || !iso) return 'Aún no hay ninguna quedada registrada';
  if (dias === 0) return 'Os habéis visto hoy';
  if (dias === 1) return 'Os visteis ayer';
  if (dias < 14) return `Os visteis el ${fechaLarga(iso)}`;
  return `No os veis desde el ${fechaLarga(iso)} (${dias} días)`;
}

export default function MisXiques() {
  const { porId } = usePerfiles();
  const navigate = useNavigate();
  const [filas, setFilas] = useState<Fila[]>([]);
  const [deudas, setDeudas] = useState<Deuda[]>([]);
  const [miRacha, setMiRacha] = useState<MiRacha | null>(null);
  const [formulario, setFormulario] = useState<{ con?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const [x, c, r] = await Promise.all([
      supabase.from('mis_xiques').select('*'),
      supabase.from('mis_cervezas').select('*'),
      supabase.from('resumen_grupo').select('racha, mejor_racha, comodin_disponible').eq('id', user?.id ?? '').maybeSingle(),
    ]);
    if (x.error || c.error) { setError('No se han podido cargar tus datos. Desliza para recargar.'); return; }

    // Primero a quien hace más que no ves (sin registros, arriba del todo)
    const orden = (f: Fila) => (f.ultima_vez ? diasDesde(f.ultima_vez) : 1e9);
    setFilas([...(x.data as Fila[])].sort((a, b) => orden(b) - orden(a)));
    setDeudas(c.data as Deuda[]);
    if (r.data) setMiRacha({ actual: r.data.racha, mejor: r.data.mejor_racha, comodin_disponible: r.data.comodin_disponible });
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function saldar(id: string) {
    const { error } = await supabase.from('deudas').update({ saldada_en: new Date().toISOString() }).eq('id', id);
    if (error) setError('No se ha podido marcar como saldada');
    else cargar();
  }

  return (
    <main style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560, margin: '0 auto' }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h1 style={{ margin: 0, fontSize: 28 }}>Mis xiques 💞</h1>
        {miRacha && (
          <p style={{ margin: 0, color: '#6b6b6b' }}>
            Tu racha: <strong>{miRacha.actual} {emojiRacha(miRacha.actual) || '🔥'}</strong>
            {' · '}mejor: {miRacha.mejor}
            {' · '}{miRacha.comodin_disponible ? 'comodín disponible 🧊' : 'sin comodín este mes'}
          </p>
        )}
      </header>

      {formulario ? (
        <NosHemosVisto
          preseleccion={formulario.con}
          onCerrar={() => setFormulario(null)}
          onHecho={() => { setFormulario(null); cargar(); }}
        />
      ) : (
        <button onClick={() => setFormulario({})} style={{ padding: 12, borderRadius: 12, border: '1px dashed #7b2f63', background: 'transparent', color: '#7b2f63', font: 'inherit', fontWeight: 600 }}>
          + Nos hemos visto ✓
        </button>
      )}

      {error && <p style={{ color: '#c5221f', margin: 0 }}>{error}</p>}

      {filas.map((f) => {
        const p = porId(f.otra);
        const dias = f.ultima_vez ? diasDesde(f.ultima_vez) : null;
        const nivel = nivelDias(dias);
        const racha = semanasSeguidas(f.semanas ?? []);
        const leDebo = deudas.filter((d) => d.sentido === 'debo' && d.acreedora === f.otra);
        const meDebe = deudas.filter((d) => d.sentido === 'me_deben' && d.deudora === f.otra);

        return (
          <article key={f.otra} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14, borderRadius: 16, border: '1px solid #e3e3e8' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {p && <Avatar perfil={p} tam={52} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLOR_NIVEL[nivel], flexShrink: 0 }} />
                  <strong style={{ fontSize: 17 }}>{f.nombre}</strong>
                </div>
                <div style={{ fontSize: 15 }}>{textoUltimaVez(dias, f.ultima_vez)}</div>
                <div style={{ fontSize: 13, color: '#6b6b6b' }}>
                  {f.veces_este_ano} {f.veces_este_ano === 1 ? 'quedada' : 'quedadas'} este año
                  {racha >= 2 && ` · 🔥 ${racha} semanas seguidas`}
                </div>
              </div>
            </div>

            {leDebo.map((d) => (
              <div key={d.id} style={{ fontSize: 14, background: '#fdf1dd', padding: '8px 10px', borderRadius: 10 }}>
                Le debes {'🍺'.repeat(d.cervezas)} {d.titulo && <>por «{d.titulo}»</>}
              </div>
            ))}
            {meDebe.map((d) => (
              <div key={d.id} style={{ fontSize: 14, background: '#e6f4ea', padding: '8px 10px', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span>Te debe {'🍺'.repeat(d.cervezas)} {d.titulo && <>por «{d.titulo}»</>}</span>
                <button onClick={() => saldar(d.id)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #1e8e3e', background: 'transparent', color: '#1e8e3e', font: 'inherit', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  Saldada ✓
                </button>
              </div>
            ))}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => navigate(`/plan/nuevo?con=${f.otra}`)} style={{ flex: 1, padding: 10, borderRadius: 10, border: 'none', background: '#7b2f63', color: '#fff', font: 'inherit', fontWeight: 600 }}>
                Proponer plan con {f.nombre}
              </button>
              <button onClick={() => setFormulario({ con: f.otra })} style={{ padding: 10, borderRadius: 10, border: '1px solid #ccc', background: 'transparent', font: 'inherit' }}>
                Nos hemos visto
              </button>
            </div>
          </article>
        );
      })}
    </main>
  );
}
