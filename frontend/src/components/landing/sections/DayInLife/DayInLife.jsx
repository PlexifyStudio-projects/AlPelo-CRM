import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

const TIMELINE = [
  {
    time: '7 AM',
    emoji: '☀️',
    title: 'Recordatorios enviados',
    desc: 'Lina IA envió recordatorios por WhatsApp. 3 clientes confirmaron mientras dormías.',
    tag: 'WhatsApp',
    tagColor: '#25d366',
  },
  {
    time: '10 AM',
    emoji: '🤖',
    title: 'Lina detecta inactivos',
    desc: '5 clientes sin venir hace 30 días. Campaña de reactivación enviada en un clic.',
    tag: 'Lina IA',
    tagColor: '#8b5cf6',
  },
  {
    time: '1 PM',
    emoji: '💬',
    title: 'Cliente nuevo por WhatsApp',
    desc: 'Preguntó horarios. Lina respondió al instante con disponibilidad y link de reserva.',
    tag: 'Automatización',
    tagColor: '#f59e0b',
  },
  {
    time: '8 PM',
    emoji: '📊',
    title: 'Cierre automático',
    desc: '14 citas completadas, 3 clientes nuevos, 5 reactivados. Todo en tu dashboard.',
    tag: 'Dashboard',
    tagColor: '#2563eb',
  },
];

export default function DayInLife() {
  const ref = useRef(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        // Reveal items one by one
        TIMELINE.forEach((_, i) => {
          setTimeout(() => setActiveIndex(i), 300 + i * 400);
        });
        obs.disconnect();
      }
    }, { threshold: 0.2 });

    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section className="day" ref={ref} aria-label="Un día con PlexifyStudio">
      <div className="day__container">
        <div className="day__header">
          <span className="day__badge">✨ Imagina esto</span>
          <h2 className="day__title">
            Un día en tu negocio <span className="day__title--highlight">con PlexifyStudio</span>
          </h2>
          <p className="day__subtitle">
            Mientras tú te enfocas en lo que amas, la plataforma trabaja por ti.
          </p>
        </div>

        <div className="day__grid">
          {TIMELINE.map((item, i) => (
            <div
              className={`day__card ${i <= activeIndex ? 'day__card--visible' : ''}`}
              key={item.time}
              style={{ '--i': i }}
            >
              <div className="day__card-emoji">{item.emoji}</div>
              <span className="day__time">{item.time}</span>
              <h3 className="day__card-title">{item.title}</h3>
              <p className="day__card-desc">{item.desc}</p>
              <span className="day__tag" style={{ background: `${item.tagColor}12`, color: item.tagColor, borderColor: `${item.tagColor}25` }}>
                {item.tag}
              </span>
            </div>
          ))}
        </div>

        <div className="day__footer">
          <p className="day__footer-text">
            <strong>Todo esto pasa automáticamente.</strong> Sin estrés, sin olvidos, sin clientes perdidos.
          </p>
          <Link to="/pricing" className="day__cta">
            Quiero un día así →
          </Link>
        </div>
      </div>
    </section>
  );
}
