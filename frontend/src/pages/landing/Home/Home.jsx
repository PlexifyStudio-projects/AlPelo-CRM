import { lazy, Suspense } from 'react';
import SEO from '../../../components/landing/common/SEO';
import Hero from '../../../components/landing/sections/Hero';

// Secciones below-the-fold — carga diferida para mejorar LCP
const LinaAI = lazy(() => import('../../../components/landing/sections/LinaAI'));
const Stats = lazy(() => import('../../../components/landing/sections/Stats'));
const Features = lazy(() => import('../../../components/landing/sections/Features'));
const Testimonials = lazy(() => import('../../../components/landing/sections/Testimonials'));
const Pricing = lazy(() => import('../../../components/landing/sections/Pricing'));

export default function Home() {
  return (
    <>
      <SEO
        title="Software para Peluquerias y Salones de Belleza"
        description="Gestiona tu peluqueria, barberia o salon con agenda online, WhatsApp marketing, CRM de clientes y automatizaciones con IA. Planes desde $190.000 COP/mes."
        url="/"
        keywords="software para peluquerias, sistema de citas para salon, agenda online barberia, CRM para salones de belleza, programa para administrar peluqueria, app de citas para spa"
      />
      {/* Hero se carga eagerly — es above-the-fold y define el LCP */}
      <Hero />
      {/* Secciones below-the-fold con lazy loading */}
      <Suspense fallback={null}>
        <LinaAI />
      </Suspense>
      <Suspense fallback={null}>
        <Stats />
      </Suspense>
      <Suspense fallback={null}>
        <Features />
      </Suspense>
      <Suspense fallback={null}>
        <Testimonials />
      </Suspense>
      <Suspense fallback={null}>
        <Pricing />
      </Suspense>
    </>
  );
}
