import { Helmet } from 'react-helmet-async';

const DEFAULT_SEO = {
  siteName: 'Plexify Studio',
  defaultTitle: 'Plexify Studio | Software para Peluquerias y Salones de Belleza',
  defaultDescription:
    'Software de gestion para peluquerias, barberias, salones de belleza y spas. Agenda online, WhatsApp marketing, CRM de clientes y automatizaciones con inteligencia artificial.',
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
    "description": "Software de gestion con inteligencia artificial para negocios de servicios en Colombia y Latinoamerica.",
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
    "description": "Software de gestion integral para peluquerias, salones de belleza, barberias y spas. Agenda online, CRM de clientes, campanas WhatsApp y automatizaciones con IA.",
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
        "description": "CRM completo, agenda, inbox WhatsApp, Lina IA y 5 automatizaciones"
      },
      {
        "@type": "Offer",
        "name": "Plan Pro",
        "price": "390000",
        "priceCurrency": "COP",
        "priceValidUntil": "2026-12-31",
        "availability": "https://schema.org/InStock",
        "description": "Todo Starter + finanzas avanzadas, comisiones, lealtad y 12 automatizaciones"
      },
      {
        "@type": "Offer",
        "name": "Plan Business",
        "price": "590000",
        "priceCurrency": "COP",
        "priceValidUntil": "2026-12-31",
        "availability": "https://schema.org/InStock",
        "description": "Todo Pro + campanas ilimitadas, soporte dedicado y 20 automatizaciones"
      }
    ],
    "featureList": "CRM de clientes, Agenda online, WhatsApp Business, Automatizaciones, Lina IA, Finanzas, Programa de lealtad, Campanas masivas"
  },
  website: {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Plexify Studio",
    "url": "https://plexifystudio-projects.github.io/AlPelo-CRM",
    "inLanguage": "es",
    "description": "Software de gestion para peluquerias, salones de belleza, barberias y spas en Colombia y Latinoamerica."
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
