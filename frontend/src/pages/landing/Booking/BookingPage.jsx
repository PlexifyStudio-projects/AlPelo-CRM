import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import SEO from '../../../components/landing/common/SEO';

const API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const b = 'booking-page';

const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const COUNTRIES = [
  { name: 'Colombia', code: '+57', flag: '\u{1F1E8}\u{1F1F4}' },
  { name: 'Mexico', code: '+52', flag: '\u{1F1F2}\u{1F1FD}' },
  { name: 'Venezuela', code: '+58', flag: '\u{1F1FB}\u{1F1EA}' },
  { name: 'Ecuador', code: '+593', flag: '\u{1F1EA}\u{1F1E8}' },
  { name: 'Peru', code: '+51', flag: '\u{1F1F5}\u{1F1EA}' },
  { name: 'Estados Unidos', code: '+1', flag: '\u{1F1FA}\u{1F1F8}' },
];

// ── AlPelo static data (reference implementation) ───────────────────────
const ALPELO = {
  name: 'ALPELO PELUQUERIA',
  tagline: 'Descubre la excelencia en AlPelo!',
  description: 'Nuestra peluqueria en Bucaramanga cuenta con expertos en peluqueria, manicure y barberia. Experimenta un servicio al cliente incomparable y la atencion de profesionales altamente capacitados en cada especialidad. Te invitamos a vivir la mejor experiencia de belleza en AlPelo!',
  cover: 'https://s3.weibook.co/alpelo_peluqueria/portadas/1713022286667.jpeg',
  address: 'Carrera 31 N 50-21, Bucaramanga',
  phone: '317 660 8487',
  hours: 'Lun-Sab 8:15am - 8:00pm | Dom 9:30am - 2:00pm',
  hoursToday: '8:15 - 20:00',
  tags: ['Barberia', 'Salon de belleza', 'Nail', 'Spa'],
  instagram: 'https://www.instagram.com/alpelopeluqueria.co',
  facebook: 'https://www.facebook.com/SomosAlpelo/',
  gallery: [
    'https://s3.weibook.co/alpelo_peluqueria/portadas/1713022286667.jpeg',
    'https://s3.weibook.co/alpelo_peluqueria/services/CORTE%20HIPSTER.png',
    'https://s3.weibook.co/alpelo_peluqueria/services/mani%20semi.jpeg',
    'https://s3.weibook.co/alpelo_peluqueria/services/corte%20y%20barba.png',
  ],
  payment: ['Nequi', 'Bancolombia', 'Davivienda', 'Efectivo'],
};

const ALPELO_STAFF = [
  { id: 1, name: 'Alexander Carballo', role: 'Barbero', rating: 4.9, photo: 'https://s3.weibook.co/alpelo_peluqueria/collaborators/c34facf4-5716-40ec-a139-bc3c0233e72e.webp' },
  { id: 2, name: 'Victor Fernandez', role: 'Barbero', rating: 4.8, photo: 'https://s3.weibook.co/alpelo_peluqueria/collaborators/c550d3ed-9cd5-4a88-86c2-563c8d5d5f75.webp' },
  { id: 3, name: 'Anderson Bohorquez', role: 'Barbero', rating: 4.5, photo: 'https://s3.weibook.co/alpelo_peluqueria/collaborators/465d86c3-530c-4bfc-81f6-f6704a76a2dc.webp' },
  { id: 4, name: 'Yhon Estrada', role: 'Barbero', rating: 5.0, photo: 'https://s3.weibook.co/alpelo_peluqueria/collaborators/7bdf5545-b7ab-4b98-bfaf-4b1579be83c1.webp' },
  { id: 5, name: 'Daniel Nunez', role: 'Barbero', rating: 4.7, photo: 'https://s3.weibook.co/alpelo_peluqueria/collaborators/2ee51b69-6e11-40b2-9d81-66941a6a1baf.webp' },
  { id: 6, name: 'Angel Pabon', role: 'Barbero', rating: 4.8, photo: 'https://s3.weibook.co/alpelo_peluqueria/collaborators/4618975a-6401-4000-ae8d-4a0474e59608.webp' },
  { id: 7, name: 'Maria Jose Bastos', role: 'Manicurista', rating: 5.0, photo: 'https://s3.weibook.co/alpelo_peluqueria/collaborators/eb5b2f5e-cf13-49a2-a653-f312974c748a.webp' },
  { id: 8, name: 'Stefania Bustamante', role: 'Manicurista', rating: 4.5, photo: 'https://s3.weibook.co/alpelo_peluqueria/collaborators/29a9c36b-dcde-4328-a8f7-1239b3c65c75.webp' },
  { id: 9, name: 'Josemith', role: 'Estilista', rating: 5.0, photo: 'https://s3.weibook.co/alpelo_peluqueria/collaborators/5aac79e5-7abd-4044-917b-8966e672fae3.webp' },
  { id: 10, name: 'Liliana Romero', role: 'Estilista', rating: 4.6, photo: 'https://s3.weibook.co/alpelo_peluqueria/collaborators/68062947-a86f-49a2-b1fb-15f3a659607b.webp' },
  { id: 11, name: 'Marcela Leal', role: 'Tricoterapia', rating: 4.7, photo: 'https://s3.weibook.co/alpelo_peluqueria/collaborators/822b9e68-7138-4be8-a085-aa620830b02b.webp' },
];

export default function BookingPage() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('servicios');
  const [activeCategory, setActiveCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Booking modal
  const [modal, setModal] = useState(false);
  const [step, setStep] = useState(1);
  const [selService, setSelService] = useState(null);
  const [selStaff, setSelStaff] = useState(null);
  const [selDate, setSelDate] = useState(null);
  const [selTime, setSelTime] = useState(null);
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [cc, setCc] = useState('+57');
  const [submitting, setSubmitting] = useState(false);
  const [conf, setConf] = useState(null);

  const svcRef = useRef(null);
  const teamRef = useRef(null);

  useEffect(() => {
    fetch(`${API}/public/book/${slug}`)
      .then(r => { if (!r.ok) throw new Error(r.status === 404 ? 'not_found' : r.status === 403 ? 'disabled' : 'error'); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [slug]);

  useEffect(() => {
    if (!selDate || !selStaff || !selService) return;
    setSlotsLoading(true); setSelTime(null);
    const ds = selDate.toISOString().split('T')[0];
    fetch(`${API}/public/book/${slug}/availability?date=${ds}&staff_id=${selStaff.id}&service_id=${selService.id}`)
      .then(r => r.json()).then(d => { setSlots(d.slots || []); setSlotsLoading(false); })
      .catch(() => { setSlots([]); setSlotsLoading(false); });
  }, [selDate, selStaff, selService, slug]);

  if (loading) return <div className={b}><div className={`${b}__loading`}><div className={`${b}__spin`} /></div></div>;
  if (error === 'not_found') return <div className={b}><div className={`${b}__err`}><h1>Negocio no encontrado</h1><p>El enlace no corresponde a ningun negocio.</p></div></div>;
  if (error === 'disabled') return <div className={b}><div className={`${b}__err`}><h1>Reservas no disponibles</h1><p>Este negocio no tiene reservas en linea.</p></div></div>;
  if (error) return <div className={b}><div className={`${b}__err`}><h1>Error</h1><p>Intenta de nuevo.</p></div></div>;

  const { services = {}, staff: apiStaff = [] } = data || {};
  const allSvc = Object.values(services).flat();
  const cats = Object.keys(services);
  const staffList = ALPELO_STAFF; // Use static data with real photos
  let filtered = activeCategory ? (services[activeCategory] || []) : allSvc;
  if (searchQuery.trim()) { const q = searchQuery.toLowerCase(); filtered = filtered.filter(s => s.name.toLowerCase().includes(q)); }

  const days = Array.from({ length: 30 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; });

  const openBooking = (svc) => {
    setSelService(svc); setSelStaff(null); setSelDate(null); setSelTime(null);
    setStep(1); setConf(null); setName(''); setPhone(''); setEmail(''); setNotes('');
    setModal(true);
  };

  const doSubmit = async () => {
    if (!name.trim() || !phone.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/public/book/${slug}/appointment`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: selService.id, staff_id: selStaff.id, date: selDate.toISOString().split('T')[0], time: selTime, client_name: name.trim(), client_phone: cc + phone.trim().replace(/\s/g, ''), client_email: email.trim() || null, notes: notes.trim() || null }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.detail || 'Error. Intenta de nuevo.'); setSubmitting(false); return; }
      const r = await res.json();
      setConf(r.appointment); setStep(4);
    } catch { alert('Error de conexion.'); }
    setSubmitting(false);
  };

  const scrollTo = (id) => { setActiveTab(id); const el = id === 'servicios' ? svcRef.current : teamRef.current; el?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  return (
    <div className={b}>
      <SEO title={`${ALPELO.name} — Agenda tu cita`} description={ALPELO.tagline} />

      {/* ══════ HERO ══════ */}
      <section className={`${b}__hero`}>
        <img src={ALPELO.cover} alt={ALPELO.name} className={`${b}__hero-bg`} />
        <div className={`${b}__hero-content`}>
          <div className={`${b}__hero-tags`}>
            {ALPELO.tags.map(t => <span key={t} className={`${b}__htag`}>{t}</span>)}
          </div>
          <h1 className={`${b}__hero-title`}>{ALPELO.name}</h1>
          <div className={`${b}__hero-info`}>
            <span className={`${b}__hero-rating`}><svg width="16" height="16" viewBox="0 0 24 24" fill="#FBBF24" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2z"/></svg> 5.0</span>
            <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> {ALPELO.address}</span>
            <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Abierto hoy {ALPELO.hoursToday}</span>
          </div>
        </div>
      </section>

      {/* ══════ STICKY NAV ══════ */}
      <nav className={`${b}__nav`}>
        <div className={`${b}__nav-wrap`}>
          <div className={`${b}__nav-brand`}>
            <strong>{ALPELO.name}</strong>
            <div className={`${b}__nav-meta`}>
              <span><svg width="12" height="12" viewBox="0 0 24 24" fill="#FBBF24" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2z"/></svg> 5.0</span>
              <span>{ALPELO.address}</span>
              <span>Abierto hoy {ALPELO.hoursToday}</span>
            </div>
          </div>
          <div className={`${b}__nav-right`}>
            <div className={`${b}__nav-tags`}>{ALPELO.tags.map(t => <span key={t}>{t}</span>)}</div>
          </div>
        </div>
        <div className={`${b}__nav-tabs`}>
          <div className={`${b}__nav-wrap`}>
            {['servicios', 'equipo'].map(tab => (
              <button key={tab} className={`${b}__tab ${activeTab === tab ? `${b}__tab--on` : ''}`} onClick={() => scrollTo(tab)}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
            ))}
          </div>
        </div>
      </nav>

      {/* ══════ ABOUT + SIDEBAR ══════ */}
      <div className={`${b}__layout`}>
        <main className={`${b}__main`}>
          <section className={`${b}__about`}>
            <h2>Sobre nosotros</h2>
            <div className={`${b}__about-tags`}>{ALPELO.tags.map(t => <span key={t}>{t}</span>)}</div>
            <p>{ALPELO.description}</p>
          </section>

          {/* ══════ SERVICES ══════ */}
          <section className={`${b}__services`} ref={svcRef} id="servicios">
            <h2>Servicios</h2>
            <div className={`${b}__search`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input placeholder="Buscar servicios..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <div className={`${b}__cats`}>
              <button className={`${b}__cat ${!activeCategory ? `${b}__cat--on` : ''}`} onClick={() => setActiveCategory(null)}>Todos los servicios <span>{allSvc.length}</span></button>
              {cats.map(c => <button key={c} className={`${b}__cat ${activeCategory === c ? `${b}__cat--on` : ''}`} onClick={() => setActiveCategory(c)}>{c.toUpperCase()}</button>)}
            </div>
            <div className={`${b}__svc-list`}>
              {filtered.map(svc => (
                <div key={svc.id} className={`${b}__svc`}>
                  <div className={`${b}__svc-body`}>
                    <h3>{svc.name}</h3>
                    <span className={`${b}__svc-cat`}>{svc.category}</span>
                  </div>
                  <div className={`${b}__svc-right`}>
                    <span className={`${b}__svc-price`}>${svc.price?.toLocaleString('es-CO')}</span>
                  </div>
                  <div className={`${b}__svc-foot`}>
                    <span className={`${b}__svc-dur`}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> {svc.duration_minutes} min</span>
                    <button className={`${b}__svc-btn`} onClick={() => openBooking(svc)}>Reservar</button>
                  </div>
                </div>
              ))}
            </div>
            {filtered.length === 0 && <p className={`${b}__empty`}>No se encontraron servicios.</p>}
          </section>

          {/* ══════ TEAM ══════ */}
          <section className={`${b}__team`} ref={teamRef} id="equipo">
            <h2>Colaboradores</h2>
            <div className={`${b}__team-scroll`}>
              {staffList.map(s => (
                <div key={s.id} className={`${b}__person`}>
                  <div className={`${b}__person-photo`}><img src={s.photo} alt={s.name} /></div>
                  <strong>{s.name.toUpperCase()}</strong>
                  <span className={`${b}__person-role`}>{s.role}</span>
                  <span className={`${b}__person-stars`}><svg width="14" height="14" viewBox="0 0 24 24" fill="#F59E0B" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2z"/></svg> {s.rating}</span>
                </div>
              ))}
            </div>
          </section>
        </main>

        {/* ══════ SIDEBAR ══════ */}
        <aside className={`${b}__side`}>
          <div className={`${b}__side-card`}>
            <h4><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> Direccion</h4>
            <p>{ALPELO.address}</p>
            <a href={`https://maps.google.com/?q=${encodeURIComponent(ALPELO.address)}`} target="_blank" rel="noopener noreferrer" className={`${b}__side-link`}>Ver direccion</a>
          </div>
          <div className={`${b}__side-card`}>
            <h4>Portafolio</h4>
            <div className={`${b}__side-photos`}>
              {ALPELO.gallery.slice(0, 3).map((img, i) => <img key={i} src={img} alt="" />)}
            </div>
          </div>
          <div className={`${b}__side-card`}>
            <h4><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Horario hoy</h4>
            <p>{ALPELO.hoursToday}</p>
          </div>
        </aside>
      </div>

      {/* ══════ FOOTER ══════ */}
      <footer className={`${b}__footer`}>
        <div className={`${b}__footer-grid`}>
          <div>
            <strong className={`${b}__footer-name`}>{ALPELO.name}</strong>
            <p className={`${b}__footer-desc`}>{ALPELO.tagline} {ALPELO.description.slice(0, 150)}...</p>
            <div className={`${b}__footer-social`}>
              <a href={ALPELO.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg></a>
              <a href={ALPELO.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></a>
            </div>
          </div>
          <div>
            <strong>Navegacion</strong>
            <button onClick={() => scrollTo('servicios')}>Servicios</button>
            <button onClick={() => scrollTo('equipo')}>Colaboradores</button>
          </div>
          <div>
            <strong>Mas informacion</strong>
            <p><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> {ALPELO.address}</p>
            <p><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> {ALPELO.hours}</p>
            <p><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg> {ALPELO.phone}</p>
          </div>
        </div>
        <div className={`${b}__footer-bottom`}>
          <span>Powered by <a href="https://plexifystudio-projects.github.io/AlPelo-CRM/" target="_blank" rel="noopener noreferrer">Plexify Studio</a></span>
        </div>
      </footer>

      {/* ══════════════════════════════════════════
           BOOKING MODAL
         ══════════════════════════════════════════ */}
      {modal && (
        <div className={`${b}__overlay`} onClick={() => !submitting && setModal(false)}>
          <div className={`${b}__modal`} onClick={e => e.stopPropagation()}>
            <button className={`${b}__modal-x`} onClick={() => setModal(false)}>&times;</button>
            <div className={`${b}__modal-head`}>
              <div className={`${b}__modal-steps`}>
                {['Profesional', 'Fecha y Hora', 'Tus datos'].map((l, i) => (
                  <div key={i} className={`${b}__ms ${step > i + 1 ? `${b}__ms--done` : ''} ${step === i + 1 ? `${b}__ms--on` : ''}`}>
                    <span className={`${b}__ms-n`}>{step > i + 1 ? '\u2713' : i + 1}</span>
                    <span className={`${b}__ms-l`}>{l}</span>
                  </div>
                ))}
              </div>
              <div className={`${b}__modal-svc`}><strong>{selService?.name}</strong><span>${selService?.price?.toLocaleString('es-CO')} &middot; {selService?.duration_minutes} min</span></div>
            </div>

            {step === 1 && (<div className={`${b}__modal-body`}>
              <h3>Elige tu profesional</h3>
              <div className={`${b}__mp-grid`}>
                {apiStaff.map(s => (
                  <button key={s.id} className={`${b}__mp ${selStaff?.id === s.id ? `${b}__mp--on` : ''}`} onClick={() => setSelStaff(s)}>
                    <div className={`${b}__mp-av`}>{s.name.charAt(0)}</div>
                    <span>{s.name}</span><small>{s.specialty}</small>
                  </button>
                ))}
              </div>
              <div className={`${b}__modal-nav`}><button className={`${b}__mbtn ${b}__mbtn--go`} disabled={!selStaff} onClick={() => setStep(2)}>Siguiente</button></div>
            </div>)}

            {step === 2 && (<div className={`${b}__modal-body`}>
              <h3>Elige fecha y hora</h3>
              <div className={`${b}__mcal`}>{days.map((d, i) => {
                const on = selDate && d.toDateString() === selDate.toDateString();
                return <button key={i} className={`${b}__mday ${on ? `${b}__mday--on` : ''}`} onClick={() => setSelDate(d)}><span>{DAYS_ES[d.getDay()]}</span><strong>{d.getDate()}</strong><span>{MONTHS_ES[d.getMonth()].slice(0,3)}</span></button>;
              })}</div>
              {selDate && (<div className={`${b}__mtime`}>
                <h4>Horarios — {selDate.getDate()} de {MONTHS_ES[selDate.getMonth()]}</h4>
                {slotsLoading ? <p className={`${b}__mwait`}>Consultando...</p> : slots.length === 0 ? <p className={`${b}__mwait`}>No hay horarios. Prueba otra fecha.</p> : (
                  <div className={`${b}__mslots`}>{slots.map(t => <button key={t} className={`${b}__mslot ${selTime === t ? `${b}__mslot--on` : ''}`} onClick={() => setSelTime(t)}>{t}</button>)}</div>
                )}
              </div>)}
              <div className={`${b}__modal-nav`}><button className={`${b}__mbtn ${b}__mbtn--back`} onClick={() => setStep(1)}>Atras</button><button className={`${b}__mbtn ${b}__mbtn--go`} disabled={!selDate || !selTime} onClick={() => setStep(3)}>Siguiente</button></div>
            </div>)}

            {step === 3 && (<div className={`${b}__modal-body`}>
              <h3>Tus datos</h3>
              <div className={`${b}__mform`}>
                <div className={`${b}__mf`}><label>Nombre completo *</label><input value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre" /></div>
                <div className={`${b}__mf`}><label>Telefono *</label><div className={`${b}__mph`}><select value={cc} onChange={e => setCc(e.target.value)}>{COUNTRIES.map(c => <option key={c.code+c.name} value={c.code}>{c.flag} {c.code}</option>)}</select><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="300 123 4567" /></div></div>
                <div className={`${b}__mf`}><label>Correo (opcional)</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" /></div>
                <div className={`${b}__mf`}><label>Notas (opcional)</label><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Indicaciones..." rows={2} /></div>
              </div>
              <div className={`${b}__msum`}>
                <div><span>Servicio</span><strong>{selService?.name}</strong></div>
                <div><span>Profesional</span><strong>{selStaff?.name}</strong></div>
                <div><span>Fecha</span><strong>{selDate ? `${selDate.getDate()} ${MONTHS_ES[selDate.getMonth()]}` : ''}</strong></div>
                <div><span>Hora</span><strong>{selTime}</strong></div>
                <div><span>Precio</span><strong>${selService?.price?.toLocaleString('es-CO')}</strong></div>
              </div>
              <p className={`${b}__mpay`}>El pago se realiza en el establecimiento.</p>
              <div className={`${b}__modal-nav`}><button className={`${b}__mbtn ${b}__mbtn--back`} onClick={() => setStep(2)}>Atras</button><button className={`${b}__mbtn ${b}__mbtn--go`} disabled={name.trim().length < 2 || phone.trim().length < 7 || submitting} onClick={doSubmit}>{submitting ? 'Agendando...' : 'Confirmar cita'}</button></div>
            </div>)}

            {step === 4 && conf && (<div className={`${b}__modal-body`} style={{textAlign:'center'}}>
              <div className={`${b}__mok`}>&#10003;</div>
              <h3>Cita agendada</h3>
              <p style={{color:'#64748b',margin:'0 0 16px'}}>Te esperamos!</p>
              <div className={`${b}__msum`}>
                <div><span>Servicio</span><strong>{conf.service}</strong></div>
                <div><span>Profesional</span><strong>{conf.staff}</strong></div>
                <div><span>Fecha</span><strong>{conf.date}</strong></div>
                <div><span>Hora</span><strong>{conf.time}</strong></div>
                <div><span>Precio</span><strong>${conf.price?.toLocaleString('es-CO')}</strong></div>
              </div>
              <p style={{color:'#10b981',fontWeight:600,fontSize:'0.85rem',margin:'12px 0'}}>Te enviaremos confirmacion por WhatsApp.</p>
              <div className={`${b}__modal-nav`}><button className={`${b}__mbtn ${b}__mbtn--go`} onClick={() => setModal(false)}>Cerrar</button></div>
            </div>)}
          </div>
        </div>
      )}
    </div>
  );
}
