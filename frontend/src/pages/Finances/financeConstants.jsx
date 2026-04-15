import { useState, useEffect } from 'react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
} from 'recharts';
import financeService from '../../services/financeService';

export const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

export const AUTO_REFRESH_MS = 60000;
export const CHART_HEIGHT = { sm: 120, md: 220, lg: 280, xl: 260 };

export const Icons = {
  dollar: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  trendUp: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  trendDown: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
      <polyline points="17 18 23 18 23 12" />
    </svg>
  ),
  receipt: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M8 10h8" /><path d="M8 14h4" />
    </svg>
  ),
  users: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  alert: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  scissors: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
    </svg>
  ),
  barChart: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  creditCard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
  pieChart: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" />
    </svg>
  ),
  trophy: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  ),
  calendar: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  star: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  refresh: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  ),
  person: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
  zap: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="0">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  plus: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  trash: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  edit: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  check: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  fileText: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  wallet: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" /><path d="M4 6v12a2 2 0 0 0 2 2h14v-4" /><path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" />
    </svg>
  ),
  download: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  clock: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
};

export const CHART_COLORS = ['#2D5A3D', '#C9A84C', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];
export const PM_COLORS = { 'efectivo': '#2D5A3D', 'transferencia': '#3B82F6', 'tarjeta': '#C9A84C', 'nequi': '#8B5CF6', 'daviplata': '#EF4444', 'Sin registrar': '#8E8E85' };

export const CATEGORY_COLORS = {
  'Barberia': '#2D5A3D',
  'Arte en Unas': '#C9A84C',
  'Peluqueria': '#60A5FA',
  'Tratamientos Capilares': '#34D399',
  'Color': '#F87171',
  'Otros': '#8E8E85',
};

export const EXPENSE_CATEGORIES = {
  'Arriendo': { icon: '\u{1F3E0}', subs: [] },
  'Nomina': { icon: '\u{1F465}', subs: ['Salarios', 'Prestaciones', 'Seguridad social'] },
  'Productos': { icon: '\u{1F4E6}', subs: ['Insumos peluqueria', 'Productos reventa', 'Limpieza'] },
  'Servicios publicos': { icon: '\u26A1', subs: ['Luz', 'Agua', 'Internet', 'Gas', 'Telefono'] },
  'Marketing': { icon: '\u{1F4F1}', subs: ['Redes sociales', 'Material impreso', 'Eventos'] },
  'Mantenimiento': { icon: '\u{1F527}', subs: ['Equipos', 'Instalaciones', 'Software/licencias'] },
  'Impuestos': { icon: '\u{1F4CB}', subs: [] },
  'Otros': { icon: '\u{1F4CB}', subs: [] },
};

export const RECURRING_OPTIONS = [
  { value: 'semanal', label: 'Semanal' },
  { value: 'quincenal', label: 'Quincenal' },
  { value: 'mensual', label: 'Mensual' },
  { value: 'bimestral', label: 'Bimestral' },
  { value: 'anual', label: 'Anual' },
];

export const PAYMENT_METHODS = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'bancolombia', label: 'Bancolombia' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'tarjeta_debito', label: 'Tarjeta Debito' },
  { value: 'tarjeta_credito', label: 'Tarjeta Credito' },
  { value: 'nequi', label: 'Nequi' },
  { value: 'daviplata', label: 'Daviplata' },
  { value: 'mixto', label: 'Mixto' },
];

export const PERIOD_OPTIONS = [
  { value: 'today', label: 'Hoy' },
  { value: 'week', label: 'Esta Semana' },
  { value: 'month', label: 'Este Mes' },
  { value: 'year', label: 'Este Año' },
];

export const TAB_OPTIONS = [
  { value: 'resumen', label: 'Resumen', color: '#2D5A3D', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
  { value: 'reportes', label: 'Reportes', color: '#3B82F6', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg> },
  { value: 'liquidacion', label: 'Liquidacion', color: '#8B5CF6', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  { value: 'gastos', label: 'Gastos y Caja', color: '#DC2626', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12V7H5a2 2 0 010-4h14v4"/><path d="M3 5v14a2 2 0 002 2h14v-4"/><path d="M18 12a2 2 0 000 4h4v-4h-4z"/></svg> },
  { value: 'facturas', label: 'Facturas', color: '#059669', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
  { value: 'dian', label: 'DIAN', color: '#6366F1', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> },
];

export const STAFF_COLORS = ['#2D5A3D', '#8B6914', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];
export const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];

export const STATUS_COLORS = { draft: '#8E8E85', sent: '#3B82F6', paid: '#10B981', cancelled: '#EF4444' };
export const STATUS_LABELS = { draft: 'Borrador', sent: 'Enviada', paid: 'Pagada', cancelled: 'Anulada' };
export const STATUS_ICONS = {
  draft: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  sent: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  paid: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  cancelled: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
};

export const GASTOS_PERIODS = [
  { value: 'month', label: 'Este Mes' },
  { value: 'last_month', label: 'Mes Anterior' },
  { value: 'week', label: 'Esta Semana' },
  { value: 'year', label: 'Este Año' },
  { value: 'custom', label: 'Personalizado' },
];

export const NOMINA_PERIODS = [
  { value: 'month', label: 'Este Mes' },
  { value: 'last_month', label: 'Mes Anterior' },
  { value: 'fortnight', label: 'Última Quincena' },
  { value: 'year', label: 'Este Año' },
  { value: 'custom', label: 'Personalizado' },
];

export const DIAN_STATUS_META = {
  pending: { label: 'POS asignado', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
  sent: { label: 'Enviada', color: '#3B82F6', bg: 'rgba(59,130,246,0.08)' },
  accepted: { label: 'Aceptada DIAN', color: '#059669', bg: 'rgba(5,150,105,0.08)' },
  rejected: { label: 'Rechazada', color: '#DC2626', bg: 'rgba(220,38,38,0.08)' },
  voided: { label: 'Anulada', color: '#94A3B8', bg: 'rgba(148,163,184,0.08)' },
};

// Helpers
export const formatCOP = (value) => {
  if (!value && value !== 0) return '$0';
  return `$${Number(value).toLocaleString('es-CO')}`;
};

export const formatDateRange = (from, to) => {
  if (!from || !to) return '';
  const opts = { day: 'numeric', month: 'short' };
  const f = new Date(from + 'T12:00:00');
  const t = new Date(to + 'T12:00:00');
  if (from === to) return f.toLocaleDateString('es-CO', { ...opts, year: 'numeric' });
  return `${f.toLocaleDateString('es-CO', opts)} — ${t.toLocaleDateString('es-CO', { ...opts, year: 'numeric' })}`;
};

export const formatDayLabel = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDate();
  const weekday = d.toLocaleDateString('es-CO', { weekday: 'short' }).slice(0, 2);
  return { day, weekday };
};

// Product commission parsing helpers
export const PRODUCTS_TAG = '<!--PRODUCTS:';
export const PRODUCTS_TAG_END = ':PRODUCTS-->';
export const parseProducts = (notes) => {
  if (!notes) return [];
  const s = notes.indexOf(PRODUCTS_TAG);
  if (s === -1) return [];
  const e = notes.indexOf(PRODUCTS_TAG_END);
  if (e === -1) return [];
  try {
    const parsed = JSON.parse(notes.substring(s + PRODUCTS_TAG.length, e));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(p => p && typeof p === 'object');
  } catch (err) {
    console.error('Failed to parse product commissions:', err);
    return [];
  }
};

// Mini-components
export const AnimatedNumber = ({ value, prefix = '', suffix = '' }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const numericValue = typeof value === 'number' ? value : parseInt(value, 10) || 0;
    if (numericValue === 0) { setDisplayValue(0); return; }

    const duration = 1200;
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplayValue(Math.round(numericValue * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [value]);

  return <span>{prefix}{displayValue.toLocaleString('es-CO')}{suffix}</span>;
};

export const GrowthBadge = ({ value }) => {
  if (value === null || value === undefined) return null;
  const isPositive = value >= 0;
  return (
    <span className={`finances__growth ${isPositive ? 'finances__growth--up' : 'finances__growth--down'}`}>
      {isPositive ? Icons.trendUp : Icons.trendDown}
      <span>{isPositive ? '+' : ''}{value}%</span>
    </span>
  );
};

export const RechartsTooltip = ({ active, payload, label, formatter }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="finances__recharts-tooltip">
      <span className="finances__recharts-tooltip-label">{label}</span>
      {payload.map((entry, i) => (
        <div key={i} className="finances__recharts-tooltip-row">
          <span className="finances__recharts-tooltip-dot" style={{ background: entry.color }} />
          <span>{entry.name}: {formatter ? formatter(entry.value) : entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export const SkeletonBlock = ({ width = '100%', height = '14px' }) => (
  <div className="finances__skeleton" style={{ width, height }} />
);

export const PaymentDonutChart = ({ data }) => {
  if (!data || !data.items || data.items.length === 0) return null;
  const total = data.items.reduce((s, i) => s + i.total, 0);

  return (
    <div className="finances__card">
      <div className="finances__card-header">
        <h2 className="finances__card-title">{Icons.wallet} Metodos de Pago</h2>
      </div>
      <div className="finances__donut-wrap">
        <div className="finances__donut-chart">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={data.items} dataKey="total" nameKey="method" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} strokeWidth={0}>
                {data.items.map((entry, i) => (
                  <Cell key={i} fill={PM_COLORS[entry.method] || CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<RechartsTooltip formatter={formatCOP} />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="finances__donut-center">
            <span className="finances__donut-total">{formatCOP(total)}</span>
            <span className="finances__donut-label">Total</span>
          </div>
        </div>
        <div className="finances__donut-legend">
          {data.items.map((item, i) => (
            <div key={i} className="finances__donut-legend-item">
              <span className="finances__donut-legend-dot" style={{ background: PM_COLORS[item.method] || CHART_COLORS[i % CHART_COLORS.length] }} />
              <span className="finances__donut-legend-name">{item.method}</span>
              <span className="finances__donut-legend-value">{formatCOP(item.total)}</span>
              <span className="finances__donut-legend-pct">{item.pct_of_total}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
