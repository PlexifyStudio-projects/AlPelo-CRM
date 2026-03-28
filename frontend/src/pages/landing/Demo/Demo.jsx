import SEO from '../../../components/landing/common/SEO';
import Demo from '../../../components/landing/sections/Demo';
import Testimonials from '../../../components/landing/sections/Testimonials';

export default function DemoPage() {
  return (
    <>
      <SEO
        title="Agendar Demo"
        description="Agenda una demostración personalizada de PlexifyStudio CRM y descubre cómo transformar la gestión de tu negocio."
        url="/demo"
      />

      <section className="page-hero" aria-label="Agendar Demo">
        <div className="page-hero__container">
          <h1 className="page-hero__title">Agenda tu Demo</h1>
          <p className="page-hero__subtitle">
            Te mostramos la plataforma en vivo, con datos reales adaptados a tu tipo de negocio. Sin compromiso, sin costo.
          </p>
        </div>
      </section>

      <Demo />
      <Testimonials />
    </>
  );
}
