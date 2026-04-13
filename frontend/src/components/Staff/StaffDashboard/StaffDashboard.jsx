import { useState, useEffect } from 'react';
import staffMeService from '../../../services/staffMeService';

const b = 'staff-dashboard';

const formatCOP = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos dias';
  if (h < 18) return 'Buenas tardes';
  return 'Buenas noches';
};

const formatTime12 = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};

const StaffDashboard = ({ user, onNavigate }) => {
  const [stats, setStats] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [s, n] = await Promise.all([
          staffMeService.getStats(),
          staffMeService.getNotifications(),
        ]);
        setStats(s);
        setAppointments(n);
      } catch { /* silent */ } finally {
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const firstName = (user?.name || stats?.staff_name || '').split(' ')[0];
  const today = new Date();
  const dateStr = today.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  if (loading) return (
    <div className={b}>
      <div className={`${b}__skeleton`}>
        <div className={`${b}__skeleton-bar`} style={{ width: '60%', height: 32 }} />
        <div className={`${b}__skeleton-bar`} style={{ width: '40%', height: 16, marginTop: 8 }} />
        <div className={`${b}__skeleton-grid`}>
          {[1,2,3,4].map(i => <div key={i} className={`${b}__skeleton-card`} />)}
        </div>
      </div>
    </div>
  );

  if (!stats) return <div className={b}><p className={`${b}__loading`}>Error al cargar datos</p></div>;

  const completionRate = stats.appointments_today > 0 ? Math.round((stats.completed_today / stats.appointments_today) * 100) : 0;
  const pendingCount = stats.confirmed_pending || 0;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Split appointments into completed and upcoming
  const upcoming = appointments.filter(a => {
    const [h, m] = (a.time || '0:0').split(':').map(Number);
    return (h * 60 + m) >= currentMinutes;
  });
  const nextAppt = stats.next_appointment;

  return (
    <div className={b}>
      {/* Hero greeting */}
      <div className={`${b}__hero`}>
        <div className={`${b}__hero-text`}>
          <span className={`${b}__hero-greeting`}>{getGreeting()}</span>
          <h1 className={`${b}__hero-name`}>{firstName}</h1>
        </div>
        <div className={`${b}__hero-meta`}>
          <span className={`${b}__hero-role`}>{stats.staff_role || 'Profesional'}</span>
          <span className={`${b}__hero-date`}>{dateStr}</span>
        </div>
      </div>

      {/* KPI Row */}
      <div className={`${b}__metrics`}>
        <div className={`${b}__metric ${b}__metric--blue`}>
          <div className={`${b}__metric-ring`}>
            <svg viewBox="0 0 36 36">
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(59,130,246,0.15)" strokeWidth="3" />
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#3B82F6" strokeWidth="3" strokeDasharray={`${completionRate}, 100`} strokeLinecap="round" />
            </svg>
            <span className={`${b}__metric-ring-value`}>{stats.appointments_today}</span>
          </div>
          <div className={`${b}__metric-info`}>
            <span className={`${b}__metric-label`}>Citas hoy</span>
            <span className={`${b}__metric-sub`}>{stats.completed_today} completadas</span>
          </div>
        </div>

        <div className={`${b}__metric ${b}__metric--emerald`}>
          <span className={`${b}__metric-value`}>{formatCOP(stats.commission_today)}</span>
          <span className={`${b}__metric-label`}>Ganancia del dia</span>
          <span className={`${b}__metric-sub`}>{Math.round(stats.commission_rate * 100)}% comision</span>
        </div>

        <div className={`${b}__metric ${b}__metric--amber`}>
          <span className={`${b}__metric-value`}>{pendingCount}</span>
          <span className={`${b}__metric-label`}>Pendientes</span>
          <span className={`${b}__metric-sub`}>{upcoming.length} por atender</span>
        </div>
      </div>

      {/* Next appointment highlight */}
      {nextAppt && (
        <div className={`${b}__next`}>
          <div className={`${b}__next-badge`}>Siguiente</div>
          <div className={`${b}__next-body`}>
            <div className={`${b}__next-time`}>{formatTime12(nextAppt.time)}</div>
            <div className={`${b}__next-details`}>
              <span className={`${b}__next-client`}>{nextAppt.client_name}</span>
              <span className={`${b}__next-service`}>{nextAppt.service_name} &middot; {nextAppt.duration_minutes} min</span>
            </div>
          </div>
          <div className={`${b}__next-glow`} />
        </div>
      )}

      {/* Timeline */}
      <div className={`${b}__timeline`}>
        <div className={`${b}__timeline-header`}>
          <h2>Agenda del dia</h2>
          <button className={`${b}__timeline-link`} onClick={() => onNavigate('staff-agenda')}>
            Ver completa
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>
        {appointments.length > 0 ? (
          <div className={`${b}__timeline-list`}>
            {appointments.map((a, i) => {
              const [ah, am] = (a.time || '0:0').split(':').map(Number);
              const aptMin = ah * 60 + am;
              const isPast = aptMin + (a.duration_minutes || 30) < currentMinutes;
              const isNow = aptMin <= currentMinutes && aptMin + (a.duration_minutes || 30) > currentMinutes;
              return (
                <div key={a.id || i} className={`${b}__timeline-item ${isPast ? `${b}__timeline-item--past` : ''} ${isNow ? `${b}__timeline-item--now` : ''}`}>
                  <div className={`${b}__timeline-dot`} />
                  <div className={`${b}__timeline-time`}>{formatTime12(a.time)}</div>
                  <div className={`${b}__timeline-card`}>
                    <span className={`${b}__timeline-client`}>{a.client_name}</span>
                    <span className={`${b}__timeline-service`}>{a.service_name}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={`${b}__timeline-empty`}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.3">
              <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span>No tienes citas para hoy</span>
          </div>
        )}
      </div>

      {/* Quick action */}
      <div className={`${b}__quick-actions`}>
        <button className={`${b}__quick-btn`} onClick={() => onNavigate('staff-finances')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
          Ver mis ingresos
        </button>
      </div>
    </div>
  );
};

export default StaffDashboard;
