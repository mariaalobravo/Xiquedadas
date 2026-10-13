// supabase/functions/login-amiga/index.ts
// Recibe un nombre (no un email): busca el correo en el servidor, envía el código
// y lo verifica. Así los correos de las amigas nunca están en el frontend.
// Desplegar con:  npx supabase functions deploy login-amiga --no-verify-jwt --use-api
import { createClient } from 'npm:@supabase/supabase-js@2';

const URL = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});
// Cliente normal para los flujos de OTP (se crea por petición para no mezclar sesiones)
const clienteAuth = () =>
  createClient(URL, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false } });

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { accion, nombre, codigo } = await req.json();
    if (!nombre) return json({ error: 'Falta el nombre' }, 400);

    const { data: perfil } = await admin.from('perfiles').select('id').eq('nombre', nombre).maybeSingle();
    if (!perfil) return json({ error: `No encuentro a ${nombre}` }, 404);

    const { data: u, error: eU } = await admin.auth.admin.getUserById(perfil.id);
    const email = u?.user?.email;
    if (eU || !email) return json({ error: 'Usuaria sin correo asociado' }, 500);

    if (accion === 'enviar') {
      const { error } = await clienteAuth().auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (error) {
        console.error('signInWithOtp', error); // se ve en Edge Functions → login-amiga → Logs
        return json({ error: `No se pudo enviar el código (${error.message}).` }, 429);
      }
      return json({ ok: true });
    }

    if (accion === 'verificar') {
      if (!/^\d{6}$/.test(codigo ?? '')) return json({ error: 'El código son 6 cifras' }, 400);
      const { data, error } = await clienteAuth().auth.verifyOtp({ email, token: codigo, type: 'email' });
      if (error || !data.session) return json({ error: 'Código incorrecto o caducado' }, 401);
      return json({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
    }

    return json({ error: 'Acción no válida' }, 400);
  } catch (_e) {
    return json({ error: 'Error inesperado' }, 500);
  }
});