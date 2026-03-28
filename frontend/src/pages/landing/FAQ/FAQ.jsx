import SEO from '../../../components/landing/common/SEO';
import FAQSection from '../../../components/landing/sections/FAQ';
import FinalCTA from '../../../components/landing/sections/FinalCTA';

export default function FAQPage() {
  return (
    <>
      <SEO
        title="Preguntas Frecuentes"
        description="Resuelve todas tus dudas sobre PlexifyStudio CRM. Preguntas frecuentes sobre funcionalidades, precios, Lina IA y más."
        url="/faq"
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
