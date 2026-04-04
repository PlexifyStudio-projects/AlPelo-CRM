import SEO from '../../../components/landing/common/SEO';
import Features from '../../../components/landing/sections/Features';
import LinaAI from '../../../components/landing/sections/LinaAI';
import FinalCTA from '../../../components/landing/sections/FinalCTA';

export default function FeaturesPage() {
  return (
    <>
      <SEO
        title="Funcionalidades del Software para Peluquerias y Negocios de Servicios"
        description="Sistema de citas, agenda online, CRM de clientes, WhatsApp Business integrado, finanzas, automatizaciones, inventario, booking online y Lina IA. Software completo para peluquerias, salones, barberias y spas en Colombia."
        url="/features"
        keywords="funcionalidades software peluqueria colombia, que incluye un CRM para salon, modulos sistema de gestion barberia, herramientas para administrar spa, sistema de citas colombia"
      />

      <section className="page-hero" aria-label="Funcionalidades del software para peluquerias y negocios de servicios">
        <div className="page-hero__container">
          <h1 className="page-hero__title">Funcionalidades del Software para Negocios de Servicios</h1>
          <p className="page-hero__subtitle">
            Todo lo que necesita para gestionar, automatizar y hacer crecer su negocio de servicios en una sola plataforma.
          </p>
        </div>
      </section>

      <Features />
      <LinaAI />
      <FinalCTA />
    </>
  );
}
