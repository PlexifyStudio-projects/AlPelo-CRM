import { Helmet } from 'react-helmet-async';

const DEFAULT_SEO = {
  siteName: 'PlexifyStudio CRM',
  defaultTitle: 'PlexifyStudio CRM — Gestión Inteligente de Clientes',
  defaultDescription:
    'PlexifyStudio CRM es la plataforma integral para gestionar clientes, automatizar citas, potenciar tu marketing y hacer crecer cualquier negocio con inteligencia artificial.',
  defaultImage: '/images/og-image.jpg',
  siteUrl: 'https://plexifystudio.com',
  twitterHandle: '@plexifystudio',
  locale: 'es_ES',
};

const defaultStructuredData = {
  organization: {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "PlexifyStudio",
    "url": "https://plexifystudio.com",
    "logo": "https://plexifystudio.com/images/logo.png",
    "contactPoint": {
      "@type": "ContactPoint",
      "email": "contact@plexifystudio.com",
      "contactType": "customer service",
      "availableLanguage": "Spanish"
    },
    "sameAs": []
  },
  software: {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "PlexifyStudio CRM",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "description": "Plataforma CRM integral con inteligencia artificial para gestionar clientes, automatizar citas, marketing por WhatsApp y finanzas.",
    "offers": {
      "@type": "AggregateOffer",
      "lowPrice": "190000",
      "highPrice": "490000",
      "priceCurrency": "COP"
    }
  },
  website: {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "PlexifyStudio CRM",
    "url": "https://plexifystudio.com"
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

  return (
    <Helmet>
      {/* Base */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={fullUrl} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}

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

      {/* JSON-LD Structured Data */}
      {Object.values(schemasToRender).map((schema, index) => (
        <script key={index} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
}
