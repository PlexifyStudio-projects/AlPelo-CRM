import { memo, useEffect, useRef } from 'react';

const REVIEWS = [
  { name: 'María García', role: 'Cadena de Clínicas', initials: 'MG', text: 'Nuestros pacientes vuelven con más frecuencia. El programa de lealtad y los recordatorios automáticos cambiaron todo.', color: '#2563eb', rating: 5 },
  { name: 'Carlos Mendoza', role: 'Barbería Premium', initials: 'CM', text: 'Antes perdía horas organizando citas. Ahora Lina IA responde por mí y las automatizaciones hacen el trabajo pesado.', color: '#10b981', rating: 5 },
  { name: 'Ana Rodríguez', role: 'Cadena de Restaurantes', initials: 'AR', text: 'Las campañas de WhatsApp nos ayudaron a rescatar clientes inactivos. En 3 meses recuperamos una gran cantidad de ingresos.', color: '#f59e0b', rating: 5 },
  { name: 'Diego Herrera', role: 'Academia de Formación', initials: 'DH', text: 'Los recordatorios automáticos de cita prácticamente eliminaron los no-shows. Un solo mes con PlexifyStudio se pagó solo.', color: '#8b5cf6', rating: 5 },
  { name: 'Laura Martínez', role: 'Centro Veterinario', initials: 'LM', text: 'El módulo de finanzas me da todo: ingresos, gastos, comisiones, facturas. Ya no necesito contador para el día a día.', color: '#0ea5e9', rating: 5 },
  { name: 'Roberto Sánchez', role: 'Gimnasio FitPro', initials: 'RS', text: 'Gestionar las comisiones de 21 profesionales era una pesadilla. Ahora PlexifyStudio lo calcula todo automáticamente.', color: '#ec4899', rating: 5 },
  { name: 'Valentina Ríos', role: 'Spa & Wellness', initials: 'VR', text: 'Mis clientes VIP reciben bonos de cumpleaños automáticos. El programa de lealtad genera reservas sin que yo haga nada.', color: '#f97316', rating: 5 },
  { name: 'Andrés Pabón', role: 'Estudio de Tatuajes', initials: 'AP', text: 'Antes se me olvidaban citas y perdía clientes. Con la agenda y los recordatorios automáticos eso ya no pasa.', color: '#2563eb', rating: 4 },
  { name: 'Camila Torres', role: 'Peluquería Top Hair', initials: 'CT', text: 'Lina IA es como tener una asistente 24/7. Responde WhatsApp, agenda citas y hasta sugiere campañas de marketing.', color: '#10b981', rating: 5 },
];

function Stars({ count = 5 }) {
  return (
    <div className="testimonials__stars">
      {[...Array(5)].map((_, i) => (
        <svg key={i} width="16" height="16" viewBox="0 0 20 20" className={`testimonials__star ${i < count ? 'testimonials__star--filled' : 'testimonials__star--empty'}`}>
          <defs>
            <linearGradient id={`star-grad-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
          <path d="M10 1l2.39 4.84 5.34.78-3.87 3.77.91 5.32L10 13.27l-4.77 2.51.91-5.32L2.27 6.69l5.34-.78z" fill={i < count ? `url(#star-grad-${i})` : '#e2e8f0'} />
        </svg>
      ))}
      <span className="testimonials__rating-text">{count}.0</span>
    </div>
  );
}

// memo: contenido estático, evita re-renders innecesarios
function Testimonials() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add('testimonials--visible'); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const row1 = REVIEWS.slice(0, 5);
  const row2 = REVIEWS.slice(5);

  return (
    <section className="testimonials" ref={ref} aria-label="Opiniones de clientes que usan nuestro software para negocios de servicios">
      <div className="testimonials__header-wrap">
        <span className="testimonials__badge">Opiniones de clientes reales</span>
        <h2 className="testimonials__title">Negocios de servicios que ya crecen con PlexifyStudio</h2>
        <p className="testimonials__subtitle">Mas de 20 tipos de negocios confian en nuestra plataforma para gestionar clientes, citas y WhatsApp.</p>
      </div>

      <div className="testimonials__marquee">
        <div className="testimonials__track testimonials__track--left">
          {[...row1, ...row1].map((r, i) => (
            <div className="testimonials__card" key={`a${i}`} style={{ '--card-accent': r.color }}>
              <div className="testimonials__card-glow" aria-hidden="true" />
              <Stars count={r.rating} />
              <p className="testimonials__text">"{r.text}"</p>
              <div className="testimonials__footer">
                <div className="testimonials__avatar" style={{ background: `linear-gradient(135deg, ${r.color}, ${r.color}dd)` }}>{r.initials}</div>
                <div>
                  <span className="testimonials__name">{r.name}</span>
                  <span className="testimonials__role">{r.role}</span>
                </div>
                <svg className="testimonials__quote-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M11.3 2.5C6.4 4.2 2.8 8.3 2.8 13.1c0 3.2 2 5.4 4.4 5.4 2.2 0 4-1.7 4-3.8 0-2.1-1.5-3.7-3.4-3.9.4-2.7 2.7-5.4 5.7-6.7L11.3 2.5zm10 0c-4.9 1.7-8.5 5.8-8.5 10.6 0 3.2 2 5.4 4.4 5.4 2.2 0 4-1.7 4-3.8 0-2.1-1.5-3.7-3.4-3.9.4-2.7 2.7-5.4 5.7-6.7L21.3 2.5z" opacity="0.08"/>
                </svg>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="testimonials__marquee">
        <div className="testimonials__track testimonials__track--right">
          {[...row2, ...row2].map((r, i) => (
            <div className="testimonials__card" key={`b${i}`} style={{ '--card-accent': r.color }}>
              <div className="testimonials__card-glow" aria-hidden="true" />
              <Stars count={r.rating} />
              <p className="testimonials__text">"{r.text}"</p>
              <div className="testimonials__footer">
                <div className="testimonials__avatar" style={{ background: `linear-gradient(135deg, ${r.color}, ${r.color}dd)` }}>{r.initials}</div>
                <div>
                  <span className="testimonials__name">{r.name}</span>
                  <span className="testimonials__role">{r.role}</span>
                </div>
                <svg className="testimonials__quote-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M11.3 2.5C6.4 4.2 2.8 8.3 2.8 13.1c0 3.2 2 5.4 4.4 5.4 2.2 0 4-1.7 4-3.8 0-2.1-1.5-3.7-3.4-3.9.4-2.7 2.7-5.4 5.7-6.7L11.3 2.5zm10 0c-4.9 1.7-8.5 5.8-8.5 10.6 0 3.2 2 5.4 4.4 5.4 2.2 0 4-1.7 4-3.8 0-2.1-1.5-3.7-3.4-3.9.4-2.7 2.7-5.4 5.7-6.7L21.3 2.5z" opacity="0.08"/>
                </svg>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default memo(Testimonials);
