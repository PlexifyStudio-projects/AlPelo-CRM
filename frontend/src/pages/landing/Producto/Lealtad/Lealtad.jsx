import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../../../../components/landing/common/SEO';
import autoImg from '../../../../assets/images/landing/Automatizacion.png';

const WORKFLOWS = [
  {
    icon: '📅',
    title: 'Recordatorio de Cita 24h',
    desc: 'WhatsApp automático al cliente 24 horas antes de su cita con fecha, hora, servicio y profesional. Incluye botón para confirmar o reprogramar.',
    trigger: 'Se activa 24h antes de cada cita',
    category: 'Citas',
    color: '#0ea5e9',
  },
  {
    icon: '⏰',
    title: 'Recordatorio 1 Hora Antes',
    desc: 'Mensaje corto de cortesía una hora antes. "¡Te esperamos en 1 hora!" — reduce no-shows hasta un 85%.',
    trigger: 'Se activa 1h antes de cada cita',
    category: 'Citas',
    color: '#0ea5e9',
  },
  {
    icon: '🔄',
    title: 'Reactivación de Inactivos',
    desc: 'Detecta clientes que llevan +30 días sin venir y les envía una oferta personalizada por WhatsApp para que vuelvan.',
    trigger: 'Automático cada semana',
    category: 'CRM',
    color: '#ef4444',
  },
  {
    icon: '🎂',
    title: 'Felicitación de Cumpleaños',
    desc: 'Mensaje de cumpleaños con bono de descuento automático. El cliente recibe su regalo y un link para reservar.',
    trigger: 'Día del cumpleaños del cliente',
    category: 'Marketing',
    color: '#ec4899',
  },
  {
    icon: '⭐',
    title: 'Seguimiento Post-Servicio',
    desc: 'A las 24 horas del servicio, envía una encuesta de satisfacción y solicita reseña en Google Reviews.',
    trigger: '24h después de completar servicio',
    category: 'CRM',
    color: '#f59e0b',
  },
  {
    icon: '🚫',
    title: 'Rescate de No-Shows',
    desc: 'Si un cliente no llega a su cita, el sistema reagenda automáticamente y le envía un mensaje para reprogramar.',
    trigger: '15 min después de la hora de la cita',
    category: 'Citas',
    color: '#ef4444',
  },
  {
    icon: '💬',
    title: 'Bienvenida a Nuevos Clientes',
    desc: 'Primer mensaje automático cuando se registra un cliente nuevo. Presenta el negocio, servicios disponibles y cómo reservar.',
    trigger: 'Al registrar un nuevo cliente',
    category: 'Marketing',
    color: '#10b981',
  },
  {
    icon: '📊',
    title: 'Reporte Semanal',
    desc: 'Resumen automático cada lunes con KPIs de la semana: citas, ingresos, clientes nuevos, retención y alertas.',
    trigger: 'Cada lunes a las 8 AM',
    category: 'Interno',
    color: '#2563eb',
  },
];

const BENEFITS = [
  { number: '85%', label: 'menos no-shows', desc: 'con recordatorios automáticos' },
  { number: '3x', label: 'más clientes reactivados', desc: 'vs seguimiento manual' },
  { number: '12h', label: 'ahorradas por semana', desc: 'en tareas repetitivas' },
  { number: '0', label: 'mensajes olvidados', desc: 'todo se envía a tiempo' },
];

export default function Lealtad() {
  const ref = useRef(null);
  useEffect(() => { ref.current?.classList.add('p-auto--visible'); }, []);

  return (
    <>
      <SEO
        title="Programa de Lealtad y Fidelizacion"
        description="Fideliza a tus clientes con puntos, recompensas y niveles automaticos. Programa de lealtad para peluquerias, salones de belleza, barberias y spas."
        url="/producto/lealtad"
        keywords="programa de fidelizacion peluqueria, puntos de lealtad salon de belleza, como retener clientes barberia, recompensas para clientes spa"
        breadcrumbs={[
          { name: 'Inicio', url: '/' },
          { name: 'Producto', url: '/features' },
          { name: 'Programa de Lealtad' },
        ]}
      />

      {/* ── HERO ── */}
      <section className="p-auto" ref={ref}>
        <div className="p-auto__hero">
          <div className="p-auto__hero-bg" aria-hidden="true" />
          <div className="p-auto__hero-inner">
            <div className="p-auto__hero-text">
              <span className="p-auto__badge">⚡ Automatizaciones</span>
              <h1 className="p-auto__title">
                Programa de Lealtad y<br />
                <span className="p-auto__title--accent">Fidelización de Clientes</span>
              </h1>
              <p className="p-auto__subtitle">
                Recordatorios de citas, reactivación de inactivos, cumpleaños,
                no-shows, seguimiento post-servicio y más — todo por WhatsApp,
                todo automático, todo sin tocar un botón.
              </p>
              <div className="p-auto__hero-actions">
                <Link to="/pricing" className="p-auto__cta p-auto__cta--primary">Ver Precios →</Link>
                <Link to="/lina-ia" className="p-auto__cta p-auto__cta--outline">Ver Lina IA</Link>
              </div>
            </div>

            <div className="p-auto__hero-image">
              <div className="p-auto__frame">
                <div className="p-auto__frame-bar">
                  <span /><span /><span />
                  <span className="p-auto__frame-url">app.plexifystudio.com/automatizaciones</span>
                </div>
                {/* TODO: Convertir a WebP para reducir ~40% el tamaño */}
                <img src={autoImg} alt="PlexifyStudio Automatizaciones" loading="lazy" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── BENEFITS ── */}
      <section className="p-auto__section">
        <div className="p-auto__section-container">
          <div className="p-auto__benefits">
            {BENEFITS.map((b) => (
              <div className="p-auto__benefit" key={b.label}>
                <span className="p-auto__benefit-number">{b.number}</span>
                <strong>{b.label}</strong>
                <span>{b.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WORKFLOWS DETALLADOS ── */}
      <section className="p-auto__section p-auto__section--alt">
        <div className="p-auto__section-container">
          <div className="p-auto__section-header">
            <span className="p-auto__section-badge">🔧 8 Workflows Incluidos</span>
            <h2>Cada automatización tiene un propósito</h2>
            <p>No son plantillas genéricas. Son flujos diseñados específicamente para negocios con clientes recurrentes.</p>
          </div>

          <div className="p-auto__workflow-grid">
            {WORKFLOWS.map((w) => (
              <div className="p-auto__workflow" key={w.title} style={{ '--wf-color': w.color }}>
                <div className="p-auto__workflow-top">
                  <span className="p-auto__workflow-icon">{w.icon}</span>
                  <span className="p-auto__workflow-cat" style={{ background: `${w.color}12`, color: w.color }}>{w.category}</span>
                </div>
                <h3 className="p-auto__workflow-title">{w.title}</h3>
                <p className="p-auto__workflow-desc">{w.desc}</p>
                <div className="p-auto__workflow-trigger">
                  <span className="p-auto__workflow-trigger-icon">⚡</span>
                  <span>{w.trigger}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="p-auto__section">
        <div className="p-auto__section-container">
          <div className="p-auto__section-header">
            <span className="p-auto__section-badge">🎯 Así de fácil</span>
            <h2>3 pasos para automatizar tu negocio</h2>
          </div>
          <div className="p-auto__steps">
            <div className="p-auto__step">
              <span className="p-auto__step-num">1</span>
              <h3>Activa</h3>
              <p>Elige qué workflows quieres activar. Solo es un toggle ON/OFF para cada uno.</p>
            </div>
            <div className="p-auto__step-arrow">→</div>
            <div className="p-auto__step">
              <span className="p-auto__step-num">2</span>
              <h3>Personaliza</h3>
              <p>Ajusta el mensaje, los tiempos y los segmentos. Usa variables como {'{{nombre}}'} y {'{{servicio}}'}.</p>
            </div>
            <div className="p-auto__step-arrow">→</div>
            <div className="p-auto__step">
              <span className="p-auto__step-num">3</span>
              <h3>Olvídate</h3>
              <p>El sistema trabaja 24/7. Tú solo ves los resultados en tu dashboard.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── VARIABLES DINÁMICAS ── */}
      <section className="p-auto__section p-auto__section--alt">
        <div className="p-auto__section-container">
          <div className="p-auto__section-header">
            <span className="p-auto__section-badge">🔤 Variables Dinámicas</span>
            <h2>Mensajes personalizados sin esfuerzo</h2>
            <p>Usa variables como {'{{nombre}}'}, {'{{servicio}}'}, {'{{fecha}}'} y el sistema las reemplaza automáticamente por los datos reales del cliente.</p>
          </div>

          <div className="p-auto__variables">
            <div className="p-auto__variables-list">
              <h3 className="p-auto__variables-title">Variables disponibles</h3>
              {[
                { var: '{{nombre}}', desc: 'Nombre del cliente', example: 'Alejandra' },
                { var: '{{servicio}}', desc: 'Servicio agendado', example: 'Corte + Barba' },
                { var: '{{fecha}}', desc: 'Fecha de la cita', example: '28 de marzo' },
                { var: '{{hora}}', desc: 'Hora de la cita', example: '3:00 PM' },
                { var: '{{profesional}}', desc: 'Profesional asignado', example: 'Alexander' },
                { var: '{{negocio}}', desc: 'Nombre del negocio', example: 'Studio Barber' },
              ].map((v) => (
                <div className="p-auto__variable-item" key={v.var}>
                  <code className="p-auto__variable-code">{v.var}</code>
                  <span className="p-auto__variable-desc">{v.desc}</span>
                  <span className="p-auto__variable-example">ej: {v.example}</span>
                </div>
              ))}
            </div>

            <div className="p-auto__variables-demo">
              <div className="p-auto__chat-demo">
                <div className="p-auto__chat-label">Plantilla</div>
                <div className="p-auto__chat-bubble p-auto__chat-bubble--template">
                  Hola <code>{'{{nombre}}'}</code>, te recordamos tu cita de <code>{'{{servicio}}'}</code> mañana <code>{'{{fecha}}'}</code> a las <code>{'{{hora}}'}</code> con <code>{'{{profesional}}'}</code> en <code>{'{{negocio}}'}</code>. ¡Te esperamos! 🙌
                </div>
              </div>

              <div className="p-auto__chat-arrow">↓ Se convierte en ↓</div>

              <div className="p-auto__chat-demo">
                <div className="p-auto__chat-label">Mensaje enviado</div>
                <div className="p-auto__chat-bubble p-auto__chat-bubble--sent">
                  Hola <strong>Alejandra</strong>, te recordamos tu cita de <strong>Corte + Barba</strong> mañana <strong>28 de marzo</strong> a las <strong>3:00 PM</strong> con <strong>Alexander</strong> en <strong>Studio Barber</strong>. ¡Te esperamos! 🙌
                </div>
                <div className="p-auto__chat-meta">
                  <span>✓✓ Entregado</span>
                  <span>14:32</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TOGGLE ON/OFF ── */}
      <section className="p-auto__section">
        <div className="p-auto__section-container">
          <div className="p-auto__section-header">
            <span className="p-auto__section-badge">🔘 Toggle ON/OFF</span>
            <h2>Un switch. Eso es todo.</h2>
            <p>Cada workflow tiene un toggle simple. Actívalo y funciona para siempre. Desactívalo y se detiene. Sin código, sin complejidad.</p>
          </div>

          <div className="p-auto__toggles">
            {[
              { name: 'Recordatorio de Cita 24h', cat: 'Citas', active: true, sent: '2.847' },
              { name: 'Recordatorio 1 Hora Antes', cat: 'Citas', active: true, sent: '2.651' },
              { name: 'Felicitación de Cumpleaños', cat: 'Marketing', active: true, sent: '342' },
              { name: 'Reactivación de Inactivos', cat: 'CRM', active: true, sent: '1.203' },
              { name: 'Seguimiento Post-Servicio', cat: 'CRM', active: false, sent: '0' },
              { name: 'Rescate de No-Shows', cat: 'Citas', active: true, sent: '487' },
              { name: 'Bienvenida a Nuevos Clientes', cat: 'Marketing', active: true, sent: '891' },
              { name: 'Reporte Semanal', cat: 'Interno', active: false, sent: '0' },
            ].map((t) => (
              <div className={`p-auto__toggle-row ${t.active ? 'p-auto__toggle-row--active' : ''}`} key={t.name}>
                <div className="p-auto__toggle-info">
                  <strong className="p-auto__toggle-name">{t.name}</strong>
                  <span className="p-auto__toggle-cat">{t.cat}</span>
                </div>
                <div className="p-auto__toggle-right">
                  {t.active && <span className="p-auto__toggle-sent">{t.sent} enviados</span>}
                  <div className={`p-auto__toggle-switch ${t.active ? 'p-auto__toggle-switch--on' : ''}`}>
                    <div className="p-auto__toggle-knob" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MÉTRICAS POR WORKFLOW ── */}
      <section className="p-auto__section p-auto__section--alt">
        <div className="p-auto__section-container">
          <div className="p-auto__section-header">
            <span className="p-auto__section-badge">📈 Métricas por Workflow</span>
            <h2>Sabe exactamente qué funciona</h2>
            <p>Cada automatización rastrea mensajes enviados, entregados, leídos, respondidos y conversiones. Datos reales, no suposiciones.</p>
          </div>

          <div className="p-auto__metrics-grid">
            {[
              {
                name: 'Recordatorio 24h',
                icon: '📅',
                color: '#0ea5e9',
                stats: { sent: 2847, delivered: 2801, read: 2654, responded: 1892, conversion: '66%' },
              },
              {
                name: 'Reactivación Inactivos',
                icon: '🔄',
                color: '#ef4444',
                stats: { sent: 1203, delivered: 1180, read: 987, responded: 412, conversion: '34%' },
              },
              {
                name: 'Cumpleaños',
                icon: '🎂',
                color: '#ec4899',
                stats: { sent: 342, delivered: 338, read: 321, responded: 287, conversion: '84%' },
              },
              {
                name: 'Bienvenida',
                icon: '💬',
                color: '#10b981',
                stats: { sent: 891, delivered: 884, read: 756, responded: 534, conversion: '60%' },
              },
            ].map((m) => (
              <div className="p-auto__metric-card" key={m.name} style={{ '--mc-color': m.color }}>
                <div className="p-auto__metric-card-header">
                  <span className="p-auto__metric-card-icon">{m.icon}</span>
                  <h3>{m.name}</h3>
                </div>
                <div className="p-auto__metric-card-stats">
                  <div className="p-auto__metric-stat">
                    <span className="p-auto__metric-stat-value">{m.stats.sent.toLocaleString()}</span>
                    <span className="p-auto__metric-stat-label">Enviados</span>
                  </div>
                  <div className="p-auto__metric-stat">
                    <span className="p-auto__metric-stat-value">{m.stats.delivered.toLocaleString()}</span>
                    <span className="p-auto__metric-stat-label">Entregados</span>
                  </div>
                  <div className="p-auto__metric-stat">
                    <span className="p-auto__metric-stat-value">{m.stats.read.toLocaleString()}</span>
                    <span className="p-auto__metric-stat-label">Leídos</span>
                  </div>
                  <div className="p-auto__metric-stat">
                    <span className="p-auto__metric-stat-value">{m.stats.responded.toLocaleString()}</span>
                    <span className="p-auto__metric-stat-label">Respondidos</span>
                  </div>
                </div>
                <div className="p-auto__metric-card-bar">
                  <div className="p-auto__metric-card-bar-fill" style={{ width: m.stats.conversion }} />
                </div>
                <div className="p-auto__metric-card-conversion">
                  <span>Tasa de conversión</span>
                  <strong>{m.stats.conversion}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
