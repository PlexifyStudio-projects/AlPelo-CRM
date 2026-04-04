import { memo, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

function Counter({ end, prefix = '', suffix = '', decimals = 0, delay = 0 }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  const ran = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !ran.current) {
        ran.current = true;
        setTimeout(() => {
          const t0 = performance.now();
          const step = (now) => {
            const p = Math.min((now - t0) / 2200, 1);
            const ease = 1 - Math.pow(1 - p, 3);
            setVal(ease * end);
            if (p < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }, delay);
      }
    }, { threshold: 0.2 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [end, delay]);

  const display = decimals > 0
    ? val.toFixed(decimals)
    : Math.floor(val).toLocaleString('es');

  return (
    <span ref={ref} className="stats__counter">
      {prefix}{display}{suffix}
    </span>
  );
}

const LOSSES = [
  {
    value: 14, suffix: 'h', prefix: '',
    headline: 'Horas a la semana',
    sub: 'perdidas en WhatsApp, agenda y tareas manuales',
    color: '#dc2626',
    delay: 0,
  },
  {
    value: 23, suffix: '%', prefix: '',
    headline: 'Clientes no regresan',
    sub: 'despues de su primera visita — nunca los vuelve a ver',
    color: '#ea580c',
    delay: 150,
  },
  {
    value: 2.4, suffix: 'M', prefix: '$', decimals: 1,
    headline: 'Perdidos al año',
    sub: 'en citas canceladas, no-shows y clientes fantasma',
    color: '#dc2626',
    delay: 300,
  },
  {
    value: 67, suffix: '%', prefix: '',
    headline: 'Sin seguimiento',
    sub: 'de negocios no contactan al cliente después del servicio',
    color: '#ea580c',
    delay: 450,
  },
];

const GAINS = [
  { icon: '⚡', text: 'Confirmación automática de citas por WhatsApp' },
  { icon: '💰', text: 'Reactivación automática de clientes inactivos' },
  { icon: '📈', text: 'Métricas en tiempo real para tomar mejores decisiones' },
  { icon: '🕐', text: 'Automatizaciones que eliminan tareas repetitivas' },
];

// memo: contenido estático, evita re-renders innecesarios
function Stats() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section className="stats" ref={ref} aria-label="Por que necesita un CRM para su negocio de servicios">
      <div className="stats__container">
        {/* ── PAIN SECTION ── */}
        <div className="stats__pain">
          <div className="stats__pain-header">
            <span className="stats__badge stats__badge--red">¿Sabia esto?</span>
            <h2 className="stats__pain-title">
              Los negocios sin CRM<br />
              <span className="stats__pain-title--red">pierden clientes e ingresos cada dia</span>
            </h2>
            <p className="stats__pain-sub">
              Estos son los numeros reales de negocios de servicios que aun no automatizan su gestion.
            </p>
          </div>

          <div className="stats__pain-grid">
            {LOSSES.map((l) => (
              <div className={`stats__pain-card ${visible ? 'stats__pain-card--visible' : ''}`} key={l.headline}>
                <p className="stats__pain-number" style={{ color: l.color }}>
                  <Counter end={l.value} prefix={l.prefix} suffix={l.suffix} decimals={l.decimals || 0} delay={l.delay} />
                </p>
                <p className="stats__pain-headline">{l.headline}</p>
                <p className="stats__pain-desc">{l.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── DIVIDER ── */}
        <div className="stats__divider">
          <div className="stats__divider-line" />
          <span className="stats__divider-text">Con PlexifyStudio todo cambia</span>
          <div className="stats__divider-line" />
        </div>

        {/* ── GAIN SECTION ── */}
        <div className="stats__gain">
          <div className="stats__gain-grid">
            {GAINS.map((g) => (
              <div className="stats__gain-card" key={g.text}>
                <span className="stats__gain-icon">{g.icon}</span>
                <span className="stats__gain-text">{g.text}</span>
              </div>
            ))}
          </div>

          <div className="stats__cta-wrap">
            <Link to="/register" className="stats__cta">
              Deje de perder clientes — empiece gratis hoy →
            </Link>
            <p className="stats__cta-note">Listo en 5 minutos · Sin tarjeta de credito · Cancele cuando quiera</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default memo(Stats);
