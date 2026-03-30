import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

function useAnimatedCounter(target, duration = 2000, delay = 800) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const timeout = setTimeout(() => {
      const start = performance.now();
      const step = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.floor(eased * target));
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, delay);
    return () => clearTimeout(timeout);
  }, [target, duration, delay]);
  return value;
}

export default function Hero() {
  const heroRef = useRef(null);

  // Animated KPI values
  const clientes = useAnimatedCounter(1247, 2200, 1000);
  const retencion = useAnimatedCounter(94, 1800, 1200);
  const citas = useAnimatedCounter(18, 1500, 1400);
  const ingresos = useAnimatedCounter(248, 2000, 1100); // 24.8 * 10
  const riesgo = useAnimatedCounter(2, 800, 1600);
  const mensajes = useAnimatedCounter(847, 2500, 1300);
  const acciones = useAnimatedCounter(23, 1200, 1500);
  const chats = useAnimatedCounter(12, 1000, 1700);
  const noLeidos = useAnimatedCounter(3, 600, 1900);
  const disponibles = useAnimatedCounter(4153, 2800, 1400);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('hero--visible');
          observer.disconnect();
        }
      },
      { threshold: 0.05 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="hero" ref={heroRef} aria-label="Sección principal">
      <div className="hero__ambient" aria-hidden="true">
        <div className="hero__ambient-blob hero__ambient-blob--1" />
        <div className="hero__ambient-blob hero__ambient-blob--2" />
      </div>

      <div className="hero__container">
        {/* LEFT — Text */}
        <div className="hero__left">
          <div className="hero__badge">
            <span className="hero__badge-dot" />
            CRM con Inteligencia Artificial
          </div>

          <h1 className="hero__title">
            La plataforma que hace{' '}
            <span className="hero__title--highlight">crecer su negocio</span>
          </h1>

          <p className="hero__subtitle">
            Agenda, CRM, WhatsApp y una IA que atiende por usted 24/7
            — todo en una sola plataforma.
          </p>

          <div className="hero__actions">
            <Link to="/register" className="hero__cta hero__cta--primary">
              Crear cuenta gratis
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </Link>
            <Link to="/lina-ia" className="hero__cta hero__cta--outline">
              Ver Lina IA en acción
            </Link>
          </div>

          <div className="hero__proof">
            <span>✓ Sin tarjeta de crédito</span>
            <span>✓ Listo en 5 minutos</span>
            <span>✓ Cancele cuando quiera</span>
          </div>
        </div>

        {/* RIGHT — CRM Dashboard Preview */}
        <div className="hero__right">
          <div className="hero__image-glow" aria-hidden="true" />

          {/* Floating WhatsApp-style labels */}
          <div className="hero__float-label hero__float-label--1">
            <span className="hero__float-label-icon">💬</span>
            <span>Hola <b>{'{{nombre}}'}</b>, tu cita es mañana a las 10:00 AM</span>
          </div>
          <div className="hero__float-label hero__float-label--2">
            <span className="hero__float-label-icon">✅</span>
            <span>Cita confirmada — Carolina Méndez, Corte Premium</span>
          </div>
          <div className="hero__float-label hero__float-label--3">
            <span className="hero__float-label-icon">🤖</span>
            <span>Lina IA: 12 clientes reactivados hoy</span>
          </div>
          <div className="features__preview-frame">
            <div className="features__preview-bar">
              <span /><span /><span />
              <span className="features__preview-url">app.plexifystudio.com</span>
            </div>
            <div className="features__preview-screen">
              {/* Sidebar */}
              <div className="features__preview-sidebar">
                <div className="features__preview-sidebar-logo">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 12l2 2 4-4"/></svg>
                </div>
                <div className="features__preview-sidebar-brand">PlexifyStudio</div>
                <div className="features__preview-sidebar-section">GESTIÓN PRINCIPAL</div>
                <div className="features__preview-sidebar-item features__preview-sidebar-item--active">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                  <span>Dashboard</span>
                </div>
                <div className="features__preview-sidebar-item"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg><span>Agenda</span></div>
                <div className="features__preview-sidebar-item"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg><span>Clientes</span></div>
                <div className="features__preview-sidebar-item"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span>Campañas</span></div>
                <div className="features__preview-sidebar-item"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg><span>Servicios</span></div>
                <div className="features__preview-sidebar-item"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg><span>Finanzas</span></div>
                <div className="features__preview-sidebar-item"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg><span>Actividad Lina</span></div>
                <div className="features__preview-sidebar-item"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4z"/><path d="M16 21v-1a4 4 0 0 0-8 0v1"/></svg><span>Equipo</span></div>
                <div className="features__preview-sidebar-section">MARKETING</div>
                <div className="features__preview-sidebar-item"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg><span>Automatizaciones</span></div>
                <div className="features__preview-sidebar-section">WHATSAPP</div>
                <div className="features__preview-sidebar-item"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span>Inbox</span></div>
                <div className="features__preview-sidebar-item"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z"/></svg><span>Lina IA</span></div>
              </div>

              {/* Main Content */}
              <div className="features__preview-content">
                <div className="features__preview-header">
                  <div>
                    <span className="features__preview-page-title">Dashboard</span>
                    <span className="features__preview-page-sub">Panel ejecutivo — PlexifyStudio</span>
                  </div>
                  <div className="features__preview-header-actions">
                    <span className="features__preview-live">● EN VIVO</span>
                  </div>
                </div>

                {/* KPI Cards */}
                <div className="features__preview-cards">
                  <div className="features__preview-card features__preview-card--blue">
                    <div className="features__preview-card-icon" style={{background:'rgba(59,130,246,0.15)', color:'#3b82f6'}}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    </div>
                    <div><b>{clientes.toLocaleString('es')}</b><span>Total Clientes</span><small>+89 este mes <em className="features__preview-up">↑ 12%</em></small></div>
                  </div>
                  <div className="features__preview-card features__preview-card--green">
                    <div className="features__preview-card-icon" style={{background:'rgba(16,185,129,0.15)', color:'#10b981'}}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 12l2 2 4-4"/></svg>
                    </div>
                    <div><b>{retencion}%</b><span>Retención</span><small>23 VIP <em className="features__preview-up">↑ 8%</em></small></div>
                  </div>
                  <div className="features__preview-card features__preview-card--cyan">
                    <div className="features__preview-card-icon" style={{background:'rgba(6,182,212,0.15)', color:'#06b6d4'}}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg>
                    </div>
                    <div><b>{citas}</b><span>Citas Hoy</span><small>14 confirmadas</small></div>
                  </div>
                  <div className="features__preview-card features__preview-card--gold">
                    <div className="features__preview-card-icon" style={{background:'rgba(245,158,11,0.15)', color:'#f59e0b'}}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    </div>
                    <div><b>${(ingresos / 10).toFixed(1)}M</b><span>Ingresos del Mes</span><small><em className="features__preview-up">↑ 34%</em></small></div>
                  </div>
                  <div className="features__preview-card features__preview-card--red">
                    <div className="features__preview-card-icon" style={{background:'rgba(239,68,68,0.15)', color:'#ef4444'}}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    </div>
                    <div><b>{riesgo}</b><span>En Riesgo</span><small>Campaña activa</small></div>
                  </div>
                </div>

                {/* Charts */}
                <div className="features__preview-bottom">
                  <div className="features__preview-chart">
                    <div className="features__preview-chart-header"><span>Ingresos — Últimos 7 días</span></div>
                    <div className="features__preview-chart-line">
                      <svg viewBox="0 0 300 80" preserveAspectRatio="none">
                        <path d="M0 70 L50 65 L100 60 L150 55 L200 40 L250 15 L300 5" fill="none" stroke="#2563eb" strokeWidth="2"/>
                        <path d="M0 70 L50 65 L100 60 L150 55 L200 40 L250 15 L300 5 L300 80 L0 80 Z" fill="url(#hero-chart-fill)" opacity="0.15"/>
                        <defs><linearGradient id="hero-chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb"/><stop offset="100%" stopColor="transparent"/></linearGradient></defs>
                      </svg>
                    </div>
                  </div>
                  <div className="features__preview-citas">
                    <div className="features__preview-chart-header"><span>Estado de Citas</span><span className="features__preview-agenda-badge">18 total</span></div>
                    <div className="features__preview-donut">
                      <svg viewBox="0 0 80 80" width="70" height="70">
                        <circle cx="40" cy="40" r="30" fill="none" stroke="#e2e8f0" strokeWidth="8"/>
                        <circle cx="40" cy="40" r="30" fill="none" stroke="#10b981" strokeWidth="8" strokeDasharray="170 188" strokeLinecap="round" transform="rotate(-90 40 40)"/>
                      </svg>
                      <span className="features__preview-donut-label">● Confirmada 94%</span>
                    </div>
                  </div>
                </div>

                {/* Agenda + Lina */}
                <div className="features__preview-bottom">
                  <div className="features__preview-agenda">
                    <div className="features__preview-chart-header"><span>Agenda de Hoy</span><span className="features__preview-agenda-badge">18 citas</span></div>
                    <div className="features__preview-agenda-cols"><span className="features__preview-agenda-col">HORA</span><span className="features__preview-agenda-col">CLIENTE</span><span className="features__preview-agenda-col">SERVICIO</span><span className="features__preview-agenda-col">ESTADO</span></div>
                    <div className="features__preview-agenda-row"><span className="features__preview-agenda-time">09:00</span><span className="features__preview-agenda-name">Carolina Méndez</span><span className="features__preview-agenda-service">Corte Premium</span><span className="features__preview-agenda-status">Confirmada</span></div>
                    <div className="features__preview-agenda-row"><span className="features__preview-agenda-time">09:30</span><span className="features__preview-agenda-name">Diego Herrera</span><span className="features__preview-agenda-service">Barba + Corte</span><span className="features__preview-agenda-status">Confirmada</span></div>
                    <div className="features__preview-agenda-row"><span className="features__preview-agenda-time">10:00</span><span className="features__preview-agenda-name">Valentina Ríos</span><span className="features__preview-agenda-service">Manicure</span><span className="features__preview-agenda-status features__preview-agenda-status--vip">VIP</span></div>
                    <div className="features__preview-agenda-row"><span className="features__preview-agenda-time">10:30</span><span className="features__preview-agenda-name">Andrés Pabón</span><span className="features__preview-agenda-service">Facial LED</span><span className="features__preview-agenda-status">Confirmada</span></div>
                  </div>
                  <div className="features__preview-lina">
                    <div className="features__preview-chart-header"><span>Lina IA</span><span className="features__preview-lina-active">● ACTIVA</span></div>
                    <div className="features__preview-lina-stats"><div><b>{mensajes}</b><small>Mensajes hoy</small></div><div><b>{acciones}</b><small>Acciones hoy</small></div></div>
                    <div className="features__preview-lina-stats"><div><b>{chats}/18</b><small>Chats activos</small></div><div><b style={{color:'#ef4444'}}>{noLeidos}</b><small>No leídos</small></div></div>
                    <div className="features__preview-lina-wa"><span>WhatsApp hoy</span><span style={{color:'#10b981', fontWeight:600}}>{mensajes} mensajes</span></div>
                    <div className="features__preview-lina-bar"><small>Mensajes disponibles</small><small>{disponibles.toLocaleString('es')} / 5.000</small></div>
                    <div className="features__preview-lina-progress"><div style={{width: '83%'}} /></div>
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
