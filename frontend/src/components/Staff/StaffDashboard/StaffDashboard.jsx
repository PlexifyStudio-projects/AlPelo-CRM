import { useState, useEffect } from 'react';
import staffMeService from '../../../services/staffMeService';

const b = 'staff-dashboard';
const formatCOP = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);
const getGreeting = () => { const h = new Date().getHours(); return h < 12 ? 'Buenos dias' : h < 18 ? 'Buenas tardes' : 'Buenas noches'; };
const fmt12 = (t) => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`; };
const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const StaffDashboard = ({ user, onNavigate }) => {
  const [stats, setStats] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [weekData, setWeekData] = useState([]);
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

        // Load week data for mini chart
        const today = new Date();
        const monday = new Date(today);
        monday.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        try {
          const weekAppts = await staffMeService.getAppointments({ date_from: toISO(monday), date_to: toISO(sunday) });
          // Group by day
          const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
          const grouped = days.map((label, i) => {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            const dateStr = toISO(d);
            const dayAppts = (weekAppts || []).filter(a => a.date === dateStr);
            return { label, count: dayAppts.length, isToday: dateStr === toISO(today) };
          });
          setWeekData(grouped);
        } catch { /* silent */ }
      } catch { /* silent */ } finally { setLoading(false); }
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const firstName = (user?.name || stats?.staff_name || '').split(' ')[0];
  const now = new Date();
  const currentMin = now.getHours() * 60 + now.getMinutes();

  if (loading) return (
    <div className={b}><div className={`${b}__loader`}><div className={`${b}__loader-spinner`} /><span>Cargando...</span></div></div>
  );
  if (!stats) return <div className={b}><p style={{ textAlign: 'center', padding: 48, color: '#94A3B8' }}>Error al cargar</p></div>;

  const pct = stats.appointments_today > 0 ? Math.round((stats.completed_today / stats.appointments_today) * 100) : 0;
  const nextAppt = stats.next_appointment;
  const maxWeek = Math.max(...weekData.map(d => d.count), 1);

  // Recent services from today's completed appointments
  const completedToday = appointments.filter(() => true); // all notifications are today's

  return (
    <div className={b}>
      {/* ===== TOP: Hero + Stats ===== */}
      <div className={`${b}__top`}>
        <div className={`${b}__hero`}>
          <div className={`${b}__hero-bg`} />
          <div className={`${b}__hero-inner`}>
            <div className={`${b}__hero-left`}>
              <div className={`${b}__hero-avatar`}>{firstName.charAt(0)}</div>
              <div>
                <p className={`${b}__hero-greet`}>{getGreeting()},</p>
                <h1 className={`${b}__hero-name`}>{firstName}</h1>
                <div className={`${b}__hero-chips`}>
                  <span className={`${b}__hero-chip`}>{stats.staff_role || 'Profesional'}</span>
                  <span className={`${b}__hero-chip ${b}__hero-chip--date`}>{now.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                </div>
              </div>
            </div>
            <div className={`${b}__hero-counters`}>
              <div className={`${b}__hero-counter`}><span className={`${b}__hero-counter-val`}>{stats.appointments_today}</span><span className={`${b}__hero-counter-lbl`}>Citas</span></div>
              <div className={`${b}__hero-counter-sep`} />
              <div className={`${b}__hero-counter`}><span className={`${b}__hero-counter-val`}>{stats.completed_today}</span><span className={`${b}__hero-counter-lbl`}>Listas</span></div>
              <div className={`${b}__hero-counter-sep`} />
              <div className={`${b}__hero-counter`}><span className={`${b}__hero-counter-val`}>{pct}%</span><span className={`${b}__hero-counter-lbl`}>Avance</span></div>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className={`${b}__kpis`}>
          <div className={`${b}__kpi ${b}__kpi--green`} onClick={() => onNavigate('staff-finances')}>
            <div className={`${b}__kpi-top`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
              <span className={`${b}__kpi-pct`}>{Math.round(stats.commission_rate * 100)}%</span>
            </div>
            <span className={`${b}__kpi-val`}>{formatCOP(stats.commission_today)}</span>
            <span className={`${b}__kpi-lbl`}>Ganancia hoy</span>
          </div>
          <div className={`${b}__kpi ${b}__kpi--amber`}>
            <div className={`${b}__kpi-top`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            </div>
            <span className={`${b}__kpi-val`}>{stats.confirmed_pending || 0}</span>
            <span className={`${b}__kpi-lbl`}>Pendientes</span>
          </div>
          <div className={`${b}__kpi ${b}__kpi--blue`} onClick={() => onNavigate('staff-agenda')}>
            <div className={`${b}__kpi-top`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            </div>
            <span className={`${b}__kpi-val`}>{appointments.length}</span>
            <span className={`${b}__kpi-lbl`}>Total hoy</span>
          </div>
        </div>
      </div>

      {/* ===== MAIN GRID ===== */}
      <div className={`${b}__grid`}>
        {/* LEFT: Appointments */}
        <div className={`${b}__col`}>
          {/* Next appointment banner */}
          {nextAppt && (
            <div className={`${b}__next`} onClick={() => onNavigate('staff-agenda')}>
              <div className={`${b}__next-dot`} />
              <div className={`${b}__next-icon`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              </div>
              <div className={`${b}__next-body`}>
                <span className={`${b}__next-tag`}>Siguiente</span>
                <span className={`${b}__next-name`}>{nextAppt.client_name}</span>
                <span className={`${b}__next-svc`}>{nextAppt.service_name} &middot; {nextAppt.duration_minutes} min</span>
              </div>
              <span className={`${b}__next-time`}>{fmt12(nextAppt.time)}</span>
            </div>
          )}

          {/* Appointments list */}
          <div className={`${b}__panel`}>
            <div className={`${b}__panel-top`}>
              <h2>Citas de hoy</h2>
              <button onClick={() => onNavigate('staff-agenda')}>Ver agenda <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg></button>
            </div>
            {appointments.length > 0 ? (
              <div className={`${b}__appt-list`}>
                {appointments.map((a, i) => {
                  const [ah, am] = (a.time || '0:0').split(':').map(Number);
                  const m = ah * 60 + am;
                  const past = m + (a.duration_minutes || 30) < currentMin;
                  const active = m <= currentMin && m + (a.duration_minutes || 30) > currentMin;
                  return (
                    <div key={a.id || i} className={`${b}__appt ${past ? `${b}__appt--past` : ''} ${active ? `${b}__appt--active` : ''}`}>
                      <div className={`${b}__appt-time`}>{fmt12(a.time)}</div>
                      <div className={`${b}__appt-info`}>
                        <span className={`${b}__appt-client`}>{a.client_name}</span>
                        <span className={`${b}__appt-svc`}>{a.service_name} {a.duration_minutes ? `· ${a.duration_minutes} min` : ''}</span>
                      </div>
                      <div className={`${b}__appt-state`}>
                        {past ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                          : active ? <span className={`${b}__appt-live`} />
                          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /></svg>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={`${b}__empty`}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                <h3>Dia libre</h3>
                <p>No tienes citas para hoy</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Week chart + Quick actions */}
        <div className={`${b}__col`}>
          {/* Week overview */}
          {weekData.length > 0 && (
            <div className={`${b}__panel`}>
              <div className={`${b}__panel-top`}><h2>Esta semana</h2></div>
              <div className={`${b}__week`}>
                {weekData.map((d, i) => (
                  <div key={i} className={`${b}__week-day ${d.isToday ? `${b}__week-day--today` : ''}`}>
                    <div className={`${b}__week-bar-wrap`}>
                      <div className={`${b}__week-bar`} style={{ height: `${Math.max((d.count / maxWeek) * 100, 4)}%` }} />
                    </div>
                    <span className={`${b}__week-count`}>{d.count}</span>
                    <span className={`${b}__week-label`}>{d.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick links */}
          <div className={`${b}__panel`}>
            <div className={`${b}__panel-top`}><h2>Accesos rapidos</h2></div>
            <div className={`${b}__links`}>
              <button className={`${b}__link`} onClick={() => onNavigate('staff-agenda')}>
                <div className={`${b}__link-icon ${b}__link-icon--indigo`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                </div>
                <div><span className={`${b}__link-title`}>Mi Agenda</span><span className={`${b}__link-desc`}>Ver semana completa</span></div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
              <button className={`${b}__link`} onClick={() => onNavigate('staff-finances')}>
                <div className={`${b}__link-icon ${b}__link-icon--emerald`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                </div>
                <div><span className={`${b}__link-title`}>Mis Ingresos</span><span className={`${b}__link-desc`}>Comisiones y pagos</span></div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffDashboard;
