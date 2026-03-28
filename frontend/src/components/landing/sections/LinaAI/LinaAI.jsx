import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import LightBurst from '../../common/LightBurst';
import ParticleRing from '../../common/ParticleRing';

const LINA_PHRASES = [
  'Iniciando Lina IA...',
  'Conectando con WhatsApp Business...',
  'Sistema activo. Monitoreando 24/7 ✓',
  'Campaña de reactivación enviada a 12 clientes ✓',
  '8 citas confirmadas para mañana por WhatsApp ✓',
  'Lerys María detectada como VIP, bono activado ✓',
  'Recordatorio enviado a Javier Vargas · 9AM ✓',
  'Ingresos esta semana: $2.4M (+23%) ✓',
  '3 clientes en riesgo rescatados automáticamente ✓',
  'Agenda optimizada — 0 conflictos detectados ✓',
];

function LinaTyping() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const phrase = LINA_PHRASES[phraseIndex];

    if (isPaused) {
      const timer = setTimeout(() => {
        setIsPaused(false);
        setIsDeleting(true);
      }, 2000);
      return () => clearTimeout(timer);
    }

    if (isDeleting) {
      if (charIndex === 0) {
        setIsDeleting(false);
        setPhraseIndex((i) => (i + 1) % LINA_PHRASES.length);
        return;
      }
      const timer = setTimeout(() => setCharIndex((c) => c - 1), 20);
      return () => clearTimeout(timer);
    }

    // Typing
    if (charIndex < phrase.length) {
      const timer = setTimeout(() => setCharIndex((c) => c + 1), 40 + Math.random() * 30);
      return () => clearTimeout(timer);
    }

    // Done typing — pause
    setIsPaused(true);
  }, [charIndex, isDeleting, isPaused, phraseIndex]);

  const displayed = LINA_PHRASES[phraseIndex].slice(0, charIndex);

  return (
    <div className="lina-ai__typing lina-ai__typing--visible">
      <span className="lina-ai__typing-cursor-wrap">
        <span className="lina-ai__typing-text">{displayed}</span>
        <span className="lina-ai__typing-cursor" />
      </span>
    </div>
  );
}

const capabilities = [
  'Responde WhatsApp automáticamente 24/7',
  'Genera campañas de marketing personalizadas',
  'Analiza métricas y sugiere mejoras',
  'Diagnostica la salud de tu negocio',
  'Predice demanda y optimiza tu agenda',
  'Rescata clientes inactivos automáticamente',
];

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="10" fill="rgba(16, 185, 129, 0.12)" />
      <path d="M6.5 10.5L9 13L14 7" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v1m0 16v1m8.66-13.66l-.71.71M4.05 19.95l-.71.71M21 12h-1M4 12H3m16.66 7.66l-.71-.71M4.05 4.05l-.71-.71" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

export default function LinaAI() {
  const sectionRef = useRef(null);
  const mockupRef = useRef(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('lina-ai--visible');
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="lina-ai" ref={sectionRef} aria-label="Lina IA — Asistente inteligente" style={{ position: 'relative' }}>
      <LightBurst position="center" color="purple" intensity="medium" />
      {/* Tech grid background */}
      <div className="lina-ai__grid-bg" aria-hidden="true" />

      <div className="lina-ai__container" style={{ position: 'relative', zIndex: 1 }}>
        {/* Left side — Text content */}
        <div className="lina-ai__content">
          <span className="lina-ai__badge">
            <SparkleIcon />
            Inteligencia Artificial
          </span>

          <h2 className="lina-ai__title">
            Conoce a <span className="lina-ai__title--highlight">Lina</span>, tu asistente ejecutiva con IA
          </h2>

          <p className="lina-ai__description">
            Lina IA entiende tu negocio, responde a tus clientes por WhatsApp, genera campañas de marketing, analiza tus métricas y toma decisiones inteligentes — todo en tiempo real.
          </p>

          <ul className="lina-ai__capabilities" aria-label="Capacidades de Lina IA">
            {capabilities.map((item) => (
              <li className="lina-ai__capability" key={item}>
                <CheckIcon />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <Link className="lina-ai__cta" to="/lina-ia" aria-label="Descubrir más sobre Lina IA">
            Descubre Lina IA
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="3" y1="9" x2="15" y2="9" />
              <polyline points="10 4 15 9 10 14" />
            </svg>
          </Link>
        </div>

        {/* Right side — Particles + Lina Card inside */}
        <div className="lina-ai__visual" ref={mockupRef}>
          <ParticleRing className="lina-ai__particle-canvas" />

          {/* Animated typing label */}
          <LinaTyping />
        </div>
      </div>
    </section>
  );
}
