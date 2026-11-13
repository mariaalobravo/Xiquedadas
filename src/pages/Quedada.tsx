// src/pages/Quedada.tsx — ruta /quedada/:id (v2)
// Una quedada espontánea ("Nos hemos visto ✓") con sus fotos.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { usePerfiles } from '../lib/perfiles';
import { useMiId } from '../lib/planes';
import { FilaAvatares } from '../components/Avatar';
import FotosQuedada from '../components/FotosQuedada';
import { C, pagina, tarjeta } from '../lib/ui';

type Q = { id: string; fecha: string; nota: string | null; registrada_por: string };

export default function Quedada() {
  const { id } = useParams<{ id: string }>();
  const miId = useMiId();
  const { porId } = usePerfiles();
  const [q, setQ] = useState<Q | null | undefined>(undefined);
  const [participantes, setParticipantes] = useState<string[]>([]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [a, b] = await Promise.all([
        supabase.from('quedadas').select('*').eq('id', id).maybeSingle(),
        supabase.from('quedada_participantes').select('usuaria_id').eq('quedada_id', id),
      ]);
      setQ((a.data ?? null) as Q | null);
      setParticipantes((b.data ?? []).map((x) => x.usuaria_id));
    })();
  }, [id]);

  if (q === undefined) return null;
  if (q === null) return <main style={pagina}><p>Esta quedada no existe.</p><Link to="/album">Volver al álbum</Link></main>;

  return (
    <main style={pagina}>
      <Link to="/album" style={{ color: C.morado, textDecoration: 'none', fontSize: 15 }}>← Álbum</Link>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h1 style={{ margin: 0, fontSize: 26 }}>{q.nota || 'Quedada'}</h1>
        <span style={{ color: C.suave, textTransform: 'capitalize' }}>
          ☕ {new Date(q.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          {' · '}apuntada por {porId(q.registrada_por)?.nombre ?? 'alguien'}
        </span>
      </section>
      <section style={tarjeta}>
        <strong>Quiénes estuvieron</strong>
        <FilaAvatares ids={participantes} tam={32} texto="estuvieron" />
      </section>
      <FotosQuedada quedadaId={q.id} puedeSubir={!!miId && participantes.includes(miId)} />
    </main>
  );
}
