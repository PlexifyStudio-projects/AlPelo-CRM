import { useState, useEffect, useRef } from 'react';

const modules = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
    title: 'Panel Ejecutivo en Tiempo Real',
    features: [
      'KPIs principales: ingresos, clientes, retención y ticket promedio',
      'Gráficas interactivas de rendimiento semanal y mensual',
      'Resumen visual de citas del día y estado del equipo',
      'Alertas inteligentes sobre clientes en riesgo',
    ],
    gradient: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #8b5cf6 100%)',
  },
  {
    id: 'clientes',
    name: 'Clientes',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: 'Gestión Integral de Clientes',
    features: [
      'Perfiles completos con historial de visitas y servicios',
      'Segmentación: Activo, Nuevo, En Riesgo, Inactivo, VIP',
      'Búsqueda avanzada, filtros y exportación de datos',
      'Seguimiento automático de frecuencia y gasto',
    ],
    gradient: 'linear-gradient(135deg, #0ea5e9 0%, #38bdf8 50%, #6366f1 100%)',
  },
  {
    id: 'campanas',
    name: 'Campañas',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 2L11 13" /><path d="M22 2L15 22L11 13L2 9L22 2Z" />
      </svg>
    ),
    title: 'Campañas de WhatsApp Masivas',
    features: [
      'Plantillas aprobadas por Meta listas para usar',
      'Envío masivo segmentado por estado o comportamiento',
      'Templates: bienvenida, seguimiento, cumpleaños, reactivación',
      'Métricas de alcance, apertura y conversión',
    ],
    gradient: 'linear-gradient(135deg, #10b981 0%, #34d399 50%, #0ea5e9 100%)',
  },
  {
    id: 'finanzas',
    name: 'Finanzas',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    title: 'Finanzas y Reportes Completos',
    features: [
      'Resumen de ingresos, gastos, comisiones y ganancia neta',
      'Reportes comparativos con períodos anteriores',
      'Gestión de comisiones por profesional automática',
      'Facturación integrada con seguimiento de pagos',
    ],
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 50%, #10b981 100%)',
  },
  {
    id: 'automatizaciones',
    name: 'Automatizaciones',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" /><polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" /><line x1="4" y1="4" x2="9" y2="9" />
      </svg>
    ),
    title: 'Workflows Inteligentes',
    features: [
      'Recordatorios automáticos de cita (24h y 1h antes)',
      'Follow-ups post-servicio y recuperación de no-shows',
      'Campañas de cumpleaños y fidelización automáticas',
      'Toggle ON/OFF por cada automatización',
    ],
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 50%, #4f46e5 100%)',
  },
  {
    id: 'lina-ia',
    name: 'Lina IA',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" /><path d="M16 14h.01" /><path d="M8 14h.01" /><path d="M12 17v1" /><rect x="4" y="10" width="16" height="10" rx="2" />
      </svg>
    ),
    title: 'Asistente de IA Especializado',
    features: [
      'Chat inteligente entrenado en tu negocio',
      'Responde WhatsApp automáticamente 24/7',
      'Diagnóstico de negocio y plan de crecimiento con IA',
      'Predicción de agenda y optimización de precios',
    ],
    gradient: 'linear-gradient(135deg, #4f46e5 0%, #8b5cf6 50%, #ec4899 100%)',
  },
];

export default function Modules() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const sectionRef = useRef(null);
  const contentRef = useRef(null);

  const activeModule = modules.find((m) => m.id === activeTab);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('modules--visible');
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    el.classList.remove('modules__content--animate');
    // Force reflow
    void el.offsetWidth;
    el.classList.add('modules__content--animate');
  }, [activeTab]);

  return (
    <section
      className="modules"
      ref={sectionRef}
      aria-label="Módulos del CRM"
    >
      <div className="modules__container">
        <header className="modules__header">
          <h2 className="modules__title">
            Explora cada rincón de PlexifyStudio
          </h2>
          <p className="modules__subtitle">
            Haz clic en cada módulo para ver cómo funciona.
          </p>
        </header>

        <div className="modules__layout">
          <nav className="modules__tabs" aria-label="Módulos del CRM">
            {modules.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`modules__tab ${activeTab === m.id ? 'modules__tab--active' : ''}`}
                onClick={() => setActiveTab(m.id)}
                aria-selected={activeTab === m.id}
                aria-controls="modules-content"
                role="tab"
              >
                <span className="modules__tab-icon">{m.icon}</span>
                <span className="modules__tab-label">{m.name}</span>
              </button>
            ))}
          </nav>

          <div
            className="modules__content"
            id="modules-content"
            ref={contentRef}
            role="tabpanel"
            aria-label={activeModule.title}
          >
            <div className="modules__content-info">
              <h3 className="modules__content-title">{activeModule.title}</h3>
              <ul className="modules__feature-list">
                {activeModule.features.map((f, i) => (
                  <li key={i} className="modules__feature-item">
                    <svg
                      className="modules__feature-check"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            <div className="modules__preview">
              <div className="modules__browser">
                <div className="modules__browser-header">
                  <span className="modules__browser-dot" />
                  <span className="modules__browser-dot" />
                  <span className="modules__browser-dot" />
                  <span className="modules__browser-url">
                    app.plexifystudio.com/{activeModule.id}
                  </span>
                </div>
                <div
                  className="modules__browser-screen"
                  style={{ background: activeModule.gradient }}
                  aria-label={`Vista previa del módulo ${activeModule.name}`}
                >
                  {/* Simulated Dashboard UI */}
                  <div className="modules__sim-dashboard">
                    <div className="modules__sim-sidebar">
                      <div className="modules__sim-sidebar-item modules__sim-sidebar-item--active" />
                      <div className="modules__sim-sidebar-item" />
                      <div className="modules__sim-sidebar-item" />
                      <div className="modules__sim-sidebar-item" />
                      <div className="modules__sim-sidebar-item" />
                    </div>
                    <div className="modules__sim-main">
                      <div className="modules__sim-header">
                        <div className="modules__sim-header-title" />
                        <div className="modules__sim-header-actions">
                          <div className="modules__sim-header-btn" />
                          <div className="modules__sim-header-btn" />
                        </div>
                      </div>
                      <div className="modules__sim-cards">
                        <div className="modules__sim-card" />
                        <div className="modules__sim-card" />
                        <div className="modules__sim-card" />
                        <div className="modules__sim-card" />
                      </div>
                      <div className="modules__sim-chart" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
