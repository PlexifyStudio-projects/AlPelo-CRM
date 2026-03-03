import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { mockClients as rawClients, mockAppointments, mockBarbers, mockVisitHistory, mockServices } from '../../data/mockData';
import { formatCurrency, daysSince } from '../../utils/formatters';
import { enrichClients, computeKPIs, STATUS } from '../../utils/clientStatus';

const mockClients = enrichClients(rawClients, mockVisitHistory);
const kpis = computeKPIs(mockClients);

// ===== ICONS =====

const Icons = {
  calendar: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  revenue: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  clients: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  clock: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  person: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  team: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  scissors: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" />
      <line x1="14.47" y1="14.48" x2="20" y2="20" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
    </svg>
  ),
  trophy: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  ),
  chart: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="12" width="4" height="9" rx="1" />
      <rect x="10" y="7" width="4" height="14" rx="1" />
      <rect x="17" y="3" width="4" height="18" rx="1" />
    </svg>
  ),
};

// ===== HELPERS =====

const getInitials = (name) => {
  const parts = name.split(' ');
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : parts[0].substring(0, 2).toUpperCase();
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Buenos dias';
  if (hour >= 12 && hour < 18) return 'Buenas tardes';
  return 'Buenas noches';
};

// ===== ANIMATED NUMBER =====

const AnimatedNumber = ({ value, prefix = '', suffix = '' }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const numericValue = typeof value === 'string'
      ? parseInt(value.replace(/[^0-9]/g, ''), 10) || 0
      : value;

    if (numericValue === 0) { setDisplayValue(0); return; }

    const duration = 1200;
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplayValue(Math.round(numericValue * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [value]);

  const formatted = typeof value === 'string' && value.includes('$')
    ? formatCurrency(displayValue)
    : `${prefix}${displayValue.toLocaleString('es-CO')}${suffix}`;

  return <span>{formatted}</span>;
};

// ===== MAIN DASHBOARD =====

const Dashboard = () => {
  const { user } = useAuth();
  const firstName = user?.name?.split(' ')[0] || 'Admin';

  // Fecha fija para demo (mock data esta en 2026-03-02)
  const today = new Date(2026, 2, 2); // 2 de marzo de 2026
  const dateStr = today.toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const greeting = useMemo(() => getGreeting(), []);

  // --- Computed stats ---
  const todayDateStr = '2026-03-02';
  const currentMonth = '2026-03';

  const todayAppts = mockAppointments
    .filter((a) => a.date === todayDateStr)
    .sort((a, b) => a.time.localeCompare(b.time));

  const pendingAppointments = todayAppts.filter((a) => a.status === 'pending').length;

  const todayRevenue = mockVisitHistory
    .filter((v) => v.date === todayDateStr && v.status === 'completed')
    .reduce((sum, v) => sum + v.amount, 0);

  const completedThisMonth = mockVisitHistory.filter(
    (v) => v.date.startsWith(currentMonth) && v.status === 'completed'
  );
  const monthRevenue = completedThisMonth.reduce((sum, v) => sum + v.amount, 0);

  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
  const lastMonthRevenue = mockVisitHistory
    .filter((v) => v.date.startsWith(lastMonthStr) && v.status === 'completed')
    .reduce((sum, v) => sum + v.amount, 0);

  const monthChange = lastMonthRevenue > 0
    ? Math.round(((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
    : 0;

  const avgTicket = completedThisMonth.length > 0
    ? Math.round(monthRevenue / completedThisMonth.length)
    : 0;

  const activeClients = mockClients.filter(
    (c) => c.status === STATUS.ACTIVO || c.status === STATUS.VIP || c.status === STATUS.NUEVO
  ).length;

  const atRiskCount = mockClients.filter((c) => c.status === STATUS.EN_RIESGO).length;
  const inactiveCount = mockClients.filter((c) => c.status === STATUS.INACTIVO).length;
  const vipCount = mockClients.filter((c) => c.status === STATUS.VIP).length;

  // --- Top 5 profesionales del mes ---
  const getStaffStats = (staffId) => {
    const staffAppts = todayAppts.filter((a) => a.barberId === staffId);
    const monthVisits = mockVisitHistory
      .filter((v) => v.date.startsWith(currentMonth) && v.barberId === staffId && v.status === 'completed');
    return {
      todayAppts: staffAppts.length,
      monthRevenue: monthVisits.reduce((sum, v) => sum + v.amount, 0),
      monthServices: monthVisits.length,
    };
  };

  const top5Staff = mockBarbers
    .map((s) => ({ ...s, stats: getStaffStats(s.id) }))
    .filter((s) => s.stats.monthRevenue > 0)
    .sort((a, b) => b.stats.monthRevenue - a.stats.monthRevenue)
    .slice(0, 5);

  const maxStaffRevenue = top5Staff.length > 0 ? top5Staff[0].stats.monthRevenue : 1;

  // --- Top services ---
  const serviceCounts = {};
  completedThisMonth.forEach((v) => {
    if (!serviceCounts[v.service]) serviceCounts[v.service] = { count: 0, revenue: 0 };
    serviceCounts[v.service].count++;
    serviceCounts[v.service].revenue += v.amount;
  });

  const topServices = Object.entries(serviceCounts)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const maxServiceRevenue = topServices.length > 0 ? topServices[0].revenue : 1;

  // --- Revenue by category ---
  const categoryStats = {};
  completedThisMonth.forEach((v) => {
    const svc = mockServices.find((s) => s.name === v.service);
    let cat = svc ? svc.category : 'Otro';
    if (cat === 'Uñas Premium') cat = 'Uñas';
    if (!categoryStats[cat]) categoryStats[cat] = { count: 0, revenue: 0 };
    categoryStats[cat].count++;
    categoryStats[cat].revenue += v.amount;
  });

  const categories = Object.entries(categoryStats)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.revenue - a.revenue);

  const totalCategoryRevenue = categories.reduce((sum, c) => sum + c.revenue, 0);

  // --- Lookups ---
  const getServicePrice = (serviceName) => {
    const svc = mockServices.find((s) => s.name === serviceName);
    return svc ? svc.price : 0;
  };

  const getClientName = (clientId) => {
    const client = mockClients.find((c) => c.id === clientId);
    return client ? client.name : 'Cliente';
  };

  const getBarberName = (barberId) => {
    const barber = mockBarbers.find((b) => b.id === barberId);
    return barber ? barber.name : 'Barbero';
  };

  const getSpecialtyShort = (specialty) => {
    if (specialty.includes('Barbero') || specialty.includes('Barbera')) return 'Barberia';
    if (specialty.includes('Estilista')) return 'Estilismo';
    if (specialty.includes('Manicurista')) return 'Uñas';
    return specialty;
  };

  const getCategoryColor = (name) => {
    if (name === 'Barbería') return 'primary';
    if (name.includes('Uñas')) return 'info';
    if (name === 'Facial') return 'accent';
    return 'primary';
  };

  // --- Week overview (next 7 days) ---
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dateKey = d.toISOString().split('T')[0];
    const appts = mockAppointments.filter((a) => a.date === dateKey);
    const revenue = appts.reduce((s, a) => s + getServicePrice(a.service), 0);
    return {
      date: d,
      dateKey,
      dayName: d.toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', ''),
      dayNum: d.getDate(),
      isToday: i === 0,
      count: appts.length,
      revenue,
      confirmed: appts.filter((a) => a.status === 'confirmed').length,
      pending: appts.filter((a) => a.status === 'pending').length,
    };
  });

  // --- Staff working today ---
  const todayStaffIds = [...new Set(todayAppts.map((a) => a.barberId))];
  const staffToday = todayStaffIds.map((id) => {
    const staff = mockBarbers.find((b) => b.id === id);
    const appts = todayAppts.filter((a) => a.barberId === id);
    const revenue = appts.reduce((s, a) => s + getServicePrice(a.service), 0);
    return { ...staff, todayAppts: appts.length, todayRevenue: revenue };
  }).sort((a, b) => b.todayRevenue - a.todayRevenue);

  // --- Services catalog grouped by category ---
  const servicesByCategory = {};
  mockServices.forEach((svc) => {
    let cat = svc.category;
    if (cat === 'Uñas Premium') cat = 'Uñas';
    if (!servicesByCategory[cat]) servicesByCategory[cat] = [];
    servicesByCategory[cat].push(svc);
  });

  const categoryOrder = ['Barbería', 'Uñas', 'Facial'];
  const sortedCatalog = categoryOrder
    .filter((c) => servicesByCategory[c])
    .map((c) => ({ name: c, services: servicesByCategory[c] }));

  return (
    <div className="dashboard">
      {/* ===== HEADER ===== */}
      <div className="dashboard__header">
        <div className="dashboard__welcome">
          <p className="dashboard__greeting">{greeting}</p>
          <h2 className="dashboard__title">
            <span className="dashboard__title-accent">{firstName}</span>, tu resumen del dia
          </h2>
          <p className="dashboard__subtitle">{dateStr}</p>
        </div>
        <div className="dashboard__header-right">
          <div className="dashboard__kpi-pills">
            <div className="dashboard__kpi-pill dashboard__kpi-pill--accent">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span>{vipCount} VIP</span>
            </div>
            <div className="dashboard__kpi-pill dashboard__kpi-pill--success">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              <span>{kpis.retentionRate}% retencion</span>
            </div>
            <div className="dashboard__kpi-pill dashboard__kpi-pill--warning">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>{atRiskCount + inactiveCount} requieren atencion</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== 4 STAT CARDS ===== */}
      <div className="dashboard__stats">
        {/* Ingresos del Mes */}
        <div className="dashboard__stat-card dashboard__stat-card--success">
          <div className="dashboard__stat-accent" />
          <div className="dashboard__stat-header">
            <div className="dashboard__stat-icon dashboard__stat-icon--success">
              {Icons.revenue}
            </div>
            {monthChange !== 0 && (
              <span className={`dashboard__stat-trend dashboard__stat-trend--${monthChange >= 0 ? 'up' : 'down'}`}>
                <span>{monthChange >= 0 ? '+' : ''}{monthChange}% vs mes ant.</span>
              </span>
            )}
          </div>
          <p className="dashboard__stat-number">
            <AnimatedNumber value={monthRevenue} prefix="$" />
          </p>
          <span className="dashboard__stat-label">Ingresos del Mes</span>
          <div className="dashboard__stat-footer">
            <span className="dashboard__stat-sub">
              {todayRevenue > 0
                ? `Hoy: ${formatCurrency(todayRevenue)}`
                : `${completedThisMonth.length} servicios completados`
              }
            </span>
          </div>
        </div>

        {/* Citas Hoy */}
        <div className="dashboard__stat-card dashboard__stat-card--info">
          <div className="dashboard__stat-accent" />
          <div className="dashboard__stat-header">
            <div className="dashboard__stat-icon dashboard__stat-icon--info">
              {Icons.calendar}
            </div>
            {pendingAppointments > 0 && (
              <span className="dashboard__stat-trend dashboard__stat-trend--pending">
                <span className="dashboard__stat-dot dashboard__stat-dot--warning" />
                <span>{pendingAppointments} pend.</span>
              </span>
            )}
          </div>
          <p className="dashboard__stat-number">
            <AnimatedNumber value={todayAppts.length} />
          </p>
          <span className="dashboard__stat-label">Citas Hoy</span>
          <div className="dashboard__stat-footer">
            <span className="dashboard__stat-sub">
              {todayAppts.filter((a) => a.status === 'confirmed').length} confirmadas
            </span>
          </div>
        </div>

        {/* Clientes Activos */}
        <div className="dashboard__stat-card dashboard__stat-card--primary">
          <div className="dashboard__stat-accent" />
          <div className="dashboard__stat-header">
            <div className="dashboard__stat-icon dashboard__stat-icon--primary">
              {Icons.clients}
            </div>
          </div>
          <p className="dashboard__stat-number">
            <AnimatedNumber value={activeClients} />
          </p>
          <span className="dashboard__stat-label">Clientes Activos</span>
          <div className="dashboard__stat-footer">
            <span className="dashboard__stat-sub">{mockClients.length} en total</span>
            <div className="dashboard__stat-bar">
              <div className="dashboard__stat-bar-fill dashboard__stat-bar-fill--primary" style={{ width: `${Math.round((activeClients / mockClients.length) * 100)}%` }} />
            </div>
          </div>
        </div>

        {/* Ticket Promedio */}
        <div className="dashboard__stat-card dashboard__stat-card--accent">
          <div className="dashboard__stat-accent" />
          <div className="dashboard__stat-header">
            <div className="dashboard__stat-icon dashboard__stat-icon--accent">
              {Icons.revenue}
            </div>
            {completedThisMonth.length > 0 && (
              <span className="dashboard__stat-trend dashboard__stat-trend--up">
                <span>{completedThisMonth.length} servicios</span>
              </span>
            )}
          </div>
          <p className="dashboard__stat-number">
            <AnimatedNumber value={avgTicket} prefix="$" />
          </p>
          <span className="dashboard__stat-label">Ticket Promedio</span>
          <div className="dashboard__stat-footer">
            <span className="dashboard__stat-sub">
              Promedio por servicio este mes
            </span>
          </div>
        </div>
      </div>

      {/* ===== WEEK OVERVIEW ===== */}
      <div className="dashboard__section">
        <div className="dashboard__section-header">
          <h3 className="dashboard__section-title">
            <span className="dashboard__section-icon">{Icons.calendar}</span>
            Semana
          </h3>
        </div>
        <div className="dashboard__week">
          {weekDays.map((day) => (
            <div key={day.dateKey} className={`dashboard__week-day ${day.isToday ? 'dashboard__week-day--today' : ''} ${day.count === 0 ? 'dashboard__week-day--empty' : ''}`}>
              <span className="dashboard__week-label">{day.dayName}</span>
              <span className="dashboard__week-num">{day.dayNum}</span>
              {day.count > 0 ? (
                <>
                  <span className="dashboard__week-count">{day.count} citas</span>
                  <span className="dashboard__week-rev">{formatCurrency(day.revenue)}</span>
                  <div className="dashboard__week-dots">
                    {day.confirmed > 0 && <span className="dashboard__week-dot dashboard__week-dot--ok" title={`${day.confirmed} confirmadas`}>{day.confirmed}</span>}
                    {day.pending > 0 && <span className="dashboard__week-dot dashboard__week-dot--pend" title={`${day.pending} pendientes`}>{day.pending}</span>}
                  </div>
                </>
              ) : (
                <span className="dashboard__week-free">Libre</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ===== MAIN GRID: Agenda + Sidebar ===== */}
      <div className="dashboard__grid">
        {/* LEFT — Agenda + Servicios Top */}
        <div className="dashboard__grid-main">
          <div className="dashboard__section">
            <div className="dashboard__section-header">
              <h3 className="dashboard__section-title">
                <span className="dashboard__section-icon">{Icons.clock}</span>
                Agenda de Hoy
              </h3>
              <div className="dashboard__agenda-summary">
                <span className="dashboard__agenda-total">{formatCurrency(todayAppts.reduce((s, a) => s + getServicePrice(a.service), 0))} proyectado</span>
                <span className="dashboard__section-count">{todayAppts.length} citas</span>
              </div>
            </div>
            <div className="dashboard__agenda">
              {todayAppts.length > 0 ? todayAppts.map((appt, index) => {
                const clientName = getClientName(appt.clientId);
                const barberName = getBarberName(appt.barberId);
                const price = getServicePrice(appt.service);
                const isNext = index === 0;
                return (
                  <div
                    key={appt.id}
                    className={`dashboard__agenda-row ${isNext ? 'dashboard__agenda-row--next' : ''}`}
                    style={{ animationDelay: `${0.04 * (index + 1)}s` }}
                  >
                    <span className="dashboard__agenda-time">
                      {appt.time}
                      {isNext && <span className="dashboard__agenda-now">Prox</span>}
                    </span>
                    <div className={`dashboard__agenda-avatar ${isNext ? 'dashboard__agenda-avatar--active' : ''}`}>
                      {getInitials(clientName)}
                    </div>
                    <div className="dashboard__agenda-info">
                      <span className="dashboard__agenda-name">{clientName}</span>
                      <span className="dashboard__agenda-service">{appt.service}</span>
                    </div>
                    <span className="dashboard__agenda-barber">{barberName}</span>
                    <span className="dashboard__agenda-price">{formatCurrency(price)}</span>
                    <span className={`dashboard__agenda-status dashboard__agenda-status--${appt.status}`}>
                      {appt.status === 'confirmed' ? 'Confirmada' : appt.status === 'cancelled' ? 'Cancelada' : 'Pendiente'}
                    </span>
                  </div>
                );
              }) : (
                <div className="dashboard__empty">
                  <p>No hay citas programadas para hoy</p>
                </div>
              )}
            </div>
          </div>

          {/* Servicios Top del Mes */}
          <div className="dashboard__section">
            <div className="dashboard__section-header">
              <h3 className="dashboard__section-title">
                <span className="dashboard__section-icon">{Icons.chart}</span>
                Servicios Top
              </h3>
              <span className="dashboard__section-count">{completedThisMonth.length} este mes</span>
            </div>
            <div className="dashboard__svc-list">
              {topServices.map((svc, index) => (
                <div key={svc.name} className="dashboard__svc-item" style={{ animationDelay: `${0.05 * (index + 1)}s` }}>
                  <span className="dashboard__svc-pos">{index + 1}</span>
                  <div className="dashboard__svc-info">
                    <span className="dashboard__svc-name">{svc.name}</span>
                    <div className="dashboard__svc-bar">
                      <div className="dashboard__svc-bar-fill" style={{ width: `${Math.round((svc.revenue / maxServiceRevenue) * 100)}%` }} />
                    </div>
                  </div>
                  <span className="dashboard__svc-count">{svc.count}x</span>
                  <span className="dashboard__svc-revenue">{formatCurrency(svc.revenue)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT — Sidebar panels */}
        <div className="dashboard__grid-side">
          {/* Equipo Hoy */}
          <div className="dashboard__section">
            <div className="dashboard__section-header">
              <h3 className="dashboard__section-title">
                <span className="dashboard__section-icon">{Icons.team}</span>
                Equipo Hoy
              </h3>
              <span className="dashboard__section-count">{staffToday.length} activos</span>
            </div>
            <div className="dashboard__staff-today">
              {staffToday.map((s) => (
                <div key={s.id} className="dashboard__staff-row">
                  <div className="dashboard__staff-avatar">{getInitials(s.name)}</div>
                  <div className="dashboard__staff-info">
                    <span className="dashboard__staff-name">{s.name.split(' ').slice(0, 2).join(' ')}</span>
                    <span className="dashboard__staff-spec">{getSpecialtyShort(s.specialty)}</span>
                  </div>
                  <span className="dashboard__staff-count">{s.todayAppts} citas</span>
                  <span className="dashboard__staff-rev">{formatCurrency(s.todayRevenue)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Profesionales del Mes */}
          <div className="dashboard__section">
            <div className="dashboard__section-header">
              <h3 className="dashboard__section-title">
                <span className="dashboard__section-icon dashboard__section-icon--accent">{Icons.trophy}</span>
                Top del Mes
              </h3>
            </div>
            <div className="dashboard__ranking">
              {top5Staff.map((staff, index) => (
                <div
                  key={staff.id}
                  className={`dashboard__ranking-item ${index === 0 ? 'dashboard__ranking-item--first' : ''}`}
                  style={{ animationDelay: `${0.06 * (index + 1)}s` }}
                >
                  <span className={`dashboard__ranking-pos ${index < 3 ? 'dashboard__ranking-pos--top' : ''}`}>{index + 1}</span>
                  <div className={`dashboard__ranking-avatar ${index === 0 ? 'dashboard__ranking-avatar--gold' : ''}`}>
                    {getInitials(staff.name)}
                  </div>
                  <div className="dashboard__ranking-content">
                    <div className="dashboard__ranking-top">
                      <span className="dashboard__ranking-name">{staff.name.split(' ').slice(0, 2).join(' ')}</span>
                      <span className="dashboard__ranking-revenue">{formatCurrency(staff.stats.monthRevenue)}</span>
                    </div>
                    <span className="dashboard__ranking-meta">
                      {getSpecialtyShort(staff.specialty)} · {staff.stats.monthServices} svcs
                    </span>
                    <div className="dashboard__ranking-bar">
                      <div className="dashboard__ranking-bar-fill" style={{ width: `${Math.round((staff.stats.monthRevenue / maxStaffRevenue) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ingresos por Área */}
          <div className="dashboard__section">
            <div className="dashboard__section-header">
              <h3 className="dashboard__section-title">
                <span className="dashboard__section-icon">{Icons.revenue}</span>
                Ingresos por Area
              </h3>
              <span className="dashboard__section-count">{formatCurrency(totalCategoryRevenue)}</span>
            </div>
            <div className="dashboard__categories">
              {categories.map((cat, index) => {
                const pct = totalCategoryRevenue > 0 ? Math.round((cat.revenue / totalCategoryRevenue) * 100) : 0;
                return (
                  <div key={cat.name} className="dashboard__cat-row" style={{ animationDelay: `${0.06 * (index + 1)}s` }}>
                    <div className={`dashboard__cat-dot dashboard__cat-dot--${getCategoryColor(cat.name)}`} />
                    <span className="dashboard__cat-name">{cat.name}</span>
                    <div className="dashboard__cat-bar">
                      <div className={`dashboard__cat-bar-fill dashboard__cat-bar-fill--${getCategoryColor(cat.name)}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="dashboard__cat-pct">{pct}%</span>
                    <span className="dashboard__cat-amount">{formatCurrency(cat.revenue)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ===== CATALOGO DE SERVICIOS ===== */}
      <div className="dashboard__section">
        <div className="dashboard__section-header">
          <h3 className="dashboard__section-title">
            <span className="dashboard__section-icon">{Icons.scissors}</span>
            Nuestros Servicios
          </h3>
          <span className="dashboard__section-count">{mockServices.length} servicios</span>
        </div>
        <div className="dashboard__catalog">
          {sortedCatalog.map((cat) => (
            <div key={cat.name} className="dashboard__catalog-group">
              <div className="dashboard__catalog-header">
                <div className={`dashboard__catalog-dot dashboard__catalog-dot--${getCategoryColor(cat.name)}`} />
                <span className="dashboard__catalog-cat">{cat.name}</span>
                <span className="dashboard__catalog-count">{cat.services.length}</span>
              </div>
              <div className="dashboard__catalog-items">
                {cat.services.map((svc) => (
                  <div key={svc.id} className="dashboard__catalog-svc">
                    <span className="dashboard__catalog-name">{svc.name}</span>
                    <span className="dashboard__catalog-dur">{svc.duration} min</span>
                    <span className="dashboard__catalog-price">{formatCurrency(svc.price)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
