import SEO from '../../../components/landing/common/SEO';
import Pricing from '../../../components/landing/sections/Pricing';

export default function PricingPage() {
  return (
    <>
      <SEO
        title="Precios — PlexifyStudio CRM"
        description="Planes transparentes para cada etapa de tu negocio. CRM completo con WhatsApp y Lina IA. Sin contratos, cancela cuando quieras."
        url="/pricing"
      />
      <Pricing />
    </>
  );
}
