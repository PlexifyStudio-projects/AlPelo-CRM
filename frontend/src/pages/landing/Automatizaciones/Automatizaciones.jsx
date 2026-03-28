import SEO from '../../../components/landing/common/SEO';
import FinalCTA from '../../../components/landing/sections/FinalCTA';

export default function Automatizaciones() {
  return (
    <>
      <SEO
        title="Automatizaciones — Workflows WhatsApp Inteligentes"
        description="Workflows automáticos con Meta API: recordatorios 24h y 1h, cumpleaños, reactivación, no-show, bienvenida y VIP. Toggle ON/OFF con aprobación Meta."
        url="/automatizaciones"
      />

      <main className="product-page">
        {/* ── Hero ── */}
        <section className="product-hero">
          <div className="product-hero__container">
            <span className="product-hero__badge">Automatizaciones</span>
            <h1 className="product-hero__title">
              Workflows <span className="product-hero__title-accent">Inteligentes</span>
            </h1>
            <p className="product-hero__subtitle">
              Motor de automatizaciones con integración directa a Meta API. Cada plantilla pasa por aprobación oficial de WhatsApp. Activa o desactiva cada workflow con un toggle.
            </p>

            <div className="product-hero__stats">
              <div className="product-hero__stat">
                <span className="product-hero__stat-value">10+</span>
                <span className="product-hero__stat-label">Workflows pre-diseñados</span>
              </div>
              <div className="product-hero__stat">
                <span className="product-hero__stat-value">Meta</span>
                <span className="product-hero__stat-label">API integrada</span>
              </div>
              <div className="product-hero__stat">
                <span className="product-hero__stat-value">ON/OFF</span>
                <span className="product-hero__stat-label">Toggle instantáneo</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Tipos de Workflow — Feature Cards ── */}
        <section className="product-features">
          <div className="product-features__container">
            <h2 className="product-features__heading">Automatiza lo repetitivo, enfócate en lo importante</h2>

            <div className="product-features__grid product-features__grid--six">
              {/* 1 — Recordatorios */}
              <article className="product-features__card">
                <div className="product-features__icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </div>
                <h3 className="product-features__card-title">Recordatorios de Cita</h3>
                <p className="product-features__card-text">
                  Envío automático 24h y 1h antes de cada cita por WhatsApp. Un solo no-show evitado al mes ya paga tu suscripción. Reduce ausencias hasta un 80%.
                </p>
              </article>

              {/* 2 — Cumpleaños */}
              <article className="product-features__card">
                <div className="product-features__icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <h3 className="product-features__card-title">Felicitación de Cumpleaños</h3>
                <p className="product-features__card-text">
                  La automatización con mayor tasa de respuesta. Genera lealtad emocional con mensajes personalizados automáticos el día del cumpleaños del cliente.
                </p>
              </article>

              {/* 3 — Reactivación */}
              <article className="product-features__card">
                <div className="product-features__icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                </div>
                <h3 className="product-features__card-title">Reactivación de Inactivos</h3>
                <p className="product-features__card-text">
                  Detecta clientes que llevan 30+ días sin venir y envía mensajes de recuperación. Configura los días de inactividad. Recuperar 1 cliente por semana transforma tu revenue.
                </p>
              </article>

              {/* 4 — No-Show */}
              <article className="product-features__card">
                <div className="product-features__icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                </div>
                <h3 className="product-features__card-title">Seguimiento No-Show</h3>
                <p className="product-features__card-text">
                  Cuando un cliente no asiste, Lina envía un seguimiento con tono amable para reagendar. El tono correcto recupera más citas que uno agresivo.
                </p>
              </article>

              {/* 5 — Bienvenida */}
              <article className="product-features__card">
                <div className="product-features__icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <h3 className="product-features__card-title">Bienvenida Automática</h3>
                <p className="product-features__card-text">
                  Un cliente que recibe bienvenida tiene 3x más probabilidad de volver. Mensaje automático al primer contacto con información del negocio y servicios.
                </p>
              </article>

              {/* 6 — Post-Visita y Reseñas */}
              <article className="product-features__card">
                <div className="product-features__icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </div>
                <h3 className="product-features__card-title">Post-Visita y Reseñas</h3>
                <p className="product-features__card-text">
                  Tras cada servicio, envía agradecimiento y link a Google Reviews automáticamente. Solo solicita reseña a clientes satisfechos para mantener tu rating alto.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* ── Workflows Detallados ── */}
        <section className="product-workflows">
          <div className="product-workflows__container">
            <h2 className="product-workflows__heading">Workflows por categoría</h2>
            <p className="product-workflows__subheading">
              Cada workflow incluye plantilla editable, aprobación Meta, configuración de horario y estadísticas de envío.
            </p>

            <div className="product-workflows__grid">
              <div className="product-workflows__card">
                <div className="product-workflows__card-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div className="product-workflows__card-body">
                  <div className="product-workflows__card-header">
                    <h3 className="product-workflows__card-title">Recordatorio 24h</h3>
                    <span className="product-workflows__card-badge product-workflows__card-badge--whatsapp">Citas</span>
                  </div>
                  <p className="product-workflows__card-text">Se activa 24 horas antes de la cita. Incluye nombre del cliente, servicio y horario.</p>
                  <div className="product-workflows__card-toggle">
                    <span className="product-workflows__toggle-pill" />
                    Activado
                  </div>
                </div>
              </div>

              <div className="product-workflows__card">
                <div className="product-workflows__card-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div className="product-workflows__card-body">
                  <div className="product-workflows__card-header">
                    <h3 className="product-workflows__card-title">Recordatorio 1h</h3>
                    <span className="product-workflows__card-badge product-workflows__card-badge--whatsapp">Citas</span>
                  </div>
                  <p className="product-workflows__card-text">Complemento perfecto del recordatorio 24h. Juntos reducen no-shows hasta un 80%.</p>
                  <div className="product-workflows__card-toggle">
                    <span className="product-workflows__toggle-pill" />
                    Activado
                  </div>
                </div>
              </div>

              <div className="product-workflows__card">
                <div className="product-workflows__card-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <div className="product-workflows__card-body">
                  <div className="product-workflows__card-header">
                    <h3 className="product-workflows__card-title">Cumpleaños</h3>
                    <span className="product-workflows__card-badge product-workflows__card-badge--marketing">Marketing</span>
                  </div>
                  <p className="product-workflows__card-text">Felicitación automática el día del cumpleaños. Mayor tasa de respuesta de todas las automatizaciones.</p>
                  <div className="product-workflows__card-toggle">
                    <span className="product-workflows__toggle-pill" />
                    Activado
                  </div>
                </div>
              </div>

              <div className="product-workflows__card">
                <div className="product-workflows__card-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                </div>
                <div className="product-workflows__card-body">
                  <div className="product-workflows__card-header">
                    <h3 className="product-workflows__card-title">Reactivación</h3>
                    <span className="product-workflows__card-badge product-workflows__card-badge--marketing">Marketing</span>
                  </div>
                  <p className="product-workflows__card-text">Detecta clientes inactivos (configurable: 30, 45, 60 o 90 días) y envía mensaje de recuperación.</p>
                  <div className="product-workflows__card-toggle">
                    <span className="product-workflows__toggle-pill" />
                    Activado
                  </div>
                </div>
              </div>

              <div className="product-workflows__card">
                <div className="product-workflows__card-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </div>
                <div className="product-workflows__card-body">
                  <div className="product-workflows__card-header">
                    <h3 className="product-workflows__card-title">Auto VIP</h3>
                    <span className="product-workflows__card-badge product-workflows__card-badge--crm">CRM</span>
                  </div>
                  <p className="product-workflows__card-text">Reconoce automáticamente a tus mejores clientes. Tus VIP son el 20% que genera el 80% de ingresos.</p>
                  <div className="product-workflows__card-toggle">
                    <span className="product-workflows__toggle-pill" />
                    Activado
                  </div>
                </div>
              </div>

              <div className="product-workflows__card">
                <div className="product-workflows__card-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <div className="product-workflows__card-body">
                  <div className="product-workflows__card-header">
                    <h3 className="product-workflows__card-title">Resumen Diario</h3>
                    <span className="product-workflows__card-badge product-workflows__card-badge--crm">Interno</span>
                  </div>
                  <p className="product-workflows__card-text">Reporte diario automático para dueños con múltiples negocios o que no están presentes todo el día.</p>
                  <div className="product-workflows__card-toggle">
                    <span className="product-workflows__toggle-pill" />
                    Activado
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Cómo Funciona ── */}
        <section className="product-steps">
          <div className="product-steps__container">
            <h2 className="product-steps__heading">Cómo funciona</h2>

            <div className="product-steps__grid">
              <div className="product-steps__item">
                <span className="product-steps__number">1</span>
                <h3 className="product-steps__item-title">Personaliza</h3>
                <p className="product-steps__item-text">
                  Edita el mensaje de cada plantilla con las variables de tu negocio. Ajusta el timing y las condiciones.
                </p>
              </div>

              <div className="product-steps__item">
                <span className="product-steps__number">2</span>
                <h3 className="product-steps__item-title">Aprobación Meta</h3>
                <p className="product-steps__item-text">
                  Envía las plantillas a Meta con un clic. El sistema gestiona el ciclo completo: borrador, pendiente, aprobada o rechazada.
                </p>
              </div>

              <div className="product-steps__item">
                <span className="product-steps__number">3</span>
                <h3 className="product-steps__item-title">Toggle ON/OFF</h3>
                <p className="product-steps__item-text">
                  Una vez aprobada por Meta, activa el workflow con un toggle. Se ejecuta automáticamente sin intervención.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Mockup Placeholder ── */}
        <section className="product-mockup">
          <div className="product-mockup__container">
            <div className="product-mockup__placeholder" aria-label="Vista previa del módulo de automatizaciones">
              <span className="product-mockup__label">Automatizaciones — Vista Previa</span>
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <FinalCTA />
      </main>
    </>
  );
}
