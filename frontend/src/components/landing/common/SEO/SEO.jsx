import { Helmet } from 'react-helmet-async';

const DEFAULT_SEO = {
  siteName: 'Plexify Studio',
  defaultTitle: 'Plexify Studio | Software para Peluquerias y Negocios de Servicios en Colombia',
  defaultDescription:
    'Software para peluquerias en Colombia con CRM, sistema de citas, WhatsApp Business integrado e inteligencia artificial. Agenda online, automatizaciones y gestion de clientes para salones de belleza, barberias y spas. Planes desde $190.000 COP/mes.',
  defaultImage: '/AlPelo-CRM/icon-192.svg',
  siteUrl: 'https://plexifystudio-projects.github.io/AlPelo-CRM',
  twitterHandle: '@plexifystudio',
  locale: 'es_CO',
};

const defaultStructuredData = {
  organization: {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Plexify Studio",
    "url": "https://plexifystudio-projects.github.io/AlPelo-CRM",
    "logo": "https://plexifystudio-projects.github.io/AlPelo-CRM/icon-192.svg",
    "description": "Software para peluquerias y negocios de servicios en Colombia. CRM con inteligencia artificial, sistema de citas, WhatsApp Business integrado y automatizaciones.",
    "foundingDate": "2026",
    "contactPoint": {
      "@type": "ContactPoint",
      "email": "contact@plexifystudio.com",
      "contactType": "customer service",
      "availableLanguage": ["Spanish"],
      "areaServed": ["CO", "MX", "AR", "CL", "PE", "EC"]
    },
    "areaServed": [
      { "@type": "Country", "name": "Colombia" },
      { "@type": "Place", "name": "Latinoamerica" }
    ],
    "sameAs": []
  },
  software: {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Plexify Studio",
    "applicationCategory": "BusinessApplication",
    "applicationSubCategory": "CRM Software",
    "operatingSystem": "Web",
    "description": "Software CRM para negocios de servicios con agenda online, WhatsApp Business integrado, Lina IA con 48 acciones, automatizaciones, finanzas, inventario y booking online.",
    "url": "https://plexifystudio-projects.github.io/AlPelo-CRM",
    "inLanguage": "es",
    "offers": [
      {
        "@type": "Offer",
        "name": "Plan Starter",
        "price": "190000",
        "priceCurrency": "COP",
        "priceValidUntil": "2026-12-31",
        "availability": "https://schema.org/InStock",
        "description": "CRM completo, agenda online, sistema de citas, inbox WhatsApp, Lina IA 1.000 mensajes y 10 automatizaciones"
      },
      {
        "@type": "Offer",
        "name": "Plan Pro",
        "price": "390000",
        "priceCurrency": "COP",
        "priceValidUntil": "2026-12-31",
        "availability": "https://schema.org/InStock",
        "description": "Todo Starter + Lina IA 3.000 mensajes, 25 automatizaciones, campanas masivas ilimitadas y soporte prioritario"
      },
      {
        "@type": "Offer",
        "name": "Plan Business",
        "price": "590000",
        "priceCurrency": "COP",
        "priceValidUntil": "2026-12-31",
        "availability": "https://schema.org/InStock",
        "description": "Todo Pro + Lina IA 5.000 mensajes, 50 automatizaciones, soporte dedicado 24/7 y onboarding personalizado"
      }
    ],
    "featureList": "CRM de clientes, Agenda con drag-and-drop, WhatsApp Business integrado, Automation Studio con 29 triggers, Lina IA con 48 acciones, Finanzas con P&L y nomina, Programa de lealtad, Campanas masivas WhatsApp, Gestion de equipo y comisiones, Inventario, Booking online, Soporte multi-sede, Analisis de sentimiento"
  },
  website: {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Plexify Studio",
    "url": "https://plexifystudio-projects.github.io/AlPelo-CRM",
    "inLanguage": "es",
    "description": "Software para peluquerias, salones de belleza, barberias y spas en Colombia. CRM con WhatsApp Business integrado, sistema de citas e inteligencia artificial."
  }
};

export default function SEO({
  title,
  description = DEFAULT_SEO.defaultDescription,
  image = DEFAULT_SEO.defaultImage,
  url,
  type = 'website',
  noindex = false,
  structuredData = null,
  keywords = '',
  breadcrumbs = null,
}) {
  const fullTitle = title
    ? `${title} | ${DEFAULT_SEO.siteName}`
    : DEFAULT_SEO.defaultTitle;

  const fullUrl = url
    ? `${DEFAULT_SEO.siteUrl}${url}`
    : DEFAULT_SEO.siteUrl;

  const fullImage = image.startsWith('http')
    ? image
    : `${DEFAULT_SEO.siteUrl}${image}`;

  const schemasToRender = structuredData || defaultStructuredData;

  // Build BreadcrumbList schema when breadcrumbs are provided
  const breadcrumbSchema = breadcrumbs ? {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbs.map((crumb, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": crumb.name,
      "item": crumb.url ? `${DEFAULT_SEO.siteUrl}${crumb.url}` : undefined,
    })),
  } : null;

  return (
    <Helmet>
      {/* Base */}
      <html lang="es" />
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={fullUrl} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      {!noindex && <meta name="robots" content="index, follow" />}
      {keywords && <meta name="keywords" content={keywords} />}
      <meta name="author" content="Plexify Studio" />
      <meta name="geo.region" content="CO" />
      <meta name="geo.placename" content="Colombia" />
      <meta name="content-language" content="es-CO" />

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={fullImage} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:site_name" content={DEFAULT_SEO.siteName} />
      <meta property="og:locale" content={DEFAULT_SEO.locale} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content={DEFAULT_SEO.twitterHandle} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={fullImage} />
      <meta name="twitter:creator" content={DEFAULT_SEO.twitterHandle} />

      {/* JSON-LD Structured Data */}
      {Object.values(schemasToRender).map((schema, index) => (
        <script key={index} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
      {breadcrumbSchema && (
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbSchema)}
        </script>
      )}
    </Helmet>
  );
}
