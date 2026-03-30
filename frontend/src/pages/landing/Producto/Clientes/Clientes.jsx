import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../../../../components/landing/common/SEO';

const FEATURES = [
  { icon: '👤', title: 'Perfil 360° del Cliente', desc: 'Historial completo, total gastado, ticket promedio, estado actual, datos de contacto y notas internas.' },
  { icon: '🎯', title: 'Estados Inteligentes', desc: 'Clasificación automática: Nuevo, Activo, En Riesgo, Inactivo y VIP según comportamiento real.' },
  { icon: '📊', title: 'KPIs en Tiempo Real', desc: 'Total clientes, retención, ticket promedio, en riesgo, inactivos y VIPs — actualizado al instante.' },
  { icon: '🔍', title: 'Búsqueda y Filtros', desc: 'Busca por nombre, teléfono o email. Filtra por estado. Ordena por cualquier columna.' },
  { icon: '📥', title: 'Importar y Exportar', desc: 'Importa desde CSV/Excel. Exporta en CSV, Word o texto plano cuando lo necesites.' },
  { icon: '📝', title: 'Registro de Visitas', desc: 'Registra visitas vinculando cliente, servicio y profesional. El historial se actualiza solo.' },
];

const CLIENTS = [
  { id: 'C00142', name: 'Alanis Perez', phone: '+57 (424) 280-0884', lastVisit: '26 de marzo de 2026', ago: 'hace 2d', visits: 34, total: '$ 2.890.000', prom: 'prom. $ 85.000', status: 'VIP', statusColor: '#8b5cf6', avatarColor: '#10b981' },
  { id: 'C00891', name: 'Javier Vargas', phone: '+57 (300) 797-3843', lastVisit: '27 de marzo de 2026', ago: 'hace 1d', visits: 28, total: '$ 1.960.000', prom: 'prom. $ 70.000', status: 'ACTIVO', statusColor: '#10b981', avatarColor: '#8b5cf6' },
  { id: 'C01205', name: 'Lerys Maria', phone: '+57 (217) 521-1171', lastVisit: '25 de marzo de 2026', ago: 'hace 3d', visits: 41, total: '$ 4.153.123', prom: 'prom. $ 101.295', status: 'VIP', statusColor: '#8b5cf6', avatarColor: '#f59e0b' },
  { id: 'C00456', name: 'Camila Restrepo', phone: '+57 (318) 445-2190', lastVisit: '28 de marzo de 2026', ago: 'hoy', visits: 12, total: '$ 840.000', prom: 'prom. $ 70.000', status: 'ACTIVO', statusColor: '#10b981', avatarColor: '#0ea5e9' },
  { id: 'C01089', name: 'Santiago Ruiz', phone: '+57 (314) 708-3182', lastVisit: '22 de marzo de 2026', ago: 'hace 6d', visits: 52, total: '$ 5.459.999', prom: 'prom. $ 104.999', status: 'VIP', statusColor: '#8b5cf6', avatarColor: '#2563eb' },
  { id: 'C00723', name: 'Valentina Ospina', phone: '+57 (315) 157-3329', lastVisit: '15 de marzo de 2026', ago: 'hace 13d', visits: 8, total: '$ 520.000', prom: 'prom. $ 65.000', status: 'EN RIESGO', statusColor: '#f59e0b', avatarColor: '#ec4899' },
  { id: 'C00334', name: 'Andrés Caicedo', phone: '+57 (301) 889-4521', lastVisit: '27 de marzo de 2026', ago: 'hace 1d', visits: 19, total: '$ 1.425.000', prom: 'prom. $ 75.000', status: 'ACTIVO', statusColor: '#10b981', avatarColor: '#f97316' },
  { id: 'C00567', name: 'María Fernanda Gil', phone: '+57 (320) 334-7812', lastVisit: '24 de marzo de 2026', ago: 'hace 4d', visits: 63, total: '$ 6.930.000', prom: 'prom. $ 110.000', status: 'VIP', statusColor: '#8b5cf6', avatarColor: '#2563eb' },
  { id: 'C00912', name: 'Daniel Patiño', phone: '+57 (316) 221-5543', lastVisit: '28 de marzo de 2026', ago: 'hoy', visits: 5, total: '$ 375.000', prom: 'prom. $ 75.000', status: 'NUEVO', statusColor: '#0ea5e9', avatarColor: '#10b981' },
  { id: 'C01145', name: 'Isabella Cardona', phone: '+57 (312) 678-9034', lastVisit: '20 de marzo de 2026', ago: 'hace 8d', visits: 27, total: '$ 2.160.000', prom: 'prom. $ 80.000', status: 'ACTIVO', statusColor: '#10b981', avatarColor: '#ec4899' },
];

export default function Clientes() {
  const heroRef = useRef(null);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    el.classList.add('p-clientes--visible');
  }, []);

  return (
    <>
      <SEO
        title="CRM y Gestion de Clientes"
        description="Base de datos inteligente con perfil completo del cliente, historial de visitas y estados automaticos. Conoce mejor a los clientes de tu peluqueria, salon o spa."
        url="/producto/clientes"
        keywords="gestion de clientes peluqueria, base de datos clientes salon de belleza, CRM para barberia, historial de clientes spa, como organizar clientes de mi negocio"
        breadcrumbs={[
          { name: 'Inicio', url: '/' },
          { name: 'Producto', url: '/features' },
          { name: 'Gestion de Clientes' },
        ]}
      />

      {/* ── HERO ── */}
      <section className="p-clientes" ref={heroRef}>
        <div className="p-clientes__hero">
          <div className="p-clientes__hero-content">
            <span className="p-clientes__badge">👤 Módulo CRM</span>
            <h1 className="p-clientes__title">
              CRM y Gestión de Clientes para<br />
              <span className="p-clientes__title--accent">Peluquerías y Salones</span>
            </h1>
            <p className="p-clientes__subtitle">
              Perfil 360°, estados inteligentes automáticos, KPIs en tiempo real
              y todo lo que necesitas para fidelizar y nunca perder un cliente.
            </p>
            <div className="p-clientes__hero-actions">
              <Link to="/pricing" className="p-clientes__cta p-clientes__cta--primary">Ver Precios →</Link>
              <Link to="/lina-ia" className="p-clientes__cta p-clientes__cta--outline">Ver Lina IA</Link>
            </div>
            <div className="p-clientes__hero-stats">
              <div><strong>1,247</strong><span>clientes activos</span></div>
              <div><strong>94.2%</strong><span>retención promedio</span></div>
              <div><strong>86</strong><span>clientes VIP</span></div>
            </div>
          </div>

          {/* CRM Interface Replica */}
          <div className="p-clientes__preview">
            <div className="p-clientes__preview-bar">
              <span /><span /><span />
              <span className="p-clientes__preview-url">app.plexifystudio.com/clientes</span>
            </div>
            <div className="p-clientes__app">
              {/* Sidebar */}
              <div className="p-clientes__sidebar">
                <div className="p-clientes__sidebar-logo">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 12l2 2 4-4"/></svg>
                  <span>PlexifyStudio</span>
                </div>
                <div className="p-clientes__sidebar-sub">PELUQUERÍA</div>
                <div className="p-clientes__sidebar-section">GESTIÓN PRINCIPAL</div>
                <div className="p-clientes__sidebar-item">
                  <span>Dashboard</span>
                  <small>PANEL EJECUTIVO</small>
                </div>
                <div className="p-clientes__sidebar-item">
                  <span>Agenda</span>
                  <small>CITAS Y CALENDARIO</small>
                </div>
                <div className="p-clientes__sidebar-item p-clientes__sidebar-item--active">
                  <span>Clientes</span>
                  <small>CRM Y GESTIÓN DE CLIENTES</small>
                </div>
                <div className="p-clientes__sidebar-item">
                  <span>Campañas</span>
                  <small>REACTIVACIÓN Y RETENCIÓN</small>
                </div>
                <div className="p-clientes__sidebar-item">
                  <span>Servicios</span>
                  <small>CATÁLOGOS Y PRECIOS</small>
                </div>
                <div className="p-clientes__sidebar-item">
                  <span>Inventario</span>
                  <small>PRODUCTOS Y STOCK</small>
                </div>
                <div className="p-clientes__sidebar-item">
                  <span>Finanzas</span>
                  <small>INGRESOS Y MÉTRICAS</small>
                </div>
                <div className="p-clientes__sidebar-item">
                  <span>Actividad Lina</span>
                  <small>MONITOREO EN TIEMPO REAL</small>
                </div>
                <div className="p-clientes__sidebar-item">
                  <span>Equipo</span>
                  <small>RENDIMIENTO Y FEEDBACK</small>
                </div>
                <div className="p-clientes__sidebar-section">MARKETING</div>
                <div className="p-clientes__sidebar-item">
                  <span>Automatizaciones</span>
                  <small>WORKFLOWS INTELIGENTES</small>
                </div>
                <div className="p-clientes__sidebar-section">WHATSAPP</div>
                <div className="p-clientes__sidebar-item">
                  <span>Inbox</span>
                  <small>CONVERSACIONES WHATSAPP</small>
                </div>
                <div className="p-clientes__sidebar-item">
                  <span>Lina IA</span>
                  <small>ASISTENTE INTELIGENTE</small>
                </div>
              </div>

              {/* Main content */}
              <div className="p-clientes__main">
                {/* Title bar */}
                <div className="p-clientes__titlebar">
                  <span className="p-clientes__titlebar-text">Gestión de Clientes</span>
                  <div className="p-clientes__titlebar-actions">
                    <span className="p-clientes__titlebar-btn">↗ Exportar</span>
                    <span className="p-clientes__titlebar-btn">↙ Importar</span>
                    <span className="p-clientes__titlebar-btn">📋 Registrar Visita</span>
                    <span className="p-clientes__titlebar-btn p-clientes__titlebar-btn--primary">+ Nuevo Cliente</span>
                  </div>
                </div>

                {/* KPI Cards */}
                <div className="p-clientes__kpis">
                  <div className="p-clientes__kpi"><b>1.247</b><span>TOTAL CLIENTES</span></div>
                  <div className="p-clientes__kpi p-clientes__kpi--green"><b>94.2%</b><span>RETENCIÓN</span></div>
                  <div className="p-clientes__kpi"><b>$ 87.500</b><span>TICKET PROMEDIO</span></div>
                  <div className="p-clientes__kpi p-clientes__kpi--orange"><b>18</b><span>EN RIESGO</span></div>
                  <div className="p-clientes__kpi p-clientes__kpi--red"><b>32</b><span>INACTIVOS</span></div>
                  <div className="p-clientes__kpi p-clientes__kpi--purple"><b>86</b><span>VIP</span></div>
                </div>

                {/* Search */}
                <div className="p-clientes__search">🔍 Buscar por nombre, teléfono o email...</div>

                {/* Filter tabs */}
                <div className="p-clientes__tabs">
                  <span className="p-clientes__tab p-clientes__tab--active">Todos 1.247</span>
                  <span className="p-clientes__tab">Nuevos 89</span>
                  <span className="p-clientes__tab">Activos 1.022</span>
                  <span className="p-clientes__tab">En Riesgo 18</span>
                  <span className="p-clientes__tab">Inactivos 32</span>
                  <span className="p-clientes__tab">★ VIP 86</span>
                </div>

                {/* Table */}
                <div className="p-clientes__table">
                  <div className="p-clientes__table-header">
                    <span className="p-clientes__col-id">ID</span>
                    <span className="p-clientes__col-client">CLIENTE ↑</span>
                    <span className="p-clientes__col-visit">ÚLTIMA VISITA ↕</span>
                    <span className="p-clientes__col-visits">VISITAS ↕</span>
                    <span className="p-clientes__col-total">TOTAL GASTADO ↕</span>
                    <span className="p-clientes__col-status">ESTADO ↕</span>
                  </div>
                  {CLIENTS.map((c) => (
                    <div className="p-clientes__table-row" key={c.id + c.name}>
                      <span className="p-clientes__col-id">{c.id}</span>
                      <span className="p-clientes__col-client">
                        <span className="p-clientes__avatar" style={{ background: c.avatarColor }}>{c.name.split(' ').map(n=>n[0]).join('')}</span>
                        <span>
                          <strong>{c.name}</strong>
                          <small>{c.phone}</small>
                        </span>
                      </span>
                      <span className="p-clientes__col-visit">
                        {c.lastVisit}
                        {c.ago && <span className="p-clientes__ago">{c.ago}</span>}
                      </span>
                      <span className="p-clientes__col-visits">{c.visits}</span>
                      <span className="p-clientes__col-total">
                        <strong>{c.total}</strong>
                        {c.prom && <small>{c.prom}</small>}
                      </span>
                      <span className="p-clientes__col-status">
                        <span className="p-clientes__status-badge" style={{ background: `${c.statusColor}15`, color: c.statusColor }}>{c.status}</span>
                      </span>
                    </div>
                  ))}
                  {/* Pagination */}
                  <div className="p-clientes__table-pagination">
                    <span>Mostrando 1-10 de 1,247 clientes</span>
                    <div className="p-clientes__table-pages">
                      <span className="p-clientes__page p-clientes__page--active">1</span>
                      <span className="p-clientes__page">2</span>
                      <span className="p-clientes__page">3</span>
                      <span className="p-clientes__page">...</span>
                      <span className="p-clientes__page">125</span>
                      <span className="p-clientes__page">→</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── KPIs EXPLICADOS ── */}
      <section className="p-clientes__section">
        <div className="p-clientes__section-container">
          <div className="p-clientes__section-header">
            <span className="p-clientes__section-badge">📊 Panel de Control</span>
            <h2>6 KPIs que te dicen todo sobre tu negocio</h2>
            <p>De un vistazo sabes exactamente cómo está tu cartera de clientes. Sin buscar, sin calcular, sin Excel.</p>
          </div>
          <div className="p-clientes__kpi-explain">
            <div className="p-clientes__kpi-card">
              <span className="p-clientes__kpi-card-number">1.247</span>
              <h3>Total Clientes</h3>
              <p>Todos los clientes registrados en tu sistema, organizados y accesibles al instante.</p>
            </div>
            <div className="p-clientes__kpi-card p-clientes__kpi-card--green">
              <span className="p-clientes__kpi-card-number">94.2%</span>
              <h3>Retención</h3>
              <p>Porcentaje de clientes que vuelven. El sistema lo calcula automáticamente por ti.</p>
            </div>
            <div className="p-clientes__kpi-card">
              <span className="p-clientes__kpi-card-number">$87.500</span>
              <h3>Ticket Promedio</h3>
              <p>Cuánto gasta en promedio cada cliente. Sabes exactamente el valor de cada visita.</p>
            </div>
            <div className="p-clientes__kpi-card p-clientes__kpi-card--orange">
              <span className="p-clientes__kpi-card-number">18</span>
              <h3>En Riesgo</h3>
              <p>Clientes que llevan días sin venir. El sistema los detecta antes de que se vayan.</p>
            </div>
            <div className="p-clientes__kpi-card p-clientes__kpi-card--red">
              <span className="p-clientes__kpi-card-number">32</span>
              <h3>Inactivos</h3>
              <p>Clientes que dejaron de venir. Con un clic envías una campaña de reactivación por WhatsApp.</p>
            </div>
            <div className="p-clientes__kpi-card p-clientes__kpi-card--purple">
              <span className="p-clientes__kpi-card-number">86</span>
              <h3>VIP</h3>
              <p>Tus mejores clientes identificados automáticamente. Reciben beneficios exclusivos.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── ESTADOS INTELIGENTES ── */}
      <section className="p-clientes__section p-clientes__section--alt">
        <div className="p-clientes__section-container">
          <div className="p-clientes__section-split">
            <div>
              <span className="p-clientes__section-badge">🎯 Clasificación Automática</span>
              <h2>5 estados que clasifican a cada cliente por ti</h2>
              <p>El sistema analiza el comportamiento de cada cliente y lo clasifica automáticamente. Tú no tienes que hacer nada — solo actuar cuando importa.</p>
            </div>
            <div className="p-clientes__states">
              <div className="p-clientes__state">
                <span className="p-clientes__state-badge" style={{ background: '#0ea5e915', color: '#0ea5e9' }}>NUEVO</span>
                <span>Acaba de registrarse o tuvo su primera visita</span>
              </div>
              <div className="p-clientes__state">
                <span className="p-clientes__state-badge" style={{ background: '#10b98115', color: '#10b981' }}>ACTIVO</span>
                <span>Viene regularmente y está al día con sus visitas</span>
              </div>
              <div className="p-clientes__state">
                <span className="p-clientes__state-badge" style={{ background: '#f59e0b15', color: '#f59e0b' }}>EN RIESGO</span>
                <span>Lleva más de 15 días sin venir — necesita atención</span>
              </div>
              <div className="p-clientes__state">
                <span className="p-clientes__state-badge" style={{ background: '#ef444415', color: '#ef4444' }}>INACTIVO</span>
                <span>No viene hace más de 30 días — campaña de rescate sugerida</span>
              </div>
              <div className="p-clientes__state">
                <span className="p-clientes__state-badge" style={{ background: '#8b5cf615', color: '#8b5cf6' }}>VIP</span>
                <span>Cliente frecuente y de alto valor — beneficios automáticos activados</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── BÚSQUEDA Y FILTROS ── */}
      <section className="p-clientes__section">
        <div className="p-clientes__section-container">
          <div className="p-clientes__section-header">
            <span className="p-clientes__section-badge">🔍 Búsqueda Inteligente</span>
            <h2>Encuentra cualquier cliente en segundos</h2>
            <p>Busca por nombre, teléfono o email. Filtra por estado con un clic. Ordena por visitas, gasto total o última visita. Exporta a CSV o Excel cuando quieras.</p>
          </div>
          <div className="p-clientes__features-grid">
            {FEATURES.map((f) => (
              <div className="p-clientes__feature-card" key={f.title}>
                <span className="p-clientes__feature-icon">{f.icon}</span>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PERFIL 360° ── */}
      <section className="p-clientes__section p-clientes__section--alt">
        <div className="p-clientes__section-container">
          <div className="p-clientes__section-split">
            <div>
              <span className="p-clientes__section-badge">👤 Ficha del Cliente</span>
              <h2>Perfil 360° de cada cliente</h2>
              <p>Cada cliente tiene una ficha completa con toda su información: datos de contacto, historial de visitas, servicios utilizados, total gastado, ticket promedio, estado actual y notas internas del equipo.</p>
              <ul className="p-clientes__check-list">
                <li>✅ Historial completo de visitas y servicios</li>
                <li>✅ Total gastado y ticket promedio por cliente</li>
                <li>✅ Estado automático (Nuevo, Activo, En Riesgo, VIP)</li>
                <li>✅ Notas internas del equipo</li>
                <li>✅ Conexión directa a WhatsApp con un clic</li>
              </ul>
            </div>
            <div className="p-clientes__profile-mock">
              <div className="p-clientes__profile-card">
                <div className="p-clientes__profile-top">
                  <span className="p-clientes__avatar" style={{ background: '#8b5cf6', width: 48, height: 48, fontSize: 16 }}>LM</span>
                  <div>
                    <strong>Lerys Maria</strong>
                    <small>+57 (217) 521-1171</small>
                    <span className="p-clientes__status-badge" style={{ background: '#8b5cf615', color: '#8b5cf6' }}>VIP</span>
                  </div>
                </div>
                <div className="p-clientes__profile-stats">
                  <div><b>41</b><span>visitas</span></div>
                  <div><b>$4.1M</b><span>gastado</span></div>
                  <div><b>$101K</b><span>ticket prom.</span></div>
                </div>
                <div className="p-clientes__profile-history">
                  <small>ÚLTIMAS VISITAS</small>
                  <div>22 mar — Corte Premium — $85.000</div>
                  <div>15 mar — Color + Tratamiento — $120.000</div>
                  <div>08 mar — Manicure + Pedicure — $95.000</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── IMPORTAR Y EXPORTAR ── */}
      <section className="p-clientes__section">
        <div className="p-clientes__section-container">
          <div className="p-clientes__section-split">
            <div>
              <span className="p-clientes__section-badge">📥 Importar y Exportar</span>
              <h2>Trae todos tus clientes en segundos</h2>
              <p>Importa tu base de datos completa desde CSV o Excel con un simple drag & drop. El sistema mapea las columnas automáticamente: nombre, teléfono, email, notas. Sin errores, sin duplicados.</p>
              <ul className="p-clientes__check-list">
                <li>✅ Importación desde CSV, Excel (.xlsx) y Google Sheets</li>
                <li>✅ Detección automática de columnas y mapeo inteligente</li>
                <li>✅ Validación de duplicados antes de importar</li>
                <li>✅ Exporta en CSV, Word o texto plano cuando lo necesites</li>
                <li>✅ Exportación filtrada — solo los clientes que selecciones</li>
              </ul>
            </div>
            <div className="p-clientes__import-mock">
              <div className="p-clientes__import-dropzone">
                <div className="p-clientes__import-icon">📂</div>
                <span className="p-clientes__import-text">Arrastra tu archivo aquí</span>
                <span className="p-clientes__import-sub">CSV, XLSX o Google Sheets</span>
                <span className="p-clientes__import-btn">Seleccionar Archivo</span>
              </div>
              <div className="p-clientes__import-files">
                <div className="p-clientes__import-file">
                  <span className="p-clientes__import-file-icon">📊</span>
                  <div>
                    <strong>clientes_marzo_2026.xlsx</strong>
                    <small>342 clientes detectados · 12 duplicados omitidos</small>
                  </div>
                  <span className="p-clientes__import-file-status">✅ Listo</span>
                </div>
                <div className="p-clientes__import-file">
                  <span className="p-clientes__import-file-icon">📄</span>
                  <div>
                    <strong>base_datos_anterior.csv</strong>
                    <small>891 clientes detectados · 0 duplicados</small>
                  </div>
                  <span className="p-clientes__import-file-status">✅ Listo</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── REGISTRO DE VISITAS ── */}
      <section className="p-clientes__section p-clientes__section--alt">
        <div className="p-clientes__section-container">
          <div className="p-clientes__section-split">
            <div className="p-clientes__visit-mock">
              <div className="p-clientes__visit-form">
                <div className="p-clientes__visit-form-title">📋 Registrar Nueva Visita</div>
                <div className="p-clientes__visit-field">
                  <label>Cliente</label>
                  <div className="p-clientes__visit-input">
                    <span className="p-clientes__avatar" style={{ background: '#8b5cf6', width: 24, height: 24, fontSize: 8 }}>LM</span>
                    Lerys Maria
                  </div>
                </div>
                <div className="p-clientes__visit-field">
                  <label>Servicio</label>
                  <div className="p-clientes__visit-input">Corte Premium — $85.000</div>
                </div>
                <div className="p-clientes__visit-field">
                  <label>Profesional</label>
                  <div className="p-clientes__visit-input">
                    <span className="p-clientes__avatar" style={{ background: '#2D5A3D', width: 24, height: 24, fontSize: 8 }}>AL</span>
                    Alexander
                  </div>
                </div>
                <div className="p-clientes__visit-field">
                  <label>Notas</label>
                  <div className="p-clientes__visit-input p-clientes__visit-input--textarea">Pidió un poco más corto en los lados. Quiere agendar para dentro de 3 semanas.</div>
                </div>
                <div className="p-clientes__visit-actions">
                  <span className="p-clientes__visit-btn">Registrar Visita</span>
                </div>
              </div>
            </div>
            <div>
              <span className="p-clientes__section-badge">📝 Registro de Visitas</span>
              <h2>Cada visita queda registrada con todos los detalles</h2>
              <p>Vincula cliente + servicio + profesional en un solo paso. Las notas internas permiten al equipo recordar preferencias y detalles importantes para la próxima vez.</p>
              <ul className="p-clientes__check-list">
                <li>✅ Selección rápida de cliente con autocompletado</li>
                <li>✅ Servicio y precio se cargan automáticamente</li>
                <li>✅ Asignación de profesional responsable</li>
                <li>✅ Notas internas visibles para todo el equipo</li>
                <li>✅ El historial del cliente se actualiza al instante</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── CONEXIÓN WHATSAPP DIRECTA ── */}
      <section className="p-clientes__section">
        <div className="p-clientes__section-container">
          <div className="p-clientes__section-split">
            <div>
              <span className="p-clientes__section-badge">💬 WhatsApp Directo</span>
              <h2>Un clic y estás hablando con tu cliente</h2>
              <p>Cada perfil de cliente tiene un botón de WhatsApp integrado. Con un clic abres la conversación. Si tienes Lina IA activada, ella puede responder automáticamente mientras tú te enfocas en tu trabajo.</p>
              <ul className="p-clientes__check-list">
                <li>✅ Botón WhatsApp en cada perfil de cliente</li>
                <li>✅ Envío de plantillas aprobadas por Meta con un clic</li>
                <li>✅ Lina IA responde automáticamente si está activada</li>
                <li>✅ Historial de mensajes vinculado al perfil del cliente</li>
                <li>✅ Envío masivo a segmentos (VIP, En Riesgo, etc.)</li>
              </ul>
            </div>
            <div className="p-clientes__wa-mock">
              <div className="p-clientes__wa-chat">
                <div className="p-clientes__wa-header">
                  <span className="p-clientes__avatar" style={{ background: '#8b5cf6', width: 32, height: 32, fontSize: 10 }}>LM</span>
                  <div>
                    <strong>Lerys Maria</strong>
                    <small>en línea</small>
                  </div>
                  <span className="p-clientes__wa-status">💚 Lina IA activa</span>
                </div>
                <div className="p-clientes__wa-messages">
                  <div className="p-clientes__wa-msg p-clientes__wa-msg--incoming">
                    <span>Hola! Quiero agendar para este sábado, hay espacio?</span>
                    <small>10:32 AM</small>
                  </div>
                  <div className="p-clientes__wa-msg p-clientes__wa-msg--outgoing">
                    <span>Hola Lerys! Claro que sí. Tenemos disponible a las 10:00 AM y 2:00 PM con Alexander. ¿Cuál prefieres?</span>
                    <small>10:32 AM · Lina IA</small>
                  </div>
                  <div className="p-clientes__wa-msg p-clientes__wa-msg--incoming">
                    <span>Perfecto, 10 AM por favor!</span>
                    <small>10:33 AM</small>
                  </div>
                  <div className="p-clientes__wa-msg p-clientes__wa-msg--outgoing">
                    <span>Listo! Tu cita está confirmada: Sábado 29 marzo a las 10:00 AM con Alexander. Te esperamos!</span>
                    <small>10:33 AM · Lina IA</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── ALERTAS INTELIGENTES ── */}
      <section className="p-clientes__section p-clientes__section--alt">
        <div className="p-clientes__section-container">
          <div className="p-clientes__section-header">
            <span className="p-clientes__section-badge">🔔 Alertas Inteligentes</span>
            <h2>Detecta clientes en riesgo antes de perderlos</h2>
            <p>El sistema monitorea el comportamiento de cada cliente y te alerta automáticamente cuando alguien lleva demasiado tiempo sin venir. Tú actúas, no adivinas.</p>
          </div>
          <div className="p-clientes__alerts-grid">
            <div className="p-clientes__alert-card p-clientes__alert-card--warning">
              <div className="p-clientes__alert-icon">⚠️</div>
              <div className="p-clientes__alert-content">
                <strong>Valentina Ospina lleva 13 días sin venir</strong>
                <p>Su frecuencia habitual es cada 7 días. Está en riesgo de inactividad.</p>
                <div className="p-clientes__alert-actions">
                  <span className="p-clientes__alert-btn">Enviar WhatsApp</span>
                  <span className="p-clientes__alert-btn p-clientes__alert-btn--secondary">Agendar Cita</span>
                </div>
              </div>
            </div>
            <div className="p-clientes__alert-card p-clientes__alert-card--danger">
              <div className="p-clientes__alert-icon">🚨</div>
              <div className="p-clientes__alert-content">
                <strong>Carlos Méndez lleva 32 días sin venir</strong>
                <p>Ha pasado a estado Inactivo. Campaña de rescate sugerida.</p>
                <div className="p-clientes__alert-actions">
                  <span className="p-clientes__alert-btn">Enviar Campaña</span>
                  <span className="p-clientes__alert-btn p-clientes__alert-btn--secondary">Ver Perfil</span>
                </div>
              </div>
            </div>
            <div className="p-clientes__alert-card p-clientes__alert-card--info">
              <div className="p-clientes__alert-icon">🎂</div>
              <div className="p-clientes__alert-content">
                <strong>Cumpleaños de Alanis Perez mañana</strong>
                <p>Cliente VIP con 34 visitas. Plantilla de felicitación lista para enviar.</p>
                <div className="p-clientes__alert-actions">
                  <span className="p-clientes__alert-btn">Enviar Felicitación</span>
                  <span className="p-clientes__alert-btn p-clientes__alert-btn--secondary">Aplicar Descuento</span>
                </div>
              </div>
            </div>
            <div className="p-clientes__alert-card p-clientes__alert-card--success">
              <div className="p-clientes__alert-icon">⭐</div>
              <div className="p-clientes__alert-content">
                <strong>Santiago Ruiz alcanzó nivel VIP</strong>
                <p>52 visitas y $5.4M gastados. Beneficios VIP activados automáticamente.</p>
                <div className="p-clientes__alert-actions">
                  <span className="p-clientes__alert-btn">Ver Beneficios</span>
                  <span className="p-clientes__alert-btn p-clientes__alert-btn--secondary">Enviar Bienvenida VIP</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HISTORIAL COMPLETO ── */}
      <section className="p-clientes__section">
        <div className="p-clientes__section-container">
          <div className="p-clientes__section-split">
            <div className="p-clientes__timeline-mock">
              <div className="p-clientes__timeline">
                <div className="p-clientes__timeline-item">
                  <span className="p-clientes__timeline-dot" style={{ background: '#10b981' }} />
                  <div className="p-clientes__timeline-content">
                    <strong>Visita completada</strong>
                    <span>Corte Premium con Alexander — $85.000</span>
                    <small>28 mar 2026 · 10:30 AM</small>
                  </div>
                </div>
                <div className="p-clientes__timeline-item">
                  <span className="p-clientes__timeline-dot" style={{ background: '#0ea5e9' }} />
                  <div className="p-clientes__timeline-content">
                    <strong>Mensaje WhatsApp enviado</strong>
                    <span>Recordatorio de cita confirmado por el cliente</span>
                    <small>28 mar 2026 · 9:00 AM</small>
                  </div>
                </div>
                <div className="p-clientes__timeline-item">
                  <span className="p-clientes__timeline-dot" style={{ background: '#8b5cf6' }} />
                  <div className="p-clientes__timeline-content">
                    <strong>Pago registrado</strong>
                    <span>Factura #F-2026-0892 — $85.000 — Efectivo</span>
                    <small>28 mar 2026 · 11:00 AM</small>
                  </div>
                </div>
                <div className="p-clientes__timeline-item">
                  <span className="p-clientes__timeline-dot" style={{ background: '#f59e0b' }} />
                  <div className="p-clientes__timeline-content">
                    <strong>Nota interna agregada</strong>
                    <span>"Pidió un poco más corto en los lados. Agendar en 3 semanas."</span>
                    <small>28 mar 2026 · 11:05 AM</small>
                  </div>
                </div>
                <div className="p-clientes__timeline-item">
                  <span className="p-clientes__timeline-dot" style={{ background: '#10b981' }} />
                  <div className="p-clientes__timeline-content">
                    <strong>Visita completada</strong>
                    <span>Color + Tratamiento con Ángel — $120.000</span>
                    <small>22 mar 2026 · 3:00 PM</small>
                  </div>
                </div>
                <div className="p-clientes__timeline-item">
                  <span className="p-clientes__timeline-dot" style={{ background: '#ec4899' }} />
                  <div className="p-clientes__timeline-content">
                    <strong>Puntos de lealtad acumulados</strong>
                    <span>+85 puntos · Total acumulado: 1,520 pts (VIP)</span>
                    <small>22 mar 2026 · 3:05 PM</small>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <span className="p-clientes__section-badge">📜 Historial Completo</span>
              <h2>Cada interacción en una línea de tiempo</h2>
              <p>Visitas, servicios, pagos, mensajes WhatsApp, notas internas, puntos de lealtad — todo queda registrado cronológicamente. La auditoría perfecta de cada relación con tu cliente.</p>
              <ul className="p-clientes__check-list">
                <li>✅ Timeline cronológica con todos los eventos</li>
                <li>✅ Visitas con servicio, profesional y precio</li>
                <li>✅ Pagos y facturas vinculados</li>
                <li>✅ Mensajes WhatsApp enviados y recibidos</li>
                <li>✅ Notas internas del equipo</li>
                <li>✅ Movimientos del programa de lealtad</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
