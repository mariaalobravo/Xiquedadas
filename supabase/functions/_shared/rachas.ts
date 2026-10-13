// supabase/functions/_shared/rachas.ts
// Aplica el cierre de un plan o encuesta a las rachas de todas
// y avisa a quien gasta el comodín o pierde la racha.
import { notificar, sb } from './push.ts';

export async function cerrarEventoRacha(respondieron: string[], que: string) {
  const { data, error } = await sb.rpc('cerrar_evento_racha', { respondieron });
  if (error) { console.error('cerrar_evento_racha', error); return; }

  for (const r of data ?? []) {
    if (r.out_resultado === 'comodin')
      await notificar(
        { title: 'Comodín usado 🧊', body: `No contestaste a ${que}, pero tu racha sigue viva. Este mes ya no te quedan comodines.`, url: '/grupo' },
        { soloA: [r.out_usuaria] }
      );
    if (r.out_resultado === 'rota')
      await notificar(
        { title: 'Racha perdida 💔', body: `No contestaste a ${que}. Tu racha vuelve a 0.`, url: '/grupo' },
        { soloA: [r.out_usuaria] }
      );
  }
}
