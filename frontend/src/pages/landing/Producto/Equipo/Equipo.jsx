import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../../../../components/landing/common/SEO';
import equipoImg from '../../../../assets/images/landing/equipo.png';

export default function Equipo() {
  const ref = useRef(null);
  useEffect(() => { ref.current?.classList.add('p-equipo--visible'); }, []);

  return (
    <>
      <SEO
        title="Gestion de Equipo y Comisiones"
        description="Administre su equipo, calcule comisiones automaticas y mida el rendimiento de cada profesional. Para negocios de servicios con varios empleados."
        url="/producto/equipo"
        keywords="gestion de empleados negocio, comisiones profesionales, rendimiento equipo, control de horarios, como pagar comisiones a mis empleados"
        breadcrumbs={[
          { name: 'Inicio', url: '/' },
          { name: 'Producto', url: '/features' },
          { name: 'Gestion de Equipo' },
        ]}
      />

      {/* ── HERO ── */}
      <section className="p-equipo" ref={ref}>
        <div className="p-equipo__hero">
          <div className="p-equipo__hero-content">
            <span className="p-equipo__badge">👥 Módulo Equipo</span>
            <h1 className="p-equipo__title">
              Gestión de Equipo, Comisiones<br />
              <span className="p-equipo__title--accent">y Horarios del Personal</span>
            </h1>
            <p className="p-equipo__subtitle">
              Perfiles completos, comisiones automáticas, ratings de clientes
              y reportes de rendimiento para cada profesional de tu equipo.
            </p>
            <div className="p-equipo__hero-actions">
              <Link to="/pricing" className="p-equipo__cta p-equipo__cta--primary">Ver Precios →</Link>
              <Link to="/lina-ia" className="p-equipo__cta p-equipo__cta--outline">Ver Lina IA</Link>
            </div>
            <div className="p-equipo__hero-stats">
              <div><strong>21</strong><span>profesionales</span></div>
              <div><strong>$24.8M</strong><span>en comisiones</span></div>
              <div><strong>4.8★</strong><span>rating</span></div>
            </div>
          </div>

          <div className="p-equipo__preview">
            {/* TODO: Convertir a WebP para reducir ~40% el tamaño */}
            <img src={equipoImg} alt="PlexifyStudio Gestión de Equipo" className="p-equipo__preview-img" loading="lazy" />
          </div>
        </div>
      </section>

      {/* ── 1. PERFILES COMPLETOS ── */}
      <section className="p-equipo__section p-equipo__section--alt">
        <div className="p-equipo__section-container">
          <div className="p-equipo__section-header">
            <span className="p-equipo__section-badge">👤 Perfiles Completos</span>
            <h2>Toda la información de cada profesional en un solo lugar</h2>
            <p>Nombre, rol, especialidad, avatar, color identificativo, fecha de ingreso y servicios asignados — todo centralizado.</p>
          </div>

          <div className="p-equipo__profiles">
            <div className="p-equipo__profile-info">
              <div className="p-equipo__profile-point">
                <span className="p-equipo__profile-point-icon">🎨</span>
                <div>
                  <h3>Color Identificativo</h3>
                  <p>Cada profesional tiene un color único que lo identifica en el calendario, agenda y reportes. Reconocimiento visual instantáneo.</p>
                </div>
              </div>
              <div className="p-equipo__profile-point">
                <span className="p-equipo__profile-point-icon">📋</span>
                <div>
                  <h3>Servicios Asignados</h3>
                  <p>Define exactamente qué servicios ofrece cada profesional. Las citas se asignan automáticamente al profesional correcto.</p>
                </div>
              </div>
              <div className="p-equipo__profile-point">
                <span className="p-equipo__profile-point-icon">📅</span>
                <div>
                  <h3>Historial Completo</h3>
                  <p>Fecha de ingreso, servicios realizados, ingresos generados y evolución del rating a lo largo del tiempo.</p>
                </div>
              </div>
            </div>

            <div className="p-equipo__profile-card-mock">
              <div className="p-equipo__profile-card">
                <div className="p-equipo__profile-card-top" style={{ '--prof-color': '#f97316' }}>
                  <div className="p-equipo__profile-avatar">AM</div>
                  <div className="p-equipo__profile-status">Activo</div>
                </div>
                <div className="p-equipo__profile-card-body">
                  <h3 className="p-equipo__profile-name">Alexander Martínez</h3>
                  <span className="p-equipo__profile-role">Barbero Senior</span>
                  <div className="p-equipo__profile-details">
                    <div className="p-equipo__profile-detail">
                      <span className="p-equipo__profile-detail-label">Especialidad</span>
                      <span className="p-equipo__profile-detail-value">Fade, Diseño, Barba</span>
                    </div>
                    <div className="p-equipo__profile-detail">
                      <span className="p-equipo__profile-detail-label">Color</span>
                      <span className="p-equipo__profile-detail-value">
                        <span className="p-equipo__profile-color-dot" style={{ background: '#f97316' }} /> Naranja
                      </span>
                    </div>
                    <div className="p-equipo__profile-detail">
                      <span className="p-equipo__profile-detail-label">Ingreso</span>
                      <span className="p-equipo__profile-detail-value">15 Ene 2024</span>
                    </div>
                    <div className="p-equipo__profile-detail">
                      <span className="p-equipo__profile-detail-label">Servicios</span>
                      <span className="p-equipo__profile-detail-value">8 asignados</span>
                    </div>
                  </div>
                  <div className="p-equipo__profile-tags">
                    <span>Corte Fade</span>
                    <span>Barba Premium</span>
                    <span>Diseño</span>
                    <span>Alisado</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. COMISIONES AUTOMÁTICAS ── */}
      <section className="p-equipo__section">
        <div className="p-equipo__section-container">
          <div className="p-equipo__section-header">
            <span className="p-equipo__section-badge">💰 Comisiones Automáticas</span>
            <h2>Define el porcentaje, el sistema hace el resto</h2>
            <p>Cada servicio completado calcula automáticamente la comisión del profesional. Sin hojas de cálculo, sin errores.</p>
          </div>

          <div className="p-equipo__commissions">
            <div className="p-equipo__commissions-explain">
              <div className="p-equipo__commissions-step">
                <span className="p-equipo__commissions-num">1</span>
                <div>
                  <h3>Define el porcentaje</h3>
                  <p>Asigna un % de comisión a cada profesional (ej: 40%, 35%, 50%). Puedes tener porcentajes diferentes por persona.</p>
                </div>
              </div>
              <div className="p-equipo__commissions-step">
                <span className="p-equipo__commissions-num">2</span>
                <div>
                  <h3>Se calcula solo</h3>
                  <p>Cada vez que un profesional completa un servicio, el sistema calcula su comisión sobre el valor cobrado.</p>
                </div>
              </div>
              <div className="p-equipo__commissions-step">
                <span className="p-equipo__commissions-num">3</span>
                <div>
                  <h3>Revisa y paga</h3>
                  <p>Al final del período, tienes un resumen exacto de lo que debes pagar a cada profesional. Exportable a Excel.</p>
                </div>
              </div>
            </div>

            <div className="p-equipo__commissions-table-wrap">
              <table className="p-equipo__commissions-table">
                <thead>
                  <tr>
                    <th>Profesional</th>
                    <th>Servicios</th>
                    <th>Ingresos</th>
                    <th>%</th>
                    <th>Comisión</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <div className="p-equipo__table-prof">
                        <span className="p-equipo__table-avatar" style={{ background: '#f97316' }}>AM</span>
                        Alexander M.
                      </div>
                    </td>
                    <td>87</td>
                    <td>$4.350.000</td>
                    <td><span className="p-equipo__table-pct">40%</span></td>
                    <td className="p-equipo__table-commission">$1.740.000</td>
                  </tr>
                  <tr>
                    <td>
                      <div className="p-equipo__table-prof">
                        <span className="p-equipo__table-avatar" style={{ background: '#8b5cf6' }}>CR</span>
                        Camila R.
                      </div>
                    </td>
                    <td>64</td>
                    <td>$3.840.000</td>
                    <td><span className="p-equipo__table-pct">35%</span></td>
                    <td className="p-equipo__table-commission">$1.344.000</td>
                  </tr>
                  <tr>
                    <td>
                      <div className="p-equipo__table-prof">
                        <span className="p-equipo__table-avatar" style={{ background: '#ec4899' }}>VP</span>
                        Valentina P.
                      </div>
                    </td>
                    <td>72</td>
                    <td>$3.600.000</td>
                    <td><span className="p-equipo__table-pct">40%</span></td>
                    <td className="p-equipo__table-commission">$1.440.000</td>
                  </tr>
                  <tr>
                    <td>
                      <div className="p-equipo__table-prof">
                        <span className="p-equipo__table-avatar" style={{ background: '#10b981' }}>AS</span>
                        Anderson S.
                      </div>
                    </td>
                    <td>91</td>
                    <td>$5.460.000</td>
                    <td><span className="p-equipo__table-pct">45%</span></td>
                    <td className="p-equipo__table-commission">$2.457.000</td>
                  </tr>
                  <tr>
                    <td>
                      <div className="p-equipo__table-prof">
                        <span className="p-equipo__table-avatar" style={{ background: '#0ea5e9' }}>DG</span>
                        Daniela G.
                      </div>
                    </td>
                    <td>58</td>
                    <td>$2.900.000</td>
                    <td><span className="p-equipo__table-pct">35%</span></td>
                    <td className="p-equipo__table-commission">$1.015.000</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td><strong>Total</strong></td>
                    <td><strong>372</strong></td>
                    <td><strong>$20.150.000</strong></td>
                    <td />
                    <td className="p-equipo__table-commission"><strong>$7.996.000</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. RATINGS Y FEEDBACK ── */}
      <section className="p-equipo__section p-equipo__section--alt">
        <div className="p-equipo__section-container">
          <div className="p-equipo__section-header">
            <span className="p-equipo__section-badge">⭐ Ratings y Feedback</span>
            <h2>Tus clientes califican, tu equipo mejora</h2>
            <p>Después de cada servicio, el cliente califica al profesional con estrellas (1-5). El rating promedio se muestra en su perfil.</p>
          </div>

          <div className="p-equipo__ratings">
            {[
              { initials: 'AM', name: 'Alexander Martínez', role: 'Barbero Senior', rating: 4.9, reviews: 312, color: '#f97316', bars: [95, 4, 1, 0, 0] },
              { initials: 'AS', name: 'Anderson Suárez', role: 'Barbero', rating: 4.8, reviews: 287, color: '#10b981', bars: [90, 7, 2, 1, 0] },
              { initials: 'CR', name: 'Camila Rodríguez', role: 'Estilista', rating: 4.9, reviews: 245, color: '#8b5cf6', bars: [93, 5, 2, 0, 0] },
              { initials: 'VP', name: 'Valentina Pérez', role: 'Manicurista', rating: 4.7, reviews: 198, color: '#ec4899', bars: [85, 10, 3, 1, 1] },
            ].map((p) => (
              <div className="p-equipo__rating-card" key={p.initials}>
                <div className="p-equipo__rating-header">
                  <span className="p-equipo__rating-avatar" style={{ background: p.color }}>{p.initials}</span>
                  <div>
                    <h3 className="p-equipo__rating-name">{p.name}</h3>
                    <span className="p-equipo__rating-role">{p.role}</span>
                  </div>
                </div>
                <div className="p-equipo__rating-score">
                  <span className="p-equipo__rating-number">{p.rating}</span>
                  <div className="p-equipo__rating-stars">
                    {'★★★★★'.split('').map((s, i) => (
                      <span key={i} className={i < Math.round(p.rating) ? 'p-equipo__star--filled' : 'p-equipo__star--empty'}>{s}</span>
                    ))}
                  </div>
                  <span className="p-equipo__rating-count">{p.reviews} reseñas</span>
                </div>
                <div className="p-equipo__rating-bars">
                  {[5, 4, 3, 2, 1].map((star, i) => (
                    <div className="p-equipo__rating-bar-row" key={star}>
                      <span className="p-equipo__rating-bar-label">{star}★</span>
                      <div className="p-equipo__rating-bar-track">
                        <div className="p-equipo__rating-bar-fill" style={{ width: `${p.bars[i]}%` }} />
                      </div>
                      <span className="p-equipo__rating-bar-pct">{p.bars[i]}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. RANKING Y RENDIMIENTO ── */}
      <section className="p-equipo__section">
        <div className="p-equipo__section-container">
          <div className="p-equipo__section-header">
            <span className="p-equipo__section-badge">🏆 Ranking y Rendimiento</span>
            <h2>El ranking mensual que motiva a tu equipo</h2>
            <p>Citas completadas, ingresos generados, ticket promedio y satisfacción del cliente — todo en un leaderboard claro.</p>
          </div>

          <div className="p-equipo__leaderboard">
            {[
              { pos: 1, initials: 'AS', name: 'Anderson Suárez', role: 'Barbero', color: '#10b981', citas: 91, revenue: '$5.460.000', ticket: '$60.000', sat: '4.8★', medal: '🥇' },
              { pos: 2, initials: 'AM', name: 'Alexander Martínez', role: 'Barbero Senior', color: '#f97316', citas: 87, revenue: '$4.350.000', ticket: '$50.000', sat: '4.9★', medal: '🥈' },
              { pos: 3, initials: 'VP', name: 'Valentina Pérez', role: 'Manicurista', color: '#ec4899', citas: 72, revenue: '$3.600.000', ticket: '$50.000', sat: '4.7★', medal: '🥉' },
              { pos: 4, initials: 'CR', name: 'Camila Rodríguez', role: 'Estilista', color: '#8b5cf6', citas: 64, revenue: '$3.840.000', ticket: '$60.000', sat: '4.9★', medal: '' },
              { pos: 5, initials: 'DG', name: 'Daniela García', role: 'Estilista', color: '#0ea5e9', citas: 58, revenue: '$2.900.000', ticket: '$50.000', sat: '4.6★', medal: '' },
            ].map((p) => (
              <div className={`p-equipo__leader ${p.pos <= 3 ? 'p-equipo__leader--top' : ''}`} key={p.pos}>
                <span className="p-equipo__leader-pos">
                  {p.medal || `#${p.pos}`}
                </span>
                <span className="p-equipo__leader-avatar" style={{ background: p.color }}>{p.initials}</span>
                <div className="p-equipo__leader-info">
                  <strong>{p.name}</strong>
                  <span>{p.role}</span>
                </div>
                <div className="p-equipo__leader-metric">
                  <span className="p-equipo__leader-metric-value">{p.citas}</span>
                  <span className="p-equipo__leader-metric-label">Citas</span>
                </div>
                <div className="p-equipo__leader-metric">
                  <span className="p-equipo__leader-metric-value">{p.revenue}</span>
                  <span className="p-equipo__leader-metric-label">Ingresos</span>
                </div>
                <div className="p-equipo__leader-metric p-equipo__leader-metric--hide-sm">
                  <span className="p-equipo__leader-metric-value">{p.ticket}</span>
                  <span className="p-equipo__leader-metric-label">Ticket Prom.</span>
                </div>
                <div className="p-equipo__leader-metric">
                  <span className="p-equipo__leader-metric-value">{p.sat}</span>
                  <span className="p-equipo__leader-metric-label">Satisfacción</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. REPORTES DE EQUIPO ── */}
      <section className="p-equipo__section p-equipo__section--alt">
        <div className="p-equipo__section-container">
          <div className="p-equipo__section-header">
            <span className="p-equipo__section-badge">📊 Reportes de Equipo</span>
            <h2>Reportes semanales y mensuales listos para descargar</h2>
            <p>Horas trabajadas, servicios realizados, comisiones ganadas y comparativos vs. período anterior. Todo exportable.</p>
          </div>

          <div className="p-equipo__reports">
            <div className="p-equipo__reports-left">
              <div className="p-equipo__report-feature">
                <span className="p-equipo__report-feature-icon">📅</span>
                <div>
                  <h3>Reporte Semanal</h3>
                  <p>Cada lunes recibes un resumen automático: citas por profesional, ingresos generados, horas trabajadas y comisiones acumuladas de la semana anterior.</p>
                </div>
              </div>
              <div className="p-equipo__report-feature">
                <span className="p-equipo__report-feature-icon">📊</span>
                <div>
                  <h3>Reporte Mensual</h3>
                  <p>Cierre de mes con comparativo vs. mes anterior: variación de ingresos, ranking del profesional del mes, evolución del rating y tendencias.</p>
                </div>
              </div>
              <div className="p-equipo__report-feature">
                <span className="p-equipo__report-feature-icon">📥</span>
                <div>
                  <h3>Exportar a Excel</h3>
                  <p>Descarga cualquier reporte en formato Excel o PDF. Ideal para contabilidad, nómina y reuniones de equipo.</p>
                </div>
              </div>
            </div>

            <div className="p-equipo__report-mock">
              <div className="p-equipo__report-card">
                <div className="p-equipo__report-card-header">
                  <h4>Resumen Mensual — Marzo 2026</h4>
                  <span className="p-equipo__report-card-badge">vs. Feb +12%</span>
                </div>
                <div className="p-equipo__report-card-stats">
                  <div>
                    <span className="p-equipo__report-stat-value">372</span>
                    <span className="p-equipo__report-stat-label">Servicios</span>
                  </div>
                  <div>
                    <span className="p-equipo__report-stat-value">$20.1M</span>
                    <span className="p-equipo__report-stat-label">Ingresos</span>
                  </div>
                  <div>
                    <span className="p-equipo__report-stat-value">186h</span>
                    <span className="p-equipo__report-stat-label">Trabajadas</span>
                  </div>
                  <div>
                    <span className="p-equipo__report-stat-value">$8.0M</span>
                    <span className="p-equipo__report-stat-label">Comisiones</span>
                  </div>
                </div>
                <div className="p-equipo__report-chart">
                  <div className="p-equipo__report-chart-bars">
                    {[65, 72, 55, 80, 90, 78, 85, 95, 70, 88, 92, 75].map((h, i) => (
                      <div key={i} className="p-equipo__report-chart-bar" style={{ height: `${h}%` }}>
                        <span className="p-equipo__report-chart-tooltip">{Math.round(h * 0.22)}M</span>
                      </div>
                    ))}
                  </div>
                  <div className="p-equipo__report-chart-labels">
                    {['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'].map((m) => (
                      <span key={m}>{m}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
