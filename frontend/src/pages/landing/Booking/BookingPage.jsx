import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import SEO from '../../../components/landing/common/SEO';

const API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const b = 'booking-page';

const DAYS_FULL = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
const DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const COUNTRIES = [
  { name: 'Colombia', code: '+57', flag: '\u{1F1E8}\u{1F1F4}' },
  { name: 'Mexico', code: '+52', flag: '\u{1F1F2}\u{1F1FD}' },
  { name: 'Venezuela', code: '+58', flag: '\u{1F1FB}\u{1F1EA}' },
  { name: 'Ecuador', code: '+593', flag: '\u{1F1EA}\u{1F1E8}' },
  { name: 'Peru', code: '+51', flag: '\u{1F1F5}\u{1F1EA}' },
  { name: 'USA', code: '+1', flag: '\u{1F1FA}\u{1F1F8}' },
];

const SVC_PER_PAGE = 8;
const PLEXIFY_LOGO = 'https://plexifystudio.com/assets/logo-BgzeKFL7.webp';

// ── SVG Icons ──
const IconStar = ({ size = 14, filled = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? '#f59e0b' : 'none'} stroke={filled ? 'none' : '#d1d5db'} strokeWidth="2">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2z" />
  </svg>
);
const IconClock = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
const IconPin = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>;
const IconPhone = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg>;
const IconWhatsApp = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>;
const IconInstagram = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>;
const IconFacebook = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>;
const IconArrow = ({ dir = 'right' }) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ transform: dir === 'left' ? 'rotate(180deg)' : 'none' }}><polyline points="9 18 15 12 9 6" /></svg>;
const IconClose = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
const IconGoogle = () => <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>;
const IconCalendar = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
const IconSearch = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
const IconMail = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="4" width="20" height="16" rx="2" /><polyline points="22,7 12,13 2,7" /></svg>;

const Stars = ({ rating, size = 14 }) => (
  <span className={`${b}__stars`}>
    {[1, 2, 3, 4, 5].map(i => <IconStar key={i} size={size} filled={i <= Math.round(rating)} />)}
  </span>
);

function useReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

function Section({ children, className = '', delay = 0 }) {
  const [ref, visible] = useReveal();
  return (
    <section ref={ref} className={`${b}__section ${className} ${visible ? `${b}__section--visible` : ''}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </section>
  );
}

// ── Horizontal scroll helper ──
function useHScroll(itemsCount, visibleCount) {
  const ref = useRef(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(itemsCount > visibleCount);
  const check = () => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 10);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };
  useEffect(() => { check(); }, [itemsCount]);
  const scroll = (dir) => {
    const el = ref.current;
    if (!el) return;
    const cardW = el.firstElementChild?.offsetWidth || 200;
    el.scrollBy({ left: dir * cardW * visibleCount, behavior: 'smooth' });
    setTimeout(check, 400);
  };
  return { ref, canLeft, canRight, scroll, check };
}

export default function BookingPage() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCat, setActiveCat] = useState(null);
  const [svcPage, setSvcPage] = useState(0);
  const [svcSearch, setSvcSearch] = useState('');
  const [lightbox, setLightbox] = useState(null);

  // Gallery carousel
  const [galIdx, setGalIdx] = useState(0);

  // Modal state
  const [modal, setModal] = useState(false);
  const [step, setStep] = useState(1);
  const [selSvc, setSelSvc] = useState(null);
  const [selStaff, setSelStaff] = useState(null);
  const [selDate, setSelDate] = useState(null);
  const [selTime, setSelTime] = useState(null);
  const [slots, setSlots] = useState([]);
  const [slotsLoad, setSlotsLoad] = useState(false);
  const [cName, setCName] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cNotes, setCNotes] = useState('');
  const [cc, setCc] = useState('+57');
  const [submitting, setSubmitting] = useState(false);
  const [conf, setConf] = useState(null);

  // Team horizontal scroll — initialized with 0, recalculated after data loads
  const teamScroll = useHScroll(data?.staff?.length || 0, 6);

  useEffect(() => {
    fetch(`${API}/public/book/${slug}`)
      .then(r => { if (!r.ok) throw new Error(r.status === 404 ? 'not_found' : r.status === 403 ? 'disabled' : 'error'); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [slug]);

  useEffect(() => {
    if (!selDate || !selStaff || !selSvc) return;
    setSlotsLoad(true); setSelTime(null);
    fetch(`${API}/public/book/${slug}/availability?date=${selDate.toISOString().split('T')[0]}&staff_id=${selStaff.id}&service_id=${selSvc.id}`)
      .then(r => r.json()).then(d => { setSlots(d.slots || []); setSlotsLoad(false); })
      .catch(() => { setSlots([]); setSlotsLoad(false); });
  }, [selDate, selStaff, selSvc, slug]);

  useEffect(() => {
    document.body.style.overflow = (modal || lightbox !== null) ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [modal, lightbox]);

  // Derived data from API
  const biz = data?.business || {};
  const schedule = data?.schedule || [];
  const reviewsData = data?.reviews || {};
  const reviewItems = reviewsData.items || [];
  const gallery = biz.gallery_images || [];
  const tags = biz.tags || [];
  const { services: svcData = {}, staff: apiStaff = [] } = data || {};

  // Auto-advance gallery carousel
  useEffect(() => {
    if (gallery.length === 0) return;
    const t = setInterval(() => setGalIdx(i => (i + 1) % gallery.length), 4000);
    return () => clearInterval(t);
  }, [gallery.length]);

  if (loading) return <div className={b}><div className={`${b}__loading`}><div className={`${b}__loading-pulse`} /><span>Cargando...</span></div></div>;
  if (error) return <div className={b}><div className={`${b}__error`}><div className={`${b}__error-icon`}>!</div><h1>{error === 'not_found' ? 'Negocio no encontrado' : error === 'disabled' ? 'Reservas no disponibles' : 'Error'}</h1><p>Verifica el enlace e intenta de nuevo.</p></div></div>;

  const allSvc = Object.values(svcData).flat();
  const cats = Object.keys(svcData);
  let filtered = activeCat ? (svcData[activeCat] || []) : allSvc;
  if (svcSearch.trim()) {
    const q = svcSearch.toLowerCase().trim();
    filtered = filtered.filter(s => s.name.toLowerCase().includes(q) || s.category?.toLowerCase().includes(q));
  }
  const totalPages = Math.ceil(filtered.length / SVC_PER_PAGE);
  const pagedSvc = filtered.slice(svcPage * SVC_PER_PAGE, (svcPage + 1) * SVC_PER_PAGE);
  const days30 = Array.from({ length: 30 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; });
  const todayName = DAYS_FULL[new Date().getDay()];
  const todayHours = schedule.find(s => s.day === todayName)?.hours || '';

  const openBooking = (svc) => {
    setSelSvc(svc); setSelStaff(null); setSelDate(null); setSelTime(null);
    setStep(1); setConf(null); setCName(''); setCPhone(''); setCEmail(''); setCNotes('');
    setModal(true);
  };

  const doSubmit = async () => {
    if (!cName.trim() || !cPhone.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/public/book/${slug}/appointment`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: selSvc.id, staff_id: selStaff.id, date: selDate.toISOString().split('T')[0], time: selTime, client_name: cName.trim(), client_phone: cc + cPhone.trim().replace(/\s/g, ''), client_email: cEmail.trim() || null, notes: cNotes.trim() || null }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.detail || 'Horario no disponible. Intenta otro.'); setSubmitting(false); return; }
      setConf((await res.json()).appointment); setStep(4);
    } catch { alert('Error de conexion.'); }
    setSubmitting(false);
  };

  return (
    <div className={b}>
      <SEO title={`${biz.name || 'Reservas'} — Agenda tu cita online`} description={biz.tagline || ''} />
      <div className={`${b}__ambient`}>
        <div className={`${b}__ambient-blob ${b}__ambient-blob--1`} />
        <div className={`${b}__ambient-blob ${b}__ambient-blob--2`} />
        <div className={`${b}__ambient-blob ${b}__ambient-blob--3`} />
      </div>

      {/* ═══ 1. HERO ═══ */}
      <section className={`${b}__hero`}>
        {(biz.cover_url || biz.logo_url) && <img src={biz.cover_url || biz.logo_url} alt={biz.name} className={`${b}__hero-img`} loading="eager" />}
        <div className={`${b}__hero-overlay`} />
        <div className={`${b}__hero-content`}>
          {reviewsData.rating && <div className={`${b}__hero-rating`}><Stars rating={reviewsData.rating} size={16} /><span>{reviewsData.rating}</span><span className={`${b}__hero-review-count`}>({reviewsData.total_reviews} opiniones)</span></div>}
          <h1 className={`${b}__hero-title`}>{biz.name}</h1>
          {biz.tagline && <p className={`${b}__hero-tagline`}>{biz.tagline}</p>}
          {tags.length > 0 && <div className={`${b}__hero-tags`}>{tags.map(t => <span key={t} className={`${b}__tag`}>{t}</span>)}</div>}
          <div className={`${b}__hero-meta`}>
            {todayHours && <div className={`${b}__hero-meta-item`}><IconClock /><span>Abierto hoy {todayHours}</span></div>}
            {biz.address && <div className={`${b}__hero-meta-item`}><IconPin /><span>{biz.address.split(',')[0]}</span></div>}
          </div>
          <button className={`${b}__hero-cta`} onClick={() => document.getElementById('bp-services')?.scrollIntoView({ behavior: 'smooth' })}><IconCalendar /> Reservar ahora</button>
        </div>
      </section>

      <div className={`${b}__body`}>
        {/* ═══ 2+3. ABOUT + LOCATION (merged row) ═══ */}
        <Section>
          <div className={`${b}__intro`}>
            <div className={`${b}__intro-main`}>
              {biz.description && <p className={`${b}__intro-text`}>{biz.description}</p>}
              <div className={`${b}__intro-stats`}>
                <div className={`${b}__intro-stat`}><strong>{apiStaff.length}</strong><span>Profesionales</span></div>
                <div className={`${b}__intro-stat`}><strong>{allSvc.length}+</strong><span>Servicios</span></div>
                {reviewsData.rating && <div className={`${b}__intro-stat`}><strong>{reviewsData.rating}</strong><span>Rating</span></div>}
              </div>
            </div>
            {biz.address && (
              <div className={`${b}__intro-location`}>
                <div className={`${b}__intro-loc-icon`}><IconPin /></div>
                <strong>{biz.address}</strong>
                <div className={`${b}__intro-loc-links`}>
                  <a href={`https://maps.google.com/?q=${encodeURIComponent(biz.address)}`} target="_blank" rel="noopener noreferrer" className={`${b}__location-link`}>Google Maps <IconArrow /></a>
                  {biz.whatsapp && <a href={`https://wa.me/${biz.whatsapp}`} target="_blank" rel="noopener noreferrer" className={`${b}__location-wa`}><IconWhatsApp /> WhatsApp</a>}
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* ═══ 4. PORTAFOLIO CAROUSEL ═══ */}
        {gallery.length > 0 && (
        <Section delay={100}>
          <h2 className={`${b}__title`}><span className={`${b}__title-accent`} />Portafolio</h2>
          <div className={`${b}__carousel`}>
            <button className={`${b}__carousel-btn ${b}__carousel-btn--prev`} onClick={() => setGalIdx(i => (i - 1 + gallery.length) % gallery.length)}><IconArrow dir="left" /></button>
            <div className={`${b}__carousel-track`}>
              <div className={`${b}__carousel-slides`} style={{ transform: `translateX(-${galIdx * 100}%)` }}>
                {gallery.map((img, i) => (
                  <div key={i} className={`${b}__carousel-slide`} onClick={() => setLightbox(i)}>
                    <img src={img} alt={`${biz.name} ${i + 1}`} loading="lazy" />
                  </div>
                ))}
              </div>
            </div>
            <button className={`${b}__carousel-btn ${b}__carousel-btn--next`} onClick={() => setGalIdx(i => (i + 1) % gallery.length)}><IconArrow /></button>
          </div>
          <div className={`${b}__carousel-dots`}>
            {gallery.map((_, i) => (
              <button key={i} className={`${b}__carousel-dot ${i === galIdx ? `${b}__carousel-dot--on` : ''}`} onClick={() => setGalIdx(i)} />
            ))}
          </div>
        </Section>
        )}

        {/* ═══ 5. SERVICIOS (4 cols, search) ═══ */}
        <Section delay={100} className={`${b}__section--services`}>
          <div id="bp-services">
            <h2 className={`${b}__title`}><span className={`${b}__title-accent`} />Servicios</h2>
          </div>
          <div className={`${b}__svc-search`}>
            <IconSearch />
            <input placeholder="Buscar servicio..." value={svcSearch} onChange={e => { setSvcSearch(e.target.value); setSvcPage(0); }} />
          </div>
          <div className={`${b}__cats`}>
            <button className={`${b}__cat ${!activeCat ? `${b}__cat--active` : ''}`} onClick={() => { setActiveCat(null); setSvcPage(0); }}>
              Todos <span className={`${b}__cat-badge`}>{allSvc.length}</span>
            </button>
            {cats.map(c => (
              <button key={c} className={`${b}__cat ${activeCat === c ? `${b}__cat--active` : ''}`} onClick={() => { setActiveCat(c); setSvcPage(0); }}>
                {c} <span className={`${b}__cat-badge`}>{(svcData[c] || []).length}</span>
              </button>
            ))}
          </div>
          <div className={`${b}__svc-grid`}>
            {pagedSvc.map((svc, i) => (
              <div key={svc.id} className={`${b}__svc`} style={{ animationDelay: `${i * 50}ms` }}>
                <div className={`${b}__svc-header`}>
                  <div><h3 className={`${b}__svc-name`}>{svc.name}</h3><span className={`${b}__svc-cat-label`}>{svc.category}</span></div>
                  <div className={`${b}__svc-price`}>${svc.price?.toLocaleString('es-CO')}</div>
                </div>
                <div className={`${b}__svc-footer`}>
                  <span className={`${b}__svc-dur`}><IconClock /> {svc.duration_minutes} min</span>
                  <button className={`${b}__svc-book`} onClick={() => openBooking(svc)}>Reservar</button>
                </div>
              </div>
            ))}
          </div>
          {filtered.length === 0 && svcSearch && <p className={`${b}__svc-empty`}>No se encontraron servicios para "{svcSearch}"</p>}
          {totalPages > 1 && (
            <div className={`${b}__pagination`}>
              <button disabled={svcPage === 0} onClick={() => setSvcPage(p => p - 1)} className={`${b}__page-btn`}><IconArrow dir="left" /></button>
              <span className={`${b}__page-info`}>{svcPage + 1} / {totalPages}</span>
              <button disabled={svcPage >= totalPages - 1} onClick={() => setSvcPage(p => p + 1)} className={`${b}__page-btn`}><IconArrow /></button>
            </div>
          )}
        </Section>

        {/* ═══ 6. HORARIOS ═══ */}
        {schedule.length > 0 && (
        <Section delay={50}>
          <h2 className={`${b}__title`}><span className={`${b}__title-accent`} />Horarios</h2>
          <div className={`${b}__card`}>
            <div className={`${b}__schedule`}>
              {schedule.filter(s => s.hours).map(s => {
                const isToday = s.day === todayName;
                return (
                  <div key={s.day} className={`${b}__schedule-row ${isToday ? `${b}__schedule-row--today` : ''}`}>
                    <span className={`${b}__schedule-day`}>{s.day}</span>
                    <span className={`${b}__schedule-hours`}>{s.hours}</span>
                    {isToday && <span className={`${b}__schedule-now`}>Hoy</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </Section>
        )}

        {/* ═══ 7. EQUIPO (horizontal scroll, 6 per row) ═══ */}
        {apiStaff.length > 0 && (
        <Section delay={100}>
          <div className={`${b}__section-head`}>
            <h2 className={`${b}__title`}><span className={`${b}__title-accent`} />Nuestro equipo</h2>
            <div className={`${b}__hscroll-nav`}>
              <button className={`${b}__hscroll-btn`} disabled={!teamScroll.canLeft} onClick={() => teamScroll.scroll(-1)}><IconArrow dir="left" /></button>
              <button className={`${b}__hscroll-btn`} disabled={!teamScroll.canRight} onClick={() => teamScroll.scroll(1)}><IconArrow /></button>
            </div>
          </div>
          <div className={`${b}__team`} ref={teamScroll.ref} onScroll={teamScroll.check}>
            {apiStaff.map(s => (
              <div key={s.id} className={`${b}__member`}>
                {s.photo_url && <div className={`${b}__member-photo`}><img src={s.photo_url} alt={s.name} loading="lazy" /></div>}
                {!s.photo_url && <div className={`${b}__member-photo`}><div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0ebe4', fontSize: '1.5rem', fontWeight: 700, color: '#a0a8c0' }}>{s.name?.charAt(0)}</div></div>}
                <div className={`${b}__member-info`}>
                  <strong className={`${b}__member-name`}>{s.name}</strong>
                  <span className={`${b}__member-role`}>{s.specialty || ''}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>
        )}

        {/* ═══ 8. GOOGLE REVIEWS ═══ */}
        {reviewItems.length > 0 && (
        <Section delay={100}>
          <div className={`${b}__section-head`}>
            <h2 className={`${b}__title`}><span className={`${b}__title-accent`} />Reseñas de Google</h2>
            <div className={`${b}__review-summary`}>
              <IconGoogle /><strong>{reviewsData.rating}</strong><Stars rating={reviewsData.rating} size={14} /><span>({reviewsData.total_reviews} opiniones)</span>
            </div>
          </div>
          <div className={`${b}__reviews`}>
            {reviewItems.map((r, i) => (
              <div key={i} className={`${b}__review`}>
                <div className={`${b}__review-head`}>
                  {r.photo ? (
                    <img src={r.photo} alt={r.name} className={`${b}__review-photo`} onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                  ) : null}
                  <div className={`${b}__review-avatar`} style={r.photo ? { display: 'none' } : {}}>{r.name?.charAt(0)}</div>
                  <div>
                    <strong className={`${b}__review-name`}>{r.name}</strong>
                    <span className={`${b}__review-date`}>{r.date}</span>
                  </div>
                </div>
                <div className={`${b}__review-stars`}><Stars rating={r.rating} size={13} /></div>
                <p className={`${b}__review-text`}>{r.text}</p>
              </div>
            ))}
          </div>
        </Section>
        )}
      </div>

      {/* ═══ 9. FOOTER (premium) ═══ */}
      <footer className={`${b}__footer`}>
        <div className={`${b}__footer-glow`} />
        <div className={`${b}__footer-top`}>
          <div className={`${b}__footer-brand`}>
            <div className={`${b}__footer-logo-row`}>
              {(biz.logo_url || biz.cover_url) && <img src={biz.logo_url || biz.cover_url} alt={biz.name} className={`${b}__footer-biz-logo`} />}
              <h3>{biz.name}</h3>
            </div>
            {biz.description && <p>{biz.description}</p>}
            <div className={`${b}__footer-social`}>
              {biz.instagram && <a href={biz.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className={`${b}__footer-social-link ${b}__footer-social-link--ig`}><IconInstagram /></a>}
              {biz.facebook && <a href={biz.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className={`${b}__footer-social-link ${b}__footer-social-link--fb`}><IconFacebook /></a>}
              {biz.whatsapp && <a href={`https://wa.me/${biz.whatsapp}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className={`${b}__footer-social-link ${b}__footer-social-link--wa`}><IconWhatsApp /></a>}
            </div>
          </div>
          <div className={`${b}__footer-col`}>
            <h4>Contacto</h4>
            {biz.address && <div className={`${b}__footer-item`}><IconPin /><span>{biz.address}</span></div>}
            {biz.phone && <div className={`${b}__footer-item`}><IconPhone /><span>{biz.phone}</span></div>}
          </div>
          <div className={`${b}__footer-col`}>
            <h4>Horario</h4>
            {schedule.filter(s => s.hours).slice(0, 3).map(s => (
              <div key={s.day} className={`${b}__footer-item`}><span>{s.day}: <strong>{s.hours}</strong></span></div>
            ))}
            {schedule.filter(s => s.hours).length > 3 && <div className={`${b}__footer-item`}><span>...</span></div>}
          </div>
          <div className={`${b}__footer-col`}>
            <h4>Reserva ahora</h4>
            <p className={`${b}__footer-cta-text`}>Agenda tu cita en linea de forma rapida y segura.</p>
            <button className={`${b}__footer-cta-btn`} onClick={() => document.getElementById('bp-services')?.scrollIntoView({ behavior: 'smooth' })}>
              <IconCalendar /> Reservar
            </button>
          </div>
        </div>
        <div className={`${b}__footer-divider`} />
        <div className={`${b}__footer-bottom`}>
          <div className={`${b}__footer-powered`}>
            <span>Powered by</span>
            <a href="https://plexifystudio.com" target="_blank" rel="noopener noreferrer">
              <img src={PLEXIFY_LOGO} alt="Plexify Studio" className={`${b}__footer-plexify-logo`} />
            </a>
          </div>
          <span>&copy; {new Date().getFullYear()} <a href="https://plexifystudio.com" target="_blank" rel="noopener noreferrer">Plexify Studio</a>. Todos los derechos reservados.</span>
        </div>
      </footer>

      {/* ═══ LIGHTBOX ═══ */}
      {lightbox !== null && (
        <div className={`${b}__lightbox`} onClick={() => setLightbox(null)}>
          <button className={`${b}__lightbox-close`} onClick={() => setLightbox(null)}><IconClose /></button>
          <button className={`${b}__lightbox-nav ${b}__lightbox-nav--prev`} onClick={e => { e.stopPropagation(); setLightbox(i => (i - 1 + gallery.length) % gallery.length); }}><IconArrow dir="left" /></button>
          <img src={gallery[lightbox]} alt="" className={`${b}__lightbox-img`} onClick={e => e.stopPropagation()} />
          <button className={`${b}__lightbox-nav ${b}__lightbox-nav--next`} onClick={e => { e.stopPropagation(); setLightbox(i => (i + 1) % gallery.length); }}><IconArrow /></button>
          <span className={`${b}__lightbox-counter`}>{lightbox + 1} / {gallery.length}</span>
        </div>
      )}

      {/* ═══ BOOKING MODAL ═══ */}
      {modal && (
        <div className={`${b}__overlay`} onClick={() => !submitting && setModal(false)}>
          <div className={`${b}__modal`} onClick={e => e.stopPropagation()}>
            <button className={`${b}__modal-x`} onClick={() => setModal(false)}><IconClose /></button>
            <div className={`${b}__steps`}>
              {['Profesional', 'Fecha y Hora', 'Tus datos'].map((l, i) => (
                <div key={i} className={`${b}__step ${step > i + 1 ? `${b}__step--done` : ''} ${step === i + 1 ? `${b}__step--active` : ''}`}>
                  <span className={`${b}__step-dot`}>{step > i + 1 ? '\u2713' : i + 1}</span>
                  <span className={`${b}__step-label`}>{l}</span>
                </div>
              ))}
            </div>
            <div className={`${b}__modal-svc`}><strong>{selSvc?.name}</strong><span>${selSvc?.price?.toLocaleString('es-CO')} &middot; {selSvc?.duration_minutes} min</span></div>

            {step === 1 && (<div className={`${b}__modal-body`}><h3>Elige tu profesional</h3>
              <div className={`${b}__staff-pick`}>{apiStaff.map(s => (
                <button key={s.id} className={`${b}__staff-opt ${selStaff?.id === s.id ? `${b}__staff-opt--on` : ''}`} onClick={() => setSelStaff(s)}>
                  <div className={`${b}__staff-opt-avatar`}>{s.name.charAt(0)}</div>
                  <span className={`${b}__staff-opt-name`}>{s.name}</span><small>{s.specialty}</small>
                </button>
              ))}</div>
              <div className={`${b}__modal-actions`}><button className={`${b}__btn ${b}__btn--accent`} disabled={!selStaff} onClick={() => setStep(2)}>Siguiente</button></div>
            </div>)}

            {step === 2 && (<div className={`${b}__modal-body`}><h3>Elige fecha y hora</h3>
              <div className={`${b}__cal-strip`}>{days30.map((d, i) => {
                const on = selDate && d.toDateString() === selDate.toDateString();
                return <button key={i} className={`${b}__cal-day ${on ? `${b}__cal-day--on` : ''}`} onClick={() => setSelDate(d)}><span className={`${b}__cal-day-name`}>{DAYS_SHORT[d.getDay()]}</span><strong>{d.getDate()}</strong><span className={`${b}__cal-day-month`}>{MONTHS[d.getMonth()].slice(0, 3)}</span></button>;
              })}</div>
              {selDate && (<div className={`${b}__time-section`}><h4>Horarios — {selDate.getDate()} de {MONTHS[selDate.getMonth()]}</h4>
                {slotsLoad ? <p className={`${b}__time-msg`}>Consultando disponibilidad...</p> : slots.length === 0 ? <p className={`${b}__time-msg`}>No hay horarios disponibles. Prueba otra fecha.</p> : (
                  <div className={`${b}__time-grid`}>{slots.map(t => <button key={t} className={`${b}__time-slot ${selTime === t ? `${b}__time-slot--on` : ''}`} onClick={() => setSelTime(t)}>{t}</button>)}</div>
                )}
              </div>)}
              <div className={`${b}__modal-actions`}><button className={`${b}__btn`} onClick={() => setStep(1)}>Atras</button><button className={`${b}__btn ${b}__btn--accent`} disabled={!selDate || !selTime} onClick={() => setStep(3)}>Siguiente</button></div>
            </div>)}

            {step === 3 && (<div className={`${b}__modal-body`}><h3>Tus datos</h3>
              <div className={`${b}__form`}>
                <label className={`${b}__field`}><span>Nombre completo *</span><input value={cName} onChange={e => setCName(e.target.value)} placeholder="Tu nombre completo" /></label>
                <label className={`${b}__field`}><span>Telefono *</span><div className={`${b}__phone-row`}><select value={cc} onChange={e => setCc(e.target.value)}>{COUNTRIES.map(c => <option key={c.code + c.name} value={c.code}>{c.flag} {c.code}</option>)}</select><input type="tel" value={cPhone} onChange={e => setCPhone(e.target.value)} placeholder="300 123 4567" /></div></label>
                <label className={`${b}__field`}><span>Correo (opcional)</span><input type="email" value={cEmail} onChange={e => setCEmail(e.target.value)} placeholder="tu@email.com" /></label>
                <label className={`${b}__field`}><span>Notas (opcional)</span><textarea value={cNotes} onChange={e => setCNotes(e.target.value)} placeholder="Alguna indicacion especial..." rows={2} /></label>
              </div>
              <div className={`${b}__summary`}>
                <div><span>Servicio</span><strong>{selSvc?.name}</strong></div>
                <div><span>Profesional</span><strong>{selStaff?.name}</strong></div>
                <div><span>Fecha</span><strong>{selDate ? `${selDate.getDate()} de ${MONTHS[selDate.getMonth()]}` : ''}</strong></div>
                <div><span>Hora</span><strong>{selTime}</strong></div>
                <div><span>Precio</span><strong>${selSvc?.price?.toLocaleString('es-CO')}</strong></div>
              </div>
              <p className={`${b}__pay-note`}>El pago se realiza directamente en el establecimiento.</p>
              <div className={`${b}__modal-actions`}><button className={`${b}__btn`} onClick={() => setStep(2)}>Atras</button><button className={`${b}__btn ${b}__btn--accent`} disabled={cName.trim().length < 2 || cPhone.trim().length < 7 || submitting} onClick={doSubmit}>{submitting ? 'Agendando...' : 'Confirmar cita'}</button></div>
            </div>)}

            {step === 4 && conf && (<div className={`${b}__modal-body ${b}__modal-body--center`}>
              <div className={`${b}__confirm-check`}>&#10003;</div>
              <h3>Cita agendada exitosamente</h3>
              <p className={`${b}__confirm-sub`}>Te esperamos!</p>
              <div className={`${b}__summary`}>
                <div><span>Servicio</span><strong>{conf.service}</strong></div>
                <div><span>Profesional</span><strong>{conf.staff}</strong></div>
                <div><span>Fecha</span><strong>{conf.date}</strong></div>
                <div><span>Hora</span><strong>{conf.time}</strong></div>
                <div><span>Precio</span><strong>${conf.price?.toLocaleString('es-CO')}</strong></div>
              </div>
              <p className={`${b}__confirm-wa`}>Te enviaremos confirmacion por WhatsApp.</p>
              <div className={`${b}__modal-actions`}><button className={`${b}__btn ${b}__btn--accent`} onClick={() => setModal(false)}>Cerrar</button></div>
            </div>)}
          </div>
        </div>
      )}
    </div>
  );
}
