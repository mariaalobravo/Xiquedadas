// src/lib/push.ts — suscribir este dispositivo a notificaciones
// En iOS el permiso solo se puede pedir desde un toque: llama a esto desde un botón.
import { supabase } from './supabase';

export const esInstalada = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as any).standalone === true;

function b64ToUint8(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function activarNotificaciones() {
  if (!esInstalada()) throw new Error('Añade la app a la pantalla de inicio primero');
  if ((await Notification.requestPermission()) !== 'granted') return;

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: b64ToUint8(import.meta.env.VITE_VAPID_PUBLIC_KEY),
  });
  const j = sub.toJSON();
  await supabase.from('suscripciones_push').upsert(
    { endpoint: j.endpoint, p256dh: j.keys!.p256dh, auth: j.keys!.auth },
    { onConflict: 'endpoint' }
  );
}
