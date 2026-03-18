import { useState, useEffect, useMemo } from 'react';
import staffMeService from '../../../services/staffMeService';

const b = 'staff-agenda';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

const ChevronLeft = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>;
const ChevronRight = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>;
const ClockIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
const UserIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;

const STATUS_LABELS = {
  confirmed: 'Confirmada',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'No asistio',
};

const STATUS_CLASSES = {
  confirmed: 'confirmed',
  completed: 'completed',
  cancelled: 'cancelled',
  no_show: 'noshow',
};

const StaffAgenda = ({ user }) => {
  const [date, setDate] = useState(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  });
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await staffMeService.getAppointments({ date_from: date, date_to: date });
        setAppointments(data);
      } catch (err) {
        console.error('Error loading agenda:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [date]);

  const changeDay = (delta) => {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().split('T')[0]);
  };

  const isToday = date === new Date().toISOString().split('T')[0];

  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const stats = useMemo(() => ({
    total: appointments.length,
    confirmed: appointments.filter(a => a.status === 'confirmed').length,
    completed: appointments.filter(a => a.status === 'completed').length,
    revenue: appointments.filter(a => a.status === 'completed').reduce((s, a) => s + (a.price || 0), 0),
  }), [appointments]);

  return (
    <div className={b}>
      {/* Header */}
      <div className={`${b}__header`}>
        <h2>Mi Agenda</h2>
        <p>Solo tus citas asignadas</p>
      </div>

      {/* Date nav */}
      <div className={`${b}__date-nav`}>
        <button className={`${b}__nav-btn`} onClick={() => changeDay(-1)}><ChevronLeft /></button>
        <div className={`${b}__date-label`}>
          <span className={`${b}__date-text`}>{dateLabel}</span>
          {isToday && <span className={`${b}__date-today`}>Hoy</span>}
        </div>
        <button className={`${b}__nav-btn`} onClick={() => changeDay(1)}><ChevronRight /></button>
        {!isToday && (
          <button className={`${b}__today-btn`} onClick={() => setDate(new Date().toISOString().split('T')[0])}>
            Ir a hoy
          </button>
        )}
      </div>

      {/* Stats */}
      <div className={`${b}__stats`}>
        <div className={`${b}__stat`}><span>{stats.total}</span> citas</div>
        <div className={`${b}__stat ${b}__stat--green`}><span>{stats.completed}</span> completadas</div>
        <div className={`${b}__stat ${b}__stat--blue`}><span>{stats.confirmed}</span> pendientes</div>
        <div className={`${b}__stat ${b}__stat--gold`}><span>{formatCurrency(stats.revenue)}</span> generado</div>
      </div>

      {/* Appointments list */}
      {loading ? (
        <p className={`${b}__loading`}>Cargando citas...</p>
      ) : appointments.length > 0 ? (
        <div className={`${b}__list`}>
          {appointments.map((appt) => (
            <div key={appt.id} className={`${b}__card ${b}__card--${STATUS_CLASSES[appt.status] || 'confirmed'}`}>
              <div className={`${b}__card-time`}>
                <ClockIcon />
                <span>{appt.time}</span>
                <span className={`${b}__card-duration`}>{appt.duration_minutes} min</span>
              </div>
              <div className={`${b}__card-body`}>
                <div className={`${b}__card-client`}>
                  <UserIcon />
                  <span>{appt.client_name}</span>
                </div>
                <span className={`${b}__card-service`}>{appt.service_name}</span>
                {appt.notes && <span className={`${b}__card-notes`}>{appt.notes}</span>}
              </div>
              <div className={`${b}__card-right`}>
                <span className={`${b}__card-price`}>{formatCurrency(appt.price)}</span>
                <span className={`${b}__card-status ${b}__card-status--${STATUS_CLASSES[appt.status]}`}>
                  {STATUS_LABELS[appt.status]}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={`${b}__empty`}>
          <p>No tienes citas para este dia</p>
        </div>
      )}
    </div>
  );
};

export default StaffAgenda;
