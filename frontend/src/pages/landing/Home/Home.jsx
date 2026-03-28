import SEO from '../../../components/landing/common/SEO';
import Hero from '../../../components/landing/sections/Hero';

import Stats from '../../../components/landing/sections/Stats';
import Features from '../../../components/landing/sections/Features';
// DayInLife removed
import LinaAI from '../../../components/landing/sections/LinaAI';

import Testimonials from '../../../components/landing/sections/Testimonials';
import Pricing from '../../../components/landing/sections/Pricing';
// Demo and FinalCTA removed

export default function Home() {
  return (
    <>
      <SEO
        title="Inicio"
        description="Plataforma CRM integral con IA para gestionar clientes, automatizar citas por WhatsApp y potenciar el marketing de cualquier negocio."
        url="/"
      />
      <Hero />
      <LinaAI />
      <Stats />
      <Features />
      <Testimonials />
      <Pricing />
    </>
  );
}
