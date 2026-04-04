import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../../../../components/landing/common/SEO';
import serviciosImg from '../../../../assets/images/landing/Servicios.png';

const CATEGORIES = [
  {
    name: 'Salud y Belleza',
    icon: '💇',
    color: '#ec4899',
    services: [
      { name: 'Corte de cabello', desc: 'Estilo personalizado', price: '$35K - $85K', dur: '30-60 min', icon: '✂️' },
      { name: 'Coloración', desc: 'Tintes y mechas', price: '$80K - $200K', dur: '1.5 - 3h', icon: '🎨' },
      { name: 'Manicure & Pedicure', desc: 'Gel, acrílico, decorado', price: '$40K - $95K', dur: '40-80 min', icon: '💅' },
      { name: 'Tratamiento Facial', desc: 'Limpieza y rejuvenecimiento', price: '$60K - $150K', dur: '45-90 min', icon: '✨' },
      { name: 'Masaje Relajante', desc: 'Cuerpo completo', price: '$70K - $120K', dur: '1h', icon: '🧘' },
      { name: 'Alisado Keratina', desc: 'Liso permanente', price: '$150K - $300K', dur: '2-3h', icon: '💎' },
    ],
  },
  {
    name: 'Salud y Bienestar',
    icon: '🏥',
    color: '#10b981',
    services: [
      { name: 'Consulta General', desc: 'Evaluación completa', price: '$50K - $100K', dur: '30 min', icon: '🩺' },
      { name: 'Terapia Física', desc: 'Rehabilitación guiada', price: '$60K - $120K', dur: '45 min', icon: '💪' },
      { name: 'Nutrición', desc: 'Plan personalizado', price: '$80K - $150K', dur: '1h', icon: '🥗' },
      { name: 'Psicología', desc: 'Sesión individual', price: '$70K - $130K', dur: '50 min', icon: '🧠' },
      { name: 'Odontología', desc: 'Limpieza y revisión', price: '$40K - $200K', dur: '30-60 min', icon: '🦷' },
      { name: 'Dermatología', desc: 'Cuidado de piel', price: '$80K - $180K', dur: '30 min', icon: '🔬' },
    ],
  },
  {
    name: 'Gastronomía',
    icon: '🍽️',
    color: '#f97316',
    services: [
      { name: 'Reserva de Mesa', desc: 'Interior o terraza', price: 'Gratis', dur: 'Reserva', icon: '🪑' },
      { name: 'Evento Privado', desc: 'Salón exclusivo', price: '$500K+', dur: '3-5h', icon: '🎉' },
      { name: 'Catering', desc: 'Servicio a domicilio', price: 'Cotización', dur: 'Variable', icon: '🚚' },
      { name: 'Menú Degustación', desc: '5-7 tiempos chef', price: '$120K - $250K', dur: '2h', icon: '👨‍🍳' },
      { name: 'Brunch Especial', desc: 'Fines de semana', price: '$60K - $100K', dur: '2h', icon: '🥂' },
      { name: 'Clase de Cocina', desc: 'Aprende con el chef', price: '$150K', dur: '3h', icon: '📖' },
    ],
  },
  {
    name: 'Fitness y Deporte',
    icon: '🏋️',
    color: '#2563eb',
    services: [
      { name: 'Clase Grupal', desc: 'Spinning, yoga, HIIT', price: '$25K - $50K', dur: '45-60 min', icon: '🏃' },
      { name: 'Personal Training', desc: 'Sesión 1 a 1', price: '$80K - $150K', dur: '1h', icon: '💪' },
      { name: 'Evaluación Física', desc: 'Medidas y objetivos', price: '$60K', dur: '45 min', icon: '📊' },
      { name: 'Plan Nutricional', desc: 'Diseño personalizado', price: '$100K - $200K', dur: '1h', icon: '🥗' },
      { name: 'Membresía Mensual', desc: 'Acceso ilimitado', price: '$120K - $250K', dur: 'Mes', icon: '🎫' },
      { name: 'CrossFit', desc: 'Entrenamiento funcional', price: '$35K', dur: '1h', icon: '🔥' },
    ],
  },
  {
    name: 'Educación',
    icon: '📚',
    color: '#8b5cf6',
    services: [
      { name: 'Clase Particular', desc: 'Tutoría 1 a 1', price: '$40K - $80K', dur: '1h', icon: '📝' },
      { name: 'Taller Grupal', desc: 'Máximo 10 personas', price: '$30K - $60K', dur: '2h', icon: '👥' },
      { name: 'Curso Online', desc: 'Acceso por 30 días', price: '$150K - $400K', dur: 'Autogestión', icon: '💻' },
      { name: 'Certificación', desc: 'Con diploma oficial', price: '$300K - $800K', dur: '40h', icon: '🎓' },
      { name: 'Asesoría', desc: 'Consulta especializada', price: '$80K - $150K', dur: '1h', icon: '🎯' },
      { name: 'Seminario', desc: 'Evento presencial', price: '$50K', dur: '3h', icon: '🎤' },
    ],
  },
  {
    name: 'Mascotas',
    icon: '🐾',
    color: '#0ea5e9',
    services: [
      { name: 'Consulta Veterinaria', desc: 'Revisión completa', price: '$40K - $80K', dur: '30 min', icon: '🩺' },
      { name: 'Vacunación', desc: 'Esquema completo', price: '$30K - $60K', dur: '15 min', icon: '💉' },
      { name: 'Peluquería Canina', desc: 'Baño y corte', price: '$35K - $80K', dur: '1-2h', icon: '🐕' },
      { name: 'Guardería', desc: 'Cuidado por día', price: '$40K - $70K', dur: 'Día', icon: '🏠' },
      { name: 'Spa de Mascotas', desc: 'Relajación total', price: '$50K - $100K', dur: '1h', icon: '🛁' },
      { name: 'Cirugía Menor', desc: 'Procedimientos', price: '$200K+', dur: 'Variable', icon: '🔧' },
    ],
  },
];

const FEATURES = [
  { icon: '📋', title: 'Catálogo Completo', desc: 'Todos tus servicios organizados por categorías. Nombre, precio, duración y descripción — todo en un lugar.' },
  { icon: '🏷️', title: 'Categorías Ilimitadas', desc: 'Crea las categorías que tu negocio necesite. Peluquería, Spa, Consultas, Clases — sin límites.' },
  { icon: '💰', title: 'Precios y Duración', desc: 'Define el precio y tiempo de cada servicio. El sistema calcula horarios automáticamente.' },
  { icon: '👤', title: 'Profesionales Asignados', desc: 'Cada servicio sabe qué profesional lo ofrece. Las citas se asignan inteligentemente.' },
  { icon: '📱', title: 'Reservas por WhatsApp', desc: 'Tus clientes ven el catálogo y reservan directo desde WhatsApp con Lina IA.' },
  { icon: '📊', title: 'Métricas por Servicio', desc: 'Servicio más vendido, ingresos por categoría, precio promedio — datos para decidir mejor.' },
];

const PROFESSIONALS_MATRIX = [
  { service: 'Corte de Cabello', pros: ['Ana M.', 'Carlos R.', 'Laura P.'], icon: '✂️' },
  { service: 'Coloración', pros: ['Ana M.', 'Laura P.'], icon: '🎨' },
  { service: 'Manicure', pros: ['Sofía G.', 'Valentina T.'], icon: '💅' },
  { service: 'Tratamiento Facial', pros: ['Laura P.', 'Sofía G.'], icon: '✨' },
  { service: 'Masaje Relajante', pros: ['Carlos R.', 'Valentina T.'], icon: '🧘' },
  { service: 'Alisado Keratina', pros: ['Ana M.'], icon: '💎' },
];

export default function Servicios() {
  const ref = useRef(null);
  const [activeCat, setActiveCat] = useState(0);
  useEffect(() => { ref.current?.classList.add('p-servicios--visible'); }, []);

  return (
    <>
      <SEO
        title="Catalogo de Servicios y Precios"
        description="Organice su catalogo de servicios con categorias, precios en COP y duracion. Sus clientes reservan directo por WhatsApp o booking online."
        url="/producto/servicios"
        keywords="catalogo de servicios negocio, lista de precios servicios, como organizar servicios, gestion de precios negocio"
        breadcrumbs={[
          { name: 'Inicio', url: '/' },
          { name: 'Producto', url: '/features' },
          { name: 'Catalogo de Servicios' },
        ]}
      />

      {/* ── HERO ── */}
      <section className="p-servicios" ref={ref}>
        <div className="p-servicios__hero">
          <div className="p-servicios__hero-bg" aria-hidden="true" />
          <div className="p-servicios__hero-inner">
            <div className="p-servicios__hero-text">
              <span className="p-servicios__badge">📋 Catálogo de Servicios</span>
              <h1 className="p-servicios__title">
                Catálogo de Servicios y Precios<br />
                <span className="p-servicios__title--accent">para su Negocio</span>
              </h1>
              <p className="p-servicios__subtitle">
                No importa si tienes una peluquería, clínica, restaurante, gimnasio o veterinaria.
                Organiza tus servicios, define precios y deja que los clientes reserven solos.
              </p>
              <div className="p-servicios__hero-actions">
                <Link to="/pricing" className="p-servicios__cta p-servicios__cta--primary">Ver Precios →</Link>
                <Link to="/lina-ia" className="p-servicios__cta p-servicios__cta--outline">Ver Lina IA</Link>
              </div>
            </div>

            <div className="p-servicios__hero-image">
              <div className="p-servicios__frame">
                <div className="p-servicios__frame-bar">
                  <span /><span /><span />
                  <span className="p-servicios__frame-url">app.plexifystudio.com/servicios</span>
                </div>
                {/* TODO: Convertir a WebP para reducir ~40% el tamaño */}
                <img src={serviciosImg} alt="PlexifyStudio Catálogo de Servicios" loading="lazy" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── INTERACTIVE CATEGORIES ── */}
      <section className="p-servicios__section">
        <div className="p-servicios__section-container">
          <div className="p-servicios__section-header">
            <span className="p-servicios__section-badge">🌐 Para todo tipo de negocio</span>
            <h2>Un catálogo que se adapta a ti</h2>
            <p>Selecciona tu industria y mira cómo se vería tu catálogo de servicios.</p>
          </div>

          <div className="p-servicios__cat-tabs">
            {CATEGORIES.map((c, i) => (
              <button
                key={c.name}
                className={`p-servicios__cat-tab ${i === activeCat ? 'p-servicios__cat-tab--active' : ''}`}
                onClick={() => setActiveCat(i)}
                style={{ '--tab-color': c.color }}
              >
                <span className="p-servicios__cat-tab-icon">{c.icon}</span>
                <span>{c.name}</span>
              </button>
            ))}
          </div>

          <div className="p-servicios__cat-content">
            <div className="p-servicios__cat-grid">
              {CATEGORIES[activeCat].services.map((s, i) => (
                <div className="p-servicios__cat-card" key={s.name} style={{ '--cat-color': CATEGORIES[activeCat].color, animationDelay: `${i * 80}ms` }}>
                  <span className="p-servicios__cat-card-icon">{s.icon}</span>
                  <div className="p-servicios__cat-card-info">
                    <strong>{s.name}</strong>
                    <span>{s.desc}</span>
                  </div>
                  <div className="p-servicios__cat-card-meta">
                    <span className="p-servicios__cat-card-price" style={{ color: CATEGORIES[activeCat].color }}>{s.price}</span>
                    <span className="p-servicios__cat-card-dur">{s.dur}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="p-servicios__section p-servicios__section--alt">
        <div className="p-servicios__section-container">
          <div className="p-servicios__section-header">
            <span className="p-servicios__section-badge">⚡ Funcionalidades</span>
            <h2>Todo lo que necesitas para gestionar tus servicios</h2>
          </div>
          <div className="p-servicios__features-grid">
            {FEATURES.map((f) => (
              <div className="p-servicios__feature-card" key={f.title}>
                <span className="p-servicios__feature-icon">{f.icon}</span>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRECIOS Y DURACIÓN ── */}
      <section className="p-servicios__section">
        <div className="p-servicios__section-container">
          <div className="p-servicios__section-split">
            <div className="p-servicios__section-split-text">
              <span className="p-servicios__section-badge">💰 Precios Inteligentes</span>
              <h2>Precios y Duración Inteligentes</h2>
              <p>Define el precio exacto y la duración estimada de cada servicio. El sistema calcula automáticamente los horarios disponibles basándose en la duración del servicio y la agenda del profesional.</p>
              <ul className="p-servicios__check-list">
                <li>⏱️ Duración configurable por servicio (15 min a 8 horas)</li>
                <li>💲 Precios fijos o rangos flexibles</li>
                <li>📅 Cálculo automático de slots disponibles</li>
                <li>🔄 Tiempo de preparación entre citas configurable</li>
                <li>📊 Historial de cambios de precio</li>
              </ul>
            </div>

            <div className="p-servicios__pricing-demo">
              <div className="p-servicios__pricing-demo-header">
                <span>💰 Configuración de Servicio</span>
              </div>
              <div className="p-servicios__pricing-demo-body">
                <div className="p-servicios__pricing-demo-field">
                  <label>Nombre del Servicio</label>
                  <div className="p-servicios__pricing-demo-input">Corte de Cabello Premium</div>
                </div>
                <div className="p-servicios__pricing-demo-row">
                  <div className="p-servicios__pricing-demo-field">
                    <label>Precio</label>
                    <div className="p-servicios__pricing-demo-input">$65.000</div>
                  </div>
                  <div className="p-servicios__pricing-demo-field">
                    <label>Duración</label>
                    <div className="p-servicios__pricing-demo-input">45 min</div>
                  </div>
                </div>
                <div className="p-servicios__pricing-demo-field">
                  <label>Tiempo de preparación</label>
                  <div className="p-servicios__pricing-demo-input">15 min</div>
                </div>
                <div className="p-servicios__pricing-demo-slots">
                  <span className="p-servicios__pricing-demo-slots-title">📅 Slots generados automáticamente:</span>
                  <div className="p-servicios__pricing-demo-slots-grid">
                    {['9:00', '10:00', '11:00', '12:00', '2:00', '3:00', '4:00', '5:00'].map((t) => (
                      <span key={t} className="p-servicios__pricing-demo-slot">{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PROFESIONALES POR SERVICIO ── */}
      <section className="p-servicios__section p-servicios__section--alt">
        <div className="p-servicios__section-container">
          <div className="p-servicios__section-header">
            <span className="p-servicios__section-badge">👥 Asignación Inteligente</span>
            <h2>Profesionales por Servicio</h2>
            <p>Asigna qué profesionales ofrecen cada servicio. Las citas solo se agendan con personal calificado.</p>
          </div>

          <div className="p-servicios__matrix">
            <div className="p-servicios__matrix-header">
              <div className="p-servicios__matrix-cell p-servicios__matrix-cell--label">Servicio</div>
              <div className="p-servicios__matrix-cell">Ana M.</div>
              <div className="p-servicios__matrix-cell">Carlos R.</div>
              <div className="p-servicios__matrix-cell">Laura P.</div>
              <div className="p-servicios__matrix-cell">Sofía G.</div>
              <div className="p-servicios__matrix-cell">Valentina T.</div>
            </div>
            {PROFESSIONALS_MATRIX.map((row) => (
              <div className="p-servicios__matrix-row" key={row.service}>
                <div className="p-servicios__matrix-cell p-servicios__matrix-cell--label">
                  <span>{row.icon}</span> {row.service}
                </div>
                {['Ana M.', 'Carlos R.', 'Laura P.', 'Sofía G.', 'Valentina T.'].map((pro) => (
                  <div className="p-servicios__matrix-cell" key={pro}>
                    {row.pros.includes(pro) ? (
                      <span className="p-servicios__matrix-check">✅</span>
                    ) : (
                      <span className="p-servicios__matrix-empty">—</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="p-servicios__matrix-note">
            <p>💡 Cuando un cliente reserva, el sistema solo muestra profesionales habilitados para ese servicio. Sin errores, sin confusiones.</p>
          </div>
        </div>
      </section>

      {/* ── RESERVAS POR WHATSAPP ── */}
      <section className="p-servicios__section">
        <div className="p-servicios__section-container">
          <div className="p-servicios__section-split">
            <div className="p-servicios__wa-chat-mockup">
              <div className="p-servicios__wa-chat-header">
                <div className="p-servicios__wa-chat-avatar">🏪</div>
                <div>
                  <strong>Tu Negocio</strong>
                  <span>en línea</span>
                </div>
              </div>
              <div className="p-servicios__wa-chat-body">
                <div className="p-servicios__wa-msg p-servicios__wa-msg--in">
                  <p>Hola! Quiero agendar una cita para mañana. ¿Qué servicios tienen disponibles?</p>
                  <span>2:30 p.m.</span>
                </div>
                <div className="p-servicios__wa-msg p-servicios__wa-msg--out">
                  <div className="p-servicios__wa-lina-badge">🤖 Lina IA</div>
                  <p>¡Hola! 😊 Con gusto. Estos son nuestros servicios disponibles para mañana:</p>
                  <span>2:30 p.m. ✓✓</span>
                </div>
                <div className="p-servicios__wa-msg p-servicios__wa-msg--out">
                  <div className="p-servicios__wa-catalog">
                    <div className="p-servicios__wa-catalog-item">
                      <span>✂️</span> <strong>Corte Premium</strong> — $65K · 45 min
                    </div>
                    <div className="p-servicios__wa-catalog-item">
                      <span>🎨</span> <strong>Coloración</strong> — $120K · 2h
                    </div>
                    <div className="p-servicios__wa-catalog-item">
                      <span>💅</span> <strong>Manicure Gel</strong> — $55K · 50 min
                    </div>
                  </div>
                  <span>2:30 p.m. ✓✓</span>
                </div>
                <div className="p-servicios__wa-msg p-servicios__wa-msg--in">
                  <p>Quiero el corte premium por favor!</p>
                  <span>2:31 p.m.</span>
                </div>
                <div className="p-servicios__wa-msg p-servicios__wa-msg--out">
                  <div className="p-servicios__wa-lina-badge">🤖 Lina IA</div>
                  <p>¡Excelente! Para Corte Premium tengo disponible mañana con Ana M.: 10:00 AM, 11:00 AM o 3:00 PM. ¿Cuál prefieres? 💇</p>
                  <span>2:31 p.m. ✓✓</span>
                </div>
              </div>
            </div>

            <div className="p-servicios__section-split-text">
              <span className="p-servicios__section-badge">📱 Reservas WhatsApp</span>
              <h2>Reservas Directas por WhatsApp</h2>
              <p>Tus clientes ven el catálogo completo y reservan directamente desde WhatsApp. Lina IA muestra servicios disponibles, precios, horarios y agenda la cita automáticamente.</p>
              <ul className="p-servicios__check-list">
                <li>📋 Catálogo completo visible en WhatsApp</li>
                <li>💬 Reservas conversacionales naturales</li>
                <li>🕐 Solo muestra horarios realmente disponibles</li>
                <li>👤 Asigna al profesional correcto automáticamente</li>
                <li>📩 Confirmación instantánea al cliente</li>
                <li>🔔 Notificación al profesional en tiempo real</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
