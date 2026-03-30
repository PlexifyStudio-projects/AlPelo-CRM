import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../../../components/landing/common/SEO';
import ParticleRing from '../../../components/landing/common/ParticleRing';

export default function LinaIA() {
  const ref = useRef(null);
  const [activeAction, setActiveAction] = useState(0);

  useEffect(() => {
    ref.current?.classList.add('lina--visible');
    // Auto-cycle actions
    const interval = setInterval(() => setActiveAction(p => (p + 1) % 6), 3000);
    return () => clearInterval(interval);
  }, []);

  const ACTIONS = [
    { icon: '💬', label: 'Responde WhatsApp', desc: 'Atiende cada mensaje al instante. Agenda citas, confirma horarios y resuelve dudas — todo desde el chat.', color: '#25d366' },
    { icon: '📅', label: 'Gestiona la Agenda', desc: 'Crea, cancela o reprograma citas. Verifica disponibilidad del equipo en tiempo real antes de confirmar.', color: '#0ea5e9' },
    { icon: '🧠', label: 'Analiza el Negocio', desc: 'Revisa métricas, detecta tendencias y genera recomendaciones concretas con los datos reales de su operación.', color: '#8b5cf6' },
    { icon: '🎯', label: 'Recupera Clientes', desc: 'Detecta quién dejó de venir, genera ofertas personalizadas y envía mensajes de reactivación automáticamente.', color: '#ef4444' },
    { icon: '📊', label: 'Reportes Claros', desc: 'KPIs, tendencias, comparativos y alertas — todo resumido y listo para tomar decisiones.', color: '#f59e0b' },
    { icon: '🔒', label: 'Verificación en 4 Pasos', desc: 'Cada mensaje pasa por 4 fases: Lee, Verifica, Analiza y Ejecuta. Nada se envía sin validación.', color: '#10b981' },
  ];

  const PIPELINE = [
    { num: '01', tag: 'READ', title: 'Lee', desc: 'Mensaje + historial + contexto del cliente', color: '#8b5cf6' },
    { num: '02', tag: 'VERIFY', title: 'Verifica', desc: 'Cruza con agenda, clientes y servicios', color: '#0ea5e9' },
    { num: '03', tag: 'ANALYZE', title: 'Analiza', desc: 'Evalúa la mejor acción posible', color: '#f59e0b' },
    { num: '04', tag: 'EXECUTE', title: 'Ejecuta', desc: 'Responde de forma natural y verificada', color: '#10b981' },
  ];

  const CHAT = [
    { from: 'client', name: 'Carolina Méndez', msg: 'Hola! Quisiera agendar un corte para mañana, ¿tienen disponibilidad?' },
    { from: 'lina', msg: '¡Hola Carolina! 😊 Claro, déjame revisar la agenda de mañana...' },
    { from: 'lina', msg: 'Tenemos disponible:\n• 10:00 AM con Alexander\n• 2:30 PM con Anderson\n• 4:00 PM con Camilo\n\n¿Cuál te queda mejor?' },
    { from: 'client', name: 'Carolina Méndez', msg: 'El de las 10 con Alexander porfa 🙏' },
    { from: 'lina', msg: '✅ ¡Listo! Tu cita quedó agendada:\n\n📅 Mañana, 29 de marzo\n⏰ 10:00 AM\n✂️ Corte Premium — $85.000\n👤 Alexander\n\nTe enviaré un recordatorio mañana a las 9 AM. ¡Te esperamos!' },
  ];

  return (
    <>
      <SEO
        title="Lina IA — Asistente Virtual para tu Negocio"
        description="Lina responde WhatsApp, agenda citas y analiza tu negocio 24/7. Asistente con inteligencia artificial para peluquerias, salones de belleza, barberias y spas."
        url="/lina-ia"
        keywords="asistente virtual para negocios, chatbot WhatsApp peluqueria, inteligencia artificial salon de belleza, bot de citas automatico, IA para barberia"
      />

      <div className="lina" ref={ref}>

        {/* ═══ HERO — Dark, compact, impactful ═══ */}
        <section className="lina__hero">
          <div className="lina__hero-bg" aria-hidden="true" />

          <div className="lina__hero-inner">
            <div className="lina__hero-left">
              <div className="lina__hero-particle">
                <ParticleRing />
              </div>
            </div>

            <div className="lina__hero-right">
              <div className="lina__hero-badge">
                <span className="lina__hero-badge-dot" />
                IA de Nueva Generación · 24/7
              </div>

              <h1 className="lina__hero-title">
                Asistente Virtual con IA para{' '}
                <span className="lina__hero-title--glow">Peluquerías y Salones</span>
              </h1>

              <p className="lina__hero-sub">
                Lina atiende a sus clientes por WhatsApp mientras usted trabaja.
                Agenda citas, responde preguntas, recupera inactivos y analiza su negocio — 24/7, sin descanso.
              </p>

              <div className="lina__hero-actions">
                <Link to="/pricing" className="lina__btn lina__btn--primary">
                  Probar Lina Gratis
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </Link>
                <Link to="/#pricing" className="lina__btn lina__btn--glass">Ver Planes</Link>
              </div>

              <div className="lina__hero-stats">
                <div><strong>29+</strong><span>Acciones</span></div>
                <div><strong>4</strong><span>Fases</span></div>
                <div><strong>24/7</strong><span>Activa</span></div>
                <div><strong>4</strong><span>Validaciones</span></div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ ACTIONS — Bento interactive selector ═══ */}
        <section className="lina__actions">
          <div className="lina__actions-inner">
            <div className="lina__actions-tabs">
              {ACTIONS.map((a, i) => (
                <button
                  key={a.label}
                  className={`lina__actions-tab ${i === activeAction ? 'lina__actions-tab--active' : ''}`}
                  onClick={() => setActiveAction(i)}
                  style={{ '--ac': a.color }}
                >
                  <span className="lina__actions-tab-icon">{a.icon}</span>
                  <span className="lina__actions-tab-label">{a.label}</span>
                </button>
              ))}
            </div>
            <div className="lina__actions-detail" style={{ '--ac': ACTIONS[activeAction].color }}>
              <span className="lina__actions-detail-icon">{ACTIONS[activeAction].icon}</span>
              <h3>{ACTIONS[activeAction].label}</h3>
              <p>{ACTIONS[activeAction].desc}</p>
            </div>
          </div>
        </section>

        {/* ═══ PIPELINE — Horizontal 4 phases ═══ */}
        <section className="lina__pipeline">
          <div className="lina__pipeline-inner">
            <h2 className="lina__section-title">
              Pipeline de verificación en <span className="lina__glow">4 fases</span>
            </h2>
            <p className="lina__section-sub">Cada mensaje pasa por un proceso riguroso antes de llegar a su cliente.</p>

            <div className="lina__pipeline-track">
              {PIPELINE.map((p, i) => (
                <div className="lina__pipeline-step" key={p.tag}>
                  <div className="lina__pipeline-num" style={{ background: p.color }}>{p.num}</div>
                  <span className="lina__pipeline-tag" style={{ color: p.color }}>{p.tag}</span>
                  <h3>{p.title}</h3>
                  <p>{p.desc}</p>
                  {i < 3 && <div className="lina__pipeline-arrow">→</div>}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ CHAT — Real WhatsApp conversation ═══ */}
        <section className="lina__chat">
          <div className="lina__chat-inner">
            <div className="lina__chat-text">
              <h2 className="lina__section-title">
                Así habla <span className="lina__glow">Lina</span> con tus clientes
              </h2>
              <p className="lina__section-sub">
                Natural, precisa, verificada. Sus clientes no notan que es IA.
                Cada respuesta está respaldada por datos reales de su negocio.
              </p>
              <ul className="lina__chat-points">
                <li>✅ Verifica disponibilidad en tiempo real</li>
                <li>✅ Agenda citas con confirmación instantánea</li>
                <li>✅ Envía recordatorios automáticos</li>
                <li>✅ Responde en segundos, no en horas</li>
              </ul>
            </div>

            <div className="lina__chat-phone">
              <div className="lina__chat-phone-header">
                <span className="lina__chat-phone-back">←</span>
                <div className="lina__chat-phone-avatar">🤖</div>
                <div>
                  <strong>PlexifyStudio</strong>
                  <small>Lina IA · en línea</small>
                </div>
              </div>
              <div className="lina__chat-phone-body">
                {CHAT.map((m, i) => (
                  <div key={i} className={`lina__chat-msg lina__chat-msg--${m.from}`}>
                    {m.from === 'lina' && <span className="lina__chat-msg-badge">🤖 Lina IA</span>}
                    <p>{m.msg}</p>
                    <span className="lina__chat-msg-time">{`${10 + i}:${i * 2}${i} a.m.`} {m.from === 'lina' ? '✓✓' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ═══ TRUST — Security compact ═══ */}
        <section className="lina__trust">
          <div className="lina__trust-inner">
            <div className="lina__trust-grid">
              <div className="lina__trust-card">
                <span>🔒</span>
                <h3>Datos Encriptados</h3>
                <p>Comunicación cifrada de extremo a extremo</p>
              </div>
              <div className="lina__trust-card">
                <span>✅</span>
                <h3>Meta Compliance</h3>
                <p>100% compatible con políticas de WhatsApp Business</p>
              </div>
              <div className="lina__trust-card">
                <span>🛡️</span>
                <h3>Sin Compartir Datos</h3>
                <p>Su información nunca se comparte con terceros</p>
              </div>
              <div className="lina__trust-card">
                <span>📋</span>
                <h3>Auditoría Completa</h3>
                <p>Registro de cada acción para revisión y control</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
