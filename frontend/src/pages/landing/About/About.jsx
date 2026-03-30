import { Link } from 'react-router-dom';
import SEO from '../../../components/landing/common/SEO';
import agendaImg from '../../../assets/images/landing/agenda.png';

const IMG_HERO = 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&q=80&auto=format';
const IMG_BUSINESS = 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=800&q=80&auto=format';

const NUMBERS = [
  { value: '2026', label: 'Año de fundación' },
  { value: '21+', label: 'Países de habla hispana' },
  { value: '14', label: 'Módulos integrados' },
  { value: '29+', label: 'Acciones de Lina IA' },
];

const VALUES = [
  { icon: '🎯', title: 'Tecnología con Propósito', desc: 'Cada funcionalidad nace de un problema real. Si no resuelve algo concreto, no lo construimos.' },
  { icon: '⚡', title: 'Simplicidad Real', desc: 'Si necesita un manual para usar un CRM, algo está mal. Domine la plataforma desde el primer día.' },
  { icon: '🤝', title: 'Crecemos con Usted', desc: 'No desaparecemos después de la venta. Escuchamos, mejoramos y nuestro soporte resuelve.' },
  { icon: '💎', title: 'Obsesión por el Detalle', desc: 'Desde la velocidad de carga hasta el último pixel. Los mismos estándares que esperaríamos como usuarios.' },
  { icon: '🌍', title: 'Para Todo Negocio', desc: 'Peluquerías, clínicas, restaurantes, gimnasios, veterinarias — si tiene clientes, es para usted.' },
  { icon: '🔒', title: 'Seguridad Primero', desc: 'Encriptación SSL, cumplimiento con Meta, datos nunca compartidos. Su información es sagrada.' },
];

const TIMELINE = [
  { year: '2026 Q1', title: 'Nacimiento', desc: 'Idea, investigación de mercado y primer prototipo funcional del CRM.' },
  { year: '2026 Q2', title: 'Lina IA', desc: 'Integración de inteligencia artificial con pipeline de 4 fases de verificación.' },
  { year: '2026 Q3', title: 'Lanzamiento', desc: 'Apertura al público con 14 módulos, WhatsApp Business y booking system.' },
  { year: '2026 Q4', title: 'Expansión LATAM', desc: 'Disponible en 21 países de habla hispana con pagos locales y soporte regional.' },
];

export default function About() {
  return (
    <>
      <SEO
        title="Sobre Nosotros — Tecnologia para tu Negocio"
        description="Plexify Studio nacio para que peluquerias, salones y spas gestionen todo en un solo lugar. CRM con IA diseñado en Colombia para Latinoamerica."
        url="/about"
        keywords="software colombiano para negocios, CRM hecho en latinoamerica, tecnologia para peluquerias, sistema de gestion para salones de belleza"
      />

      <div className="abt">
        {/* ═══ HERO ═══ */}
        <section className="abt__hero">
          <div className="abt__hero-bg" aria-hidden="true">
            {/* TODO: Convertir a WebP para reducir ~40% el tamaño */}
            <img src={IMG_HERO} alt="" className="abt__hero-bg-img" loading="eager" fetchPriority="high" />
            <div className="abt__hero-overlay" />
          </div>
          <div className="abt__hero-inner">
            <span className="abt__hero-eyebrow">Sobre nosotros</span>
            <h1 className="abt__hero-title">
              Sobre Plexify Studio —{' '}
              <span className="abt__hero-title--accent">Software para Negocios de Servicios</span>
            </h1>
            <p className="abt__hero-sub">
              Vimos negocios increíbles gestionando todo con libretas, hojas de cálculo
              y mensajes de WhatsApp perdidos. PlexifyStudio nació para cambiar eso.
            </p>
          </div>
        </section>

        {/* ═══ NUMBERS ═══ */}
        <section className="abt__numbers">
          <div className="abt__numbers-inner">
            {NUMBERS.map((n) => (
              <div className="abt__number" key={n.label}>
                <span className="abt__number-value">{n.value}</span>
                <span className="abt__number-label">{n.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ═══ MISSION ═══ */}
        <section className="abt__mission">
          <div className="abt__mission-inner">
            <div className="abt__mission-text">
              <span className="abt__section-badge">🎯 Nuestra Misión</span>
              <h2>Que la tecnología deje de ser un privilegio</h2>
              <p>
                Los grandes negocios tienen CRMs de millones de dólares. Los pequeños
                negocios — los que realmente sostienen la economía — gestionan todo a mano.
              </p>
              <p>
                PlexifyStudio es un CRM integral con inteligencia artificial que conecta
                agenda, clientes, finanzas, WhatsApp y automatizaciones en una sola plataforma.
                Para peluquerías, clínicas, restaurantes, gimnasios, academias, veterinarias
                y cualquier negocio que gestione clientes.
              </p>
              <p>
                <strong>Sin curva de aprendizaje. Sin conocimientos técnicos.
                Sin precios inalcanzables.</strong>
              </p>
            </div>
            <div className="abt__mission-visual">
              <div className="abt__mission-img">
                {/* TODO: Convertir a WebP para reducir ~40% el tamaño */}
                <img src={agendaImg} alt="PlexifyStudio CRM — Agenda y Calendario" loading="lazy" />
              </div>
              <div className="abt__mission-features">
                <div className="abt__mission-feature">
                  <span>📋</span>
                  <div><strong>14 módulos</strong><span>Todo conectado</span></div>
                </div>
                <div className="abt__mission-feature">
                  <span>🤖</span>
                  <div><strong>Lina IA</strong><span>Asistente 24/7</span></div>
                </div>
                <div className="abt__mission-feature">
                  <span>💬</span>
                  <div><strong>WhatsApp</strong><span>Integración nativa</span></div>
                </div>
                <div className="abt__mission-feature">
                  <span>📊</span>
                  <div><strong>Dashboard</strong><span>Métricas en vivo</span></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ IMAGE BREAK ═══ */}
        <section className="abt__image-break">
          <div className="abt__image-break-inner">
            <div className="abt__image-break-img">
              <img src={IMG_BUSINESS} alt="Negocios reales usando PlexifyStudio" loading="lazy" />
            </div>
            <div className="abt__image-break-text">
              <h2>Hecho para negocios reales</h2>
              <p>
                No somos una empresa de software que construye desde un escritorio. Trabajamos
                directamente con dueños de negocios, entendemos sus problemas y diseñamos
                soluciones que funcionan en el día a día real.
              </p>
              <div className="abt__image-break-stats">
                <div><strong>Peluquerías</strong></div>
                <div><strong>Clínicas</strong></div>
                <div><strong>Restaurantes</strong></div>
                <div><strong>Gimnasios</strong></div>
                <div><strong>Spas</strong></div>
                <div><strong>Veterinarias</strong></div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ VALUES ═══ */}
        <section className="abt__values">
          <div className="abt__values-inner">
            <span className="abt__section-badge">💡 Cómo Trabajamos</span>
            <h2 className="abt__values-title">No son palabras bonitas en una pared</h2>
            <p className="abt__values-sub">Son los principios que guían cada línea de código y cada decisión de producto.</p>

            <div className="abt__values-grid">
              {VALUES.map((v) => (
                <div className="abt__value-card" key={v.title}>
                  <span className="abt__value-icon">{v.icon}</span>
                  <h3>{v.title}</h3>
                  <p>{v.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ TIMELINE ═══ */}
        <section className="abt__timeline">
          <div className="abt__timeline-inner">
            <span className="abt__section-badge">📅 Nuestro Camino</span>
            <h2 className="abt__timeline-title">De idea a plataforma</h2>

            <div className="abt__timeline-track">
              {TIMELINE.map((t, i) => (
                <div className="abt__timeline-item" key={t.year}>
                  <span className="abt__timeline-year">{t.year}</span>
                  <div className="abt__timeline-dot" />
                  <div className="abt__timeline-content">
                    <h3>{t.title}</h3>
                    <p>{t.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ CTA ═══ */}
        <section className="abt__cta">
          <div className="abt__cta-inner">
            <h2>Su negocio merece mejores herramientas</h2>
            <p>Cree su cuenta en 5 minutos y vea todo funcionando con los datos de su negocio.</p>
            <div className="abt__cta-actions">
              <Link to="/register" className="abt__btn abt__btn--primary">Crear cuenta gratis →</Link>
              <Link to="/pricing" className="abt__btn abt__btn--outline">Ver planes</Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
