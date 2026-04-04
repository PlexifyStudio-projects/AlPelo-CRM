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
        title="Software para Peluquerias en Colombia — CRM con WhatsApp e IA"
        description="El mejor software para peluquerias en Colombia. CRM con WhatsApp Business integrado, sistema de citas, agenda online e inteligencia artificial. Gestione su peluqueria, barberia, salon o spa desde una sola plataforma. Planes desde $190.000 COP/mes."
        url="/"
        keywords="software para peluquerias colombia, crm para negocios de servicios, sistema de citas colombia, whatsapp business crm, software gestion spa, sistema de agenda online, mejor software para barberia en colombia, crm con whatsapp integrado"
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
