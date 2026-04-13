import { useState, useEffect } from 'react';
import staffMeService from '../../../services/staffMeService';

const b = 'sd';
const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);
const greet = () => { const h = new Date().getHours(); return h < 12 ? 'Buenos dias' : h < 18 ? 'Buenas tardes' : 'Buenas noches'; };
const t12 = (t) => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`; };
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtDate = (d) => { if (!d) return ''; const dt = new Date(d + 'T12:00:00'); return dt.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }); };

const StaffDashboard = ({ user, onNavigate }) => {
  const [s, setS] = useState(null);
  const [appts, setAppts] = useState([]);
  const [week, setWeek] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [stats, notifs] = await Promise.all([staffMeService.getStats(), staffMeService.getNotifications()]);
        setS(stats); setAppts(notifs);
        const today = new Date();
        const mon = new Date(today); mon.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
        try {
          const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
          const wa = await staffMeService.getAppointments({ date_from: iso(mon), date_to: iso(sun) });
          const days = ['L', 'M', 'Mi', 'J', 'V', 'S', 'D'];
          setWeek(days.map((l, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); const ds = iso(d); return { l, n: (wa || []).filter(a => a.date === ds).length, t: ds === iso(today) }; }));
        } catch { /* */ }
      } catch { /* */ } finally { setLoading(false); }
    };
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, []);

  if (loading) return <div className={b}><div className={`${b}__load`}><div className={`${b}__spin`} /></div></div>;
  if (!s) return <div className={b}><p style={{ textAlign: 'center', padding: 48, color: '#94A3B8' }}>Error al cargar</p></div>;

  const name = (user?.name || s.staff_name || '').split(' ')[0];
  const now = new Date();
  const cm = now.getHours() * 60 + now.getMinutes();
  const mx = Math.max(...week.map(d => d.n), 1);
  const next = s.next_appointment;
  const earnDiff = s.commission_today - (s.commission_yesterday || 0);
  const earnPct = s.commission_yesterday > 0 ? Math.round(((s.commission_today - s.commission_yesterday) / s.commission_yesterday) * 100) : s.commission_today > 0 ? 100 : 0;
  const monthVisits = s.month_visits || [];
  const monthName = now.toLocaleDateString('es-CO', { month: 'long' });

  return (
    <div className={b}>
      {/* HERO */}
      <div className={`${b}__hero`}>
        <div className={`${b}__hero-bg`} />
        <div className={`${b}__hero-c`}>
          <div className={`${b}__hero-l`}>
            <div className={`${b}__hero-av`}>{name.charAt(0)}</div>
            <div>
              <p className={`${b}__hero-g`}>{greet()},</p>
              <h1 className={`${b}__hero-n`}>{name}</h1>
              <div className={`${b}__hero-ch`}>
                <span>{s.staff_role || 'Profesional'}</span>
                <span className={`${b}__hero-dt`}>{now.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* STATS (scrollable mobile) */}
      <div className={`${b}__stats`}>
        <div className={`${b}__stat`}>
          <div className={`${b}__stat-top`}>
            <span className={`${b}__stat-ic ${b}__stat-ic--g`}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg></span>
            {earnDiff !== 0 && <span className={`${b}__stat-badge ${earnDiff > 0 ? `${b}__stat-badge--up` : `${b}__stat-badge--down`}`}>{earnDiff > 0 ? '↑' : '↓'} {Math.abs(earnPct)}%</span>}
          </div>
          <span className={`${b}__stat-val`}>{fmt(s.commission_today)}</span>
          <span className={`${b}__stat-lbl`}>Ganancia hoy</span>
          {s.commission_yesterday > 0 && <span className={`${b}__stat-sub`}>Ayer: {fmt(s.commission_yesterday)}</span>}
        </div>
        <div className={`${b}__stat`}>
          <span className={`${b}__stat-ic ${b}__stat-ic--b`}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="20 6 9 17 4 12" /></svg></span>
          <span className={`${b}__stat-val`}>{s.visits_today || s.completed_today}</span>
          <span className={`${b}__stat-lbl`}>Visitas hoy</span>
        </div>
        <div className={`${b}__stat`}>
          <span className={`${b}__stat-ic ${b}__stat-ic--am`}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg></span>
          <span className={`${b}__stat-val`}>{s.confirmed_pending}</span>
          <span className={`${b}__stat-lbl`}>Pendientes</span>
        </div>
        <div className={`${b}__stat`}>
          <span className={`${b}__stat-ic ${b}__stat-ic--p`}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg></span>
          <span className={`${b}__stat-val`}>{s.total_visits || 0}</span>
          <span className={`${b}__stat-lbl`}>Total visitas</span>
        </div>
      </div>

      {/* NEXT */}
      {next && (
        <div className={`${b}__next`} onClick={() => onNavigate('staff-agenda')}>
          <div className={`${b}__next-ic`}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg></div>
          <div className={`${b}__next-bd`}>
            <span className={`${b}__next-tg`}>Siguiente</span>
            <span className={`${b}__next-nm`}>{next.client_name}</span>
            <span className={`${b}__next-sv`}>{next.service_name} · {next.duration_minutes} min</span>
          </div>
          <span className={`${b}__next-tm`}>{t12(next.time)}</span>
        </div>
      )}

      {/* MAIN GRID */}
      <div className={`${b}__main`}>
        {/* LEFT: Today's appointments */}
        <div className={`${b}__pnl`}>
          <div className={`${b}__pnl-h`}>
            <h2>Citas de hoy</h2>
            <button onClick={() => onNavigate('staff-agenda')}>Agenda <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg></button>
          </div>
          {appts.length > 0 ? (
            <div className={`${b}__list`}>
              {appts.map((a, i) => {
                const [ah, am] = (a.time || '0:0').split(':').map(Number);
                const m = ah * 60 + am; const past = m + (a.duration_minutes || 30) < cm; const live = m <= cm && m + (a.duration_minutes || 30) > cm;
                return (
                  <div key={a.id || i} className={`${b}__item ${past ? `${b}__item--p` : ''} ${live ? `${b}__item--a` : ''}`}>
                    <div className={`${b}__item-tm`}>{t12(a.time)}</div>
                    <div className={`${b}__item-bd`}><span className={`${b}__item-cl`}>{a.client_name}</span><span className={`${b}__item-sv`}>{a.service_name}</span></div>
                    {past ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg> : live ? <span className={`${b}__live`} /> : <span className={`${b}__dot`} />}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={`${b}__empty`}><span>No tienes citas para hoy</span></div>
          )}
        </div>

        {/* RIGHT column */}
        <div className={`${b}__right`}>
          {/* Week chart */}
          {week.length > 0 && (
            <div className={`${b}__pnl`}>
              <div className={`${b}__pnl-h`}><h2>Semana</h2></div>
              <div className={`${b}__wk`}>
                {week.map((d, i) => (
                  <div key={i} className={`${b}__wk-d ${d.t ? `${b}__wk-d--t` : ''}`}>
                    <div className={`${b}__wk-bw`}><div className={`${b}__wk-b`} style={{ height: `${Math.max((d.n / mx) * 100, 6)}%` }} /></div>
                    <span className={`${b}__wk-n`}>{d.n}</span><span className={`${b}__wk-l`}>{d.l}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Month earnings summary (staff only: commission + tips) */}
          <div className={`${b}__pnl`}>
            <div className={`${b}__pnl-h`}><h2>Resumen {monthName}</h2></div>
            <div className={`${b}__month-summary`}>
              <div className={`${b}__month-row`}><span>Comisiones</span><span className={`${b}__month-val`}>{fmt(s.month_commission || 0)}</span></div>
              <div className={`${b}__month-row`}><span>Propinas</span><span className={`${b}__month-val ${b}__month-val--tip`}>+{fmt(s.month_tips || 0)}</span></div>
              <div className={`${b}__month-row ${b}__month-row--total`}><span>Total a recibir</span><span>{fmt((s.month_commission || 0) + (s.month_tips || 0))}</span></div>
              <div className={`${b}__month-row ${b}__month-row--visits`}><span>Visitas del mes</span><span>{monthVisits.length}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* MONTH VISITS TABLE */}
      {monthVisits.length > 0 && (
        <div className={`${b}__pnl`} style={{ marginTop: 16 }}>
          <div className={`${b}__pnl-h`}>
            <h2>Visitas de {monthName}</h2>
            <button onClick={() => onNavigate('staff-finances')}>Ver todo <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg></button>
          </div>
          <div className={`${b}__visits`}>
            <div className={`${b}__visits-head`}>
              <span>Fecha</span><span>Cliente</span><span>Servicio</span><span>Comision</span><span>Propina</span>
            </div>
            {monthVisits.map((v, i) => (
              <div key={v.id || i} className={`${b}__visits-row`}>
                <span className={`${b}__visits-date`}>{fmtDate(v.visit_date)}</span>
                <span className={`${b}__visits-name`}>{v.client_name}</span>
                <span className={`${b}__visits-svc`}>{v.service_name}</span>
                <span className={`${b}__visits-comm`}>{fmt(v.commission)}</span>
                <span className={`${b}__visits-tip`}>{v.tip > 0 ? `+${fmt(v.tip)}` : '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QUICK LINKS */}
      <div className={`${b}__links`}>
        <button onClick={() => onNavigate('staff-agenda')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
          Mi Agenda
        </button>
        <button onClick={() => onNavigate('staff-finances')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
          Mis Ingresos
        </button>
      </div>
    </div>
  );
};

export default StaffDashboard;
