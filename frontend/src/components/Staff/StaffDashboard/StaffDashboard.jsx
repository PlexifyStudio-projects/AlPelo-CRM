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
  const ampm = h >= 12 ? 'pm' : 'am';
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
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  if (loading) return (
    <div className={b}>
      <div className={`${b}__loader`}>
        <div className={`${b}__loader-spinner`} />
        <span>Cargando tu panel...</span>
      </div>
    </div>
  );

  if (!stats) return <div className={b}><p style={{ textAlign: 'center', padding: 48, color: '#94A3B8' }}>Error al cargar datos</p></div>;

  const completionPct = stats.appointments_today > 0 ? Math.round((stats.completed_today / stats.appointments_today) * 100) : 0;
  const nextAppt = stats.next_appointment;

  return (
    <div className={b}>
      {/* -------- Hero Card -------- */}
      <div className={`${b}__hero`}>
        <div className={`${b}__hero-bg`} />
        <div className={`${b}__hero-content`}>
          <div className={`${b}__hero-left`}>
            <div className={`${b}__hero-avatar`}>
              {firstName.charAt(0)}
            </div>
            <div>
              <p className={`${b}__hero-greet`}>{getGreeting()},</p>
              <h1 className={`${b}__hero-name`}>{firstName}</h1>
              <div className={`${b}__hero-chips`}>
                <span className={`${b}__hero-chip`}>{stats.staff_role || 'Profesional'}</span>
                <span className={`${b}__hero-chip ${b}__hero-chip--date`}>
                  {now.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
              </div>
            </div>
          </div>
          <div className={`${b}__hero-stats`}>
            <div className={`${b}__hero-stat`}>
              <span className={`${b}__hero-stat-val`}>{stats.appointments_today}</span>
              <span className={`${b}__hero-stat-lbl`}>Citas</span>
            </div>
            <div className={`${b}__hero-stat-divider`} />
            <div className={`${b}__hero-stat`}>
              <span className={`${b}__hero-stat-val`}>{stats.completed_today}</span>
              <span className={`${b}__hero-stat-lbl`}>Listas</span>
            </div>
            <div className={`${b}__hero-stat-divider`} />
            <div className={`${b}__hero-stat`}>
              <span className={`${b}__hero-stat-val`}>{completionPct}%</span>
              <span className={`${b}__hero-stat-lbl`}>Avance</span>
            </div>
          </div>
        </div>
      </div>

      {/* -------- KPI Cards -------- */}
      <div className={`${b}__kpis`}>
        <div className={`${b}__kpi ${b}__kpi--earnings`} onClick={() => onNavigate('staff-finances')}>
          <div className={`${b}__kpi-icon`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
          </div>
          <div className={`${b}__kpi-body`}>
            <span className={`${b}__kpi-value`}>{formatCOP(stats.commission_today)}</span>
            <span className={`${b}__kpi-label`}>Ganancia del dia</span>
          </div>
          <span className={`${b}__kpi-badge`}>{Math.round(stats.commission_rate * 100)}%</span>
        </div>

        <div className={`${b}__kpi ${b}__kpi--pending`}>
          <div className={`${b}__kpi-icon`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
          </div>
          <div className={`${b}__kpi-body`}>
            <span className={`${b}__kpi-value`}>{stats.confirmed_pending || 0}</span>
            <span className={`${b}__kpi-label`}>Pendientes</span>
          </div>
        </div>
      </div>

      {/* -------- Next Appointment -------- */}
      {nextAppt && (
        <div className={`${b}__next`} onClick={() => onNavigate('staff-agenda')}>
          <div className={`${b}__next-pulse`} />
          <div className={`${b}__next-icon`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>
          </div>
          <div className={`${b}__next-info`}>
            <span className={`${b}__next-tag`}>Siguiente cita</span>
            <span className={`${b}__next-client`}>{nextAppt.client_name}</span>
            <span className={`${b}__next-detail`}>{nextAppt.service_name} &middot; {nextAppt.duration_minutes} min</span>
          </div>
          <div className={`${b}__next-time`}>{formatTime12(nextAppt.time)}</div>
        </div>
      )}

      {/* -------- Timeline -------- */}
      <div className={`${b}__section`}>
        <div className={`${b}__section-top`}>
          <h2>Agenda de hoy</h2>
          <button onClick={() => onNavigate('staff-agenda')}>
            Ver todo
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>

        {appointments.length > 0 ? (
          <div className={`${b}__cards`}>
            {appointments.map((a, i) => {
              const [ah, am] = (a.time || '0:0').split(':').map(Number);
              const aptMin = ah * 60 + am;
              const isPast = aptMin + (a.duration_minutes || 30) < currentMinutes;
              const isActive = aptMin <= currentMinutes && aptMin + (a.duration_minutes || 30) > currentMinutes;
              return (
                <div key={a.id || i} className={`${b}__card ${isPast ? `${b}__card--past` : ''} ${isActive ? `${b}__card--active` : ''}`}>
                  <div className={`${b}__card-time`}>
                    <span className={`${b}__card-hour`}>{formatTime12(a.time)}</span>
                    {a.duration_minutes && <span className={`${b}__card-dur`}>{a.duration_minutes} min</span>}
                  </div>
                  <div className={`${b}__card-body`}>
                    <span className={`${b}__card-client`}>{a.client_name}</span>
                    <span className={`${b}__card-service`}>{a.service_name}</span>
                  </div>
                  <div className={`${b}__card-status`}>
                    {isPast ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                    ) : isActive ? (
                      <span className={`${b}__card-live`} />
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={`${b}__empty`}>
            <div className={`${b}__empty-icon`}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            </div>
            <h3>Dia libre</h3>
            <p>No tienes citas programadas para hoy. Disfruta tu descanso.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffDashboard;
