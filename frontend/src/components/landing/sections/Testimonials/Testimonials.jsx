import { memo, useEffect, useRef } from 'react';

const REVIEWS = [
  { name: 'María García', role: 'Cadena de Clínicas', initials: 'MG', text: 'Nuestros pacientes vuelven con más frecuencia. El programa de lealtad y los recordatorios automáticos cambiaron todo.', color: '#2563eb' },
  { name: 'Carlos Mendoza', role: 'Barbería Premium', initials: 'CM', text: 'Antes perdía horas organizando citas. Ahora Lina IA responde por mí y las automatizaciones hacen el trabajo pesado.', color: '#10b981' },
  { name: 'Ana Rodríguez', role: 'Cadena de Restaurantes', initials: 'AR', text: 'Las campañas de WhatsApp nos ayudaron a rescatar clientes inactivos. En 3 meses recuperamos una gran cantidad de ingresos.', color: '#f59e0b' },
  { name: 'Diego Herrera', role: 'Academia de Formación', initials: 'DH', text: 'Los recordatorios automáticos de cita prácticamente eliminaron los no-shows. Un solo mes con PlexifyStudio se pagó solo.', color: '#8b5cf6' },
  { name: 'Laura Martínez', role: 'Centro Veterinario', initials: 'LM', text: 'El módulo de finanzas me da todo: ingresos, gastos, comisiones, facturas. Ya no necesito contador para el día a día.', color: '#0ea5e9' },
  { name: 'Roberto Sánchez', role: 'Gimnasio FitPro', initials: 'RS', text: 'Gestionar las comisiones de 21 profesionales era una pesadilla. Ahora PlexifyStudio lo calcula todo automáticamente.', color: '#ec4899' },
  { name: 'Valentina Ríos', role: 'Spa & Wellness', initials: 'VR', text: 'Mis clientes VIP reciben bonos de cumpleaños automáticos. El programa de lealtad genera reservas sin que yo haga nada.', color: '#f97316' },
  { name: 'Andrés Pabón', role: 'Estudio de Tatuajes', initials: 'AP', text: 'Antes se me olvidaban citas y perdía clientes. Con la agenda y los recordatorios automáticos eso ya no pasa.', color: '#2563eb' },
  { name: 'Camila Torres', role: 'Peluquería Top Hair', initials: 'CT', text: 'Lina IA es como tener una asistente 24/7. Responde WhatsApp, agenda citas y hasta sugiere campañas de marketing.', color: '#10b981' },
];

function Stars() {
  return (
    <div className="testimonials__stars">
      {[...Array(5)].map((_, i) => (
        <svg key={i} width="13" height="13" viewBox="0 0 20 20" fill="#f59e0b">
          <path d="M10 1l2.39 4.84 5.34.78-3.87 3.77.91 5.32L10 13.27l-4.77 2.51.91-5.32L2.27 6.69l5.34-.78z" />
        </svg>
      ))}
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
    <section className="testimonials" ref={ref}>
      <div className="testimonials__header-wrap">
        <span className="testimonials__badge">⭐ Opiniones reales</span>
        <h2 className="testimonials__title">Lo que dicen nuestros clientes</h2>
        <p className="testimonials__subtitle">Negocios reales con resultados reales.</p>
      </div>

      <div className="testimonials__marquee">
        <div className="testimonials__track testimonials__track--left">
          {[...row1, ...row1].map((r, i) => (
            <div className="testimonials__card" key={`a${i}`}>
              <Stars />
              <p className="testimonials__text">"{r.text}"</p>
              <div className="testimonials__footer">
                <div className="testimonials__avatar" style={{ background: r.color }}>{r.initials}</div>
                <div>
                  <span className="testimonials__name">{r.name}</span>
                  <span className="testimonials__role">{r.role}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="testimonials__marquee">
        <div className="testimonials__track testimonials__track--right">
          {[...row2, ...row2].map((r, i) => (
            <div className="testimonials__card" key={`b${i}`}>
              <Stars />
              <p className="testimonials__text">"{r.text}"</p>
              <div className="testimonials__footer">
                <div className="testimonials__avatar" style={{ background: r.color }}>{r.initials}</div>
                <div>
                  <span className="testimonials__name">{r.name}</span>
                  <span className="testimonials__role">{r.role}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default memo(Testimonials);
