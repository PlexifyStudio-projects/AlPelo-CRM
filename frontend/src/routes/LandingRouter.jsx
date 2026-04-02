import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import LandingLayout from '../components/landing/layout/Layout';

const Loader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
    <div style={{ width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const SuspenseWrapper = ({ children }) => (
  <Suspense fallback={<Loader />}>{children}</Suspense>
);

const Home = lazy(() => import('../pages/landing/Home'));
const About = lazy(() => import('../pages/landing/About'));
const Features = lazy(() => import('../pages/landing/Features'));
const Pricing = lazy(() => import('../pages/landing/Pricing'));
const Contact = lazy(() => import('../pages/landing/Contact'));
const FAQ = lazy(() => import('../pages/landing/FAQ'));
const Legal = lazy(() => import('../pages/landing/Legal'));
const LandingNotFound = lazy(() => import('../pages/landing/NotFound'));
const Register = lazy(() => import('../pages/landing/Register'));
const LinaIA = lazy(() => import('../pages/landing/LinaIA'));
const Finanzas = lazy(() => import('../pages/landing/Finanzas'));
const Automatizaciones = lazy(() => import('../pages/landing/Automatizaciones'));

const ProdClientes = lazy(() => import('../pages/landing/Producto/Clientes'));
const ProdAgenda = lazy(() => import('../pages/landing/Producto/Agenda'));
const ProdCampanas = lazy(() => import('../pages/landing/Producto/Campanas'));
const ProdServicios = lazy(() => import('../pages/landing/Producto/Servicios'));
const ProdEquipo = lazy(() => import('../pages/landing/Producto/Equipo'));
const ProdLealtad = lazy(() => import('../pages/landing/Producto/Lealtad'));

const BookingPage = lazy(() => import('../pages/landing/Booking/BookingPage'));

const W = SuspenseWrapper;

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '') || '';

const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingLayout />,
    children: [
      { index: true, element: <W><Home /></W> },
      { path: 'about', element: <W><About /></W> },
      { path: 'features', element: <W><Features /></W> },
      { path: 'pricing', element: <W><Pricing /></W> },
      { path: 'contact', element: <W><Contact /></W> },
      { path: 'faq', element: <W><FAQ /></W> },
      { path: 'legal', element: <W><Legal /></W> },
      { path: 'register', element: <W><Register /></W> },
      { path: 'lina-ia', element: <W><LinaIA /></W> },
      { path: 'finanzas', element: <W><Finanzas /></W> },
      { path: 'automatizaciones', element: <W><Automatizaciones /></W> },
      { path: 'producto/clientes', element: <W><ProdClientes /></W> },
      { path: 'producto/agenda', element: <W><ProdAgenda /></W> },
      { path: 'producto/campanas', element: <W><ProdCampanas /></W> },
      { path: 'producto/servicios', element: <W><ProdServicios /></W> },
      { path: 'producto/equipo', element: <W><ProdEquipo /></W> },
      { path: 'producto/lealtad', element: <W><ProdLealtad /></W> },
      { path: 'book/:slug', element: <W><BookingPage /></W> },
    ],
  },
], { basename: BASE });

export default function LandingRouter() {
  return <RouterProvider router={router} />;
}
