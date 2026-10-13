// src/App.tsx — sin sesión: pantalla "¿Quién eres?"; con sesión: la app con sus pestañas
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { PerfilesProvider } from './lib/perfiles';
import Layout from './components/Layout';
import Entrada from './pages/Entrada';
import Planes from './pages/Planes';
import NuevoPlan from './pages/NuevoPlan';
import DetallePlan from './pages/DetallePlan';
import Calendario from './pages/Calendario';
import EncuestaPage from './pages/Encuesta';
import MisXiques from './pages/MisXiques';
import Grupo from './pages/Grupo';
import Normas from './pages/Normas';
import Ajustes from './pages/Ajustes';

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Planes /> },
      { path: '/calendario', element: <Calendario /> },
      { path: '/encuesta', element: <EncuestaPage /> },
      { path: '/xiques', element: <MisXiques /> },
      { path: '/grupo', element: <Grupo /> },
      { path: '/plan/nuevo', element: <NuevoPlan /> }, // ?con=<id> o ?fecha=YYYY-MM-DD&franja=tarde
      { path: '/plan/:id', element: <DetallePlan /> },
      { path: '/normas', element: <Normas /> },
      { path: '/ajustes', element: <Ajustes /> },
      { path: '*', element: <Planes /> },
    ],
  },
]);

export default function App() {
  const [sesion, setSesion] = useState<Session | null>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSesion(data.session); setListo(true); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSesion(s));
    return () => subscription.unsubscribe();
  }, []);

  if (!listo) return null;
  if (!sesion) return <Entrada />;
  return (
    <PerfilesProvider>
      <RouterProvider router={router} />
    </PerfilesProvider>
  );
}
