import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../../../../components/landing/common/SEO';
import agendaImg from '../../../../assets/images/landing/agenda.png';

const FEATURES = [
  { icon: '📅', title: 'Calendario Visual Semanal', desc: 'Vista de toda la semana con bloques de color por profesional. Ve de un vistazo quién tiene citas y cuándo.' },
  { icon: '⏰', title: 'Recordatorios Automáticos', desc: 'WhatsApp automático 24h y 1h antes de la cita. Reduce no-shows sin mover un dedo.' },
  { icon: '👥', title: 'Multi-Profesional', desc: 'Cada profesional tiene su color. Filtra por uno o ve todos a la vez en el mismo calendario.' },
  { icon: '🚫', title: 'Gestión de No-Shows', desc: 'Detecta automáticamente cuando un cliente no llega. Reagenda el espacio y envía mensaje.' },
  { icon: '📱', title: 'Reservas por WhatsApp', desc: 'Lina IA agenda citas directamente desde conversaciones de WhatsApp. El cliente ni nota que es IA.' },
  { icon: '📊', title: 'KPIs de Agenda', desc: 'Citas del día, ingresos esperados, completadas y pendientes — todo actualizado en tiempo real.' },
];

const CITAS = [
  { time: '9:00 AM', end: '10:00 AM', client: 'Lerys Maria', service: 'Corte Premium', duration: '1h', price: '$ 85.000', prof: 'Alexander', profColor: '#2D5A3D', status: 'Confirmada' },
  { time: '9:30 AM', end: '10:00 AM', client: 'Santiago Ruiz', service: 'Barba Clásica', duration: '30min', price: '$ 35.000', prof: 'Anderson', profColor: '#3B82F6', status: 'Confirmada' },
  { time: '10:00 AM', end: '11:30 AM', client: 'Camila Restrepo', service: 'Color + Tratamiento', duration: '1h 30min', price: '$ 120.000', prof: 'Ángel', profColor: '#E05292', status: 'Pendiente' },
  { time: '10:30 AM', end: '11:00 AM', client: 'Alanis Perez', service: 'Manicure Gel', duration: '40min', price: '$ 55.000', prof: 'Astrid', profColor: '#C9A84C', status: 'Confirmada' },
  { time: '11:00 AM', end: '12:00 PM', client: 'Javier Vargas', service: 'Corte + Barba', duration: '1h', price: '$ 65.000', prof: 'Alexander', profColor: '#2D5A3D', status: 'Confirmada' },
  { time: '2:00 PM', end: '3:30 PM', client: 'María F. Gil', service: 'Alisado Keratina', duration: '1h 30min', price: '$ 180.000', prof: 'Camilo', profColor: '#8B5CF6', status: 'Pendiente' },
  { time: '3:00 PM', end: '4:00 PM', client: 'Andrés Caicedo', service: 'Corte Hipster', duration: '40min', price: '$ 40.000', prof: 'Anderson', profColor: '#3B82F6', status: 'Confirmada' },
  { time: '4:00 PM', end: '5:30 PM', client: 'Isabella Cardona', service: 'Combo Manicure + Pedicure', duration: '1h 20min', price: '$ 95.000', prof: 'Astrid', profColor: '#C9A84C', status: 'Confirmada' },
  { time: '5:00 PM', end: '6:00 PM', client: 'Valentina Ospina', service: 'Cubrimiento de Canas', duration: '2h', price: '$ 80.000', prof: 'Ángel', profColor: '#E05292', status: 'Confirmada' },
  { time: '6:00 PM', end: '6:40 PM', client: 'Daniel Patiño', service: 'Corte Clásico', duration: '40min', price: '$ 35.000', prof: 'Alexander', profColor: '#2D5A3D', status: 'Confirmada' },
];

const PROFS = [
  { name: 'Alexander', color: '#2D5A3D' },
  { name: 'Anderson', color: '#3B82F6' },
  { name: 'Ángel', color: '#E05292' },
  { name: 'Astrid', color: '#C9A84C' },
  { name: 'Camilo', color: '#8B5CF6' },
];

export default function Agenda() {
  const ref = useRef(null);
  useEffect(() => { ref.current?.classList.add('p-agenda--visible'); }, []);

  return (
    <>
      <SEO
        title="Agenda Online y Sistema de Citas"
        description="Calendario visual con recordatorios automaticos por WhatsApp, gestion de no-shows y reservas con IA. Organiza las citas de tu peluqueria, salon o spa facilmente."
        url="/producto/agenda"
        keywords="sistema de citas para salon, agenda online barberia, como organizar citas de mi peluqueria, calendario de citas para spa, software de reservas online"
        breadcrumbs={[
          { name: 'Inicio', url: '/' },
          { name: 'Producto', url: '/features' },
          { name: 'Agenda Online' },
        ]}
      />

      {/* ── HERO ── */}
      <section className="p-agenda" ref={ref}>
        <div className="p-agenda__hero">
          <div className="p-agenda__hero-content">
            <span className="p-agenda__badge">📅 Módulo Agenda</span>
            <h1 className="p-agenda__title">
              Agenda Online y Sistema de Citas<br />
              <span className="p-agenda__title--accent">para Peluquerías y Barberías</span>
            </h1>
            <p className="p-agenda__subtitle">
              Calendario visual semanal, recordatorios automáticos por WhatsApp,
              gestión de no-shows y reservas con IA. Sin perder una sola cita.
            </p>
            <div className="p-agenda__hero-actions">
              <Link to="/pricing" className="p-agenda__cta p-agenda__cta--primary">Ver Precios →</Link>
              <Link to="/lina-ia" className="p-agenda__cta p-agenda__cta--outline">Ver Lina IA</Link>
            </div>
            <div className="p-agenda__hero-stats">
              <div><strong>18</strong><span>citas hoy</span></div>
              <div><strong>95%</strong><span>confirmadas</span></div>
              <div><strong>0</strong><span>conflictos</span></div>
            </div>
          </div>

          {/* Agenda Screenshot */}
          <div className="p-agenda__preview">
            {/* TODO: Convertir a WebP para reducir ~40% el tamaño */}
            <img src={agendaImg} alt="PlexifyStudio Agenda - Calendario de citas" className="p-agenda__preview-img" loading="lazy" />
          </div>
        </div>
      </section>

      {/* ── CITAS DEL DÍA ── */}
      <section className="p-agenda__section">
        <div className="p-agenda__section-container">
          <div className="p-agenda__section-header">
            <span className="p-agenda__section-badge">📋 Agenda del Día</span>
            <h2>Así se ve un día completo con 18 citas</h2>
            <p>Cada cita muestra cliente, servicio, duración, precio y profesional asignado. Todo organizado automáticamente.</p>
          </div>
          <div className="p-agenda__day-list">
            {CITAS.map((c, i) => (
              <div className="p-agenda__day-item" key={i}>
                <span className="p-agenda__day-time">{c.time}</span>
                <span className="p-agenda__day-prof-dot" style={{ background: c.profColor }} />
                <div className="p-agenda__day-info">
                  <strong>{c.client}</strong>
                  <span>{c.service} · {c.duration} · {c.price}</span>
                </div>
                <span className="p-agenda__day-prof">{c.prof}</span>
                <span className="p-agenda__day-status" style={{ background: c.status === 'Confirmada' ? '#10b98115' : '#f59e0b15', color: c.status === 'Confirmada' ? '#10b981' : '#f59e0b' }}>{c.status}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="p-agenda__section p-agenda__section--alt">
        <div className="p-agenda__section-container">
          <div className="p-agenda__section-header">
            <span className="p-agenda__section-badge">⚡ Funcionalidades</span>
            <h2>Todo lo que necesitas para gestionar tu agenda</h2>
          </div>
          <div className="p-agenda__features-grid">
            {FEATURES.map((f) => (
              <div className="p-agenda__feature-card" key={f.title}>
                <span className="p-agenda__feature-icon">{f.icon}</span>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── VISTA SEMANAL Y DIARIA ── */}
      <section className="p-agenda__section">
        <div className="p-agenda__section-container">
          <div className="p-agenda__section-split">
            <div>
              <span className="p-agenda__section-badge">📅 Vista Semanal</span>
              <h2>Toda la semana de un vistazo</h2>
              <p>La vista semanal muestra todos los profesionales en columnas y las horas en filas. Ves de un vistazo quién tiene espacios libres y dónde hay conflictos. Ideal para planificar la semana completa.</p>
              <ul className="p-agenda__check-list">
                <li>✅ Columnas por día con bloques de color por profesional</li>
                <li>✅ Arrastra y suelta para reagendar citas</li>
                <li>✅ Espacios libres resaltados en verde</li>
                <li>✅ Click en cualquier celda para crear cita rápida</li>
              </ul>
            </div>
            <div className="p-agenda__view-mock">
              <div className="p-agenda__view-card">
                <div className="p-agenda__view-card-title">Vista Semanal — Marzo 24-30</div>
                <div className="p-agenda__view-week">
                  <div className="p-agenda__view-col">
                    <span className="p-agenda__view-day">LUN 24</span>
                    <div className="p-agenda__view-block" style={{ background: 'rgba(45,90,61,0.15)', borderLeft: '3px solid #2D5A3D' }}>
                      <small>9:00</small><span>Lerys M.</span>
                    </div>
                    <div className="p-agenda__view-block" style={{ background: 'rgba(59,130,246,0.15)', borderLeft: '3px solid #3B82F6' }}>
                      <small>10:00</small><span>Santiago R.</span>
                    </div>
                    <div className="p-agenda__view-block" style={{ background: 'rgba(224,82,146,0.15)', borderLeft: '3px solid #E05292' }}>
                      <small>11:30</small><span>Camila R.</span>
                    </div>
                  </div>
                  <div className="p-agenda__view-col">
                    <span className="p-agenda__view-day p-agenda__view-day--today">MAR 25</span>
                    <div className="p-agenda__view-block" style={{ background: 'rgba(201,168,76,0.15)', borderLeft: '3px solid #C9A84C' }}>
                      <small>9:30</small><span>Alanis P.</span>
                    </div>
                    <div className="p-agenda__view-block" style={{ background: 'rgba(45,90,61,0.15)', borderLeft: '3px solid #2D5A3D' }}>
                      <small>11:00</small><span>Javier V.</span>
                    </div>
                    <div className="p-agenda__view-block" style={{ background: 'rgba(139,92,246,0.15)', borderLeft: '3px solid #8B5CF6' }}>
                      <small>2:00</small><span>María F.</span>
                    </div>
                  </div>
                  <div className="p-agenda__view-col">
                    <span className="p-agenda__view-day">MIÉ 26</span>
                    <div className="p-agenda__view-block" style={{ background: 'rgba(59,130,246,0.15)', borderLeft: '3px solid #3B82F6' }}>
                      <small>3:00</small><span>Andrés C.</span>
                    </div>
                    <div className="p-agenda__view-block" style={{ background: 'rgba(201,168,76,0.15)', borderLeft: '3px solid #C9A84C' }}>
                      <small>4:00</small><span>Isabella C.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="p-agenda__section-split p-agenda__section-split--reverse">
            <div className="p-agenda__view-mock">
              <div className="p-agenda__view-card">
                <div className="p-agenda__view-card-title">Vista Diaria — Martes 25 marzo</div>
                <div className="p-agenda__view-daily">
                  <div className="p-agenda__view-hour">
                    <span className="p-agenda__view-hour-label">8:00</span>
                    <div className="p-agenda__view-hour-line" />
                  </div>
                  <div className="p-agenda__view-hour">
                    <span className="p-agenda__view-hour-label">9:00</span>
                    <div className="p-agenda__view-hour-line">
                      <div className="p-agenda__view-block p-agenda__view-block--daily" style={{ background: 'rgba(45,90,61,0.15)', borderLeft: '3px solid #2D5A3D' }}>
                        <strong>Lerys Maria</strong>
                        <span>Corte Premium · Alexander · $85.000</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-agenda__view-hour">
                    <span className="p-agenda__view-hour-label">10:00</span>
                    <div className="p-agenda__view-hour-line">
                      <div className="p-agenda__view-block p-agenda__view-block--daily" style={{ background: 'rgba(224,82,146,0.15)', borderLeft: '3px solid #E05292' }}>
                        <strong>Camila Restrepo</strong>
                        <span>Color + Tratamiento · Ángel · $120.000</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-agenda__view-hour">
                    <span className="p-agenda__view-hour-label">11:00</span>
                    <div className="p-agenda__view-hour-line">
                      <div className="p-agenda__view-block p-agenda__view-block--daily" style={{ background: 'rgba(59,130,246,0.15)', borderLeft: '3px solid #3B82F6' }}>
                        <strong>Javier Vargas</strong>
                        <span>Corte + Barba · Anderson · $65.000</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <span className="p-agenda__section-badge">🕐 Vista Diaria</span>
              <h2>Hora por hora, servicio por servicio</h2>
              <p>La vista diaria te muestra cada cita en detalle: cliente, servicio, duración, profesional asignado y precio. Perfecta para el día a día, cuando necesitas ver exactamente qué viene después.</p>
              <ul className="p-agenda__check-list">
                <li>✅ Bloques hora por hora con detalle completo</li>
                <li>✅ Color por profesional para identificar rápido</li>
                <li>✅ Espacios libres claramente visibles</li>
                <li>✅ Clic para crear cita en cualquier horario libre</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── RECORDATORIOS AUTOMÁTICOS ── */}
      <section className="p-agenda__section p-agenda__section--alt">
        <div className="p-agenda__section-container">
          <div className="p-agenda__section-header">
            <span className="p-agenda__section-badge">⏰ Recordatorios Automáticos</span>
            <h2>Nunca más un cliente que olvida su cita</h2>
            <p>WhatsApp automático 24 horas y 1 hora antes. El cliente confirma con un botón. Tú no haces nada.</p>
          </div>
          <div className="p-agenda__reminders">
            <div className="p-agenda__reminder-card">
              <div className="p-agenda__reminder-label">24 HORAS ANTES</div>
              <div className="p-agenda__reminder-bubble p-agenda__reminder-bubble--outgoing">
                <span>Hola Lerys! Te recordamos tu cita mañana Sábado 29 de marzo a las 10:00 AM con Alexander.</span>
                <span className="p-agenda__reminder-service">Servicio: Corte Premium — $85.000</span>
                <div className="p-agenda__reminder-buttons">
                  <span className="p-agenda__reminder-confirm">✅ Confirmar</span>
                  <span className="p-agenda__reminder-cancel">❌ Cancelar</span>
                </div>
                <small>Viernes 28 mar · 10:00 AM · Automático</small>
              </div>
            </div>
            <div className="p-agenda__reminder-card">
              <div className="p-agenda__reminder-label">CLIENTE CONFIRMA</div>
              <div className="p-agenda__reminder-bubble p-agenda__reminder-bubble--incoming">
                <span>✅ Confirmar</span>
                <small>Viernes 28 mar · 10:02 AM</small>
              </div>
              <div className="p-agenda__reminder-bubble p-agenda__reminder-bubble--outgoing">
                <span>Perfecto Lerys! Tu cita está confirmada. Te esperamos mañana a las 10:00 AM. No olvides llegar 5 minutos antes.</span>
                <small>Viernes 28 mar · 10:02 AM · Lina IA</small>
              </div>
            </div>
            <div className="p-agenda__reminder-card">
              <div className="p-agenda__reminder-label">1 HORA ANTES</div>
              <div className="p-agenda__reminder-bubble p-agenda__reminder-bubble--outgoing">
                <span>Lerys, te esperamos en 1 hora! Tu cita con Alexander es a las 10:00 AM. Dirección: Calle 35 #21-15, Bucaramanga.</span>
                <small>Sábado 29 mar · 9:00 AM · Automático</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── GESTIÓN DE NO-SHOWS ── */}
      <section className="p-agenda__section">
        <div className="p-agenda__section-container">
          <div className="p-agenda__section-header">
            <span className="p-agenda__section-badge">🚫 Gestión de No-Shows</span>
            <h2>Si no llega, el sistema actúa por ti</h2>
            <p>Detección automática, reapertura del espacio y mensaje al cliente. Todo en piloto automático.</p>
          </div>
          <div className="p-agenda__noshow-steps">
            <div className="p-agenda__noshow-step">
              <div className="p-agenda__noshow-number">1</div>
              <div className="p-agenda__noshow-icon">⏰</div>
              <h3>Detección Automática</h3>
              <p>Si el cliente no se presenta 15 minutos después de la hora, el sistema lo marca como No-Show automáticamente.</p>
            </div>
            <div className="p-agenda__noshow-arrow">→</div>
            <div className="p-agenda__noshow-step">
              <div className="p-agenda__noshow-number">2</div>
              <div className="p-agenda__noshow-icon">📂</div>
              <h3>Espacio Reabierto</h3>
              <p>El horario se libera inmediatamente y queda disponible para otros clientes o para citas sin cita previa.</p>
            </div>
            <div className="p-agenda__noshow-arrow">→</div>
            <div className="p-agenda__noshow-step">
              <div className="p-agenda__noshow-number">3</div>
              <div className="p-agenda__noshow-icon">💬</div>
              <h3>Mensaje de Reagendamiento</h3>
              <p>Lina IA envía un WhatsApp al cliente ofreciendo reagendar. Amable, profesional y automático.</p>
            </div>
            <div className="p-agenda__noshow-arrow">→</div>
            <div className="p-agenda__noshow-step">
              <div className="p-agenda__noshow-number">4</div>
              <div className="p-agenda__noshow-icon">📊</div>
              <h3>Registro y Análisis</h3>
              <p>El no-show queda registrado en el perfil del cliente. Si es recurrente, el sistema sugiere acciones.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── PROFESIONALES Y COLORES ── */}
      <section className="p-agenda__section p-agenda__section--alt">
        <div className="p-agenda__section-container">
          <div className="p-agenda__section-split">
            <div>
              <span className="p-agenda__section-badge">🎨 Profesionales y Colores</span>
              <h2>Cada profesional tiene su color único</h2>
              <p>Identifica al instante quién tiene cada cita. Filtra por un profesional para ver solo su agenda, o muéstralos todos en el mismo calendario con colores diferenciados.</p>
              <ul className="p-agenda__check-list">
                <li>✅ Color único asignado a cada profesional</li>
                <li>✅ Filtro rápido por profesional</li>
                <li>✅ Vista combinada con todos los profesionales</li>
                <li>✅ Disponibilidad en tiempo real de cada uno</li>
              </ul>
            </div>
            <div className="p-agenda__profs-mock">
              <div className="p-agenda__profs-grid">
                {PROFS.map((p) => (
                  <div className="p-agenda__prof-card" key={p.name}>
                    <span className="p-agenda__prof-color" style={{ background: p.color }} />
                    <div className="p-agenda__prof-info">
                      <strong>{p.name}</strong>
                      <small>3 citas hoy · 2 libres</small>
                    </div>
                    <span className="p-agenda__prof-status">Activo</span>
                  </div>
                ))}
              </div>
              <div className="p-agenda__profs-legend">
                <span>Filtrar:</span>
                {PROFS.map((p) => (
                  <span className="p-agenda__profs-tag" key={p.name} style={{ background: `${p.color}15`, color: p.color, borderColor: `${p.color}30` }}>
                    <span className="p-agenda__prof-dot-sm" style={{ background: p.color }} />
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HORARIOS SUGERIDOS POR IA ── */}
      <section className="p-agenda__section">
        <div className="p-agenda__section-container">
          <div className="p-agenda__section-split">
            <div className="p-agenda__ia-mock">
              <div className="p-agenda__ia-card">
                <div className="p-agenda__ia-header">
                  <span className="p-agenda__ia-avatar">🤖</span>
                  <div>
                    <strong>Lina IA — Sugerencias de Agenda</strong>
                    <small>Optimización en tiempo real</small>
                  </div>
                </div>
                <div className="p-agenda__ia-suggestions">
                  <div className="p-agenda__ia-suggestion">
                    <span className="p-agenda__ia-suggestion-icon">💡</span>
                    <div>
                      <strong>Horario óptimo para Lerys Maria</strong>
                      <span>Basado en sus 41 visitas, prefiere los sábados entre 9:00 y 11:00 AM. Alexander tiene espacio el sábado a las 10:00.</span>
                    </div>
                    <span className="p-agenda__ia-suggestion-action">Agendar</span>
                  </div>
                  <div className="p-agenda__ia-suggestion">
                    <span className="p-agenda__ia-suggestion-icon">📊</span>
                    <div>
                      <strong>Espacio sin utilizar detectado</strong>
                      <span>Los miércoles de 2:00 a 4:00 PM están vacíos hace 3 semanas. Sugerencia: enviar promo de happy hour.</span>
                    </div>
                    <span className="p-agenda__ia-suggestion-action">Crear Promo</span>
                  </div>
                  <div className="p-agenda__ia-suggestion">
                    <span className="p-agenda__ia-suggestion-icon">⚡</span>
                    <div>
                      <strong>Redistribución sugerida</strong>
                      <span>Alexander tiene 6 citas el viernes y Camilo solo 2. Sugerencia: ofrecer a los nuevos clientes horarios con Camilo.</span>
                    </div>
                    <span className="p-agenda__ia-suggestion-action">Aplicar</span>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <span className="p-agenda__section-badge">🤖 IA Inteligente</span>
              <h2>Lina IA optimiza tu agenda por ti</h2>
              <p>La inteligencia artificial analiza patrones de tus clientes, la carga de cada profesional y los horarios vacíos para sugerirte la agenda perfecta. Menos huecos, más ingresos.</p>
              <ul className="p-agenda__check-list">
                <li>✅ Sugiere horarios basados en preferencias del cliente</li>
                <li>✅ Detecta espacios sin utilizar y propone promociones</li>
                <li>✅ Redistribuye carga entre profesionales</li>
                <li>✅ Predice demanda por día y hora</li>
                <li>✅ Optimiza tiempos muertos entre citas</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
