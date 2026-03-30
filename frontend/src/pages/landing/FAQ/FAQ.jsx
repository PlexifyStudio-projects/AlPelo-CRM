import SEO from '../../../components/landing/common/SEO';
import FAQSection from '../../../components/landing/sections/FAQ';
import FinalCTA from '../../../components/landing/sections/FinalCTA';

export default function FAQPage() {
  return (
    <>
      <SEO
        title="Preguntas Frecuentes — Dudas Resueltas"
        description="Resuelve tus dudas sobre Plexify Studio: precios, WhatsApp Business, Lina IA, seguridad de datos y como funciona. Todo lo que necesitas saber antes de empezar."
        url="/faq"
        keywords="preguntas frecuentes software peluqueria, dudas CRM salon de belleza, como funciona sistema de citas, es seguro plexify studio"
      />

      <section className="page-hero" aria-label="Preguntas Frecuentes">
        <div className="page-hero__container">
          <h1 className="page-hero__title">Preguntas Frecuentes</h1>
          <p className="page-hero__subtitle">
            Todo lo que necesitas saber sobre PlexifyStudio CRM antes de tomar una decisión.
          </p>
        </div>
      </section>

      <FAQSection />
      <FinalCTA />
    </>
  );
}
