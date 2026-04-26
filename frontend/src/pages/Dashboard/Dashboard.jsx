import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTenant } from '../../context/TenantContext';
import UsageMeter from '../../components/common/UsageMeter/UsageMeter';
import EmptyState from '../../components/common/EmptyState/EmptyState';
import {
  ResponsiveContainer, Tooltip, XAxis, YAxis,
  PieChart, Pie, Cell, CartesianGrid,
  BarChart, Bar,
} from 'recharts';
import { formatPhone } from '../../utils/formatters';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

const Icon = {
  revenue: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  calendar: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  users: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  cash: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>,
  alertTri: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  package: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>,
  clock: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  smile: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>,
  message: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/></svg>,
  zap: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  chat: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  mail: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  trending: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  trendingDown: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>,
  arrowRight: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  plus: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  userPlus: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>,
  pos: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><circle cx="7" cy="15" r="1"/><circle cx="12" cy="15" r="1"/><circle cx="17" cy="15" r="1"/></svg>,
  receipt: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>,
  megaphone: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11v3a4 4 0 0 0 4 4h11l3 3V8l-3 3H7a4 4 0 0 0-4 4z" transform="rotate(180 12 12)"/><path d="M11 6v7"/></svg>,
  qr: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><line x1="14" y1="14" x2="14" y2="14"/><line x1="20" y1="14" x2="20" y2="20"/><line x1="14" y1="20" x2="20" y2="20"/><line x1="17" y1="17" x2="17" y2="17"/></svg>,
  bot: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>,
  trophy: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>,
  scissors: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>,
  award: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>,
  check: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  refresh: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
};

const formatCOP = (value) => {
  if (!value && value !== 0) return '$0';
  const v = Math.abs(Math.round(value));
  if (v >= 1_000_000) return `$${(value / 1_000_000).toFixed(value < 10_000_000 ? 1 : 0)}M`;
  if (v >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${value.toLocaleString('es-CO')}`;
};

const formatCOPFull = (value) => {
  if (!value && value !== 0) return '$0';
  return `$${Number(value).toLocaleString('es-CO')}`;
};

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
};

const formatDateLong = (date = new Date()) => {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${days[date.getDay()]}, ${date.getDate()} de ${months[date.getMonth()]} de ${date.getFullYear()}`;
};

const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return 'Ahora';
  if (m < 60) return `Hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Hace ${h}h`;
  return `Hace ${Math.floor(h / 24)}d`;
};

const daysUntil = (isoDate) => {
  if (!isoDate) return null;
  const target = new Date(isoDate);
  const now = new Date();
  const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  return diff;
};

const taskCountdown = (createdAt, content) => {
  if (!createdAt) return null;
  const txt = content || '';
  let executeAt = null;
  const reminderMatch = txt.match(/(\d+)\s*min(?:utos?)?\s*antes\s+de\s+(?:la\s+)?cita\s+(\d{1,2}):(\d{2})\s*(am|pm)\s+(\d{1,2})\/(\d{2})/i);
  if (reminderMatch) {
    const leadMin = parseInt(reminderMatch[1]);
    let hour = parseInt(reminderMatch[2]);
    const minute = parseInt(reminderMatch[3]);
    const ampm = reminderMatch[4].toLowerCase();
    const day = parseInt(reminderMatch[5]);
    const month = parseInt(reminderMatch[6]) - 1;
    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
    const now = new Date();
    const apptDate = new Date(now.getFullYear(), month, day, hour, minute);
    if (apptDate < new Date(now.getTime() - 24 * 60 * 60000)) apptDate.setFullYear(now.getFullYear() + 1);
    executeAt = new Date(apptDate.getTime() - leadMin * 60000);
  }
  if (!executeAt) {
    const delayMatch = txt.match(/en\s+(\d+)\s*min/i);
    const delayMin = delayMatch ? parseInt(delayMatch[1]) : 5;
    executeAt = new Date(new Date(createdAt).getTime() + delayMin * 60000);
  }
  const remainMs = executeAt - new Date();
  if (remainMs <= 0) return { text: 'Ejecutando…', done: true };
  const totalMin = Math.floor(remainMs / 60000);
  const remainSec = Math.floor((remainMs % 60000) / 1000);
  if (totalMin >= 60) return { text: `${Math.floor(totalMin / 60)}h ${totalMin % 60}m`, done: false };
  if (totalMin > 0) return { text: `${totalMin}m ${remainSec}s`, done: false };
  return { text: `${remainSec}s`, done: false };
};

const STATUS_CONFIG = {
  confirmed: { label: 'Confirmada', mod: 'success' },
  completed: { label: 'Completada', mod: 'info' },
  paid: { label: 'Pagada', mod: 'info' },
  cancelled: { label: 'Cancelada', mod: 'error' },
  pending: { label: 'Pendiente', mod: 'warning' },
  no_show: { label: 'No asistió', mod: 'error' },
};

const STATUS_COLORS = {
  confirmed: '#10B981',
  completed: '#3B82F6',
  paid: '#1E40AF',
  cancelled: '#EF4444',
  pending: '#F59E0B',
  no_show: '#DC2626',
};

const PAYMENT_METHOD_COLORS = {
  efectivo: '#10B981',
  cash: '#10B981',
  nequi: '#7C3AED',
  daviplata: '#DC2626',
  bancolombia: '#FFCC00',
  transfer: '#3B82F6',
  transferencia: '#3B82F6',
  card: '#0F172A',
  tarjeta: '#0F172A',
  'sin registrar': '#94A3B8',
};

const PaymentIcon = ({ method }) => {
  const m = (method || '').toLowerCase();
  if (m.includes('efectivo') || m === 'cash') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
  );
  if (m.includes('nequi') || m.includes('daviplata')) return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
  );
  if (m.includes('bancolombia') || m.includes('davivienda') || m.includes('banco')) return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>
  );
  if (m.includes('transfer')) return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
  );
  if (m.includes('tarjeta') || m === 'card') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
  );
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
  );
};

const initials = (name) => (name || '?').split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();

// Animated number counter
const AnimatedNumber = ({ value, prefix = '', formatter }) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const target = typeof value === 'number' ? value : parseInt(value, 10) || 0;
    if (target === 0) { setDisplay(0); return; }
    const duration = 1000;
    const start = performance.now();
    const animate = (t) => {
      const progress = Math.min((t - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value]);
  return <span>{prefix}{formatter ? formatter(display) : display.toLocaleString('es-CO')}</span>;
};

const SparkLine = ({ data, color = '#1E40AF' }) => {
  if (!data || data.length < 2) return null;
  const values = data.map(d => d.value || 0);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - (((d.value || 0) - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg className="dashboard__sparkline" viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`spark-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polygon points={`0,100 ${points} 100,100`} fill={`url(#spark-${color.replace('#','')})`}/>
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
};

const SkeletonKpi = () => (
  <div className="dashboard__kpi dashboard__kpi--skeleton">
    <div className="dashboard__kpi-head">
      <span className="dashboard__skeleton-bar dashboard__skeleton-bar--xs" />
      <span className="dashboard__skeleton-bar dashboard__skeleton-bar--icon" />
    </div>
    <span className="dashboard__skeleton-bar dashboard__skeleton-bar--lg" />
    <span className="dashboard__skeleton-bar dashboard__skeleton-bar--sm" />
  </div>
);

const Dashboard = ({ user, onNavigate }) => {
  const { tenant } = useTenant();
  const [qrOpen, setQrOpen] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState('tasks');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const userFirstName = (user?.name || '').split(' ')[0] || 'Admin';
  const bookingUrl = useMemo(() => {
    if (tenant?.booking_url) return tenant.booking_url;
    if (tenant?.slug) {
      const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '/');
      return `${window.location.origin}${base}book/${tenant.slug}`;
    }
    return '';
  }, [tenant?.booking_url, tenant?.slug]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [linaToggling, setLinaToggling] = useState(false);
  const [paymentAlerts, setPaymentAlerts] = useState([]);
  const [dismissingAlert, setDismissingAlert] = useState(null);

  // Auxiliary data sources
  const [financeMonth, setFinanceMonth] = useState(null);
  const [cashRegister, setCashRegister] = useState(null);
  const [cashBalance, setCashBalance] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [topStaff, setTopStaff] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [, setTick] = useState(0);

  // Comparison chart period (today=Día / month=Mes / year=Año)
  const [comparePeriod, setComparePeriod] = useState('today');
  const [financeCompare, setFinanceCompare] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);

  // Tick for task countdowns
  useEffect(() => {
    const hasPending = (stats?.pending_tasks || []).some(t => t.status === 'pending');
    if (!hasPending) return;
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, [stats?.pending_tasks]);

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    const headers = { 'Content-Type': 'application/json' };
    const opts = { headers, credentials: 'include' };

    try {
      const [statsRes, finRes, cashRes, cashBalRes, methodsRes, staffRes, stockRes] = await Promise.allSettled([
        fetch(`${API_URL}/dashboard/stats`, opts),
        fetch(`${API_URL}/finances/summary?period=month`, opts),
        fetch(`${API_URL}/cash-register/today`, opts),
        fetch(`${API_URL}/finances/cash-register`, opts),
        fetch(`${API_URL}/finances/payment-methods?period=month`, opts),
        fetch(`${API_URL}/finances/staff-performance?period=month`, opts),
        fetch(`${API_URL}/inventory/alerts`, opts),
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
        const data = await statsRes.value.json();
        setStats(data);
        setError(null);
      } else if (statsRes.status === 'fulfilled') {
        const err = await statsRes.value.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${statsRes.value.status}`);
      } else {
        throw new Error('Sin conexión');
      }

      if (finRes.status === 'fulfilled' && finRes.value.ok) setFinanceMonth(await finRes.value.json());
      if (cashRes.status === 'fulfilled' && cashRes.value.ok) setCashRegister(await cashRes.value.json());
      if (cashBalRes.status === 'fulfilled' && cashBalRes.value.ok) setCashBalance(await cashBalRes.value.json());
      if (methodsRes.status === 'fulfilled' && methodsRes.value.ok) {
        const m = await methodsRes.value.json();
        setPaymentMethods(m.items || []);
      }
      if (staffRes.status === 'fulfilled' && staffRes.value.ok) setTopStaff(await staffRes.value.json());
      if (stockRes.status === 'fulfilled' && stockRes.value.ok) setLowStock(await stockRes.value.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(() => fetchAll(true), 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // Refetch comparison summary whenever period changes
  useEffect(() => {
    let cancel = false;
    setCompareLoading(true);
    fetch(`${API_URL}/finances/summary?period=${comparePeriod}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!cancel) setFinanceCompare(data); })
      .catch(() => {})
      .finally(() => { if (!cancel) setCompareLoading(false); });
    return () => { cancel = true; };
  }, [comparePeriod]);

  useEffect(() => {
    if (stats?.payment_alerts) setPaymentAlerts(stats.payment_alerts);
  }, [stats]);

  // Derived data
  const sparkData = useMemo(
    () => (stats?.revenue_by_day || []).map(d => ({ value: d.revenue || 0, label: d.date })),
    [stats?.revenue_by_day]
  );

  const monthDeltaCorrect = useMemo(() => {
    if (!financeMonth) return null;
    if (typeof financeMonth.revenue_growth_pct === 'number') return Math.round(financeMonth.revenue_growth_pct);
    return null;
  }, [financeMonth]);

  // Comparison chart data (financial scale + count scale separated)
  const compareFinancial = useMemo(() => {
    if (!financeCompare) return [];
    return [
      { metric: 'Ingresos', actual: financeCompare.total_revenue || 0, anterior: financeCompare.prev_revenue || 0, color: '#10B981' },
      { metric: 'Gastos', actual: financeCompare.total_expenses || 0, anterior: financeCompare.prev_expenses || 0, color: '#EF4444' },
      { metric: 'Ganancia', actual: financeCompare.net_profit || 0, anterior: financeCompare.prev_net_profit || 0, color: '#1E40AF' },
    ];
  }, [financeCompare]);

  const compareVolume = useMemo(() => {
    if (!financeCompare) return [];
    return [
      { metric: 'Citas', actual: financeCompare.total_visits || 0, anterior: financeCompare.prev_visits || 0, color: '#3B82F6' },
      { metric: 'Clientes', actual: financeCompare.unique_clients || 0, anterior: financeCompare.prev_unique_clients || 0, color: '#6366F1' },
    ];
  }, [financeCompare]);

  const compareDeltas = useMemo(() => {
    if (!financeCompare) return [];
    const calcDelta = (cur, prev) => {
      if (prev === 0) return cur > 0 ? 100 : 0;
      return Math.round(((cur - prev) / prev) * 100);
    };
    return [
      { label: 'Ingresos', actual: financeCompare.total_revenue || 0, prev: financeCompare.prev_revenue || 0, delta: calcDelta(financeCompare.total_revenue || 0, financeCompare.prev_revenue || 0), money: true, positive: true },
      { label: 'Gastos', actual: financeCompare.total_expenses || 0, prev: financeCompare.prev_expenses || 0, delta: calcDelta(financeCompare.total_expenses || 0, financeCompare.prev_expenses || 0), money: true, positive: false },
      { label: 'Ganancia', actual: financeCompare.net_profit || 0, prev: financeCompare.prev_net_profit || 0, delta: calcDelta(financeCompare.net_profit || 0, financeCompare.prev_net_profit || 0), money: true, positive: true },
      { label: 'Citas', actual: financeCompare.total_visits || 0, prev: financeCompare.prev_visits || 0, delta: calcDelta(financeCompare.total_visits || 0, financeCompare.prev_visits || 0), money: false, positive: true },
    ];
  }, [financeCompare]);

  const compareLabels = {
    today: { current: 'Hoy', prev: 'Ayer' },
    month: { current: 'Mes actual', prev: 'Mes anterior' },
    year: { current: 'Año actual', prev: 'Año anterior' },
  };
  const labels = compareLabels[comparePeriod] || compareLabels.today;

  const appointments = stats?.appointments_today_list || [];

  const noshowRiskCount = useMemo(
    () => appointments.filter(a => (a.noshow_risk || 0) >= 60 && a.status !== 'completed' && a.status !== 'paid' && a.status !== 'cancelled').length,
    [appointments]
  );

  const occupancyPct = useMemo(() => {
    const total = stats?.appointments_today || 0;
    const completed = stats?.completed_today || 0;
    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
  }, [stats]);

  const apptStatusData = useMemo(() => {
    const counts = {};
    appointments.forEach(a => {
      const s = a.status || 'pending';
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts).map(([status, count]) => ({
      name: (STATUS_CONFIG[status] || STATUS_CONFIG.pending).label,
      value: count,
      status,
    }));
  }, [appointments]);

  const insights = useMemo(() => {
    const out = [];
    if (noshowRiskCount > 0) {
      out.push({ id: 'noshow', tone: 'warning', icon: Icon.alertTri, label: `${noshowRiskCount} cita${noshowRiskCount !== 1 ? 's' : ''} con riesgo de no-show hoy`, action: 'Ver agenda', target: 'agenda' });
    }
    if (lowStock && lowStock.length > 0) {
      out.push({ id: 'stock', tone: 'error', icon: Icon.package, label: `${lowStock.length} producto${lowStock.length !== 1 ? 's' : ''} bajo stock mínimo`, action: 'Revisar', target: 'inventory' });
    }
    if ((stats?.whatsapp_unread || 0) > 0) {
      out.push({ id: 'unread', tone: 'success', icon: Icon.chat, label: `${stats.whatsapp_unread} mensaje${stats.whatsapp_unread !== 1 ? 's' : ''} sin leer en WhatsApp`, action: 'Abrir Inbox', target: 'inbox' });
    }
    if (cashRegister && cashRegister.discrepancy && Math.abs(cashRegister.discrepancy) > 1000) {
      const sign = cashRegister.discrepancy > 0 ? 'sobrante' : 'faltante';
      out.push({ id: 'cash', tone: 'warning', icon: Icon.cash, label: `Diferencia en caja: ${sign} de ${formatCOPFull(Math.abs(cashRegister.discrepancy))}`, action: 'Revisar caja', target: 'finances' });
    }
    if (out.length === 0) {
      out.push({ id: 'ok', tone: 'success', icon: Icon.smile, label: 'Todo en orden — ningún punto crítico hoy', action: null, target: null });
    }
    return out.slice(0, 4);
  }, [noshowRiskCount, lowStock, stats?.whatsapp_unread, cashRegister]);

  const cashStatus = cashRegister?.status || 'not_opened';
  const cashCurrent = cashRegister
    ? (cashRegister.opening_amount || 0) + (cashRegister.total_cash || 0)
    : 0;

  const linaActive = stats?.lina_is_global_active;
  const allTasks = stats?.pending_tasks || [];
  const pendingTasks = allTasks.filter(t => t.status === 'pending');
  const completedTasks = allTasks.filter(t => t.status === 'completed' || t.status === 'expired');
  const topServices = stats?.top_services_today || [];
  const topStaffSlice = (topStaff || []).filter(s => s.revenue > 0).slice(0, 5);

  const handleLinaToggle = async () => {
    if (linaToggling || !stats || tenant.ai_is_paused) return;
    setLinaToggling(true);
    const newState = !stats.lina_is_global_active;
    setStats(prev => ({ ...prev, lina_is_global_active: newState }));
    try {
      const res = await fetch(`${API_URL}/whatsapp/toggle-all-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enable: newState }),
      });
      if (!res.ok) setStats(prev => ({ ...prev, lina_is_global_active: !newState }));
    } catch {
      setStats(prev => ({ ...prev, lina_is_global_active: !newState }));
    } finally {
      setLinaToggling(false);
    }
  };

  const dismissPaymentAlert = async (convId) => {
    setDismissingAlert(convId);
    try {
      await fetch(`${API_URL}/payment-alert/${convId}`, { method: 'DELETE', credentials: 'include' });
      setPaymentAlerts(prev => prev.filter(a => a.conversation_id !== convId));
    } catch (e) { console.error(e); }
    setDismissingAlert(null);
  };

  const resolveTask = async (noteId) => {
    try {
      await fetch(`${API_URL}/notes/${noteId}/resolve`, { method: 'PUT', credentials: 'include' });
      fetchAll(true);
    } catch (e) { console.error(e); }
  };

  const goto = (target) => onNavigate && target && onNavigate(target);

  if (loading && !stats) {
    return (
      <div className="dashboard">
        <div className="dashboard__hero">
          <div>
            <h1 className="dashboard__hero-greeting">Cargando…</h1>
            <p className="dashboard__hero-date">{formatDateLong()}</p>
          </div>
        </div>
        <div className="dashboard__kpi-grid">
          {[...Array(4)].map((_, i) => <SkeletonKpi key={i} />)}
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="dashboard">
        <div className="dashboard__error">
          <div className="dashboard__error-icon">{Icon.alertTri}</div>
          <p className="dashboard__error-text">No se pudieron cargar los datos</p>
          <p className="dashboard__error-detail">{error}</p>
          <button className="dashboard__error-btn" onClick={() => fetchAll()}>Reintentar</button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="dashboard">

      {/* HERO HEADER */}
      <header className="dashboard__hero">
        <div className="dashboard__hero-left">
          <h1 className="dashboard__hero-greeting">
            {greeting()}, <span className="dashboard__hero-name">{userFirstName}</span>
          </h1>
          <p className="dashboard__hero-date">{tenant?.name} · {formatDateLong()}</p>
        </div>
        <div className="dashboard__hero-right">
          <div className="dashboard__quick-actions">
            <button className="dashboard__qa" onClick={() => goto('agenda')} title="Nueva cita">
              <span className="dashboard__qa-icon dashboard__qa-icon--info">{Icon.plus}</span>
              <span className="dashboard__qa-label">Cita</span>
            </button>
            <button className="dashboard__qa" onClick={() => goto('clients')} title="Nuevo cliente">
              <span className="dashboard__qa-icon dashboard__qa-icon--accent">{Icon.userPlus}</span>
              <span className="dashboard__qa-label">Cliente</span>
            </button>
            <button className="dashboard__qa" onClick={() => goto('finances')} title="Vender (POS)">
              <span className="dashboard__qa-icon dashboard__qa-icon--success">{Icon.pos}</span>
              <span className="dashboard__qa-label">Vender</span>
            </button>
            <button className="dashboard__qa" onClick={() => goto('finances')} title="Nuevo gasto">
              <span className="dashboard__qa-icon dashboard__qa-icon--warning">{Icon.receipt}</span>
              <span className="dashboard__qa-label">Gasto</span>
            </button>
            <button className="dashboard__qa" onClick={() => goto('campaigns')} title="Crear campaña">
              <span className="dashboard__qa-icon dashboard__qa-icon--error">{Icon.megaphone}</span>
              <span className="dashboard__qa-label">Campaña</span>
            </button>
            <button className="dashboard__qa" onClick={() => setQrOpen(true)} title="Mi código QR">
              <span className="dashboard__qa-icon dashboard__qa-icon--neutral">{Icon.qr}</span>
              <span className="dashboard__qa-label">QR</span>
            </button>
            <button
              className="dashboard__qa"
              onClick={() => {
                try { sessionStorage.setItem('settings:open-panel', 'reservas'); } catch {}
                goto('settings');
              }}
              title="Mi información del negocio"
            >
              <span className="dashboard__qa-icon dashboard__qa-icon--info">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </span>
              <span className="dashboard__qa-label">Mi info</span>
            </button>
          </div>
          <button
            className={`dashboard__refresh ${refreshing ? 'dashboard__refresh--spinning' : ''}`}
            onClick={() => fetchAll()}
            aria-label="Actualizar"
            title="Actualizar"
          >
            {Icon.refresh}
          </button>
          <span className="dashboard__live">
            <span className="dashboard__live-dot" />
            En vivo
          </span>
        </div>
      </header>

      {/* KPI BENTO */}
      <section className="dashboard__kpi-grid">
        {/* Revenue */}
        <article className="dashboard__kpi dashboard__kpi--revenue">
          <div className="dashboard__kpi-head">
            <span className="dashboard__kpi-label">Ingresos del mes</span>
            <span className="dashboard__kpi-icon dashboard__kpi-icon--success">{Icon.revenue}</span>
          </div>
          <div className="dashboard__kpi-value">
            <AnimatedNumber value={financeMonth?.total_revenue ?? stats.revenue_this_month} formatter={formatCOPFull} />
          </div>
          <div className="dashboard__kpi-foot">
            {monthDeltaCorrect !== null && (
              <span className={`dashboard__delta dashboard__delta--${monthDeltaCorrect >= 0 ? 'up' : 'down'}`}>
                {monthDeltaCorrect >= 0 ? Icon.trending : Icon.trendingDown}
                {Math.abs(monthDeltaCorrect)}% vs mes anterior
              </span>
            )}
            <span className="dashboard__kpi-sub">{formatCOPFull(stats.revenue_this_week)} esta semana</span>
          </div>
          <SparkLine data={sparkData} color="#10B981" />
        </article>

        {/* Citas hoy */}
        <article className="dashboard__kpi">
          <div className="dashboard__kpi-head">
            <span className="dashboard__kpi-label">Citas hoy</span>
            <span className="dashboard__kpi-icon dashboard__kpi-icon--info">{Icon.calendar}</span>
          </div>
          <div className="dashboard__kpi-value">
            <AnimatedNumber value={stats.appointments_today} />
          </div>
          <div className="dashboard__kpi-foot">
            <span className="dashboard__delta dashboard__delta--neutral">
              {Icon.check} {stats.completed_today || 0} completadas
            </span>
            <span className="dashboard__kpi-sub">{occupancyPct}% del día</span>
          </div>
          <div className="dashboard__kpi-bar">
            <span className="dashboard__kpi-bar-fill" style={{ width: `${Math.min(occupancyPct, 100)}%`, background: '#3B82F6' }} />
          </div>
        </article>

        {/* Clientes activos */}
        <article className="dashboard__kpi">
          <div className="dashboard__kpi-head">
            <span className="dashboard__kpi-label">Clientes activos</span>
            <span className="dashboard__kpi-icon dashboard__kpi-icon--accent">{Icon.users}</span>
          </div>
          <div className="dashboard__kpi-value">
            <AnimatedNumber value={stats.active_clients} />
          </div>
          <div className="dashboard__kpi-foot">
            <span className="dashboard__delta dashboard__delta--up">
              {Icon.trending} +{stats.new_clients_this_month || 0} nuevos
            </span>
            <span className="dashboard__kpi-sub">
              {stats.vip_clients || 0} VIP · {stats.at_risk_clients || 0} en riesgo
            </span>
          </div>
        </article>

        {/* Caja del día — persistent cash balance, fully clickable */}
        <article
          className={`dashboard__kpi dashboard__kpi--cash dashboard__kpi--clickable dashboard__kpi--${cashStatus === 'open' ? 'live' : 'muted'}`}
          onClick={() => {
            try { sessionStorage.setItem('finances:initial-tab', 'gastos'); } catch {}
            goto('finances');
          }}
          role="button"
          tabIndex={0}
        >
          <div className="dashboard__kpi-head">
            <span className="dashboard__kpi-label">Caja del día</span>
            <span className="dashboard__kpi-icon dashboard__kpi-icon--warning">{Icon.cash}</span>
          </div>
          <div className="dashboard__kpi-value">
            <AnimatedNumber value={cashBalance?.balance ?? 0} formatter={formatCOPFull} />
          </div>
          <div className="dashboard__kpi-foot">
            <span className="dashboard__delta dashboard__delta--neutral">
              Hoy {formatCOPFull(cashBalance?.today_total ?? 0)}
            </span>
            <span className="dashboard__kpi-sub">
              {cashStatus === 'not_opened'
                ? 'Caja sin abrir · clic para gestionar'
                : `${cashBalance?.sales_today ? formatCOPFull(cashBalance.sales_today) + ' ventas' : 'Sin ventas'} · ${cashRegister?.transaction_count || 0} transacc.`}
            </span>
          </div>
        </article>
      </section>

      {/* SMART INSIGHTS BAR */}
      <section className="dashboard__insights">
        {insights.map(ins => (
          <button
            key={ins.id}
            className={`dashboard__insight dashboard__insight--${ins.tone}`}
            onClick={() => goto(ins.target)}
            disabled={!ins.target}
          >
            <span className="dashboard__insight-icon">{ins.icon}</span>
            <span className="dashboard__insight-label">{ins.label}</span>
            {ins.action && <span className="dashboard__insight-action">{ins.action} {Icon.arrowRight}</span>}
          </button>
        ))}
      </section>

      {/* CHARTS GRID */}
      <section className="dashboard__charts">
        {/* Comparison: current vs previous period */}
        <article className="dashboard__card dashboard__card--span-2">
          <header className="dashboard__card-head">
            <div>
              <h2 className="dashboard__card-title">Comparación de período</h2>
              <p className="dashboard__card-sub">{labels.current} vs {labels.prev}</p>
            </div>
            <div className="dashboard__period-tabs">
              {[
                { id: 'today', label: 'Día' },
                { id: 'month', label: 'Mes' },
                { id: 'year', label: 'Año' },
              ].map(opt => (
                <button
                  key={opt.id}
                  className={`dashboard__period-tab ${comparePeriod === opt.id ? 'dashboard__period-tab--active' : ''}`}
                  onClick={() => setComparePeriod(opt.id)}
                  disabled={compareLoading}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </header>

          {!financeCompare ? (
            <div className="dashboard__compare-loading">Cargando comparativo…</div>
          ) : (
            <>
              <div className="dashboard__compare-grid">
                <div className="dashboard__compare-block">
                  <span className="dashboard__compare-block-title">Financiero</span>
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={compareFinancial} margin={{ top: 6, right: 8, left: -12, bottom: 0 }} barCategoryGap="22%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
                      <XAxis dataKey="metric" tick={{ fontSize: 11, fill: '#64748B', fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={formatCOP} width={50} />
                      <Tooltip
                        cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                        contentStyle={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 10, fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}
                        formatter={(v) => formatCOPFull(v)}
                      />
                      <Bar dataKey="actual" name={labels.current} radius={[6, 6, 0, 0]} maxBarSize={42}>
                        {compareFinancial.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Bar>
                      <Bar dataKey="anterior" name={labels.prev} radius={[6, 6, 0, 0]} maxBarSize={42} fill="#CBD5E1" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="dashboard__compare-block">
                  <span className="dashboard__compare-block-title">Volumen</span>
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={compareVolume} margin={{ top: 6, right: 8, left: -12, bottom: 0 }} barCategoryGap="22%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
                      <XAxis dataKey="metric" tick={{ fontSize: 11, fill: '#64748B', fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
                      <Tooltip
                        cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                        contentStyle={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 10, fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}
                      />
                      <Bar dataKey="actual" name={labels.current} radius={[6, 6, 0, 0]} maxBarSize={42}>
                        {compareVolume.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Bar>
                      <Bar dataKey="anterior" name={labels.prev} radius={[6, 6, 0, 0]} maxBarSize={42} fill="#CBD5E1" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="dashboard__compare-deltas">
                {compareDeltas.map(d => {
                  const fmt = d.money ? formatCOP : (v) => v.toLocaleString('es-CO');
                  const isUp = d.delta >= 0;
                  const good = d.positive ? isUp : !isUp;
                  return (
                    <div key={d.label} className="dashboard__compare-delta">
                      <span className="dashboard__compare-delta-label">{d.label}</span>
                      <span className="dashboard__compare-delta-val">{fmt(d.actual)}</span>
                      <span className={`dashboard__compare-delta-pct dashboard__compare-delta-pct--${good ? 'up' : 'down'}`}>
                        {isUp ? Icon.trending : Icon.trendingDown}
                        {Math.abs(d.delta)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </article>

        {/* Payment methods — monthly, span 2 */}
        <article className="dashboard__card dashboard__card--span-2">
          <header className="dashboard__card-head">
            <div>
              <h2 className="dashboard__card-title">Métodos de pago del mes</h2>
              <p className="dashboard__card-sub">Total recibido por canal</p>
            </div>
          </header>
          {paymentMethods.length > 0 ? (
            <div className="dashboard__methods">
              {paymentMethods.map(m => {
                const color = PAYMENT_METHOD_COLORS[(m.method || '').toLowerCase()] || '#64748B';
                return (
                  <div key={m.method} className="dashboard__method">
                    <span className="dashboard__method-icon" style={{ background: `${color}1a`, color }}>
                      <PaymentIcon method={m.method} />
                    </span>
                    <div className="dashboard__method-info">
                      <span className="dashboard__method-name">{m.method}</span>
                      <span className="dashboard__method-meta">{m.count} tx</span>
                    </div>
                    <div className="dashboard__method-bar">
                      <span className="dashboard__method-bar-fill" style={{ width: `${m.pct_of_total}%`, background: color }} />
                    </div>
                    <span className="dashboard__method-amount">{formatCOPFull(m.total)}</span>
                    <span className="dashboard__method-pct" style={{ color }}>{m.pct_of_total}%</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={Icon.cash} title="Sin pagos este mes" description="Aparecerán al registrar ventas" />
          )}
        </article>
      </section>

      {/* OPERATIONS ROW — Top Staff (wide) + Top Services */}
      <section className="dashboard__ops">
        {/* Top staff del mes */}
        <article className="dashboard__card">
          <header className="dashboard__card-head">
            <div>
              <h2 className="dashboard__card-title">{Icon.trophy} Top staff del mes</h2>
              <p className="dashboard__card-sub">Ranking por ingresos · pasa el cursor para ver servicios</p>
            </div>
          </header>
          {topStaffSlice.length === 0 ? (
            <EmptyState icon={Icon.trophy} title="Sin datos" description="Aparecerá cuando haya ventas" />
          ) : (
            <div className="dashboard__staff">
              {topStaffSlice.map((s, i) => {
                const rank = i + 1;
                const services = (s.top_services || []).slice(0, 5);
                return (
                  <div key={s.staff_id} className="dashboard__staff-row">
                    <span className={`dashboard__staff-rank dashboard__staff-rank--${rank}`}>{rank}</span>
                    <div className="dashboard__staff-avatar">
                      {s.photo_url ? <img src={s.photo_url} alt={s.staff_name} /> : <span>{initials(s.staff_name)}</span>}
                    </div>
                    <div className="dashboard__staff-info">
                      <span className="dashboard__staff-name">{s.staff_name}</span>
                      <span className="dashboard__staff-meta">
                        {s.services_count} servicio{s.services_count !== 1 ? 's' : ''} · {s.unique_clients} cliente{s.unique_clients !== 1 ? 's' : ''}
                      </span>
                      {s.last_visit && (
                        <span className="dashboard__staff-last">
                          Última: <strong>{s.last_visit.client_name}</strong> · {s.last_visit.service_name} · {formatCOPFull(s.last_visit.amount)}
                        </span>
                      )}
                    </div>
                    <div className="dashboard__staff-stats">
                      <span className="dashboard__staff-revenue">{formatCOPFull(s.revenue)}</span>
                      <span className="dashboard__staff-comm">Comisión {formatCOPFull(s.commission_amount)}</span>
                    </div>
                    {services.length > 0 && (
                      <div className="dashboard__staff-pop">
                        <span className="dashboard__staff-pop-title">Servicios realizados</span>
                        {services.map((svc, idx) => (
                          <div key={idx} className="dashboard__staff-pop-row">
                            <span className="dashboard__staff-pop-name">{svc.name}</span>
                            <span className="dashboard__staff-pop-count">{svc.count}×</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </article>

        {/* Tareas + Pagos — combined as tabs, side-by-side with Top Staff */}
        <article className="dashboard__card">
          <header className="dashboard__card-head">
            <div className="dashboard__bottom-tabs">
              <button
                className={`dashboard__bottom-tab ${activeBottomTab === 'tasks' ? 'dashboard__bottom-tab--active' : ''}`}
                onClick={() => setActiveBottomTab('tasks')}
              >
                {Icon.zap} Tareas Lina
                {pendingTasks.length > 0 && <span className="dashboard__bottom-tab-count">{pendingTasks.length}</span>}
              </button>
              <button
                className={`dashboard__bottom-tab ${activeBottomTab === 'payments' ? 'dashboard__bottom-tab--active' : ''}`}
                onClick={() => setActiveBottomTab('payments')}
              >
                {Icon.alertTri} Pagos
                {paymentAlerts.length > 0 && <span className="dashboard__bottom-tab-count dashboard__bottom-tab-count--error">{paymentAlerts.length}</span>}
              </button>
            </div>
          </header>

          {activeBottomTab === 'tasks' && (
            pendingTasks.length === 0 && completedTasks.length === 0 ? (
              <EmptyState icon={Icon.check} title="Todo al día" description="No hay tareas pendientes" />
            ) : (
              <div className="dashboard__tasks">
                {pendingTasks.map(task => {
                  const content = (task.content || '').replace(/^PENDIENTE:\s*/i, '');
                  const cd = taskCountdown(task.created_at, task.content);
                  return (
                    <div key={task.id} className="dashboard__task">
                      <span className={`dashboard__task-dot ${cd?.done ? 'dashboard__task-dot--exec' : ''}`} />
                      <div className="dashboard__task-info">
                        <span className="dashboard__task-client">{task.client_name}</span>
                        <span className="dashboard__task-text">{content}</span>
                      </div>
                      <div className="dashboard__task-actions">
                        {cd && !cd.done ? (
                          <span className="dashboard__task-time">{Icon.clock} {cd.text}</span>
                        ) : cd?.done ? (
                          <span className="dashboard__task-time dashboard__task-time--exec">{Icon.zap} {cd.text}</span>
                        ) : (
                          <span className="dashboard__task-time">{Icon.clock} {timeAgo(task.created_at)}</span>
                        )}
                        <button className="dashboard__task-resolve" onClick={() => resolveTask(task.id)} title="Marcar resuelta">
                          {Icon.check}
                        </button>
                      </div>
                    </div>
                  );
                })}
                {completedTasks.slice(0, 3).map(task => {
                  const content = (task.content || '')
                    .replace(/^(COMPLETADO|RESUELTO|EXPIRADO):\s*/i, '')
                    .replace(/\s*\[Auto-resuelto.*?\]/, '')
                    .replace(/\s*\[Expirado.*?\]/, '');
                  return (
                    <div key={task.id} className="dashboard__task dashboard__task--done">
                      <span className="dashboard__task-check">{Icon.check}</span>
                      <div className="dashboard__task-info">
                        <span className="dashboard__task-client">{task.client_name}</span>
                        <span className="dashboard__task-text dashboard__task-text--done">{content}</span>
                      </div>
                      <span className="dashboard__pill dashboard__pill--neutral">
                        {task.status === 'completed' ? 'Completada' : 'Expirada'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {activeBottomTab === 'payments' && (
            paymentAlerts.length === 0 ? (
              <EmptyState icon={Icon.check} title="Sin pendientes" description="No hay pagos por verificar" />
            ) : (
              <div className="dashboard__alerts">
                {paymentAlerts.map(alert => (
                  <div key={alert.conversation_id} className="dashboard__alert">
                    <div className="dashboard__alert-info" onClick={() => goto('inbox')}>
                      <span className="dashboard__alert-name">{alert.client_name}</span>
                      <span className="dashboard__alert-phone">{formatPhone(alert.phone)}</span>
                    </div>
                    <button className="dashboard__alert-goto" onClick={() => goto('inbox')} title="Ver en Inbox">
                      Ver {Icon.arrowRight}
                    </button>
                    <button
                      className="dashboard__alert-x"
                      onClick={() => dismissPaymentAlert(alert.conversation_id)}
                      disabled={dismissingAlert === alert.conversation_id}
                      title="Descartar"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )
          )}
        </article>
      </section>

      {/* LINA IA + Estado citas + Top services */}
      <section className="dashboard__lina-row">
        <article className="dashboard__card dashboard__card--span-2 dashboard__lina">
          <header className="dashboard__card-head">
            <div>
              <h2 className="dashboard__card-title">{Icon.bot} Lina IA</h2>
              <p className="dashboard__card-sub">Asistente de WhatsApp</p>
            </div>
            <span className={`dashboard__lina-badge dashboard__lina-badge--${tenant.ai_is_paused ? 'blocked' : linaActive ? 'active' : 'inactive'}`}>
              {tenant.ai_is_paused ? 'Bloqueada' : linaActive ? 'Activa' : 'Inactiva'}
            </span>
          </header>

          {tenant.ai_is_paused ? (
            <div className="dashboard__lina-blocked">
              <span>Control bloqueado por soporte técnico</span>
            </div>
          ) : (
            <div className="dashboard__lina-toggle">
              <span className="dashboard__lina-toggle-label">
                {linaActive ? 'Respondiendo chats automáticamente' : 'IA pausada — sin respuestas automáticas'}
              </span>
              <button
                className={`dashboard__switch ${linaActive ? 'dashboard__switch--on' : ''}`}
                onClick={handleLinaToggle}
                disabled={linaToggling}
                aria-label={linaActive ? 'Desactivar Lina IA' : 'Activar Lina IA'}
              >
                <span className="dashboard__switch-knob" />
              </button>
            </div>
          )}

          <div className="dashboard__lina-bottom">
            <div className="dashboard__lina-stats">
              <div className="dashboard__lina-stat">
                <span className="dashboard__lina-stat-icon dashboard__lina-stat-icon--info">{Icon.message}</span>
                <div>
                  <span className="dashboard__lina-stat-val">{stats.lina_messages_today || 0}</span>
                  <span className="dashboard__lina-stat-lbl">Mensajes hoy</span>
                </div>
              </div>
              <div className="dashboard__lina-stat">
                <span className="dashboard__lina-stat-icon dashboard__lina-stat-icon--accent">{Icon.zap}</span>
                <div>
                  <span className="dashboard__lina-stat-val">{stats.lina_actions_today || 0}</span>
                  <span className="dashboard__lina-stat-lbl">Acciones hoy</span>
                </div>
              </div>
              <div className="dashboard__lina-stat">
                <span className="dashboard__lina-stat-icon dashboard__lina-stat-icon--success">{Icon.chat}</span>
                <div>
                  <span className="dashboard__lina-stat-val">{stats.whatsapp_active_conversations || 0}/{stats.whatsapp_total_conversations || 0}</span>
                  <span className="dashboard__lina-stat-lbl">Chats activos</span>
                </div>
              </div>
              <div className="dashboard__lina-stat">
                <span className="dashboard__lina-stat-icon dashboard__lina-stat-icon--warning">{Icon.mail}</span>
                <div>
                  <span className={`dashboard__lina-stat-val ${stats.whatsapp_unread > 0 ? 'dashboard__lina-stat-val--alert' : ''}`}>{stats.whatsapp_unread || 0}</span>
                  <span className="dashboard__lina-stat-lbl">No leídos</span>
                </div>
              </div>
            </div>
            <div className="dashboard__lina-meter">
              <UsageMeter />
            </div>
          </div>
        </article>

        {/* Status donut — beside Lina */}
        <article className="dashboard__card">
          <header className="dashboard__card-head">
            <div>
              <h2 className="dashboard__card-title">Estado de citas</h2>
              <p className="dashboard__card-sub">{appointments.length} citas hoy</p>
            </div>
          </header>
          {apptStatusData.length > 0 ? (
            <div className="dashboard__donut">
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={apptStatusData} cx="50%" cy="50%" innerRadius={42} outerRadius={62} paddingAngle={2} dataKey="value" stroke="none">
                    {apptStatusData.map((e, i) => (
                      <Cell key={i} fill={STATUS_COLORS[e.status] || '#94A3B8'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 10, fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}
                    formatter={(v, n) => [`${v} cita${v !== 1 ? 's' : ''}`, n]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="dashboard__donut-legend">
                {apptStatusData.map(e => {
                  const total = apptStatusData.reduce((s, x) => s + x.value, 0);
                  const pct = total ? Math.round((e.value / total) * 100) : 0;
                  return (
                    <div key={e.status} className="dashboard__donut-row">
                      <span className="dashboard__donut-dot" style={{ background: STATUS_COLORS[e.status] || '#94A3B8' }} />
                      <span className="dashboard__donut-label">{e.name}</span>
                      <span className="dashboard__donut-val">{e.value} · {pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <EmptyState icon={Icon.calendar} title="Sin citas" description="No hay citas agendadas hoy" />
          )}
        </article>

        {/* Top services — beside Lina */}
        <article className="dashboard__card">
          <header className="dashboard__card-head">
            <div>
              <h2 className="dashboard__card-title">{Icon.scissors} Servicios populares</h2>
              <p className="dashboard__card-sub">Más solicitados hoy</p>
            </div>
          </header>
          {topServices.length === 0 ? (
            <EmptyState icon={Icon.scissors} title="Sin datos" description="Aparecerán al registrar visitas" />
          ) : (
            <div className="dashboard__services">
              {topServices.map((svc, i) => {
                const max = topServices[0]?.count || 1;
                const pct = (svc.count / max) * 100;
                return (
                  <div key={i} className="dashboard__service">
                    <div className="dashboard__service-row">
                      <span className="dashboard__service-name">{svc.name}</span>
                      <span className="dashboard__service-count">{svc.count}</span>
                    </div>
                    <div className="dashboard__service-bar">
                      <span className="dashboard__service-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>
      </section>

      {/* QR MODAL — rendered via portal to escape any stacking context */}
      {qrOpen && createPortal(
        <div className="dashboard__qr-overlay" onClick={() => setQrOpen(false)}>
          <div className="dashboard__qr-modal" onClick={(e) => e.stopPropagation()}>
            <button className="dashboard__qr-close" onClick={() => setQrOpen(false)} aria-label="Cerrar">✕</button>
            <div className="dashboard__qr-content">
              <h3 className="dashboard__qr-title">Tu enlace de reservas</h3>
              <p className="dashboard__qr-text">
                Comparte tu enlace en redes sociales o imprime el QR para tu local.
                Tus clientes podrán agendar sus citas en segundos.
              </p>
              {bookingUrl ? (
                <>
                  <label className="dashboard__qr-url-label">URL de reservas</label>
                  <div className="dashboard__qr-url">
                    <span className="dashboard__qr-url-text">{bookingUrl}</span>
                    <button
                      className="dashboard__qr-url-copy"
                      onClick={() => {
                        navigator.clipboard.writeText(bookingUrl);
                        setCopiedUrl(true);
                        setTimeout(() => setCopiedUrl(false), 2000);
                      }}
                    >
                      {copiedUrl ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                  <button className="dashboard__qr-config" onClick={() => { setQrOpen(false); goto('settings'); }}>
                    Configurar en ajustes {Icon.arrowRight}
                  </button>
                </>
              ) : (
                <div className="dashboard__qr-empty">
                  <p>Tu enlace de reservas aún no está configurado.</p>
                  <button className="dashboard__qr-config" onClick={() => { setQrOpen(false); goto('settings'); }}>
                    Configurar ahora {Icon.arrowRight}
                  </button>
                </div>
              )}
            </div>
            <div className="dashboard__qr-side">
              {bookingUrl ? (
                <>
                  <div className="dashboard__qr-image">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(bookingUrl)}`}
                      alt="QR de reservas"
                    />
                  </div>
                  <span className="dashboard__qr-side-label">Recibe citas</span>
                </>
              ) : (
                <div className="dashboard__qr-image dashboard__qr-image--empty">
                  {Icon.qr}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Dashboard;
