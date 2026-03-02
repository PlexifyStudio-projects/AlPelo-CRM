import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { mockClients as rawClients, mockAppointments, mockBarbers, mockVisitHistory } from '../../data/mockData';
import { formatCurrency, daysSince, formatDate } from '../../utils/formatters';
import { enrichClients, computeKPIs, STATUS } from '../../utils/clientStatus';

const mockClients = enrichClients(rawClients, mockVisitHistory);
const kpis = computeKPIs(mockClients);

// ===== ICON COMPONENTS =====

const StatIcon = ({ type }) => {
  const icons = {
    clients: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    appointments: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    messages: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />
      </svg>
    ),
    revenue: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  };
  return icons[type] || null;
};

const WhatsAppIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const PhoneIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const TrendUpIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const TrendDownIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
    <polyline points="17 18 23 18 23 12" />
  </svg>
);

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const StarRating = ({ rating }) => {
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.5;
  return (
    <div className="dashboard__barber-stars">
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill={i < fullStars ? '#C9A84C' : (i === fullStars && hasHalf ? '#C9A84C' : 'none')} stroke="#C9A84C" strokeWidth="1.5">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
      <span className="dashboard__barber-rating-value">{rating}</span>
    </div>
  );
};

// ===== HELPERS =====

const getInitials = (name) => {
  const parts = name.split(' ');
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : parts[0].substring(0, 2).toUpperCase();
};

const getDaysSeverity = (days) => {
  if (days < 15) return 'green';
  if (days <= 30) return 'yellow';
  if (days <= 60) return 'orange';
  return 'red';
};

const getStatusLabel = (status) => {
  const labels = {
    [STATUS.VIP]: 'VIP',
    [STATUS.NUEVO]: 'Nuevo',
    [STATUS.ACTIVO]: 'Activo',
    [STATUS.EN_RIESGO]: 'En Riesgo',
    [STATUS.INACTIVO]: 'Inactivo',
  };
  return labels[status] || status;
};

const getStatusColor = (status) => {
  const colors = {
    [STATUS.VIP]: 'accent',
    [STATUS.NUEVO]: 'info',
    [STATUS.ACTIVO]: 'success',
    [STATUS.EN_RIESGO]: 'warning',
    [STATUS.INACTIVO]: 'danger',
  };
  return colors[status] || 'info';
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Buenos dias';
  if (hour >= 12 && hour < 18) return 'Buenas tardes';
  return 'Buenas noches';
};

// ===== ANIMATED NUMBER COMPONENT =====

const AnimatedNumber = ({ value, prefix = '', suffix = '' }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const numericValue = typeof value === 'string'
      ? parseInt(value.replace(/[^0-9]/g, ''), 10) || 0
      : value;

    if (numericValue === 0) {
      setDisplayValue(0);
      return;
    }

    const duration = 1200;
    const startTime = performance.now();
    const startValue = 0;

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out expo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = Math.round(startValue + (numericValue - startValue) * eased);
      setDisplayValue(current);
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value]);

  const formatted = typeof value === 'string' && value.includes('$')
    ? formatCurrency(displayValue)
    : `${prefix}${displayValue.toLocaleString('es-CO')}${suffix}`;

  return <span>{formatted}</span>;
};

// ===== MAIN DASHBOARD COMPONENT =====

const Dashboard = () => {
  const { user } = useAuth();
  const firstName = user?.name?.split(' ')[0] || 'Admin';

  const today = new Date();
  const dateStr = today.toLocaleDateString('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const greeting = useMemo(() => getGreeting(), []);

  // --- Stat computations ---
  const activeClients = mockClients.filter(
    (c) => c.status === STATUS.ACTIVO || c.status === STATUS.VIP || c.status === STATUS.NUEVO
  ).length;
  const totalClients = mockClients.length;

  const todayDateStr = today.toISOString().split('T')[0];
  const todayAppts = mockAppointments
    .filter((a) => a.date === todayDateStr)
    .sort((a, b) => a.time.localeCompare(b.time));
  const todayAppointmentsCount = todayAppts.length;
  const pendingAppointments = mockAppointments.filter((a) => a.status === 'pending').length;

  // --- Clients for follow-up (20+ days since last visit) ---
  const followUpClients = mockClients
    .map((c) => ({ ...c, daysSinceVisit: daysSince(c.lastVisit) }))
    .filter((c) => c.daysSinceVisit >= 20)
    .sort((a, b) => b.daysSinceVisit - a.daysSinceVisit);

  // --- Helper to find client/barber names ---
  const getClientName = (clientId) => {
    const client = mockClients.find((c) => c.id === clientId);
    return client ? client.name : 'Cliente';
  };
  const getBarberName = (barberId) => {
    const barber = mockBarbers.find((b) => b.id === barberId);
    return barber ? barber.name : 'Barbero';
  };

  // --- Quick status counts for the mini KPI row ---
  const vipCount = mockClients.filter((c) => c.status === STATUS.VIP).length;
  const atRiskCount = mockClients.filter((c) => c.status === STATUS.EN_RIESGO).length;
  const retentionRate = kpis.retentionRate;

  // --- Barber appointment counts for today ---
  const getBarberTodayCount = (barberId) => {
    return todayAppts.filter((a) => a.barberId === barberId).length;
  };

  return (
    <div className="dashboard">
      {/* ===== KPI HEADER ===== */}
      <div className="dashboard__header">
        <div className="dashboard__welcome">
          <p className="dashboard__greeting">{greeting}</p>
          <h2 className="dashboard__title">
            <span className="dashboard__title-accent">{firstName}</span>, tu resumen del dia
          </h2>
          <p className="dashboard__subtitle">{dateStr}</p>
        </div>
        <div className="dashboard__header-right">
          <div className="dashboard__quick-actions">
            <button className="dashboard__quick-btn dashboard__quick-btn--primary">
              <PlusIcon />
              <span>Nueva Cita</span>
            </button>
            <button className="dashboard__quick-btn dashboard__quick-btn--outline">
              <PlusIcon />
              <span>Nuevo Cliente</span>
            </button>
          </div>
          <div className="dashboard__kpi-pills">
            <div className="dashboard__kpi-pill dashboard__kpi-pill--accent">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span>{vipCount} VIP</span>
            </div>
            <div className="dashboard__kpi-pill dashboard__kpi-pill--warning">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>{atRiskCount} en riesgo</span>
            </div>
            <div className="dashboard__kpi-pill dashboard__kpi-pill--success">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              <span>{retentionRate}% retencion</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== STAT CARDS ===== */}
      <div className="dashboard__stats">
        {/* Card 1: Clientes Activos */}
        <div className="dashboard__stat-card dashboard__stat-card--primary">
          <div className="dashboard__stat-accent" />
          <div className="dashboard__stat-header">
            <div className="dashboard__stat-icon dashboard__stat-icon--primary">
              <StatIcon type="clients" />
            </div>
            <span className="dashboard__stat-trend dashboard__stat-trend--up">
              <TrendUpIcon />
              <span>+8%</span>
            </span>
          </div>
          <p className="dashboard__stat-number">
            <AnimatedNumber value={activeClients} />
          </p>
          <span className="dashboard__stat-label">Clientes Activos</span>
          <div className="dashboard__stat-footer">
            <span className="dashboard__stat-sub">{totalClients} en total</span>
            <div className="dashboard__stat-bar">
              <div className="dashboard__stat-bar-fill dashboard__stat-bar-fill--primary" style={{ width: `${Math.round((activeClients / totalClients) * 100)}%` }} />
            </div>
          </div>
        </div>

        {/* Card 2: Citas Hoy */}
        <div className="dashboard__stat-card dashboard__stat-card--info">
          <div className="dashboard__stat-accent" />
          <div className="dashboard__stat-header">
            <div className="dashboard__stat-icon dashboard__stat-icon--info">
              <StatIcon type="appointments" />
            </div>
            {pendingAppointments > 0 && (
              <span className="dashboard__stat-trend dashboard__stat-trend--pending">
                <span className="dashboard__stat-dot dashboard__stat-dot--warning" />
                <span>{pendingAppointments} pend.</span>
              </span>
            )}
          </div>
          <p className="dashboard__stat-number">
            <AnimatedNumber value={todayAppointmentsCount} />
          </p>
          <span className="dashboard__stat-label">Citas Hoy</span>
          <div className="dashboard__stat-footer">
            <span className="dashboard__stat-sub dashboard__stat-sub--warning">
              <span className="dashboard__stat-dot dashboard__stat-dot--warning" />
              {pendingAppointments} pendientes
            </span>
          </div>
        </div>

        {/* Card 3: Mensajes Enviados */}
        <div className="dashboard__stat-card dashboard__stat-card--accent">
          <div className="dashboard__stat-accent" />
          <div className="dashboard__stat-header">
            <div className="dashboard__stat-icon dashboard__stat-icon--accent">
              <StatIcon type="messages" />
            </div>
            <span className="dashboard__stat-trend dashboard__stat-trend--active">
              <span className="dashboard__stat-pulse" />
              <span>Activa</span>
            </span>
          </div>
          <p className="dashboard__stat-number">
            <AnimatedNumber value={1240} />
          </p>
          <span className="dashboard__stat-label">Mensajes Enviados</span>
          <div className="dashboard__stat-footer">
            <span className="dashboard__stat-sub dashboard__stat-sub--success">Campana activa</span>
          </div>
        </div>

        {/* Card 4: Ingresos del Mes */}
        <div className="dashboard__stat-card dashboard__stat-card--success">
          <div className="dashboard__stat-accent" />
          <div className="dashboard__stat-header">
            <div className="dashboard__stat-icon dashboard__stat-icon--success">
              <StatIcon type="revenue" />
            </div>
            <span className="dashboard__stat-trend dashboard__stat-trend--up">
              <TrendUpIcon />
              <span>+12.5%</span>
            </span>
          </div>
          <p className="dashboard__stat-number">
            <AnimatedNumber value={4850000} prefix="$" />
          </p>
          <span className="dashboard__stat-label">Ingresos del Mes</span>
          <div className="dashboard__stat-footer">
            <span className="dashboard__stat-sub dashboard__stat-sub--success">+12.5% vs. mes anterior</span>
          </div>
        </div>
      </div>

      {/* ===== TWO-COLUMN MAIN SECTION ===== */}
      <div className="dashboard__columns">
        {/* --- LEFT: Citas de Hoy --- */}
        <div className="dashboard__col-left">
          <div className="dashboard__section">
            <div className="dashboard__section-header">
              <h3 className="dashboard__section-title">
                <span className="dashboard__section-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </span>
                Agenda de Hoy
              </h3>
              <span className="dashboard__section-count">{todayAppts.length} citas</span>
            </div>
            <div className="dashboard__schedule">
              {todayAppts.length > 0 ? (
                todayAppts.map((appt, index) => (
                  <div
                    key={appt.id}
                    className={`dashboard__appt-item ${index === 0 ? 'dashboard__appt-item--next' : ''}`}
                    style={{ animationDelay: `${0.06 * (index + 1)}s` }}
                  >
                    {index === 0 && <div className="dashboard__appt-now-label">Siguiente</div>}
                    <div className="dashboard__appt-time-block">
                      <span className="dashboard__appt-time">{appt.time}</span>
                    </div>
                    <div className="dashboard__appt-line">
                      <div className={`dashboard__appt-dot ${index === 0 ? 'dashboard__appt-dot--active' : ''}`} />
                      {index < todayAppts.length - 1 && <div className="dashboard__appt-connector" />}
                    </div>
                    <div className="dashboard__appt-details">
                      <div className="dashboard__appt-top">
                        <div className="dashboard__appt-client-info">
                          <div className="dashboard__appt-avatar">
                            {getInitials(getClientName(appt.clientId))}
                          </div>
                          <span className="dashboard__appt-client">{getClientName(appt.clientId)}</span>
                        </div>
                        <div className={`dashboard__appt-status dashboard__appt-status--${appt.status}`}>
                          {appt.status === 'confirmed' ? 'Confirmada' : appt.status === 'cancelled' ? 'Cancelada' : 'Pendiente'}
                        </div>
                      </div>
                      <span className="dashboard__appt-service">{appt.service}</span>
                      <span className="dashboard__appt-barber">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                        {getBarberName(appt.barberId)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="dashboard__empty">
                  <div className="dashboard__empty-icon">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </div>
                  <p>No hay citas programadas para hoy</p>
                  <span className="dashboard__empty-hint">Las citas apareceran aqui automaticamente</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* --- RIGHT: Clientes para Seguimiento --- */}
        <div className="dashboard__col-right">
          <div className="dashboard__section">
            <div className="dashboard__section-header">
              <h3 className="dashboard__section-title dashboard__section-title--urgent">
                <span className="dashboard__section-icon dashboard__section-icon--urgent">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </span>
                Requieren Seguimiento
              </h3>
              <span className="dashboard__section-count dashboard__section-count--urgent">{followUpClients.length}</span>
            </div>
            <div className="dashboard__followup">
              {followUpClients.length > 0 ? (
                followUpClients.map((client, index) => {
                  const severity = getDaysSeverity(client.daysSinceVisit);
                  const statusColor = getStatusColor(client.status);
                  return (
                    <div
                      key={client.id}
                      className={`dashboard__followup-item ${severity === 'red' || severity === 'orange' ? 'dashboard__followup-item--critical' : ''}`}
                      style={{ animationDelay: `${0.06 * (index + 1)}s` }}
                    >
                      {(severity === 'red' || severity === 'orange') && (
                        <span className="dashboard__followup-pulse" />
                      )}
                      <div className={`dashboard__followup-avatar dashboard__followup-avatar--${severity}`}>
                        {getInitials(client.name)}
                      </div>
                      <div className="dashboard__followup-info">
                        <div className="dashboard__followup-top">
                          <span className="dashboard__followup-name">{client.name}</span>
                          <span className={`dashboard__followup-status dashboard__followup-status--${statusColor}`}>
                            {getStatusLabel(client.status)}
                          </span>
                        </div>
                        <span className="dashboard__followup-phone">{client.phone}</span>
                      </div>
                      <div className={`dashboard__followup-days dashboard__followup-days--${severity}`}>
                        {client.daysSinceVisit}d
                      </div>
                      <div className="dashboard__followup-actions">
                        <button
                          className="dashboard__followup-action dashboard__followup-action--whatsapp"
                          title={`Enviar WhatsApp a ${client.name}`}
                          aria-label={`Enviar WhatsApp a ${client.name}`}
                        >
                          <WhatsAppIcon />
                        </button>
                        <button
                          className="dashboard__followup-action dashboard__followup-action--call"
                          title={`Llamar a ${client.name}`}
                          aria-label={`Llamar a ${client.name}`}
                        >
                          <PhoneIcon />
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="dashboard__empty">
                  <div className="dashboard__empty-icon">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  </div>
                  <p>Todos los clientes estan al dia</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===== EQUIPO DEL DIA ===== */}
      <div className="dashboard__team-section">
        <div className="dashboard__section-header">
          <h3 className="dashboard__section-title">
            <span className="dashboard__section-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </span>
            Equipo del Dia
          </h3>
          <span className="dashboard__section-count">
            {mockBarbers.filter((b) => b.available).length} disponibles
          </span>
        </div>
        <div className="dashboard__team-grid">
          {mockBarbers.filter((b) => b.specialty === 'Barbero' || b.specialty === 'Barbera').map((barber, index) => {
            const todayCount = getBarberTodayCount(barber.id);
            return (
              <div
                key={barber.id}
                className={`dashboard__barber-card ${!barber.available ? 'dashboard__barber-card--unavailable' : ''}`}
                style={{ animationDelay: `${0.06 * (index + 1)}s` }}
              >
                <div className="dashboard__barber-left">
                  <div className="dashboard__barber-avatar">
                    {getInitials(barber.name)}
                    <span className={`dashboard__barber-dot ${barber.available ? 'dashboard__barber-dot--active' : 'dashboard__barber-dot--inactive'}`} />
                  </div>
                </div>
                <div className="dashboard__barber-info">
                  <span className="dashboard__barber-name">{barber.name}</span>
                  <StarRating rating={barber.rating} />
                </div>
                <div className="dashboard__barber-meta">
                  {todayCount > 0 && (
                    <span className="dashboard__barber-count">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      {todayCount} hoy
                    </span>
                  )}
                  <span className={`dashboard__barber-availability ${barber.available ? 'dashboard__barber-availability--active' : 'dashboard__barber-availability--inactive'}`}>
                    {barber.available ? 'Disponible' : 'No disponible'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
