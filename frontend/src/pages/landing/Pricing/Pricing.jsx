import SEO from '../../../components/landing/common/SEO';
import Pricing from '../../../components/landing/sections/Pricing';

export default function PricingPage() {
  return (
    <>
      <SEO
        title="Precios y Planes — Software para Peluquerias desde $190.000/mes"
        description="Planes desde $190.000 COP/mes para su peluqueria, salon o spa en Colombia. Incluye sistema de citas, agenda online, WhatsApp Business integrado, CRM de clientes y Lina IA. Sin contratos, cancele cuando quiera."
        url="/pricing"
        keywords="precio software peluqueria colombia, cuanto cuesta un sistema para salon, planes CRM barberia, software de citas para spa precio, sistema de gestion economico colombia"
      />
      <Pricing isPage />
    </>
  );
}
