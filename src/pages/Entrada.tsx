// src/pages/Entrada.tsx
// Pantalla de entrada: eliges quién eres y verificas con el código que llega a tu correo.
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import './Entrada.css';

// Los nombres deben coincidir EXACTAMENTE con perfiles.nombre (tildes incluidas)
const AMIGAS = [
  { nombre: 'Irene',    color: '#F28B82' },
  { nombre: 'María',    color: '#FBBC04' },
  { nombre: 'Carmen',   color: '#81C995' },
  { nombre: 'Cristina', color: '#78D9EC' },
  { nombre: 'Sabela',   color: '#A7B4FA' },
  { nombre: 'Helí',     color: '#D7AEFB' },
  { nombre: 'Sara',     color: '#FDCFE8' },
];

const CLAVE_ULTIMA = 'ultima-amiga';

function leerUltima(): string | null {
  try { return localStorage.getItem(CLAVE_ULTIMA); } catch { return null; }
}
function guardarUltima(nombre: string) {
  try { localStorage.setItem(CLAVE_ULTIMA, nombre); } catch { /* sin storage, no pasa nada */ }
}

type Paso = 'elegir' | 'codigo';

export default function Entrada({ onDentro }: { onDentro?: () => void }) {
  const [paso, setPaso] = useState<Paso>('elegir');
  const [elegida, setElegida] = useState<string | null>(leerUltima());
  const [codigo, setCodigo] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function llamar(body: Record<string, string>) {
    const { data, error } = await supabase.functions.invoke('login-amiga', { body });
    if (error) {
      // Intenta sacar el mensaje que devuelve la función
      let msg = 'Algo ha fallado, inténtalo otra vez';
      try { msg = (await (error as any).context.json()).error ?? msg; } catch { /* ignorar */ }
      throw new Error(msg);
    }
    return data;
  }

  async function enviarCodigo(nombre: string) {
    setElegida(nombre);
    setError(null);
    setCargando(true);
    try {
      await llamar({ accion: 'enviar', nombre });
      guardarUltima(nombre);
      setCodigo('');
      setPaso('codigo');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  async function verificar(e: React.FormEvent) {
    e.preventDefault();
    if (!elegida || codigo.length < 6) return;
    setError(null);
    setCargando(true);
    try {
      const { access_token, refresh_token } = await llamar({ accion: 'verificar', nombre: elegida, codigo });
      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (error) throw error;
      onDentro?.();
    } catch (e: any) {
      setError(e.message ?? 'Código incorrecto');
    } finally {
      setCargando(false);
    }
  }

  const amiga = AMIGAS.find((a) => a.nombre === elegida);

  if (paso === 'codigo' && amiga) {
    return (
      <main className="entrada">
        <div className="avatar grande" style={{ background: amiga.color }}>{amiga.nombre[0]}</div>
        <h1>Hola, {amiga.nombre} 👋</h1>
        <p className="sub">Te hemos mandado un código de 6 cifras a tu correo.</p>

        <form onSubmit={verificar} className="form-codigo">
          <input
            className="input-codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="······"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
            autoFocus
          />
          <button className="boton" disabled={cargando || codigo.length < 6}>
            {cargando ? 'Comprobando…' : 'Entrar'}
          </button>
        </form>

        {error && <p className="error">{error}</p>}

        <div className="enlaces">
          <button className="enlace" disabled={cargando} onClick={() => enviarCodigo(amiga.nombre)}>
            Reenviar código
          </button>
          <button className="enlace" onClick={() => { setPaso('elegir'); setError(null); }}>
            No soy {amiga.nombre}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="entrada">
      <h1>¿Quién eres?</h1>
      <p className="sub">Elige tu nombre y te mandamos un código para entrar.</p>

      <ul className="rejilla">
        {AMIGAS.map((a) => (
          <li key={a.nombre}>
            <button
              className={`tarjeta ${elegida === a.nombre ? 'ultima' : ''}`}
              disabled={cargando}
              onClick={() => enviarCodigo(a.nombre)}
            >
              <span className="avatar" style={{ background: a.color }}>{a.nombre[0]}</span>
              <span className="nombre">{a.nombre}</span>
              {cargando && elegida === a.nombre && <span className="mini">Enviando…</span>}
            </button>
          </li>
        ))}
      </ul>

      {error && <p className="error">{error}</p>}
    </main>
  );
}
