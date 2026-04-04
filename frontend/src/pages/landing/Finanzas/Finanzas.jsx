import SEO from '../../../components/landing/common/SEO';
import FinalCTA from '../../../components/landing/sections/FinalCTA';

export default function Finanzas() {
  return (
    <>
      <SEO
        title="Finanzas y Reportes para Peluquerias y Negocios de Servicios"
        description="Controle ingresos, gastos, nomina, comisiones y facturacion de su peluqueria o negocio de servicios. Reportes en tiempo real, P&L automatico, IVA y KPIs financieros en una sola vista. Software financiero en COP."
        url="/finanzas"
        keywords="control financiero peluqueria, reportes de ventas negocio, comisiones empleados salon, facturacion colombia, como controlar gastos de mi negocio, nomina automatica"
      />

      <main className="product-page">
        {/* ── Hero ── */}
        <section className="product-hero">
          <div className="product-hero__container">
            <span className="product-hero__badge">Finanzas</span>
            <h1 className="product-hero__title">
              Finanzas y Reportes para <span className="product-hero__title-accent">su Negocio</span>
            </h1>
            <p className="product-hero__subtitle">
              Módulos financieros integrados: resumen ejecutivo, reportes comparativos, control de gastos con P&L automático, nómina y comisiones por profesional, facturación, IVA y rendimiento del equipo. Todo en tiempo real.
            </p>

            <div className="product-hero__stats">
              <div className="product-hero__stat">
                <span className="product-hero__stat-value">5</span>
                <span className="product-hero__stat-label">Sub-módulos</span>
              </div>
              <div className="product-hero__stat">
                <span className="product-hero__stat-value">P&L</span>
                <span className="product-hero__stat-label">Automático</span>
              </div>
              <div className="product-hero__stat">
                <span className="product-hero__stat-value">100%</span>
                <span className="product-hero__stat-label">Tiempo real</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── 5 Sub-módulos — Feature Cards ── */}
        <section className="product-features">
          <div className="product-features__container">
            <h2 className="product-features__heading">Todo el control financiero de su negocio</h2>

            <div className="product-features__grid product-features__grid--five">
              {/* 1 — Resumen */}
              <article className="product-features__card">
                <div className="product-features__icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                </div>
                <h3 className="product-features__card-title">Resumen Financiero</h3>
                <p className="product-features__card-text">
                  KPIs en tiempo real: ingresos totales, servicios realizados, clientes atendidos y ticket promedio. Gráficas de tendencia por día, semana, mes o año con comparativas de crecimiento.
                </p>
              </article>

              {/* 2 — Reportes */}
              <article className="product-features__card">
                <div className="product-features__icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                </div>
                <h3 className="product-features__card-title">Reportes Comparativos</h3>
                <p className="product-features__card-text">
                  Comparativa período actual vs anterior con porcentaje de crecimiento. Ranking de profesionales por revenue, desglose por servicio y distribución por método de pago.
                </p>
              </article>

              {/* 3 — Gastos */}
              <article className="product-features__card">
                <div className="product-features__icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                    <polyline points="17 6 23 6 23 12" />
                  </svg>
                </div>
                <h3 className="product-features__card-title">Gastos y P&L</h3>
                <p className="product-features__card-text">
                  Estado de pérdidas y ganancias automático: ingresos, gastos por categoría (arriendo, nómina, productos, servicios públicos), comisiones, ganancia neta y margen de beneficio.
                </p>
              </article>

              {/* 4 — Comisiones */}
              <article className="product-features__card">
                <div className="product-features__icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" y1="8" x2="19" y2="14" />
                    <line x1="22" y1="11" x2="16" y2="11" />
                  </svg>
                </div>
                <h3 className="product-features__card-title">Comisiones por Profesional</h3>
                <p className="product-features__card-text">
                  Cálculo automático de comisiones por cada profesional. Cards individuales con servicios realizados, revenue generado, tasa de comisión configurable y total a pagar.
                </p>
              </article>

              {/* 5 — Facturas */}
              <article className="product-features__card">
                <div className="product-features__icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
                    <path d="M8 10h8" />
                    <path d="M8 14h4" />
                  </svg>
                </div>
                <h3 className="product-features__card-title">Facturación</h3>
                <p className="product-features__card-text">
                  Emisión de facturas con detalle de servicios, KPIs de facturas emitidas, total facturado, facturas pagadas y pendientes. Registro completo y exportable.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* ── Sub-módulos con Tabs ── */}
        <section className="product-tabs">
          <div className="product-tabs__container">
            <h2 className="product-tabs__heading">5 vistas especializadas</h2>
            <p className="product-tabs__subheading">
              Navega entre módulos con un clic. Cada vista está diseñada para un aspecto financiero específico.
            </p>

            <div className="product-tabs__nav">
              <span className="product-tabs__tab product-tabs__tab--active">Resumen</span>
              <span className="product-tabs__tab">Reportes</span>
              <span className="product-tabs__tab">Gastos</span>
              <span className="product-tabs__tab">Comisiones</span>
              <span className="product-tabs__tab">Facturas</span>
            </div>

            <div className="product-tabs__content">
              <div className="product-tabs__item">
                <div className="product-tabs__item-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </div>
                <div className="product-tabs__item-body">
                  <h4 className="product-tabs__item-title">Ingresos totales con tendencia</h4>
                  <p className="product-tabs__item-text">Gráfica de área con ingresos diarios, ticket promedio y comparativa de crecimiento vs período anterior.</p>
                </div>
              </div>

              <div className="product-tabs__item">
                <div className="product-tabs__item-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                    <path d="M22 12A10 10 0 0 0 12 2v10z" />
                  </svg>
                </div>
                <div className="product-tabs__item-body">
                  <h4 className="product-tabs__item-title">Revenue por categoría de servicio</h4>
                  <p className="product-tabs__item-text">Gráfica de pie con distribución de ingresos por categoría y desglose de métodos de pago.</p>
                </div>
              </div>

              <div className="product-tabs__item">
                <div className="product-tabs__item-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                    <polyline points="17 6 23 6 23 12" />
                  </svg>
                </div>
                <div className="product-tabs__item-body">
                  <h4 className="product-tabs__item-title">Ranking de profesionales</h4>
                  <p className="product-tabs__item-text">Top performers por revenue generado, servicios realizados y rating promedio de clientes.</p>
                </div>
              </div>

              <div className="product-tabs__item">
                <div className="product-tabs__item-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                    <line x1="1" y1="10" x2="23" y2="10" />
                  </svg>
                </div>
                <div className="product-tabs__item-body">
                  <h4 className="product-tabs__item-title">Métodos de pago</h4>
                  <p className="product-tabs__item-text">Distribución visual por efectivo, transferencia, tarjeta y billeteras digitales.</p>
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
                <h3 className="product-steps__item-title">Datos Automáticos</h3>
                <p className="product-steps__item-text">
                  Cada servicio, visita y transacción genera datos financieros automáticamente. Sin entrada manual.
                </p>
              </div>

              <div className="product-steps__item">
                <span className="product-steps__number">2</span>
                <h3 className="product-steps__item-title">Análisis Inteligente</h3>
                <p className="product-steps__item-text">
                  Compara períodos, identifica tendencias de crecimiento y encuentra oportunidades con gráficas interactivas.
                </p>
              </div>

              <div className="product-steps__item">
                <span className="product-steps__number">3</span>
                <h3 className="product-steps__item-title">Decisiones con Datos</h3>
                <p className="product-steps__item-text">
                  Toma decisiones basadas en P&L real, comisiones calculadas y reportes comparativos. No más intuición.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <FinalCTA />
      </main>
    </>
  );
}
