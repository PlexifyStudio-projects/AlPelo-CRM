import { useEffect, useRef } from 'react';

const miniStats = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    label: 'Configura en 5 min',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    label: 'Sin compromiso',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 18v-6a9 9 0 0118 0v6" />
        <path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3v5zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3v5z" />
      </svg>
    ),
    label: 'Soporte 24/7 con IA',
  },
];

export default function VideoDemo() {
  const sectionRef = useRef(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('video-demo--visible');
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="video-demo" ref={sectionRef} aria-label="Video demostración">
      <div className="video-demo__container">
        <div className="video-demo__header">
          <h2 className="video-demo__title">Mira PlexifyStudio en acción</h2>
          <p className="video-demo__subtitle">
            Descubre en 2 minutos cómo PlexifyStudio CRM puede transformar la gestión de tu negocio.
          </p>
        </div>

        <div className="video-demo__player">
          {/* Browser-like frame */}
          <div className="video-demo__frame">
            <div className="video-demo__frame-header">
              <span className="video-demo__frame-dot" />
              <span className="video-demo__frame-dot" />
              <span className="video-demo__frame-dot" />
            </div>

            <div className="video-demo__placeholder" role="button" tabIndex={0} aria-label="Reproducir video demo">
              <div className="video-demo__play-btn" aria-hidden="true">
                <svg
                  className="video-demo__play-icon"
                  width="32"
                  height="32"
                  viewBox="0 0 32 32"
                  fill="none"
                >
                  <path d="M12 8L26 16L12 24V8Z" fill="currentColor" />
                </svg>
              </div>
              <span className="video-demo__overlay-text">Ver Demo · 2:00 min</span>
            </div>
          </div>
        </div>

        <div className="video-demo__stats">
          {miniStats.map((stat) => (
            <div className="video-demo__stat" key={stat.label}>
              <span className="video-demo__stat-icon">{stat.icon}</span>
              <span className="video-demo__stat-label">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
