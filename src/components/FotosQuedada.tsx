// src/components/FotosQuedada.tsx — galería de una quedada (plan o espontánea), máx. 3 fotos (v2)
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePerfiles } from '../lib/perfiles';
import { useMiId } from '../lib/planes';
import { MAX_FOTOS, borrarFoto, cargarFotos, subirFoto, type Foto } from '../lib/fotos';
import { C, btnSecundario, tarjeta } from '../lib/ui';

export default function FotosQuedada({ planId, quedadaId, puedeSubir }: {
  planId?: string; quedadaId?: string; puedeSubir: boolean;
}) {
  const miId = useMiId();
  const { porId } = usePerfiles();
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<Foto | null>(null);
  const [borrando, setBorrando] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => setFotos(await cargarFotos({ planId, quedadaId })), [planId, quedadaId]);
  useEffect(() => { cargar(); }, [cargar]);

  async function alElegir(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !miId) return;
    setError(null);
    setSubiendo(true);
    try { await subirFoto(file, miId, { planId, quedadaId }); await cargar(); }
    catch (err: any) { setError(err.message); }
    finally { setSubiendo(false); }
  }

  async function borrar(f: Foto) {
    try { await borrarFoto(f); setAbierta(null); setBorrando(false); await cargar(); }
    catch (err: any) { setError(err.message); }
  }

  const quedan = MAX_FOTOS - fotos.length;

  return (
    <section style={tarjeta}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <strong style={{ flex: 1 }}>📸 Fotos</strong>
        <span style={{ fontSize: 13, color: C.suave }}>{fotos.length}/{MAX_FOTOS}</span>
      </div>

      {fotos.length === 0 && !puedeSubir && <span style={{ fontSize: 14, color: C.suave }}>Aún no hay fotos de esta quedada.</span>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {fotos.map((f) => (
          <button key={f.id} onClick={() => { setAbierta(f); setBorrando(false); }}
                  style={{ padding: 0, border: 'none', borderRadius: 10, overflow: 'hidden', aspectRatio: '1', background: C.borde, cursor: 'pointer' }}>
            {f.url && <img src={f.url} alt="Foto de la quedada" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
          </button>
        ))}
        {puedeSubir && quedan > 0 && (
          <button onClick={() => input.current?.click()} disabled={subiendo} style={{
            aspectRatio: '1', borderRadius: 10, border: `2px dashed ${C.morado}`, background: C.moradoSuave,
            color: C.morado, font: 'inherit', fontWeight: 600, cursor: 'pointer', display: 'grid', placeItems: 'center',
          }}>
            {subiendo ? 'Subiendo…' : '+ Añadir'}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={alElegir} />
      {error && <p style={{ margin: 0, color: C.error, fontSize: 14 }}>{error}</p>}

      {/* Foto a pantalla completa */}
      {abierta && (
        <div onClick={() => setAbierta(null)} style={{
          position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.88)', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 12, padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 16px calc(env(safe-area-inset-bottom, 0px) + 16px)',
        }}>
          {abierta.url && <img src={abierta.url} alt="Foto de la quedada" style={{ maxWidth: '100%', maxHeight: '75dvh', borderRadius: 12 }} />}
          <span style={{ color: '#fff', fontSize: 14 }}>Subida por {porId(abierta.autora)?.nombre ?? 'alguien'}</span>
          <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 8 }}>
            {abierta.autora === miId && (borrando ? (
              <>
                <button onClick={() => borrar(abierta)} style={{ ...btnSecundario, color: C.error }}>Sí, borrar</button>
                <button onClick={() => setBorrando(false)} style={btnSecundario}>No</button>
              </>
            ) : (
              <button onClick={() => setBorrando(true)} style={{ ...btnSecundario, color: C.error }}>Borrar foto</button>
            ))}
            <button onClick={() => setAbierta(null)} style={btnSecundario}>Cerrar</button>
          </div>
        </div>
      )}
    </section>
  );
}
