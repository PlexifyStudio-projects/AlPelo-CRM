import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import SEO from '../../../components/landing/common/SEO';
import '../../../styles/landing/pages/_booking.scss';

const API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const COUNTRIES = [
  { name: 'Colombia', code: '+57', flag: '\u{1F1E8}\u{1F1F4}' },
  { name: 'Mexico', code: '+52', flag: '\u{1F1F2}\u{1F1FD}' },
  { name: 'Argentina', code: '+54', flag: '\u{1F1E6}\u{1F1F7}' },
  { name: 'Chile', code: '+56', flag: '\u{1F1E8}\u{1F1F1}' },
  { name: 'Peru', code: '+51', flag: '\u{1F1F5}\u{1F1EA}' },
  { name: 'Ecuador', code: '+593', flag: '\u{1F1EA}\u{1F1E8}' },
  { name: 'Venezuela', code: '+58', flag: '\u{1F1FB}\u{1F1EA}' },
  { name: 'Estados Unidos', code: '+1', flag: '\u{1F1FA}\u{1F1F8}' },
  { name: 'Espana', code: '+34', flag: '\u{1F1EA}\u{1F1F8}' },
];

export default function BookingPage() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Wizard state
  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientNotes, setClientNotes] = useState('');
  const [countryCode, setCountryCode] = useState('+57');
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState(null);

  // Fetch business data on mount
  useEffect(() => {
    fetch(`${API}/public/book/${slug}`)
      .then(r => {
        if (!r.ok) throw new Error(r.status === 404 ? 'not_found' : r.status === 403 ? 'disabled' : 'error');
        return r.json();
      })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [slug]);

  // Fetch availability when date changes
  useEffect(() => {
    if (!selectedDate || !selectedStaff || !selectedService) return;
    setSlotsLoading(true);
    setSelectedTime(null);
    const dateStr = selectedDate.toISOString().split('T')[0];
    fetch(`${API}/public/book/${slug}/availability?date=${dateStr}&staff_id=${selectedStaff.id}&service_id=${selectedService.id}`)
      .then(r => r.json())
      .then(d => { setSlots(d.slots || []); setSlotsLoading(false); })
      .catch(() => { setSlots([]); setSlotsLoading(false); });
  }, [selectedDate, selectedStaff, selectedService, slug]);

  // Apply tenant brand colors
  const brand = data?.business;
  const style = brand ? {
    '--brand-primary': brand.brand_color || '#2563eb',
    '--brand-dark': brand.brand_color_dark || '#1e40af',
    '--brand-accent': brand.brand_color_accent || '#6366f1',
  } : {};

  // ── Loading ──
  if (loading) return (
    <div className="booking">
      <div className="booking__loader">
        <div className="booking__spinner" />
      </div>
    </div>
  );

  // ── Error states ──
  if (error === 'not_found') return (
    <div className="booking">
      <div className="booking__error">
        <h1>Negocio no encontrado</h1>
        <p>El enlace que usaste no corresponde a ningun negocio registrado.</p>
      </div>
    </div>
  );
  if (error === 'disabled') return (
    <div className="booking">
      <div className="booking__error">
        <h1>Reservas no disponibles</h1>
        <p>Este negocio aun no tiene habilitadas las reservas en linea.</p>
      </div>
    </div>
  );
  if (error) return (
    <div className="booking">
      <div className="booking__error">
        <h1>Error al cargar</h1>
        <p>Hubo un problema cargando la pagina. Intenta de nuevo.</p>
      </div>
    </div>
  );

  // ── Confirmation screen ──
  if (confirmation) return (
    <div className="booking" style={style}>
      <div className="booking__header">
        {brand?.logo_url && <img src={brand.logo_url} alt={brand.name} className="booking__logo" />}
        <h1 className="booking__business-name">{brand?.name}</h1>
      </div>
      <div className="booking__confirmation">
        <div className="booking__check-icon">&#10003;</div>
        <h2>Cita agendada</h2>
        <p className="booking__conf-msg">Te esperamos!</p>
        <div className="booking__conf-details">
          <div className="booking__conf-row"><span>Servicio</span><strong>{confirmation.service}</strong></div>
          <div className="booking__conf-row"><span>Profesional</span><strong>{confirmation.staff}</strong></div>
          <div className="booking__conf-row"><span>Fecha</span><strong>{confirmation.date}</strong></div>
          <div className="booking__conf-row"><span>Hora</span><strong>{confirmation.time}</strong></div>
          <div className="booking__conf-row"><span>Precio</span><strong>${confirmation.price?.toLocaleString('es-CO')} COP</strong></div>
        </div>
        <p className="booking__conf-note">El pago se realiza directamente en el establecimiento.</p>
        <p className="booking__conf-wa">Te enviaremos confirmacion por WhatsApp.</p>
      </div>
    </div>
  );

  const { services = {}, staff = [] } = data || {};
  const allServices = Object.values(services).flat();
  const categories = Object.keys(services);

  // Generate next 30 days for calendar
  const today = new Date();
  const calendarDays = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    calendarDays.push(d);
  }

  const handleSubmit = async () => {
    if (!clientName.trim() || !clientPhone.trim()) return;
    setSubmitting(true);
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const res = await fetch(`${API}/public/book/${slug}/appointment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: selectedService.id,
          staff_id: selectedStaff.id,
          date: dateStr,
          time: selectedTime,
          client_name: clientName.trim(),
          client_phone: countryCode + clientPhone.trim().replace(/\s/g, ''),
          client_email: clientEmail.trim() || null,
          notes: clientNotes.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || 'Error al agendar. Intenta de nuevo.');
        setSubmitting(false);
        return;
      }
      const result = await res.json();
      setConfirmation(result.appointment);
    } catch {
      alert('Error de conexion. Intenta de nuevo.');
    }
    setSubmitting(false);
  };

  const canGoNext = () => {
    if (step === 1) return !!selectedService;
    if (step === 2) return !!selectedStaff;
    if (step === 3) return !!selectedDate && !!selectedTime;
    if (step === 4) return clientName.trim().length >= 2 && clientPhone.trim().length >= 7;
    return false;
  };

  return (
    <div className="booking" style={style}>
      <SEO
        title={`${brand?.name || 'Reservar'} — Agenda tu cita`}
        description={brand?.tagline || `Reserva tu cita en ${brand?.name}`}
      />

      {/* ── Header ── */}
      <div className="booking__header">
        {brand?.logo_url && <img src={brand.logo_url} alt={brand.name} className="booking__logo" />}
        <div>
          <h1 className="booking__business-name">{brand?.name}</h1>
          {brand?.tagline && <p className="booking__tagline">{brand.tagline}</p>}
        </div>
      </div>

      {/* ── Gallery ── */}
      {brand?.gallery_images?.length > 0 && (
        <div className="booking__gallery">
          {brand.gallery_images.slice(0, 4).map((img, i) => (
            <img key={i} src={img} alt={`${brand.name} ${i + 1}`} className="booking__gallery-img" />
          ))}
        </div>
      )}

      {/* ── Step Indicator ── */}
      <div className="booking__steps">
        {['Servicio', 'Profesional', 'Fecha y Hora', 'Tus datos'].map((label, i) => (
          <div key={i} className={`booking__step-dot ${step > i + 1 ? 'booking__step-dot--done' : ''} ${step === i + 1 ? 'booking__step-dot--active' : ''}`}>
            <span className="booking__step-num">{step > i + 1 ? '\u2713' : i + 1}</span>
            <span className="booking__step-label">{label}</span>
          </div>
        ))}
      </div>

      {/* ── Wizard Content ── */}
      <div className="booking__content">

        {/* STEP 1: Service */}
        {step === 1 && (
          <div className="booking__section">
            <h2 className="booking__section-title">Elige tu servicio</h2>
            {categories.map(cat => (
              <div key={cat} className="booking__category">
                <h3 className="booking__category-name">{cat}</h3>
                <div className="booking__service-grid">
                  {services[cat].map(svc => (
                    <button
                      key={svc.id}
                      className={`booking__service-card ${selectedService?.id === svc.id ? 'booking__service-card--selected' : ''}`}
                      onClick={() => setSelectedService(svc)}
                    >
                      <span className="booking__service-name">{svc.name}</span>
                      <span className="booking__service-meta">
                        <strong>${svc.price?.toLocaleString('es-CO')}</strong> &middot; {svc.duration_minutes} min
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* STEP 2: Staff */}
        {step === 2 && (
          <div className="booking__section">
            <h2 className="booking__section-title">Elige tu profesional</h2>
            <div className="booking__staff-grid">
              <button
                className={`booking__staff-card ${selectedStaff?.id === 'any' ? 'booking__staff-card--selected' : ''}`}
                onClick={() => {
                  if (staff.length > 0) setSelectedStaff({ id: staff[0].id, name: 'Disponible' });
                }}
              >
                <div className="booking__staff-avatar">?</div>
                <span className="booking__staff-name">Sin preferencia</span>
                <span className="booking__staff-spec">Quien este disponible</span>
              </button>
              {staff.map(s => (
                <button
                  key={s.id}
                  className={`booking__staff-card ${selectedStaff?.id === s.id ? 'booking__staff-card--selected' : ''}`}
                  onClick={() => setSelectedStaff(s)}
                >
                  <div className="booking__staff-avatar">
                    {s.photo_url ? <img src={s.photo_url} alt={s.name} /> : s.name.charAt(0)}
                  </div>
                  <span className="booking__staff-name">{s.name}</span>
                  <span className="booking__staff-spec">{s.specialty}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: Date & Time */}
        {step === 3 && (
          <div className="booking__section">
            <h2 className="booking__section-title">Elige fecha y hora</h2>
            <div className="booking__calendar">
              {calendarDays.map((d, i) => {
                const isSelected = selectedDate && d.toDateString() === selectedDate.toDateString();
                return (
                  <button
                    key={i}
                    className={`booking__day ${isSelected ? 'booking__day--selected' : ''}`}
                    onClick={() => setSelectedDate(d)}
                  >
                    <span className="booking__day-name">{DAYS_ES[d.getDay()]}</span>
                    <span className="booking__day-num">{d.getDate()}</span>
                    <span className="booking__day-month">{MONTHS_ES[d.getMonth()].slice(0, 3)}</span>
                  </button>
                );
              })}
            </div>

            {selectedDate && (
              <div className="booking__times">
                <h3 className="booking__times-title">
                  Horarios disponibles — {selectedDate.getDate()} de {MONTHS_ES[selectedDate.getMonth()]}
                </h3>
                {slotsLoading ? (
                  <div className="booking__slots-loading">Consultando disponibilidad...</div>
                ) : slots.length === 0 ? (
                  <div className="booking__slots-empty">No hay horarios disponibles este dia. Prueba otra fecha.</div>
                ) : (
                  <div className="booking__slots">
                    {slots.map(t => (
                      <button
                        key={t}
                        className={`booking__slot ${selectedTime === t ? 'booking__slot--selected' : ''}`}
                        onClick={() => setSelectedTime(t)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 4: Client Data */}
        {step === 4 && (
          <div className="booking__section">
            <h2 className="booking__section-title">Tus datos</h2>
            <div className="booking__form">
              <div className="booking__field">
                <label>Nombre completo *</label>
                <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Tu nombre" />
              </div>
              <div className="booking__field booking__field--phone">
                <label>Telefono *</label>
                <div className="booking__phone-row">
                  <select value={countryCode} onChange={e => setCountryCode(e.target.value)} className="booking__country-select">
                    {COUNTRIES.map(c => (
                      <option key={c.code + c.name} value={c.code}>{c.flag} {c.code}</option>
                    ))}
                  </select>
                  <input type="tel" value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="300 123 4567" />
                </div>
              </div>
              <div className="booking__field">
                <label>Correo electronico (opcional)</label>
                <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="tu@email.com" />
              </div>
              <div className="booking__field">
                <label>Notas (opcional)</label>
                <textarea value={clientNotes} onChange={e => setClientNotes(e.target.value)} placeholder="Alguna indicacion especial..." rows={3} />
              </div>

              {/* Summary */}
              <div className="booking__summary">
                <h3>Resumen de tu cita</h3>
                <div className="booking__summary-row"><span>Servicio:</span> <strong>{selectedService?.name}</strong></div>
                <div className="booking__summary-row"><span>Profesional:</span> <strong>{selectedStaff?.name}</strong></div>
                <div className="booking__summary-row"><span>Fecha:</span> <strong>{selectedDate ? `${selectedDate.getDate()} de ${MONTHS_ES[selectedDate.getMonth()]}` : ''}</strong></div>
                <div className="booking__summary-row"><span>Hora:</span> <strong>{selectedTime}</strong></div>
                <div className="booking__summary-row"><span>Precio:</span> <strong>${selectedService?.price?.toLocaleString('es-CO')} COP</strong></div>
                <p className="booking__pay-note">El pago se realiza directamente en el establecimiento.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Navigation ── */}
      <div className="booking__nav">
        {step > 1 && !confirmation && (
          <button className="booking__btn booking__btn--back" onClick={() => setStep(s => s - 1)}>
            Atras
          </button>
        )}
        {step < 4 && (
          <button className="booking__btn booking__btn--next" disabled={!canGoNext()} onClick={() => setStep(s => s + 1)}>
            Siguiente
          </button>
        )}
        {step === 4 && (
          <button className="booking__btn booking__btn--submit" disabled={!canGoNext() || submitting} onClick={handleSubmit}>
            {submitting ? 'Agendando...' : 'Confirmar cita'}
          </button>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="booking__footer">
        <span>Reservas en linea por</span>
        <a href="https://plexifystudio-projects.github.io/AlPelo-CRM/" target="_blank" rel="noopener noreferrer">Plexify Studio</a>
      </div>
    </div>
  );
}
