import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import SEO from '../../../components/landing/common/SEO';

const API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const b = 'booking-page';

const DAYS_FULL = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
const DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const COUNTRIES = [
  { name: 'Colombia', code: '+57', flag: '\u{1F1E8}\u{1F1F4}' },
  { name: 'Mexico', code: '+52', flag: '\u{1F1F2}\u{1F1FD}' },
  { name: 'Venezuela', code: '+58', flag: '\u{1F1FB}\u{1F1EA}' },
  { name: 'Ecuador', code: '+593', flag: '\u{1F1EA}\u{1F1E8}' },
  { name: 'Peru', code: '+51', flag: '\u{1F1F5}\u{1F1EA}' },
  { name: 'USA', code: '+1', flag: '\u{1F1FA}\u{1F1F8}' },
];

const SVC_PER_PAGE = 6;
const REVIEWS_PER_PAGE = 9;
const PLEXIFY_LOGO = 'https://plexifystudio.com/assets/logo-BgzeKFL7.webp';

// ── Icons ──
const IconStar = ({ size = 14, filled = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? '#f59e0b' : 'none'} stroke={filled ? '#f59e0b' : '#cbd5e1'} strokeWidth="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2z" /></svg>
);
const IconClock = ({ s = 15 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
const IconPin = ({ s = 16 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>;
const IconPhone = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg>;
const IconWA = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>;
const IconIG = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>;
const IconFB = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>;
const IconChev = ({ dir = 'right', s = 16 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: dir === 'left' ? 'rotate(180deg)' : 'none' }}><polyline points="9 18 15 12 9 6" /></svg>;
const IconX = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
const IconSearch = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
const IconHeart = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>;
const IconShare = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>;
const IconCalendar = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
const IconUser = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
const IconCheck = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>;
const IconArrowLeft = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>;
const IconScissors = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" /></svg>;

const Stars = ({ rating, size = 14 }) => (
  <span className={`${b}__stars`}>{[1,2,3,4,5].map(i => <IconStar key={i} size={size} filled={i <= Math.round(rating)} />)}</span>
);

function useHScroll(count, visible) {
  const ref = useRef(null);
  const [canL, setCanL] = useState(false);
  const [canR, setCanR] = useState(count > visible);
  const check = () => { const el = ref.current; if (!el) return; setCanL(el.scrollLeft > 10); setCanR(el.scrollLeft < el.scrollWidth - el.clientWidth - 10); };
  useEffect(() => { check(); }, [count]);
  const scroll = (dir) => { const el = ref.current; if (!el) return; el.scrollBy({ left: dir * (el.firstElementChild?.offsetWidth || 200) * visible, behavior: 'smooth' }); setTimeout(check, 400); };
  return { ref, canL, canR, scroll, check };
}

// Check if business is currently open
function isOpenNow(schedule) {
  const now = new Date();
  const todayName = DAYS_FULL[now.getDay()];
  const entry = schedule.find(s => s.day === todayName);
  if (!entry?.hours) return { open: false, text: 'Cerrado hoy' };
  const match = entry.hours.match(/(\d+):(\d+)\s*(AM|PM)\s*-\s*(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return { open: true, text: `Abierto hoy ${entry.hours}` };
  const toMin = (h, m, p) => ((h % 12) + (p.toUpperCase() === 'PM' ? 12 : 0)) * 60 + parseInt(m);
  const openMin = toMin(parseInt(match[1]), match[2], match[3]);
  const closeMin = toMin(parseInt(match[4]), match[5], match[6]);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (nowMin >= openMin && nowMin < closeMin) return { open: true, text: `Abierto · Cierra ${match[4]}:${match[5]}${match[6]}` };
  return { open: false, text: `Cerrado · Abre ${match[1]}:${match[2]}${match[3]}` };
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
  const [expandedDescs, setExpandedDescs] = useState(new Set());
  const [stickyVisible, setStickyVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('servicios');
  const [reviewPage, setReviewPage] = useState(0);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  // ── Inline booking flow (no modal) ──
  const [bkStep, setBkStep] = useState(0); // 0=browse, 1=staff, 2=datetime, 3=form, 4=done
  const [selSvc, setSelSvc] = useState(null);
  const [selStaff, setSelStaff] = useState(null);
  const [selDate, setSelDate] = useState(null);
  const [selTime, setSelTime] = useState(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekData, setWeekData] = useState({});
  const [weekLoading, setWeekLoading] = useState(false);
  const [cName, setCName] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cNotes, setCNotes] = useState('');
  const [cc, setCc] = useState('+57');
  const [submitting, setSubmitting] = useState(false);
  const [conf, setConf] = useState(null);
  const [bkError, setBkError] = useState(null);

  const teamScroll = useHScroll(data?.staff?.length || 0, 4);

  useEffect(() => {
    const fn = () => setStickyVisible(window.scrollY > 380);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    if (!data) return;
    const ids = ['bp-reviews', 'bp-team', 'bp-services'];
    const tabs = ['resenas', 'equipo', 'servicios'];
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { const i = ids.indexOf(e.target.id); if (i >= 0) setActiveTab(tabs[i]); }
    }, { threshold: 0.15, rootMargin: '-60px 0px 0px 0px' });
    ids.forEach(id => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [data]);

  useEffect(() => {
    fetch(`${API}/public/book/${slug}`)
      .then(r => { if (!r.ok) throw new Error(r.status === 404 ? 'not_found' : r.status === 403 ? 'disabled' : 'error'); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [slug]);

  // Compute the Monday of the current week offset
  const weekStart = useMemo(() => {
    const d = new Date();
    const day = d.getDay(); // 0=Sun
    const diff = day === 0 ? -6 : 1 - day; // adjust to Monday
    d.setDate(d.getDate() + diff + weekOffset * 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [weekOffset]);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  }), [weekStart]);

  // Fetch weekly schedule (single call for 7 days)
  useEffect(() => {
    if (bkStep !== 2 || !selStaff || !selSvc) return;
    setWeekLoading(true);
    const ws = weekStart.toISOString().split('T')[0];
    fetch(`${API}/public/book/${slug}/weekly?staff_id=${selStaff.id}&service_id=${selSvc.id}&week_start=${ws}`)
      .then(r => r.json())
      .then(data => {
        const map = {};
        (data.days || []).forEach(d => { map[d.date] = d; });
        setWeekData(map);
        setWeekLoading(false);
      })
      .catch(() => { setWeekData({}); setWeekLoading(false); });
  }, [bkStep, selStaff, selSvc, weekOffset, slug]);

  useEffect(() => {
    document.body.style.overflow = lightbox !== null ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [lightbox]);

  const biz = data?.business || {};
  const schedule = data?.schedule || [];
  const reviewsData = data?.reviews || {};
  const reviewItems = reviewsData.items || [];
  const gallery = biz.gallery_images || [];
  const tags = biz.tags || [];
  const { services: svcData = {}, staff: apiStaff = [] } = data || {};

  const openStatus = useMemo(() => isOpenNow(schedule), [schedule]);

  // Staff filtered by service — uses staff_ids if populated, otherwise matches category→specialty
  const eligibleStaff = useMemo(() => {
    if (!selSvc) return apiStaff;
    // If staff_ids explicitly set, use those
    const ids = selSvc.staff_ids || [];
    if (ids.length > 0) return apiStaff.filter(s => ids.includes(s.id));
    // Smart match: category keywords → specialty keywords
    const CAT_KEYWORDS = {
      'arte en uñas': ['manicure', 'pedicure', 'uñas', 'nail', 'unas'],
      'barbería': ['cortes', 'barba', 'grooming', 'barbero', 'facial'],
      'barberia': ['cortes', 'barba', 'grooming', 'barbero', 'facial'],
      'peluquería': ['cortes', 'styling', 'color', 'peinado', 'blower', 'alisado', 'keratina'],
      'peluqueria': ['cortes', 'styling', 'color', 'peinado', 'blower', 'alisado', 'keratina'],
      'tratamientos capilares': ['tratamiento', 'capilar', 'tricoterapeuta', 'recuperación', 'recuperacion', 'botox'],
    };
    const cat = (selSvc.category || '').toLowerCase();
    const keywords = CAT_KEYWORDS[cat];
    if (!keywords) return apiStaff; // unknown category, show all
    const matched = apiStaff.filter(s => {
      const spec = (s.specialty || '').toLowerCase();
      // Exclude admin/support/dev staff
      if (/soporte|administrativo|developer|admin/i.test(spec)) return false;
      return keywords.some(kw => spec.includes(kw));
    });
    return matched.length > 0 ? matched : apiStaff; // fallback to all if no match
  }, [selSvc, apiStaff]);

  // Build time rows for weekly grid (30-min increments)
  const timeRows = useMemo(() => {
    let minH = 7, maxH = 20;
    Object.values(weekData).forEach(d => {
      if (d.hours?.start) {
        const [h] = d.hours.start.split(':').map(Number);
        if (h < minH) minH = h;
      }
      if (d.hours?.end) {
        const [h] = d.hours.end.split(':').map(Number);
        if (h + 1 > maxH) maxH = h + 1;
      }
    });
    const rows = [];
    for (let h = minH; h < maxH; h++) {
      rows.push(`${String(h).padStart(2, '0')}:00`);
      rows.push(`${String(h).padStart(2, '0')}:30`);
    }
    return rows;
  }, [weekData]);

  const scrollToSection = useCallback((tab) => {
    setActiveTab(tab);
    const el = document.getElementById({ servicios: 'bp-services', equipo: 'bp-team', resenas: 'bp-reviews' }[tab]);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 56, behavior: 'smooth' });
  }, []);

  if (loading) return <div className={b}><div className={`${b}__loading`}><div className={`${b}__spinner`} /><span>Cargando...</span></div></div>;
  if (error) return <div className={b}><div className={`${b}__error`}><div className={`${b}__error-icon`}>!</div><h1>{error === 'not_found' ? 'Negocio no encontrado' : error === 'disabled' ? 'Reservas no disponibles' : 'Error'}</h1><p>Verifica el enlace e intenta de nuevo.</p></div></div>;

  const starDist = [5,4,3,2,1].map(n => ({ stars: n, count: reviewItems.filter(r => Math.round(r.rating) === n).length }));
  const maxStarCount = Math.max(...starDist.map(d => d.count), 1);
  const totalReviewPages = Math.ceil(reviewItems.length / REVIEWS_PER_PAGE);
  const pagedReviews = reviewItems.slice(reviewPage * REVIEWS_PER_PAGE, (reviewPage + 1) * REVIEWS_PER_PAGE);
  const toggleDesc = (id) => setExpandedDescs(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const allSvc = Object.values(svcData).flat();
  const cats = Object.keys(svcData);
  let filtered = activeCat ? (svcData[activeCat] || []) : allSvc;
  if (svcSearch.trim()) { const q = svcSearch.toLowerCase().trim(); filtered = filtered.filter(s => s.name.toLowerCase().includes(q) || s.category?.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q)); }
  const totalPages = Math.ceil(filtered.length / SVC_PER_PAGE);
  const pagedSvc = filtered.slice(svcPage * SVC_PER_PAGE, (svcPage + 1) * SVC_PER_PAGE);
  const todayName = DAYS_FULL[new Date().getDay()];
  const todayHours = schedule.find(s => s.day === todayName)?.hours || '';

  const startBooking = (svc) => {
    setSelSvc(svc); setSelStaff(null); setSelDate(null); setSelTime(null);
    setConf(null); setCName(''); setCPhone(''); setCEmail(''); setCNotes('');
    setBkStep(1);
    setTimeout(() => document.getElementById('bp-services')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const resetBooking = () => { setBkStep(0); setSelSvc(null); setSelStaff(null); setSelDate(null); setSelTime(null); setConf(null); setBkError(null); };

  const doSubmit = async () => {
    if (!cName.trim() || !cPhone.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/public/book/${slug}/appointment`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: selSvc.id, staff_id: selStaff.id, date: selDate.toISOString().split('T')[0], time: selTime, client_name: cName.trim(), client_phone: cc + cPhone.trim().replace(/\s/g, ''), client_email: cEmail.trim() || null, notes: cNotes.trim() || null }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); setBkError(e.detail || 'Horario no disponible. Intenta otro.'); setSubmitting(false); return; }
      setBkError(null); setConf((await res.json()).appointment); setBkStep(4);
    } catch { setBkError('Error de conexión. Verifica tu internet e intenta de nuevo.'); }
    setSubmitting(false);
  };

  const STEP_LABELS = ['Servicio', 'Profesional', 'Fecha y hora', 'Datos'];

  return (
    <div className={b}>
      <SEO title={`${biz.name || 'Reservas'} — Agenda tu cita online`} description={biz.tagline || ''} />

      {/* ═══ STICKY ═══ */}
      <header className={`${b}__sticky ${stickyVisible ? `${b}__sticky--on` : ''}`}>
        <div className={`${b}__sticky-wrap`}>
          <strong className={`${b}__sticky-name`}>{biz.name}</strong>
          <div className={`${b}__sticky-meta`}>
            {reviewsData.rating && <span className={`${b}__sticky-rat`}><IconStar size={11} /> {reviewsData.rating}</span>}
            {biz.address && <span><IconPin s={12} /> {biz.address.split(',')[0]}</span>}
            {todayHours && <span className={openStatus.open ? `${b}__sticky-open` : `${b}__sticky-closed`}><span className={`${b}__dot`} /> {openStatus.open ? 'Abierto' : 'Cerrado'}</span>}
          </div>
          <nav className={`${b}__sticky-tabs`}>
            {[['servicios','Servicios'],['equipo','Equipo'],['resenas','Reseñas']].map(([k,l]) => (
              <button key={k} className={`${b}__stab ${activeTab===k?`${b}__stab--on`:''}`} onClick={() => scrollToSection(k)}>{l}</button>
            ))}
          </nav>
        </div>
      </header>

      {/* ═══ HERO ═══ */}
      <section className={`${b}__hero`}>
        {(biz.cover_url || biz.logo_url) && <img src={biz.cover_url || biz.logo_url} alt={biz.name} className={`${b}__hero-bg`} />}
        <div className={`${b}__hero-grad`} />
        <div className={`${b}__hero-body`}>
          {tags.length > 0 && <div className={`${b}__hero-tags`}>{tags.map(t => <span key={t}>{t}</span>)}</div>}
          <h1 className={`${b}__hero-name`}>{biz.name}</h1>
          <div className={`${b}__hero-row`}>
            {reviewsData.rating && <span className={`${b}__hero-badge`}><IconStar size={15} /> <strong>{reviewsData.rating}</strong> ({reviewsData.total_reviews} reseñas)</span>}
            {biz.address && <span className={`${b}__hero-item`}><IconPin s={15} /> {biz.address}</span>}
            <span className={`${b}__hero-status ${openStatus.open ? `${b}__hero-status--open` : `${b}__hero-status--closed`}`}>
              <span className={`${b}__dot`} /> {openStatus.text}
            </span>
          </div>
        </div>
      </section>

      {/* ═══ NAV ═══ */}
      <nav className={`${b}__nav`}>
        <div className={`${b}__nav-wrap`}>
          <div className={`${b}__nav-tabs`}>
            {[['servicios','Servicios'],['equipo','Equipo'],['resenas','Reseñas']].map(([k,l]) => (
              <button key={k} className={`${b}__ntab ${activeTab===k?`${b}__ntab--on`:''}`} onClick={() => scrollToSection(k)}>{l}</button>
            ))}
          </div>
        </div>
      </nav>

      <div className={`${b}__content`}>
        {/* ═══ INFO BAR ═══ */}
        <div className={`${b}__info`}>
          <div className={`${b}__info-main`}>
            <h2>Sobre nosotros</h2>
            {tags.length > 0 && <div className={`${b}__info-tags`}>{tags.map(t => <span key={t}>{t}</span>)}</div>}
            {biz.description && <p className={`${b}__info-desc`}>{biz.description}</p>}
          </div>
          <div className={`${b}__info-side`}>
            {biz.address && (
              <div className={`${b}__icard`}>
                <div className={`${b}__icard-h`}><IconPin s={16} /><strong>Dirección</strong></div>
                <span>{biz.address}</span>
                <a href={`https://maps.google.com/?q=${encodeURIComponent(biz.address)}`} target="_blank" rel="noopener noreferrer">Ver dirección</a>
              </div>
            )}
            {gallery.length > 0 && (
              <div className={`${b}__icard`}>
                <div className={`${b}__icard-h`}><IconScissors /><strong>Portafolio</strong>{gallery.length > 3 && <button onClick={() => setLightbox(0)}>Ver {gallery.length} fotos</button>}</div>
                <div className={`${b}__icard-thumbs`}>{gallery.slice(0, 3).map((img, i) => <img key={i} src={img} alt="" onClick={() => setLightbox(i)} loading="lazy" />)}</div>
              </div>
            )}
            {todayHours && (
              <div className={`${b}__icard`}>
                <div className={`${b}__icard-h`}><IconClock s={16} /><strong>Horario hoy</strong></div>
                <span>{todayHours}</span>
                {schedule.length > 1 && (
                  <>
                    <button className={`${b}__icard-toggle`} onClick={() => setScheduleOpen(v => !v)}>{scheduleOpen ? 'Ocultar' : 'Ver todos'}</button>
                    {scheduleOpen && <div className={`${b}__icard-sched`}>{schedule.filter(s => s.hours).map(s => <div key={s.day} className={s.day === todayName ? `${b}__icard-sched-today` : ''}><span>{s.day}</span><span>{s.hours}</span></div>)}</div>}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ═══ SERVICES / INLINE BOOKING ═══ */}
        <section className={`${b}__services`} id="bp-services">
          {bkStep === 0 ? (
            <>
              <h2 className={`${b}__heading`}>Servicios</h2>
              <div className={`${b}__svc-search`}><IconSearch /><input placeholder="Buscar servicios..." value={svcSearch} onChange={e => { setSvcSearch(e.target.value); setSvcPage(0); }} /></div>
              <div className={`${b}__cats`}>
                <button className={`${b}__cat ${!activeCat?`${b}__cat--on`:''}`} onClick={() => { setActiveCat(null); setSvcPage(0); }}>Todos los servicios <span>{allSvc.length}</span></button>
                {cats.map(c => <button key={c} className={`${b}__cat ${activeCat===c?`${b}__cat--on`:''}`} onClick={() => { setActiveCat(c); setSvcPage(0); }}>{c}</button>)}
              </div>
              <div className={`${b}__svc-grid`}>
                {pagedSvc.map((svc, i) => {
                  const pop = i < 3 && svcPage === 0 && !activeCat && !svcSearch;
                  const exp = expandedDescs.has(svc.id);
                  return (
                    <div key={svc.id} className={`${b}__svc`} style={{ animationDelay: `${i*40}ms` }}>
                      <div className={`${b}__svc-top`}>
                        <div className={`${b}__svc-info`}>
                          <h3>{svc.name}</h3>
                          <span className={`${b}__svc-cat`}>{svc.category}</span>
                          {svc.description && <><p className={`${b}__svc-desc ${exp?`${b}__svc-desc--open`:''}`}>{svc.description}</p>{svc.description.length > 90 && <button className={`${b}__svc-more`} onClick={() => toggleDesc(svc.id)}>{exp ? 'Ver menos' : 'Ver más'}</button>}</>}
                        </div>
                        <div className={`${b}__svc-price`}>
                          {pop && <div className={`${b}__svc-pop`}><IconStar size={10} /> Popular</div>}
                          <strong>${svc.price?.toLocaleString('es-CO')}</strong>
                        </div>
                      </div>
                      <div className={`${b}__svc-bot`}>
                        <span><IconClock s={14} /> {svc.duration_minutes} min</span>
                        <button onClick={() => startBooking(svc)}>Reservar</button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {filtered.length === 0 && svcSearch && <p className={`${b}__empty`}>No se encontraron servicios para &ldquo;{svcSearch}&rdquo;</p>}
              {totalPages > 1 && (
                <div className={`${b}__pager`}>
                  <button disabled={svcPage===0} onClick={() => setSvcPage(0)}><IconChev dir="left" /><IconChev dir="left" /></button>
                  <button disabled={svcPage===0} onClick={() => setSvcPage(p=>p-1)}><IconChev dir="left" /></button>
                  <span>{svcPage+1} de {totalPages}</span>
                  <button disabled={svcPage>=totalPages-1} onClick={() => setSvcPage(p=>p+1)}><IconChev /></button>
                  <button disabled={svcPage>=totalPages-1} onClick={() => setSvcPage(totalPages-1)}><IconChev /><IconChev /></button>
                </div>
              )}
            </>
          ) : (
            /* ═══ INLINE BOOKING FLOW ═══ */
            <div className={`${b}__booking`}>
              {/* Progress */}
              <div className={`${b}__bk-progress`}>
                {STEP_LABELS.map((label, i) => (
                  <div key={i} className={`${b}__bk-step ${bkStep > i + 1 ? `${b}__bk-step--done` : ''} ${bkStep === i + 1 ? `${b}__bk-step--on` : ''}`}>
                    <div className={`${b}__bk-dot`}>{bkStep > i + 1 ? <IconCheck /> : i + 1}</div>
                    <span>{label}</span>
                  </div>
                ))}
              </div>

              {/* Selected service summary */}
              <div className={`${b}__bk-svc`}>
                <div>
                  <strong>{selSvc?.name}</strong>
                  <span>{selSvc?.category}</span>
                </div>
                <div className={`${b}__bk-svc-right`}>
                  <strong>${selSvc?.price?.toLocaleString('es-CO')}</strong>
                  <span>{selSvc?.duration_minutes} min</span>
                </div>
                <button className={`${b}__bk-change`} onClick={resetBooking}>Cambiar</button>
              </div>

              {/* Step 1: Pick Staff */}
              {bkStep === 1 && (
                <div className={`${b}__bk-body`}>
                  <h3><IconUser /> Elige tu profesional</h3>
                  {eligibleStaff.length === 0 && <p className={`${b}__bk-empty`}>No hay profesionales disponibles para este servicio.</p>}
                  <div className={`${b}__bk-staff`}>
                    {eligibleStaff.map(s => (
                      <button key={s.id} className={`${b}__bk-pick ${selStaff?.id===s.id?`${b}__bk-pick--on`:''}`} onClick={() => setSelStaff(s)}>
                        <div className={`${b}__bk-avatar`}>{s.photo_url ? <img src={s.photo_url} alt={s.name} /> : <span>{s.name.charAt(0)}</span>}</div>
                        <strong>{s.name}</strong>
                        <em>{s.specialty}</em>
                        {s.rating && <div className={`${b}__bk-rating`}><IconStar size={11} /> {s.rating}</div>}
                      </button>
                    ))}
                  </div>
                  <div className={`${b}__bk-actions`}>
                    <button className={`${b}__btn`} onClick={resetBooking}><IconArrowLeft /> Volver a servicios</button>
                    <button className={`${b}__btn ${b}__btn--primary`} disabled={!selStaff} onClick={() => setBkStep(2)}>Siguiente</button>
                  </div>
                </div>
              )}

              {/* Step 2: Pick Day → Pick Time */}
              {bkStep === 2 && (() => {
                const selDs = selDate ? selDate.toISOString().split('T')[0] : null;
                const selDayData = selDs ? (weekData[selDs] || {}) : null;
                const selSlots = selDayData?.slots || [];
                return (
                <div className={`${b}__bk-body`}>
                  <h3><IconCalendar /> Elige fecha y hora</h3>
                  {/* Week nav */}
                  <div className={`${b}__dt-nav`}>
                    <button disabled={weekOffset === 0} onClick={() => { setWeekOffset(w => w - 1); setSelDate(null); setSelTime(null); }}><IconChev dir="left" /></button>
                    <span>{weekDays[0].getDate()} {MONTHS[weekDays[0].getMonth()].slice(0,3)} — {weekDays[6].getDate()} {MONTHS[weekDays[6].getMonth()].slice(0,3)}</span>
                    <button disabled={weekOffset >= 3} onClick={() => { setWeekOffset(w => w + 1); setSelDate(null); setSelTime(null); }}><IconChev /></button>
                  </div>
                  {/* Day cards */}
                  {weekLoading ? (
                    <div className={`${b}__dt-loading`}><div className={`${b}__spinner`} /> <span>Cargando disponibilidad...</span></div>
                  ) : (
                    <>
                      <div className={`${b}__dt-days`}>
                        {weekDays.map((d, i) => {
                          const ds = d.toISOString().split('T')[0];
                          const dd = weekData[ds] || {};
                          const nSlots = dd.slots?.length || 0;
                          const isToday = d.toDateString() === new Date().toDateString();
                          const isOn = selDate?.toDateString() === d.toDateString();
                          const isPast = d < new Date() && !isToday;
                          const hasSlots = nSlots > 0;
                          return (
                            <button
                              key={i}
                              className={`${b}__dt-day ${isOn ? `${b}__dt-day--on` : ''} ${isToday ? `${b}__dt-day--today` : ''} ${!hasSlots || isPast ? `${b}__dt-day--off` : ''}`}
                              onClick={() => { if (hasSlots && !isPast) { setSelDate(d); setSelTime(null); } }}
                              disabled={!hasSlots || isPast}
                            >
                              <small>{DAYS_SHORT[d.getDay()]}</small>
                              <strong>{d.getDate()}</strong>
                              <small>{MONTHS[d.getMonth()].slice(0,3)}</small>
                              {hasSlots && !isPast && <span className={`${b}__dt-day-avail`}>{nSlots} disponibles</span>}
                              {(!hasSlots || isPast) && <span className={`${b}__dt-day-na`}>No disponible</span>}
                            </button>
                          );
                        })}
                      </div>
                      {/* Time slots for selected day */}
                      {selDate && (
                        <div className={`${b}__dt-times`}>
                          <h4>Horarios disponibles — {DAYS_SHORT[selDate.getDay()]} {selDate.getDate()} de {MONTHS[selDate.getMonth()]}</h4>
                          {selSlots.length === 0 ? (
                            <p className={`${b}__dt-empty`}>No hay horarios disponibles para este día.</p>
                          ) : (
                            <div className={`${b}__dt-grid`}>
                              {selSlots.map(t => {
                                const h = parseInt(t);
                                const label = h < 12 ? 'AM' : 'PM';
                                return (
                                  <button key={t} className={`${b}__dt-slot ${selTime === t ? `${b}__dt-slot--on` : ''}`} onClick={() => setSelTime(t)}>
                                    <strong>{t}</strong>
                                    <small>{label}</small>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                  {selDate && selTime && (
                    <div className={`${b}__dt-confirm`}>
                      <IconCheck /> <span>Seleccionado: <strong>{DAYS_SHORT[selDate.getDay()]} {selDate.getDate()} de {MONTHS[selDate.getMonth()]} a las {selTime}</strong></span>
                    </div>
                  )}
                  <div className={`${b}__bk-actions`}>
                    <button className={`${b}__btn`} onClick={() => setBkStep(1)}><IconArrowLeft /> Atrás</button>
                    <button className={`${b}__btn ${b}__btn--primary`} disabled={!selDate || !selTime} onClick={() => setBkStep(3)}>Siguiente</button>
                  </div>
                </div>
                );
              })()}

              {/* Step 3: Client Data */}
              {bkStep === 3 && (
                <div className={`${b}__bk-body`}>
                  <h3><IconUser /> Tus datos</h3>
                  <div className={`${b}__bk-form`}>
                    <label><span>Nombre completo *</span><input value={cName} onChange={e => setCName(e.target.value)} placeholder="Tu nombre completo" /></label>
                    <label><span>Teléfono *</span><div className={`${b}__bk-tel`}><select value={cc} onChange={e => setCc(e.target.value)}>{COUNTRIES.map(c => <option key={c.code+c.name} value={c.code}>{c.flag} {c.code}</option>)}</select><input type="tel" value={cPhone} onChange={e => setCPhone(e.target.value)} placeholder="300 123 4567" /></div></label>
                    <label><span>Correo (opcional)</span><input type="email" value={cEmail} onChange={e => setCEmail(e.target.value)} placeholder="tu@email.com" /></label>
                    <label><span>Notas (opcional)</span><textarea value={cNotes} onChange={e => setCNotes(e.target.value)} placeholder="Alguna indicación especial..." rows={2} /></label>
                  </div>
                  <div className={`${b}__bk-receipt`}>
                    <div><span>Servicio</span><strong>{selSvc?.name}</strong></div>
                    <div><span>Profesional</span><strong>{selStaff?.name}</strong></div>
                    <div><span>Fecha</span><strong>{selDate ? `${selDate.getDate()} de ${MONTHS[selDate.getMonth()]}` : ''}</strong></div>
                    <div><span>Hora</span><strong>{selTime}</strong></div>
                    <div><span>Precio</span><strong>${selSvc?.price?.toLocaleString('es-CO')}</strong></div>
                  </div>
                  <p className={`${b}__bk-note`}>El pago se realiza directamente en el establecimiento.</p>
                  {bkError && (
                    <div className={`${b}__bk-error`}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                      <span>{bkError}</span>
                      <button onClick={() => setBkError(null)}><IconX /></button>
                    </div>
                  )}
                  <div className={`${b}__bk-actions`}>
                    <button className={`${b}__btn`} onClick={() => setBkStep(2)}><IconArrowLeft /> Atrás</button>
                    <button className={`${b}__btn ${b}__btn--primary`} disabled={cName.trim().length < 2 || cPhone.trim().length < 7 || submitting} onClick={doSubmit}>{submitting ? 'Agendando...' : 'Confirmar cita'}</button>
                  </div>
                </div>
              )}

              {/* Step 4: Confirmation */}
              {bkStep === 4 && conf && (
                <div className={`${b}__bk-body ${b}__bk-body--center`}>
                  <div className={`${b}__bk-success`}><IconCheck /></div>
                  <h3>Cita agendada exitosamente</h3>
                  <p className={`${b}__bk-sub`}>¡Te esperamos!</p>
                  <div className={`${b}__bk-receipt`}>
                    <div><span>Servicio</span><strong>{conf.service}</strong></div>
                    <div><span>Profesional</span><strong>{conf.staff}</strong></div>
                    <div><span>Fecha</span><strong>{conf.date}</strong></div>
                    <div><span>Hora</span><strong>{conf.time}</strong></div>
                    <div><span>Precio</span><strong>${conf.price?.toLocaleString('es-CO')}</strong></div>
                  </div>
                  <p className={`${b}__bk-wa`}>Te enviaremos confirmación por WhatsApp.</p>
                  <div className={`${b}__bk-actions ${b}__bk-actions--center`}>
                    <button className={`${b}__btn ${b}__btn--primary`} onClick={resetBooking}>Reservar otro servicio</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <hr className={`${b}__divider`} />

        {/* ═══ TEAM ═══ */}
        {apiStaff.length > 0 && (
        <section className={`${b}__team-section`} id="bp-team">
          <div className={`${b}__section-row`}>
            <h2 className={`${b}__heading`}>Nuestro equipo</h2>
            {apiStaff.length > 4 && (
              <div className={`${b}__scroll-nav`}>
                <button disabled={!teamScroll.canL} onClick={() => teamScroll.scroll(-1)}><IconChev dir="left" /></button>
                <button disabled={!teamScroll.canR} onClick={() => teamScroll.scroll(1)}><IconChev /></button>
              </div>
            )}
          </div>
          <div className={`${b}__team`} ref={teamScroll.ref} onScroll={teamScroll.check}>
            {apiStaff.map(s => (
              <div key={s.id} className={`${b}__member`}>
                <div className={`${b}__member-photo`}>
                  {s.photo_url ? <img src={s.photo_url} alt={s.name} loading="lazy" /> : <span>{s.name?.charAt(0)}</span>}
                </div>
                <div className={`${b}__member-info`}>
                  <strong>{s.name}</strong>
                  <em>{s.specialty || ''}</em>
                  {s.rating && <div className={`${b}__member-score`}><IconStar size={13} /> {s.rating}</div>}
                </div>
              </div>
            ))}
          </div>
        </section>
        )}

        <hr className={`${b}__divider`} />

        {/* ═══ REVIEWS ═══ */}
        {reviewItems.length > 0 && (
        <section className={`${b}__reviews`} id="bp-reviews">
          <h2 className={`${b}__heading`}>Reseñas</h2>
          <div className={`${b}__rev-top`}>
            <div className={`${b}__rev-score`}>
              <span className={`${b}__rev-num`}>{reviewsData.rating}</span>
              <div><Stars rating={reviewsData.rating} size={16} /><p>{reviewsData.total_reviews} reseñas</p></div>
            </div>
            <div className={`${b}__rev-bars`}>
              {starDist.map(d => (
                <div key={d.stars} className={`${b}__bar`}>
                  <span>{d.stars}</span><IconStar size={11} />
                  <div className={`${b}__bar-track`}><div className={`${b}__bar-fill`} style={{ width: `${(d.count/maxStarCount)*100}%` }} /></div>
                  <span className={`${b}__bar-n`}>{d.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className={`${b}__rev-grid`}>
            {pagedReviews.map((r, i) => (
              <div key={i} className={`${b}__rev`}>
                <div className={`${b}__rev-head`}>
                  {r.photo ? <img src={r.photo} alt={r.name} className={`${b}__rev-img`} onError={e => { e.target.style.display='none'; if(e.target.nextSibling) e.target.nextSibling.style.display='flex'; }} /> : null}
                  <div className={`${b}__rev-init`} style={r.photo ? {display:'none'} : {}}>{r.name?.charAt(0)}</div>
                  <div><strong>{r.name}</strong><span>{r.date}</span></div>
                </div>
                <Stars rating={r.rating} size={13} />
                {r.text && <p>{r.text}</p>}
              </div>
            ))}
          </div>
          {totalReviewPages > 1 && (
            <div className={`${b}__pager`}>
              <button disabled={reviewPage===0} onClick={() => setReviewPage(0)}><IconChev dir="left" /><IconChev dir="left" /></button>
              <button disabled={reviewPage===0} onClick={() => setReviewPage(p=>p-1)}><IconChev dir="left" /></button>
              <span>{reviewPage+1} de {totalReviewPages}</span>
              <button disabled={reviewPage>=totalReviewPages-1} onClick={() => setReviewPage(p=>p+1)}><IconChev /></button>
              <button disabled={reviewPage>=totalReviewPages-1} onClick={() => setReviewPage(totalReviewPages-1)}><IconChev /><IconChev /></button>
            </div>
          )}
        </section>
        )}
      </div>

      {/* ═══ FOOTER ═══ */}
      <footer className={`${b}__footer`}>
        <div className={`${b}__ft-top`}>
          <div className={`${b}__ft-brand`}>
            <div className={`${b}__ft-logo-row`}>
              {(biz.logo_url || biz.cover_url) && <img src={biz.logo_url || biz.cover_url} alt={biz.name} className={`${b}__ft-logo`} />}
              <div>
                <h3>{biz.name}</h3>
                {tags.length > 0 && <span className={`${b}__ft-tags`}>{tags.join(' · ')}</span>}
              </div>
            </div>
            {biz.description && <p className={`${b}__ft-desc`}>{biz.description}</p>}
            <div className={`${b}__ft-social`}>
              {biz.instagram && <a href={biz.instagram} target="_blank" rel="noopener noreferrer" title="Instagram"><IconIG /></a>}
              {biz.facebook && <a href={biz.facebook} target="_blank" rel="noopener noreferrer" title="Facebook"><IconFB /></a>}
              {biz.whatsapp && <a href={`https://wa.me/${biz.whatsapp}`} target="_blank" rel="noopener noreferrer" title="WhatsApp"><IconWA /></a>}
            </div>
          </div>
          <div className={`${b}__ft-col`}>
            <h4>Navegación</h4>
            <button onClick={() => scrollToSection('servicios')}>Servicios</button>
            <button onClick={() => scrollToSection('equipo')}>Nuestro equipo</button>
            <button onClick={() => scrollToSection('resenas')}>Reseñas</button>
          </div>
          <div className={`${b}__ft-col`}>
            <h4>Contacto</h4>
            {biz.address && <div className={`${b}__ft-item`}><IconPin s={14} /><span>{biz.address}</span></div>}
            {biz.phone && <div className={`${b}__ft-item`}><IconPhone /><span>{biz.phone}</span></div>}
            {todayHours && <div className={`${b}__ft-item`}><IconClock s={14} /><span>{todayHours}</span></div>}
          </div>
          <div className={`${b}__ft-col`}>
            <h4>Reserva ahora</h4>
            <p className={`${b}__ft-cta-text`}>Agenda tu cita en línea de forma rápida y segura.</p>
            <button className={`${b}__ft-cta`} onClick={() => scrollToSection('servicios')}>Reservar cita</button>
          </div>
        </div>
        <div className={`${b}__ft-divider`} />
        <div className={`${b}__ft-bottom`}>
          <div className={`${b}__ft-powered`}>
            <span>Powered by</span>
            <a href="https://plexifystudio.com" target="_blank" rel="noopener noreferrer"><img src={PLEXIFY_LOGO} alt="Plexify Studio" /></a>
          </div>
          <span>&copy; {new Date().getFullYear()} <a href="https://plexifystudio.com" target="_blank" rel="noopener noreferrer">Plexify Studio</a>. Todos los derechos reservados.</span>
        </div>
      </footer>

      {/* ═══ LIGHTBOX ═══ */}
      {lightbox !== null && (
        <div className={`${b}__lb`} onClick={() => setLightbox(null)}>
          <button className={`${b}__lb-x`} onClick={() => setLightbox(null)}><IconX /></button>
          <button className={`${b}__lb-prev`} onClick={e => { e.stopPropagation(); setLightbox(i => (i-1+gallery.length)%gallery.length); }}><IconChev dir="left" s={20} /></button>
          <img src={gallery[lightbox]} alt="" className={`${b}__lb-img`} onClick={e => e.stopPropagation()} />
          <button className={`${b}__lb-next`} onClick={e => { e.stopPropagation(); setLightbox(i => (i+1)%gallery.length); }}><IconChev s={20} /></button>
          <span className={`${b}__lb-count`}>{lightbox+1} / {gallery.length}</span>
        </div>
      )}
    </div>
  );
}
