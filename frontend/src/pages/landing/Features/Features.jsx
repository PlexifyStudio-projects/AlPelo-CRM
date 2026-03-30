import SEO from '../../../components/landing/common/SEO';
import Features from '../../../components/landing/sections/Features';
import LinaAI from '../../../components/landing/sections/LinaAI';
import FinalCTA from '../../../components/landing/sections/FinalCTA';

export default function FeaturesPage() {
  return (
    <>
      <SEO
        title="Funcionalidades — 14 Modulos en Una Plataforma"
        description="Agenda online, CRM de clientes, WhatsApp marketing, finanzas, automatizaciones y Lina IA. 14 modulos para gestionar tu peluqueria, salon de belleza o spa."
        url="/features"
        keywords="funcionalidades software peluqueria, que incluye un CRM para salon, modulos sistema de gestion barberia, herramientas para administrar spa"
      />

      <section className="page-hero" aria-label="Características de PlexifyStudio">
        <div className="page-hero__container">
          <h1 className="page-hero__title">Características</h1>
          <p className="page-hero__subtitle">
            Todo lo que necesitas para gestionar, automatizar y hacer crecer tu negocio en una sola plataforma.
          </p>
        </div>
      </section>

      <Features />
      <LinaAI />
      <FinalCTA />
    </>
  );
}
