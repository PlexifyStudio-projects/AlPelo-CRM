import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../../../../components/landing/common/SEO';
import campanaImg from '../../../../assets/images/landing/campaña.png';

const TEMPLATES = [
  { name: 'Bienvenida', cat: 'Onboarding', color: '#10b981', msg: '¡Hola {{nombre}}! 👋 Bienvenido/a a {{negocio}}. Estamos felices de tenerte. ¿Te gustaría agendar tu primera cita?' },
  { name: 'Recordatorio 24h', cat: 'Recordatorio', color: '#2563eb', msg: 'Hola {{nombre}}, te recordamos que mañana tienes tu cita de {{servicio}} a las {{hora}}. ¡Te esperamos! 📅' },
  { name: 'Cumpleaños', cat: 'Fidelización', color: '#ec4899', msg: '🎂 ¡Feliz cumpleaños, {{nombre}}! En {{negocio}} queremos celebrarte con un 15% de descuento en tu próxima visita. ¡Válido esta semana!' },
  { name: 'Reactivación', cat: 'Rescate', color: '#f97316', msg: '{{nombre}}, ¡te extrañamos! 💜 Han pasado más de 30 días. Vuelve a {{negocio}} con un 20% OFF en cualquier servicio.' },
  { name: 'Post-Servicio', cat: 'Seguimiento', color: '#8b5cf6', msg: 'Hola {{nombre}}, gracias por visitarnos hoy. ¿Cómo te fue con tu {{servicio}}? Tu opinión nos importa mucho. ⭐' },
  { name: 'Promoción VIP', cat: 'Promoción', color: '#0ea5e9', msg: '🌟 {{nombre}}, como cliente VIP de {{negocio}} tienes acceso exclusivo a nuestra nueva promoción: {{promo}}. ¡Reserva ahora!' },
];

const SEGMENTS = [
  { name: 'Todos los Clientes', icon: '👥', count: '2,847', color: '#2563eb', desc: 'Base completa de contactos activos' },
  { name: 'Clientes VIP', icon: '⭐', count: '312', color: '#f59e0b', desc: 'Más de 10 visitas o ticket alto' },
  { name: 'Inactivos (+30 días)', icon: '😴', count: '489', color: '#ef4444', desc: 'Sin visita en el último mes' },
  { name: 'Clientes Nuevos', icon: '🆕', count: '156', color: '#10b981', desc: 'Primera visita en últimos 15 días' },
  { name: 'En Riesgo', icon: '⚠️', count: '203', color: '#f97316', desc: 'Frecuencia decreciente detectada' },
];

const METRICS = [
  { label: 'Enviados', value: '2,847', pct: 100, color: '#2563eb' },
  { label: 'Entregados', value: '2,791', pct: 98, color: '#10b981' },
  { label: 'Leídos', value: '2,234', pct: 78, color: '#8b5cf6' },
  { label: 'Respondidos', value: '1,423', pct: 50, color: '#f59e0b' },
  { label: 'Conversiones', value: '847', pct: 30, color: '#ec4899' },
];

const REACTIVATION_STEPS = [
  { step: '01', icon: '🔍', title: 'Detección Automática', desc: 'El sistema identifica clientes que no visitan hace 30+ días. Analiza historial, frecuencia habitual y último servicio.' },
  { step: '02', icon: '✍️', title: 'Mensaje Personalizado', desc: 'Se genera un mensaje único con el nombre del cliente, su servicio favorito y una oferta especial de regreso.' },
  { step: '03', icon: '📤', title: 'Envío por WhatsApp', desc: 'El mensaje se envía automáticamente. Si el cliente responde, Lina IA continúa la conversación y agenda la cita.' },
  { step: '04', icon: '📊', title: 'Resultados Medibles', desc: 'Tasa de apertura, respuesta y re-agendamiento. Sabrás exactamente cuántos clientes recuperaste y cuánto ingreso generaron.' },
];

export default function Campanas() {
  const ref = useRef(null);
  useEffect(() => { ref.current?.classList.add('p-campanas--visible'); }, []);

  return (
    <>
      <SEO title="Campañas WhatsApp" description="Envío masivo de WhatsApp, plantillas aprobadas por Meta, campañas de reactivación y métricas en tiempo real." url="/producto/campanas" />

      {/* ── HERO ── */}
      <section className="p-campanas" ref={ref}>
        <div className="p-campanas__hero">
          <div className="p-campanas__hero-content">
            <span className="p-campanas__badge">💬 WhatsApp & Campañas</span>
            <h1 className="p-campanas__title">
              WhatsApp que trabaja<br />
              <span className="p-campanas__title--accent">mientras tú descansas</span>
            </h1>
            <p className="p-campanas__subtitle">
              Envía campañas masivas, reactivación de clientes inactivos,
              recordatorios automáticos y deja que Lina IA responda por ti 24/7.
            </p>
            <div className="p-campanas__hero-actions">
              <Link to="/pricing" className="p-campanas__cta p-campanas__cta--primary">Ver Precios →</Link>
              <Link to="/lina-ia" className="p-campanas__cta p-campanas__cta--outline">Ver Lina IA</Link>
            </div>
            <div className="p-campanas__hero-stats">
              <div><strong>847</strong><span>mensajes hoy</span></div>
              <div><strong>12</strong><span>campañas activas</span></div>
              <div><strong>95%</strong><span>tasa de entrega</span></div>
            </div>
          </div>

          <div className="p-campanas__preview">
            <img src={campanaImg} alt="PlexifyStudio Campañas WhatsApp" className="p-campanas__preview-img" />
          </div>
        </div>
      </section>

      {/* ── 1. PLANTILLAS WHATSAPP ── */}
      <section className="p-campanas__section">
        <div className="p-campanas__section-container">
          <div className="p-campanas__section-header">
            <span className="p-campanas__section-badge">📝 Plantillas Listas</span>
            <h2>Plantillas WhatsApp Aprobadas por Meta</h2>
            <p>Templates profesionales listos para usar. Cada plantilla está pre-aprobada por Meta y utiliza variables dinámicas para personalización automática.</p>
          </div>

          <div className="p-campanas__templates-grid">
            {TEMPLATES.map((t) => (
              <div className="p-campanas__template-card" key={t.name}>
                <div className="p-campanas__template-header">
                  <span className="p-campanas__template-name">{t.name}</span>
                  <span className="p-campanas__template-cat" style={{ background: `${t.color}15`, color: t.color }}>{t.cat}</span>
                </div>
                <div className="p-campanas__template-bubble">
                  <div className="p-campanas__template-bubble-tail" />
                  <p>{t.msg}</p>
                  <span className="p-campanas__template-time">10:30 a.m. ✓✓</span>
                </div>
                <div className="p-campanas__template-footer">
                  <span className="p-campanas__template-status">✅ Aprobada por Meta</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 2. ENVÍO MASIVO ── */}
      <section className="p-campanas__section p-campanas__section--alt">
        <div className="p-campanas__section-container">
          <div className="p-campanas__section-header">
            <span className="p-campanas__section-badge">📨 Segmentación</span>
            <h2>Envío Masivo Inteligente</h2>
            <p>No envíes el mismo mensaje a todos. Segmenta tu audiencia y envía campañas relevantes a cada grupo de clientes.</p>
          </div>

          <div className="p-campanas__segments-grid">
            {SEGMENTS.map((s) => (
              <div className="p-campanas__segment-card" key={s.name} style={{ '--seg-color': s.color }}>
                <span className="p-campanas__segment-icon">{s.icon}</span>
                <div className="p-campanas__segment-info">
                  <strong>{s.name}</strong>
                  <span>{s.desc}</span>
                </div>
                <div className="p-campanas__segment-count" style={{ color: s.color }}>{s.count}</div>
              </div>
            ))}
          </div>

          <div className="p-campanas__send-demo">
            <div className="p-campanas__send-demo-header">
              <span>📊 Resultados del último envío masivo — Campaña &quot;Promoción Navidad&quot;</span>
            </div>
            <div className="p-campanas__send-demo-stats">
              <div className="p-campanas__send-demo-stat">
                <strong>2,847</strong>
                <span>Enviados</span>
              </div>
              <div className="p-campanas__send-demo-stat">
                <strong style={{ color: '#10b981' }}>98.2%</strong>
                <span>Entregados</span>
              </div>
              <div className="p-campanas__send-demo-stat">
                <strong style={{ color: '#8b5cf6' }}>78.4%</strong>
                <span>Leídos</span>
              </div>
              <div className="p-campanas__send-demo-stat">
                <strong style={{ color: '#f59e0b' }}>49.7%</strong>
                <span>Respondidos</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. LINA IA RESPONDE ── */}
      <section className="p-campanas__section">
        <div className="p-campanas__section-container">
          <div className="p-campanas__section-split">
            <div className="p-campanas__section-split-text">
              <span className="p-campanas__section-badge">🤖 Respuesta Automática</span>
              <h2>Lina IA Responde por Ti</h2>
              <p>Cuando un cliente responde a tu campaña, Lina IA toma la conversación automáticamente. Responde preguntas, muestra disponibilidad y agenda citas — todo sin intervención humana, 24/7.</p>
              <ul className="p-campanas__lina-features">
                <li>💬 Respuestas naturales e inteligentes en segundos</li>
                <li>📅 Consulta disponibilidad y agenda citas en tiempo real</li>
                <li>🔄 Escalamiento a humano cuando es necesario</li>
                <li>🌙 Funciona de noche, fines de semana y festivos</li>
                <li>📊 Aprende del historial de cada cliente</li>
              </ul>
            </div>

            <div className="p-campanas__chat-mockup">
              <div className="p-campanas__chat-header-bar">
                <div className="p-campanas__chat-avatar">🏪</div>
                <div>
                  <strong>Tu Negocio</strong>
                  <span>en línea</span>
                </div>
              </div>
              <div className="p-campanas__chat-body">
                <div className="p-campanas__chat-msg p-campanas__chat-msg--out">
                  <p>¡Hola María! 🎂 Feliz cumpleaños. En Tu Negocio queremos celebrarte con un 15% de descuento. ¡Válido esta semana!</p>
                  <span>10:00 a.m. ✓✓</span>
                </div>
                <div className="p-campanas__chat-msg p-campanas__chat-msg--in">
                  <p>Hola! Muchas gracias 😊 ¿Tienen disponibilidad para mañana sábado?</p>
                  <span>10:15 a.m.</span>
                </div>
                <div className="p-campanas__chat-msg p-campanas__chat-msg--out">
                  <div className="p-campanas__chat-lina-badge">🤖 Lina IA</div>
                  <p>¡Con gusto, María! Mañana sábado tenemos disponible: 10:00 AM, 11:30 AM y 3:00 PM. ¿Cuál prefieres? Tu descuento de cumpleaños se aplica automáticamente 🎉</p>
                  <span>10:15 a.m. ✓✓</span>
                </div>
                <div className="p-campanas__chat-msg p-campanas__chat-msg--in">
                  <p>Perfecto! A las 11:30 por favor 🙌</p>
                  <span>10:16 a.m.</span>
                </div>
                <div className="p-campanas__chat-msg p-campanas__chat-msg--out">
                  <div className="p-campanas__chat-lina-badge">🤖 Lina IA</div>
                  <p>¡Listo! Tu cita queda agendada para mañana sábado a las 11:30 AM. Recuerda que tienes 15% de descuento por tu cumpleaños. ¡Te esperamos, María! 🎂✨</p>
                  <span>10:16 a.m. ✓✓</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. MÉTRICAS DE CAMPAÑA ── */}
      <section className="p-campanas__section p-campanas__section--alt">
        <div className="p-campanas__section-container">
          <div className="p-campanas__section-split">
            <div className="p-campanas__metrics-dashboard">
              <div className="p-campanas__metrics-title">
                <span>📊 Dashboard de Campaña — &quot;Promo Verano 2026&quot;</span>
              </div>
              <div className="p-campanas__metrics-bars">
                {METRICS.map((m) => (
                  <div className="p-campanas__metric-row" key={m.label}>
                    <div className="p-campanas__metric-label">
                      <span>{m.label}</span>
                      <strong>{m.value}</strong>
                    </div>
                    <div className="p-campanas__metric-bar">
                      <div className="p-campanas__metric-bar-fill" style={{ width: `${m.pct}%`, background: m.color }} />
                    </div>
                    <span className="p-campanas__metric-pct" style={{ color: m.color }}>{m.pct}%</span>
                  </div>
                ))}
              </div>
              <div className="p-campanas__metrics-kpis">
                <div><strong>$4.2M</strong><span>Ingresos generados</span></div>
                <div><strong>847</strong><span>Citas agendadas</span></div>
                <div><strong>3.2x</strong><span>ROI de campaña</span></div>
              </div>
            </div>

            <div className="p-campanas__section-split-text">
              <span className="p-campanas__section-badge">📊 Métricas</span>
              <h2>Métricas de Campaña en Tiempo Real</h2>
              <p>Cada campaña tiene su propio dashboard con métricas detalladas. Sabe exactamente cuántos mensajes se enviaron, entregaron, leyeron y respondieron.</p>
              <ul className="p-campanas__lina-features">
                <li>📈 Tasa de entrega, lectura y respuesta en vivo</li>
                <li>💰 ROI directo: ingresos generados por campaña</li>
                <li>📅 Citas agendadas directamente desde la campaña</li>
                <li>🔄 Comparativa entre campañas anteriores</li>
                <li>📥 Exportar reportes en PDF o Excel</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. REACTIVACIÓN AUTOMÁTICA ── */}
      <section className="p-campanas__section">
        <div className="p-campanas__section-container">
          <div className="p-campanas__section-header">
            <span className="p-campanas__section-badge">🎯 Rescate de Clientes</span>
            <h2>Reactivación Automática de Clientes Inactivos</h2>
            <p>El sistema detecta clientes que dejaron de visitarte, les envía una oferta personalizada y mide los resultados. Todo en piloto automático.</p>
          </div>

          <div className="p-campanas__reactivation-steps">
            {REACTIVATION_STEPS.map((s) => (
              <div className="p-campanas__reactivation-step" key={s.step}>
                <div className="p-campanas__reactivation-number">{s.step}</div>
                <span className="p-campanas__reactivation-icon">{s.icon}</span>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="p-campanas__reactivation-results">
            <div className="p-campanas__reactivation-result">
              <strong>489</strong>
              <span>Clientes inactivos detectados</span>
            </div>
            <div className="p-campanas__reactivation-arrow">→</div>
            <div className="p-campanas__reactivation-result">
              <strong>312</strong>
              <span>Mensajes enviados</span>
            </div>
            <div className="p-campanas__reactivation-arrow">→</div>
            <div className="p-campanas__reactivation-result">
              <strong>187</strong>
              <span>Respondieron</span>
            </div>
            <div className="p-campanas__reactivation-arrow">→</div>
            <div className="p-campanas__reactivation-result p-campanas__reactivation-result--highlight">
              <strong>143</strong>
              <span>Clientes recuperados</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
