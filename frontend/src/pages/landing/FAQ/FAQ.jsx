import SEO from '../../../components/landing/common/SEO';
import FAQSection from '../../../components/landing/sections/FAQ';
import FinalCTA from '../../../components/landing/sections/FinalCTA';

export default function FAQPage() {
  return (
    <>
      <SEO
        title="Preguntas Frecuentes — Software para Peluquerias y Negocios"
        description="Resuelva sus dudas sobre PlexifyStudio: precios, WhatsApp Business, Lina IA, sistema de citas, seguridad de datos y como funciona el software para peluquerias y negocios de servicios en Colombia."
        url="/faq"
        keywords="preguntas frecuentes software peluqueria colombia, dudas CRM salon de belleza, como funciona sistema de citas, es seguro plexify studio, software para negocios de servicios"
      />

      <section className="page-hero" aria-label="Preguntas frecuentes sobre el software para peluquerias y negocios de servicios">
        <div className="page-hero__container">
          <h1 className="page-hero__title">Preguntas Frecuentes sobre el Software para Negocios</h1>
          <p className="page-hero__subtitle">
            Todo lo que necesita saber sobre PlexifyStudio antes de tomar una decision.
          </p>
        </div>
      </section>

      <FAQSection />
      <FinalCTA />
    </>
  );
}
