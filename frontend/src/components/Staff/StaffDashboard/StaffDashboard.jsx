import { useState, useEffect } from 'react';
import staffMeService from '../../../services/staffMeService';

const b = 'staff-dashboard';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos dias';
  if (h < 18) return 'Buenas tardes';
  return 'Buenas noches';
};

const CalendarIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
const CheckIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>;
const DollarIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>;
const ClockIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
const BellIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>;
const ArrowRight = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>;

const StaffDashboard = ({ user, onNavigate }) => {
  const [stats, setStats] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [s, n] = await Promise.all([
          staffMeService.getStats(),
          staffMeService.getNotifications(),
        ]);
        setStats(s);
        setNotifications(n);
      } catch { /* silent */ } finally {
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className={b}><p className={`${b}__loading`}>Cargando tu panel...</p></div>;
  if (!stats) return <div className={b}><p className={`${b}__loading`}>Error al cargar datos</p></div>;

  return (
    <div className={b}>
      <div className={`${b}__greeting`}>
        <h1>{getGreeting()}, {(user?.name || stats.staff_name || '').split(' ')[0]}</h1>
        <p>{stats.staff_role} &middot; {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      <div className={`${b}__kpis`}>
        <div className={`${b}__kpi`}>
          <div className={`${b}__kpi-icon ${b}__kpi-icon--blue`}><CalendarIcon /></div>
          <div className={`${b}__kpi-info`}>
            <span className={`${b}__kpi-value`}>{stats.appointments_today}</span>
            <span className={`${b}__kpi-label`}>Citas hoy</span>
          </div>
        </div>
        <div className={`${b}__kpi`}>
          <div className={`${b}__kpi-icon ${b}__kpi-icon--green`}><CheckIcon /></div>
          <div className={`${b}__kpi-info`}>
            <span className={`${b}__kpi-value`}>{stats.completed_today}</span>
            <span className={`${b}__kpi-label`}>Completadas</span>
          </div>
        </div>
        <div className={`${b}__kpi`}>
          <div className={`${b}__kpi-icon ${b}__kpi-icon--gold`}><DollarIcon /></div>
          <div className={`${b}__kpi-info`}>
            <span className={`${b}__kpi-value`}>{formatCurrency(stats.commission_today)}</span>
            <span className={`${b}__kpi-label`}>Ganancia hoy ({Math.round(stats.commission_rate * 100)}%)</span>
          </div>
        </div>
        <div className={`${b}__kpi`}>
          <div className={`${b}__kpi-icon ${b}__kpi-icon--purple`}><ClockIcon /></div>
          <div className={`${b}__kpi-info`}>
            <span className={`${b}__kpi-value`}>{stats.confirmed_pending}</span>
            <span className={`${b}__kpi-label`}>Pendientes</span>
          </div>
        </div>
      </div>

      {stats.next_appointment && (
        <div className={`${b}__next-appt`}>
          <div className={`${b}__next-appt-label`}>Proxima cita</div>
          <div className={`${b}__next-appt-content`}>
            <div className={`${b}__next-appt-time`}>{stats.next_appointment.time}</div>
            <div className={`${b}__next-appt-info`}>
              <span className={`${b}__next-appt-client`}>{stats.next_appointment.client_name}</span>
              <span className={`${b}__next-appt-service`}>{stats.next_appointment.service_name} &middot; {stats.next_appointment.duration_minutes} min</span>
            </div>
          </div>
        </div>
      )}

      <div className={`${b}__notifications`}>
        <div className={`${b}__section-header`}>
          <BellIcon />
          <h2>Citas de hoy</h2>
          <span className={`${b}__section-badge`}>{notifications.length}</span>
        </div>
        {notifications.length > 0 ? (
          <div className={`${b}__notif-list`}>
            {notifications.map((n) => (
              <div key={n.id} className={`${b}__notif-item`}>
                <div className={`${b}__notif-time`}>{n.time}</div>
                <div className={`${b}__notif-body`}>
                  <span className={`${b}__notif-client`}>{n.client_name}</span>
                  <span className={`${b}__notif-service`}>{n.service_name}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className={`${b}__notif-empty`}>No tienes mas citas confirmadas por hoy</p>
        )}
      </div>

      <div className={`${b}__actions`}>
        <button className={`${b}__action-btn`} onClick={() => onNavigate('staff-agenda')}>
          <CalendarIcon /> Ver mi agenda completa <ArrowRight />
        </button>
        <button className={`${b}__action-btn`} onClick={() => onNavigate('staff-finances')}>
          <DollarIcon /> Ver mis ingresos <ArrowRight />
        </button>
      </div>
    </div>
  );
};

export default StaffDashboard;
