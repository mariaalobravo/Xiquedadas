// src/pages/Ajustes.tsx — ruta /ajustes
// Foto de perfil, notificaciones y cerrar sesión.
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { activarNotificaciones, esInstalada } from '../lib/push';
import SubirFoto from '../components/SubirFoto';

type EstadoAvisos = 'cargando' | 'activas' | 'inactivas' | 'bloqueadas' | 'no-instalada' | 'no-soportadas';

export default function Ajustes() {
  const [avisos, setAvisos] = useState<EstadoAvisos>('cargando');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function comprobar() {
    if (!esInstalada()) return setAvisos('no-instalada');
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return setAvisos('no-soportadas');
    if (Notification.permission === 'denied') return setAvisos('bloqueadas');
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    setAvisos(sub && Notification.permission === 'granted' ? 'activas' : 'inactivas');
  }
  useEffect(() => { comprobar(); }, []);

  async function activar() {
    setError(null);
    setOcupado(true);
    try {
      await activarNotificaciones();
      await comprobar();
    } catch (e: any) {
      setError(e.message ?? 'No se han podido activar las notificaciones');
    } finally {
      setOcupado(false);
    }
  }

  const tarjeta: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10, padding: 16, borderRadius: 16, border: '1px solid #e3e3e8' };
  const boton: React.CSSProperties = { padding: 12, borderRadius: 12, border: 'none', background: '#7b2f63', color: '#fff', font: 'inherit', fontWeight: 600 };

  return (
    <main style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560, margin: '0 auto' }}>
      <h1 style={{ margin: 0, fontSize: 28 }}>Ajustes</h1>

      <section style={tarjeta}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Tu foto</h2>
        <SubirFoto />
      </section>

      <section style={tarjeta}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Notificaciones</h2>
        {avisos === 'activas' && <p style={{ margin: 0 }}>✅ Activadas en este móvil.</p>}
        {avisos === 'inactivas' && (
          <>
            <p style={{ margin: 0 }}>Actívalas para enterarte de planes nuevos, recordatorios y la encuesta del domingo.</p>
            <button onClick={activar} disabled={ocupado} style={boton}>{ocupado ? 'Activando…' : 'Activar notificaciones'}</button>
          </>
        )}
        {avisos === 'no-instalada' && (
          <p style={{ margin: 0 }}>
            Para recibir notificaciones en el iPhone, primero añade la app a la pantalla de inicio:
            en Safari, toca <strong>Compartir</strong> → <strong>Añadir a pantalla de inicio</strong>, y ábrela desde el icono.
          </p>
        )}
        {avisos === 'bloqueadas' && (
          <p style={{ margin: 0 }}>
            Las tienes bloqueadas. Actívalas en <strong>Ajustes del iPhone → Notificaciones → Planes</strong>.
          </p>
        )}
        {avisos === 'no-soportadas' && <p style={{ margin: 0 }}>Este navegador no admite notificaciones.</p>}
        {error && <p style={{ margin: 0, color: '#c5221f' }}>{error}</p>}
      </section>

      <button onClick={() => supabase.auth.signOut()}
              style={{ padding: 12, borderRadius: 12, border: '1px solid #ccc', background: 'transparent', font: 'inherit' }}>
        Cerrar sesión
      </button>
    </main>
  );
}
