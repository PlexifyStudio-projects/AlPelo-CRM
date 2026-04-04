import SEO from '../../../components/landing/common/SEO';

const CONTACT_INFO = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M22 4l-10 8L2 4" />
      </svg>
    ),
    label: 'Email',
    value: 'contact@plexifystudio.com',
    href: 'mailto:contact@plexifystudio.com',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    label: 'Horario',
    value: 'Lunes a Viernes, 9am - 6pm (COT)',
    href: null,
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    label: 'Respuesta',
    value: 'Respondemos en menos de 24 horas',
    href: null,
  },
];

export default function Contact() {
  return (
    <>
      <SEO
        title="Contacto — Soporte para Software de Peluquerias y Negocios"
        description="Escribanos y resolvemos sus dudas sobre PlexifyStudio. Soporte en espanol para peluquerias, salones de belleza, barberias y spas en Colombia. Respuesta en menos de 24 horas."
        url="/contact"
        keywords="contacto plexify studio, soporte software peluqueria colombia, atencion al cliente CRM salon, ayuda sistema de citas, software para negocios de servicios"
      />

      <section className="page-hero" aria-label="Contáctanos">
        <div className="page-hero__container">
          <h1 className="page-hero__title">Contacto — Soporte para Peluquerías y Salones</h1>
          <p className="page-hero__subtitle">
            ¿Tiene preguntas o quiere ver una demo personalizada? Escríbanos y le respondemos en menos de 24 horas.
          </p>
        </div>
      </section>

      <section className="contact-hero" aria-label="Información de contacto">
        <div className="contact-hero__container">
          <div className="contact-hero__cards">
            {CONTACT_INFO.map(({ icon, label, value, href }) => (
              <article key={label} className="contact-hero__card">
                <div className="contact-hero__card-icon" aria-hidden="true">
                  {icon}
                </div>
                <h3 className="contact-hero__card-label">{label}</h3>
                {href ? (
                  <a className="contact-hero__card-value contact-hero__card-value--link" href={href}>
                    {value}
                  </a>
                ) : (
                  <p className="contact-hero__card-value">{value}</p>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

    </>
  );
}
