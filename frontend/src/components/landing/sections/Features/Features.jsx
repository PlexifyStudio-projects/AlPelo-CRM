import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

const features = [
  {
    title: 'Gestión de Clientes',
    highlight: '1.247 clientes organizados en un clic',
    description: 'Historial completo, estados VIP, métricas por cliente, seguimiento inteligente y alertas automáticas de riesgo.',
    link: '/producto/clientes',
    color: '#4f46e5',
    colorLight: 'rgba(79, 70, 229, 0.1)',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    title: 'Agenda y Citas',
    highlight: '95% de citas confirmadas automáticamente',
    description: 'Calendario visual, reservas online, recordatorios por WhatsApp y gestión inteligente de no-shows.',
    link: '/producto/agenda',
    color: '#0ea5e9',
    colorLight: 'rgba(14, 165, 233, 0.1)',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
      </svg>
    ),
  },
  {
    title: 'Finanzas Completas',
    highlight: 'Control total de ingresos y gastos',
    description: 'Dashboard financiero con P&L, comisiones automáticas, facturas y reportes comparativos en tiempo real.',
    link: '/producto/finanzas',
    color: '#10b981',
    colorLight: 'rgba(16, 185, 129, 0.1)',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    title: 'WhatsApp Integrado',
    highlight: '847 mensajes gestionados hoy por Lina IA',
    description: 'Inbox en tiempo real, respuestas automáticas con IA, envío masivo de campañas y plantillas aprobadas por Meta.',
    link: '/producto/whatsapp',
    color: '#25d366',
    colorLight: 'rgba(37, 211, 102, 0.1)',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <line x1="9" y1="10" x2="9.01" y2="10" />
        <line x1="12" y1="10" x2="12.01" y2="10" />
        <line x1="15" y1="10" x2="15.01" y2="10" />
      </svg>
    ),
  },
  {
    title: 'Automatizaciones',
    highlight: 'Configura una vez, funciona para siempre',
    description: 'Workflows inteligentes: recordatorios de citas, follow-ups, cumpleaños, reactivación de inactivos y más.',
    link: '/producto/automatizaciones',
    color: '#f59e0b',
    colorLight: 'rgba(245, 158, 11, 0.1)',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  {
    title: 'Equipo y Comisiones',
    highlight: 'Cada profesional sabe cuánto gana',
    description: 'Gestiona profesionales, calcula comisiones automáticas, mide rendimiento y ratings del equipo.',
    link: '/producto/equipo',
    color: '#0ea5e9',
    colorLight: 'rgba(14, 165, 233, 0.1)',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4z" />
        <path d="M16 21v-2a4 4 0 0 0-4-4 4 4 0 0 0-4 4v2" />
        <path d="M20 8v6M23 11h-6" />
      </svg>
    ),
  },
  {
    title: 'Programa de Lealtad',
    highlight: 'Clientes que vuelven una y otra vez',
    description: 'Niveles Bronce, Plata, Oro y VIP. Referidos con bonificación, bonos de cumpleaños y créditos automáticos.',
    link: '/producto/lealtad',
    color: '#8b5cf6',
    colorLight: 'rgba(139, 92, 246, 0.1)',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  {
    title: 'Servicios y Catálogo',
    highlight: 'Tu catálogo profesional en minutos',
    description: 'Catálogo completo con categorías, precios, duración, profesionales asignados y reservas directas.',
    link: '/producto/servicios',
    color: '#4f46e5',
    colorLight: 'rgba(79, 70, 229, 0.1)',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
];

export default function Features() {
  const sectionRef = useRef(null);
  const cardsRef = useRef([]);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('features--visible');
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const cards = cardsRef.current.filter(Boolean);
    if (!cards.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('features__card--visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, []);

  return (
    <section className="features" ref={sectionRef} aria-label="Funcionalidades principales">
      <div className="features__container">
        <div className="features__header">
          <span className="features__badge">🚀 Todo incluido</span>
          <h2 className="features__title">
            Todo lo que necesitas.{' '}
            <span className="features__title--highlight">En una sola plataforma.</span>
          </h2>
          <p className="features__subtitle">
            8 módulos que trabajan juntos para que tu negocio funcione en piloto automático.
            Cada uno diseñado para ahorrarte tiempo y hacerte ganar más.
          </p>
        </div>

        <div className="features__bento">
          {features.map((feature, index) => (
            <Link
              to={feature.link}
              className={`features__bento-card features__bento-card--${index + 1}`}
              key={feature.title}
              ref={(el) => { cardsRef.current[index] = el; }}
              style={{ '--card-color': feature.color, '--card-bg': feature.colorLight }}
            >
              <div className="features__bento-top">
                <div
                  className="features__bento-icon"
                  style={{ backgroundColor: feature.colorLight, color: feature.color }}
                >
                  {feature.icon}
                </div>
                <span className="features__bento-arrow" style={{ color: feature.color }}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="14" x2="14" y2="4"/><polyline points="6 4 14 4 14 12"/></svg>
                </span>
              </div>
              <h3 className="features__bento-title">{feature.title}</h3>
              <p className="features__bento-highlight" style={{ color: feature.color }}>{feature.highlight}</p>
              <p className="features__bento-desc">{feature.description}</p>
            </Link>
          ))}
        </div>

      </div>
    </section>
  );
}
