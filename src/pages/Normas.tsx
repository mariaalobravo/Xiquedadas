// src/pages/Normas.tsx — ruta /normas
// Normas del grupo (las edita cualquiera), faltas sin justificar y cervezas pendientes.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { usePerfiles } from '../lib/perfiles';
import { C, btnPrimario, btnSecundario, campo, pagina, tarjeta } from '../lib/ui';

type Norma = { id: number; texto: string; orden: number; actualizada_por: string | null; actualizada_en: string };
type Deuda = { deudora: string; acreedora: string; cervezas: number };

export default function Normas() {
  const { porId } = usePerfiles();
  const [normas, setNormas] = useState<Norma[]>([]);
  const [faltas, setFaltas] = useState<{ usuaria_id: string; injustificadas: number }[]>([]);
  const [deudas, setDeudas] = useState<Deuda[]>([]);
  const [editando, setEditando] = useState<number | 'nueva' | null>(null);
  const [texto, setTexto] = useState('');
  const [borrando, setBorrando] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const [n, f, d] = await Promise.all([
      supabase.from('normas').select('*').order('orden').order('id'),
      supabase.from('faltas').select('*'),
      supabase.from('deudas').select('deudora, acreedora, cervezas').is('saldada_en', null),
    ]);
    setNormas((n.data ?? []) as Norma[]);
    setFaltas(((f.data ?? []) as { usuaria_id: string; injustificadas: number }[]).sort((a, b) => b.injustificadas - a.injustificadas));
    setDeudas((d.data ?? []) as Deuda[]);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const nombre = (id: string | null) => (id && porId(id)?.nombre) || 'alguien';

  async function guardar() {
    setError(null);
    if (!texto.trim()) return setError('La norma no puede estar vacía.');
    const { error } = editando === 'nueva'
      ? await supabase.from('normas').insert({ texto: texto.trim(), orden: (normas.at(-1)?.orden ?? 0) + 1 })
      : await supabase.from('normas').update({ texto: texto.trim() }).eq('id', editando as number);
    if (error) return setError('No se ha podido guardar.');
    setEditando(null);
    setTexto('');
    cargar();
  }

  async function borrar(id: number) {
    const { error } = await supabase.from('normas').delete().eq('id', id);
    if (error) return setError('No se ha podido borrar.');
    setBorrando(null);
    cargar();
  }

  // Cervezas pendientes agrupadas por pareja
  const porPareja = new Map<string, number>();
  for (const d of deudas) porPareja.set(`${d.deudora}|${d.acreedora}`, (porPareja.get(`${d.deudora}|${d.acreedora}`) ?? 0) + d.cervezas);

  const editor = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <textarea id="norma-texto" autoFocus style={{ ...campo, minHeight: 80 }} value={texto} onChange={(e) => setTexto(e.target.value)} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={guardar} style={{ ...btnPrimario, flex: 1 }}>Guardar</button>
        <button onClick={() => { setEditando(null); setTexto(''); }} style={btnSecundario}>Cancelar</button>
      </div>
    </div>
  );

  return (
    <main style={pagina}>
      <h1 style={{ margin: 0, fontSize: 26 }}>Normas del grupo 📜</h1>

      <section style={tarjeta}>
        {normas.length === 0 && editando !== 'nueva' && <span style={{ color: C.suave }}>Aún no hay normas.</span>}
        {normas.map((n, i) => (
          <div key={n.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: i ? 10 : 0, borderTop: i ? `1px solid ${C.borde}` : 'none' }}>
            {editando === n.id ? editor : (
              <>
                <div style={{ display: 'flex', gap: 10 }}>
                  <b style={{ color: C.morado }}>{i + 1}.</b>
                  <span style={{ flex: 1 }}>{n.texto}</span>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 13, color: C.suave }}>
                  <span style={{ flex: 1 }}>
                    {n.actualizada_por && `Editada por ${nombre(n.actualizada_por)} el ${new Date(n.actualizada_en).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`}
                  </span>
                  {borrando === n.id ? (
                    <>
                      <button onClick={() => borrar(n.id)} style={{ ...btnSecundario, padding: '4px 10px', color: C.error }}>Sí, borrar</button>
                      <button onClick={() => setBorrando(null)} style={{ ...btnSecundario, padding: '4px 10px' }}>No</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setEditando(n.id); setTexto(n.texto); }} style={{ background: 'none', border: 'none', color: C.morado, font: 'inherit', cursor: 'pointer' }}>Editar</button>
                      <button onClick={() => setBorrando(n.id)} style={{ background: 'none', border: 'none', color: C.error, font: 'inherit', cursor: 'pointer' }}>Borrar</button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
        {editando === 'nueva' ? editor : (
          <button onClick={() => { setEditando('nueva'); setTexto(''); }} style={{ ...btnSecundario, alignSelf: 'flex-start' }}>+ Añadir norma</button>
        )}
        {error && <p style={{ margin: 0, color: C.error }}>{error}</p>}
      </section>

      <section style={tarjeta}>
        <strong>Cervezas pendientes 🍺</strong>
        {porPareja.size === 0 ? <span style={{ color: C.suave }}>Ninguna. Todo saldado.</span> : (
          [...porPareja.entries()].map(([k, n]) => {
            const [deudora, acreedora] = k.split('|');
            return <span key={k}>{nombre(deudora)} debe {'🍺'.repeat(n)} a {nombre(acreedora)}</span>;
          })
        )}
        <span style={{ fontSize: 13, color: C.suave }}>Quien recibe la cerveza la marca como saldada en "Mis xiques".</span>
      </section>

      <section style={tarjeta}>
        <strong>Faltas sin justificar</strong>
        {faltas.length === 0 ? <span style={{ color: C.suave }}>Nadie ha faltado sin justificar 🎉</span> : (
          faltas.map((f) => <span key={f.usuaria_id}>{nombre(f.usuaria_id)}: {f.injustificadas}</span>)
        )}
      </section>
    </main>
  );
}
