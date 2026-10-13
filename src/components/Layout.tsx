// src/components/Layout.tsx — barra superior + barra de pestañas inferior
import { Link, NavLink, Outlet } from 'react-router-dom';
import { C } from '../lib/ui';

const PESTANAS = [
  { to: '/', texto: 'Planes', icono: '🗓️', end: true },
  { to: '/calendario', texto: 'Calendario', icono: '📆' },
  { to: '/encuesta', texto: 'Encuesta', icono: '📊' },
  { to: '/xiques', texto: 'Xiques', icono: '💞' },
  { to: '/grupo', texto: 'Grupo', icono: '👯' },
];

export default function Layout() {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: C.fondo }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 10, background: C.blanco, borderBottom: `1px solid ${C.borde}`,
        padding: 'calc(env(safe-area-inset-top, 0px) + 10px) 16px 10px', display: 'flex', alignItems: 'center', gap: 4,
      }}>
        <Link to="/" style={{ flex: 1, fontWeight: 800, fontSize: 20, color: C.morado, textDecoration: 'none' }}>
          Xiquedadas
        </Link>
        <Link to="/normas" aria-label="Normas" style={{ fontSize: 22, padding: 6, textDecoration: 'none' }}>📜</Link>
        <Link to="/ajustes" aria-label="Ajustes" style={{ fontSize: 22, padding: 6, textDecoration: 'none' }}>⚙️</Link>
      </header>

      <div style={{ flex: 1, paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)' }}>
        <Outlet />
      </div>

      <nav style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 10, display: 'flex',
        background: C.blanco, borderTop: `1px solid ${C.borde}`, paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        {PESTANAS.map((p) => (
          <NavLink key={p.to} to={p.to} end={p.end} style={({ isActive }) => ({
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '8px 0',
            fontSize: 11, textDecoration: 'none', color: isActive ? C.morado : C.suave, fontWeight: isActive ? 700 : 500,
          })}>
            <span style={{ fontSize: 20 }}>{p.icono}</span>
            {p.texto}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
