// src/pages/Album.tsx — ruta /album (v2)
// Todas las quedadas (planes y quedadas espontáneas) con su foto de portada.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { MAX_FOTOS, urlsFirmadas } from '../lib/fotos';
import { C, pagina } from '../lib/ui';

type Entrada = { tipo: 'plan' | 'quedada'; id: string; titulo: string; fecha: string; n_fotos: number; portada: string | null };

const fmt = (yyyymmdd: string) =>
  new Date(yyyymmdd + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

export default function Album() {
  const [entradas, setEntradas] = useState<Entrada[] | null>(null);
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  const [soloConFotos, setSoloConFotos] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('album').select('*').order('fecha', { ascending: false }).limit(200);
      const lista = (data ?? []) as Entrada[];
      setEntradas(lista);
      setUrls(await urlsFirmadas(lista.map((e) => e.portada).filter(Boolean) as string[]));
      if (!lista.some((e) => e.n_fotos > 0)) setSoloConFotos(false);
    })();
  }, []);

  const visibles = (entradas ?? []).filter((e) => !soloConFotos || e.n_fotos > 0);

  const pestana = (activo: boolean, texto: string, alPulsar: () => void) => (
    <button onClick={alPulsar} aria-pressed={activo} style={{
      flex: 1, padding: '8px 4px', borderRadius: 10, border: 'none', font: 'inherit', fontSize: 14, cursor: 'pointer',
      background: activo ? C.blanco : 'transparent', fontWeight: activo ? 700 : 500, boxShadow: activo ? '0 1px 3px rgba(0,0,0,.12)' : 'none',
    }}>{texto}</button>
  );

  return (
    <main style={pagina}>
      <h1 style={{ margin: 0, fontSize: 26 }}>Álbum 📸</h1>

      <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: '#ececf1' }}>
        {pestana(soloConFotos, 'Con fotos', () => setSoloConFotos(true))}
        {pestana(!soloConFotos, 'Todas las quedadas', () => setSoloConFotos(false))}
      </div>

      {entradas && visibles.length === 0 && (
        <p style={{ margin: 0, color: C.suave, textAlign: 'center', padding: 24 }}>
          Aún no hay quedadas. Cuando pase un plan, entra en él para subir hasta {MAX_FOTOS} fotos.
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        {visibles.map((e) => {
          const url = e.portada ? urls.get(e.portada) : undefined;
          return (
            <Link key={`${e.tipo}-${e.id}`} to={e.tipo === 'plan' ? `/plan/${e.id}` : `/quedada/${e.id}`}
                  style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ aspectRatio: '1', borderRadius: 14, overflow: 'hidden', background: C.moradoSuave, display: 'grid', placeItems: 'center', position: 'relative' }}>
                {url
                  ? <img src={url} alt={e.titulo} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  : <span style={{ fontSize: 34 }} aria-hidden>{e.tipo === 'plan' ? '🗓️' : '☕'}</span>}
                <span style={{ position: 'absolute', right: 6, bottom: 6, fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,.9)', borderRadius: 99, padding: '2px 8px' }}>
                  {e.n_fotos}/{MAX_FOTOS}
                </span>
              </div>
              <strong style={{ fontSize: 15, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{e.titulo}</strong>
              <span style={{ fontSize: 13, color: C.suave }}>{fmt(e.fecha)}</span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
