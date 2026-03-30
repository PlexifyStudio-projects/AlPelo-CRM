import SEO from '../../../components/landing/common/SEO';
import Pricing from '../../../components/landing/sections/Pricing';

export default function PricingPage() {
  return (
    <>
      <SEO
        title="Precios y Planes desde $190.000/mes"
        description="Planes desde $190.000 COP/mes para tu peluqueria, salon o spa. Incluye agenda online, WhatsApp, CRM de clientes y Lina IA. Sin contratos, cancela cuando quieras."
        url="/pricing"
        keywords="precio software peluqueria, cuanto cuesta un sistema para salon, planes CRM barberia, software de citas para spa precio, sistema de gestion economico"
      />
      <Pricing isPage />
    </>
  );
}
