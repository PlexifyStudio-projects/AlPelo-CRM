import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import SEO from '../../../components/landing/common/SEO';

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

const b = 'bk'; // BEM block prefix

export default function BookingPage() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('servicios');
  const [activeCategory, setActiveCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Booking modal state
  const [bookingModal, setBookingModal] = useState(false);
  const [bookingStep, setBookingStep] = useState(1); // 1=staff, 2=date, 3=data
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

  const svcRef = useRef(null);
  const teamRef = useRef(null);

  // Fetch business data
  useEffect(() => {
    fetch(`${API}/public/book/${slug}`)
      .then(r => {
        if (!r.ok) throw new Error(r.status === 404 ? 'not_found' : r.status === 403 ? 'disabled' : 'error');
        return r.json();
      })
      .then(d => {
        setData(d);
        const cats = Object.keys(d.services || {});
        if (cats.length) setActiveCategory(null); // "Todos" by default
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [slug]);

  // Fetch availability
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

  const brand = data?.business;
  const style = brand ? {
    '--bk-primary': brand.brand_color || '#2563eb',
    '--bk-dark': brand.brand_color_dark || '#1e40af',
    '--bk-accent': brand.brand_color_accent || '#6366f1',
  } : {};

  // ── Loading ──
  if (loading) return (
    <div className={b} style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className={`${b}__spinner`} />
    </div>
  );

  // ── Errors ──
  if (error === 'not_found') return <div className={b}><div className={`${b}__error`}><h1>Negocio no encontrado</h1><p>El enlace no corresponde a ningun negocio registrado.</p></div></div>;
  if (error === 'disabled') return <div className={b}><div className={`${b}__error`}><h1>Reservas no disponibles</h1><p>Este negocio aun no tiene habilitadas las reservas en linea.</p></div></div>;
  if (error) return <div className={b}><div className={`${b}__error`}><h1>Error</h1><p>Hubo un problema. Intenta de nuevo.</p></div></div>;

  const { services = {}, staff = [], location } = data || {};
  const allServices = Object.values(services).flat();
  const categories = Object.keys(services);

  // Filter services
  let filteredServices = activeCategory ? (services[activeCategory] || []) : allServices;
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filteredServices = filteredServices.filter(s => s.name.toLowerCase().includes(q) || (s.category || '').toLowerCase().includes(q));
  }

  // Calendar days (next 30)
  const today = new Date();
  const calendarDays = Array.from({ length: 30 }, (_, i) => { const d = new Date(today); d.setDate(today.getDate() + i); return d; });

  const openBooking = (svc) => {
    setSelectedService(svc);
    setSelectedStaff(null);
    setSelectedDate(null);
    setSelectedTime(null);
    setBookingStep(1);
    setConfirmation(null);
    setClientName('');
    setClientPhone('');
    setClientEmail('');
    setClientNotes('');
    setBookingModal(true);
  };

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
      setBookingStep(4);
    } catch {
      alert('Error de conexion. Intenta de nuevo.');
    }
    setSubmitting(false);
  };

  const scrollTab = (id) => {
    setActiveTab(id);
    const el = id === 'servicios' ? svcRef.current : id === 'equipo' ? teamRef.current : null;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className={b} style={style}>
      <SEO title={`${brand?.name || 'Reservar'} — Agenda tu cita`} description={brand?.tagline || `Reserva tu cita en ${brand?.name}`} />

      {/* ═══ HERO ═══ */}
      <div className={`${b}__hero`}>
        {brand?.gallery_images?.length > 0 ? (
          <img src={brand.gallery_images[0]} alt={brand.name} className={`${b}__hero-img`} />
        ) : (
          <div className={`${b}__hero-placeholder`} />
        )}
        <div className={`${b}__hero-overlay`}>
          {brand?.gallery_images?.length > 0 && (
            <div className={`${b}__hero-tags`}>
              {categories.slice(0, 4).map(c => <span key={c} className={`${b}__hero-tag`}>{c}</span>)}
            </div>
          )}
          <h1 className={`${b}__hero-name`}>{brand?.name}</h1>
          <div className={`${b}__hero-meta`}>
            {location?.address && <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> {location.address}{location.city ? `, ${location.city}` : ''}</span>}
          </div>
        </div>
      </div>

      {/* ═══ STICKY NAV ═══ */}
      <div className={`${b}__nav`}>
        <div className={`${b}__nav-inner`}>
          <div className={`${b}__nav-left`}>
            {brand?.logo_url && <img src={brand.logo_url} alt="" className={`${b}__nav-logo`} />}
            <div>
              <strong className={`${b}__nav-name`}>{brand?.name}</strong>
              {brand?.tagline && <span className={`${b}__nav-tagline`}>{brand.tagline}</span>}
            </div>
          </div>
          <div className={`${b}__nav-tabs`}>
            {['servicios', 'equipo'].map(tab => (
              <button key={tab} className={`${b}__nav-tab ${activeTab === tab ? `${b}__nav-tab--active` : ''}`} onClick={() => scrollTab(tab)}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ ABOUT + SIDEBAR ═══ */}
      <div className={`${b}__body`}>
        <div className={`${b}__main`}>
          {brand?.booking_description && (
            <section className={`${b}__about`}>
              <h2>Sobre nosotros</h2>
              <div className={`${b}__about-tags`}>
                {categories.map(c => <span key={c} className={`${b}__tag`}>{c}</span>)}
              </div>
              <p>{brand.booking_description}</p>
            </section>
          )}

          {/* ═══ SERVICES ═══ */}
          <section className={`${b}__services`} ref={svcRef}>
            <h2>Servicios</h2>
            <div className={`${b}__search`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input placeholder="Buscar servicios..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>

            <div className={`${b}__cat-tabs`}>
              <button className={`${b}__cat-tab ${!activeCategory ? `${b}__cat-tab--active` : ''}`} onClick={() => setActiveCategory(null)}>
                Todos <span className={`${b}__cat-count`}>{allServices.length}</span>
              </button>
              {categories.map(c => (
                <button key={c} className={`${b}__cat-tab ${activeCategory === c ? `${b}__cat-tab--active` : ''}`} onClick={() => setActiveCategory(c)}>
                  {c.toUpperCase()}
                </button>
              ))}
            </div>

            <div className={`${b}__svc-grid`}>
              {filteredServices.map(svc => (
                <div key={svc.id} className={`${b}__svc-card`}>
                  <div className={`${b}__svc-info`}>
                    <div className={`${b}__svc-top`}>
                      <h3 className={`${b}__svc-name`}>{svc.name}</h3>
                      <span className={`${b}__svc-price`}>${svc.price?.toLocaleString('es-CO')}</span>
                    </div>
                    <span className={`${b}__svc-cat`}>{svc.category}</span>
                  </div>
                  <div className={`${b}__svc-bottom`}>
                    <span className={`${b}__svc-dur`}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      {svc.duration_minutes} min
                    </span>
                    <button className={`${b}__svc-book`} onClick={() => openBooking(svc)}>Reservar</button>
                  </div>
                </div>
              ))}
            </div>
            {filteredServices.length === 0 && <p className={`${b}__empty`}>No se encontraron servicios.</p>}
          </section>

          {/* ═══ TEAM ═══ */}
          <section className={`${b}__team`} ref={teamRef}>
            <h2>Colaboradores</h2>
            <div className={`${b}__team-grid`}>
              {staff.map(s => (
                <div key={s.id} className={`${b}__staff-card`}>
                  <div className={`${b}__staff-avatar`}>
                    {s.photo_url ? <img src={s.photo_url} alt={s.name} /> : <span>{s.name.charAt(0)}</span>}
                  </div>
                  <strong className={`${b}__staff-name`}>{s.name.toUpperCase()}</strong>
                  <span className={`${b}__staff-role`}>{s.specialty}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ═══ SIDEBAR ═══ */}
        <aside className={`${b}__sidebar`}>
          {location?.address && (
            <div className={`${b}__side-block`}>
              <h4><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> Direccion</h4>
              <p>{location.address}{location.city ? `, ${location.city}` : ''}</p>
            </div>
          )}
          {brand?.gallery_images?.length > 1 && (
            <div className={`${b}__side-block`}>
              <h4>Portafolio</h4>
              <div className={`${b}__side-gallery`}>
                {brand.gallery_images.slice(1, 4).map((img, i) => (
                  <img key={i} src={img} alt="" className={`${b}__side-thumb`} />
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* ═══ FOOTER ═══ */}
      <footer className={`${b}__footer`}>
        <div className={`${b}__footer-inner`}>
          <div className={`${b}__footer-brand`}>
            <strong>{brand?.name}</strong>
            {brand?.tagline && <p>{brand.tagline}</p>}
          </div>
          <div className={`${b}__footer-nav`}>
            <strong>Navegacion</strong>
            <button onClick={() => scrollTab('servicios')}>Servicios</button>
            <button onClick={() => scrollTab('equipo')}>Colaboradores</button>
          </div>
          <div className={`${b}__footer-info`}>
            <strong>Informacion</strong>
            {location?.address && <p><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> {location.address}</p>}
            {location?.phone && <p>{location.phone}</p>}
          </div>
        </div>
        <div className={`${b}__footer-bottom`}>
          <span>Powered by <a href="https://plexifystudio-projects.github.io/AlPelo-CRM/" target="_blank" rel="noopener noreferrer">Plexify Studio</a></span>
        </div>
      </footer>

      {/* ═══════════════════════════════════════════════════════
           BOOKING MODAL — Opens when clicking "Reservar"
         ═══════════════════════════════════════════════════════ */}
      {bookingModal && (
        <div className={`${b}__modal-overlay`} onClick={() => { if (!submitting) setBookingModal(false); }}>
          <div className={`${b}__modal`} onClick={e => e.stopPropagation()}>
            <button className={`${b}__modal-close`} onClick={() => setBookingModal(false)}>&times;</button>

            {/* Step indicator */}
            <div className={`${b}__modal-steps`}>
              {['Profesional', 'Fecha y Hora', 'Tus datos'].map((label, i) => (
                <div key={i} className={`${b}__ms ${bookingStep > i + 1 ? `${b}__ms--done` : ''} ${bookingStep === i + 1 ? `${b}__ms--active` : ''}`}>
                  <span className={`${b}__ms-num`}>{bookingStep > i + 1 ? '\u2713' : i + 1}</span>
                  <span className={`${b}__ms-label`}>{label}</span>
                </div>
              ))}
            </div>

            <div className={`${b}__modal-svc`}>
              <strong>{selectedService?.name}</strong>
              <span>${selectedService?.price?.toLocaleString('es-CO')} &middot; {selectedService?.duration_minutes} min</span>
            </div>

            {/* STEP 1: Staff */}
            {bookingStep === 1 && (
              <div className={`${b}__modal-body`}>
                <h3>Elige tu profesional</h3>
                <div className={`${b}__m-staff`}>
                  <button className={`${b}__m-staff-card ${selectedStaff?.id === 'any' ? `${b}__m-staff-card--sel` : ''}`} onClick={() => { if (staff.length) setSelectedStaff({ id: staff[0].id, name: 'Disponible' }); }}>
                    <div className={`${b}__m-avatar`}>?</div>
                    <span>Sin preferencia</span>
                  </button>
                  {staff.map(s => (
                    <button key={s.id} className={`${b}__m-staff-card ${selectedStaff?.id === s.id ? `${b}__m-staff-card--sel` : ''}`} onClick={() => setSelectedStaff(s)}>
                      <div className={`${b}__m-avatar`}>{s.photo_url ? <img src={s.photo_url} alt={s.name} /> : s.name.charAt(0)}</div>
                      <span>{s.name}</span>
                      <small>{s.specialty}</small>
                    </button>
                  ))}
                </div>
                <div className={`${b}__modal-nav`}>
                  <button className={`${b}__mbtn ${b}__mbtn--next`} disabled={!selectedStaff} onClick={() => setBookingStep(2)}>Siguiente</button>
                </div>
              </div>
            )}

            {/* STEP 2: Date & Time */}
            {bookingStep === 2 && (
              <div className={`${b}__modal-body`}>
                <h3>Elige fecha y hora</h3>
                <div className={`${b}__m-calendar`}>
                  {calendarDays.map((d, i) => {
                    const isSel = selectedDate && d.toDateString() === selectedDate.toDateString();
                    return (
                      <button key={i} className={`${b}__m-day ${isSel ? `${b}__m-day--sel` : ''}`} onClick={() => setSelectedDate(d)}>
                        <span className={`${b}__m-day-label`}>{DAYS_ES[d.getDay()]}</span>
                        <span className={`${b}__m-day-num`}>{d.getDate()}</span>
                        <span className={`${b}__m-day-month`}>{MONTHS_ES[d.getMonth()].slice(0, 3)}</span>
                      </button>
                    );
                  })}
                </div>
                {selectedDate && (
                  <div className={`${b}__m-times`}>
                    <h4>Horarios — {selectedDate.getDate()} de {MONTHS_ES[selectedDate.getMonth()]}</h4>
                    {slotsLoading ? <p className={`${b}__m-loading`}>Consultando disponibilidad...</p> : slots.length === 0 ? (
                      <p className={`${b}__m-empty`}>No hay horarios disponibles. Prueba otra fecha.</p>
                    ) : (
                      <div className={`${b}__m-slots`}>
                        {slots.map(t => (
                          <button key={t} className={`${b}__m-slot ${selectedTime === t ? `${b}__m-slot--sel` : ''}`} onClick={() => setSelectedTime(t)}>{t}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className={`${b}__modal-nav`}>
                  <button className={`${b}__mbtn ${b}__mbtn--back`} onClick={() => setBookingStep(1)}>Atras</button>
                  <button className={`${b}__mbtn ${b}__mbtn--next`} disabled={!selectedDate || !selectedTime} onClick={() => setBookingStep(3)}>Siguiente</button>
                </div>
              </div>
            )}

            {/* STEP 3: Client Data */}
            {bookingStep === 3 && (
              <div className={`${b}__modal-body`}>
                <h3>Tus datos</h3>
                <div className={`${b}__m-form`}>
                  <div className={`${b}__m-field`}>
                    <label>Nombre completo *</label>
                    <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Tu nombre completo" />
                  </div>
                  <div className={`${b}__m-field`}>
                    <label>Telefono *</label>
                    <div className={`${b}__m-phone`}>
                      <select value={countryCode} onChange={e => setCountryCode(e.target.value)}>
                        {COUNTRIES.map(c => <option key={c.code + c.name} value={c.code}>{c.flag} {c.code}</option>)}
                      </select>
                      <input type="tel" value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="300 123 4567" />
                    </div>
                  </div>
                  <div className={`${b}__m-field`}>
                    <label>Correo (opcional)</label>
                    <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="tu@email.com" />
                  </div>
                  <div className={`${b}__m-field`}>
                    <label>Notas (opcional)</label>
                    <textarea value={clientNotes} onChange={e => setClientNotes(e.target.value)} placeholder="Alguna indicacion especial..." rows={2} />
                  </div>
                </div>
                <div className={`${b}__m-summary`}>
                  <div><span>Servicio:</span> <strong>{selectedService?.name}</strong></div>
                  <div><span>Profesional:</span> <strong>{selectedStaff?.name}</strong></div>
                  <div><span>Fecha:</span> <strong>{selectedDate ? `${selectedDate.getDate()} de ${MONTHS_ES[selectedDate.getMonth()]}` : ''}</strong></div>
                  <div><span>Hora:</span> <strong>{selectedTime}</strong></div>
                  <div><span>Precio:</span> <strong>${selectedService?.price?.toLocaleString('es-CO')} COP</strong></div>
                </div>
                <p className={`${b}__m-pay`}>El pago se realiza directamente en el establecimiento.</p>
                <div className={`${b}__modal-nav`}>
                  <button className={`${b}__mbtn ${b}__mbtn--back`} onClick={() => setBookingStep(2)}>Atras</button>
                  <button className={`${b}__mbtn ${b}__mbtn--submit`} disabled={clientName.trim().length < 2 || clientPhone.trim().length < 7 || submitting} onClick={handleSubmit}>
                    {submitting ? 'Agendando...' : 'Confirmar cita'}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: Confirmation */}
            {bookingStep === 4 && confirmation && (
              <div className={`${b}__modal-body ${b}__modal-body--center`}>
                <div className={`${b}__m-check`}>&#10003;</div>
                <h3>Cita agendada</h3>
                <p className={`${b}__m-conf-sub`}>Te esperamos!</p>
                <div className={`${b}__m-summary`}>
                  <div><span>Servicio:</span> <strong>{confirmation.service}</strong></div>
                  <div><span>Profesional:</span> <strong>{confirmation.staff}</strong></div>
                  <div><span>Fecha:</span> <strong>{confirmation.date}</strong></div>
                  <div><span>Hora:</span> <strong>{confirmation.time}</strong></div>
                  <div><span>Precio:</span> <strong>${confirmation.price?.toLocaleString('es-CO')} COP</strong></div>
                </div>
                <p className={`${b}__m-wa`}>Te enviaremos confirmacion por WhatsApp.</p>
                <div className={`${b}__modal-nav`}>
                  <button className={`${b}__mbtn ${b}__mbtn--next`} onClick={() => setBookingModal(false)}>Cerrar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
