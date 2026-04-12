import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTenant } from '../../context/TenantContext';
import { useNotification } from '../../context/NotificationContext';
import { formatPhone } from '../../utils/formatters';
import financeService from '../../services/financeService';
import clientService from '../../services/clientService';
import servicesService from '../../services/servicesService';
import staffService from '../../services/staffService';
import aiService from '../../services/aiService';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

const Icons = {
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
};

const CHART_COLORS = ['#2D5A3D', '#C9A84C', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];
const PM_COLORS = { 'efectivo': '#2D5A3D', 'transferencia': '#3B82F6', 'tarjeta': '#C9A84C', 'nequi': '#8B5CF6', 'daviplata': '#EF4444', 'Sin registrar': '#8E8E85' };

const formatCOP = (value) => {
  if (!value && value !== 0) return '$0';
  return `$${Number(value).toLocaleString('es-CO')}`;
};

const formatDateRange = (from, to) => {
  if (!from || !to) return '';
  const opts = { day: 'numeric', month: 'short' };
  const f = new Date(from + 'T12:00:00');
  const t = new Date(to + 'T12:00:00');
  if (from === to) return f.toLocaleDateString('es-CO', { ...opts, year: 'numeric' });
  return `${f.toLocaleDateString('es-CO', opts)} — ${t.toLocaleDateString('es-CO', { ...opts, year: 'numeric' })}`;
};

const formatDayLabel = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDate();
  const weekday = d.toLocaleDateString('es-CO', { weekday: 'short' }).slice(0, 2);
  return { day, weekday };
};

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Hoy' },
  { value: 'week', label: 'Esta Semana' },
  { value: 'month', label: 'Este Mes' },
  { value: 'year', label: 'Este Año' },
];

const CATEGORY_COLORS = {
  'Barberia': '#2D5A3D',
  'Arte en Unas': '#C9A84C',
  'Peluqueria': '#60A5FA',
  'Tratamientos Capilares': '#34D399',
  'Color': '#F87171',
  'Otros': '#8E8E85',
};

const EXPENSE_CATEGORIES = {
  'Arriendo': { icon: '\u{1F3E0}', subs: [] },
  'Nomina': { icon: '\u{1F465}', subs: ['Salarios', 'Prestaciones', 'Seguridad social'] },
  'Productos': { icon: '\u{1F4E6}', subs: ['Insumos peluqueria', 'Productos reventa', 'Limpieza'] },
  'Servicios publicos': { icon: '\u26A1', subs: ['Luz', 'Agua', 'Internet', 'Gas', 'Telefono'] },
  'Marketing': { icon: '\u{1F4F1}', subs: ['Redes sociales', 'Material impreso', 'Eventos'] },
  'Mantenimiento': { icon: '\u{1F527}', subs: ['Equipos', 'Instalaciones', 'Software/licencias'] },
  'Impuestos': { icon: '\u{1F4CB}', subs: [] },
  'Otros': { icon: '\u{1F4CB}', subs: [] },
};

const RECURRING_OPTIONS = [
  { value: 'semanal', label: 'Semanal' },
  { value: 'quincenal', label: 'Quincenal' },
  { value: 'mensual', label: 'Mensual' },
  { value: 'bimestral', label: 'Bimestral' },
  { value: 'anual', label: 'Anual' },
];

const PAYMENT_METHODS = [
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

const TAB_OPTIONS = [
  { value: 'resumen', label: 'Resumen' },
  { value: 'forecast', label: 'Proyección' },
  { value: 'reportes', label: 'Reportes' },
  { value: 'rendimiento', label: 'Rendimiento' },
  { value: 'gastos', label: 'Gastos' },
  { value: 'facturas', label: 'Facturas' },
  { value: 'nomina', label: 'Nómina' },
  { value: 'dian', label: 'DIAN' },
];

const AnimatedNumber = ({ value, prefix = '', suffix = '' }) => {
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

const GrowthBadge = ({ value }) => {
  if (value === null || value === undefined) return null;
  const isPositive = value >= 0;
  return (
    <span className={`finances__growth ${isPositive ? 'finances__growth--up' : 'finances__growth--down'}`}>
      {isPositive ? Icons.trendUp : Icons.trendDown}
      <span>{isPositive ? '+' : ''}{value}%</span>
    </span>
  );
};

const RechartsTooltip = ({ active, payload, label, formatter }) => {
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

const RevenueAreaChart = ({ data }) => {
  if (!data || data.length === 0) return <div className="finances__empty">Sin datos de ingresos para este periodo</div>;

  const chartData = data.map(item => {
    const { day, weekday } = formatDayLabel(item.date);
    return { ...item, label: `${weekday} ${day}`, avg_ticket: item.visits > 0 ? Math.round(item.revenue / item.visits) : 0 };
  });

  const useBar = chartData.length <= 7;

  return (
    <div className="finances__recharts-container">
      <ResponsiveContainer width="100%" height={280}>
        {useBar ? (
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2D5A3D" />
                <stop offset="100%" stopColor="#3D7A52" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#EDEDEB" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#8E8E85', fontWeight: 600 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#8E8E85' }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${Math.round(v/1000)}k` : v} width={50} />
            <Tooltip content={<RechartsTooltip formatter={formatCOP} />} />
            <Bar dataKey="revenue" name="Ingresos" fill="url(#barGrad)" radius={[6, 6, 0, 0]} maxBarSize={60} />
          </BarChart>
        ) : (
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2D5A3D" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#2D5A3D" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#EDEDEB" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8E8E85' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#8E8E85' }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${Math.round(v/1000)}k` : v} width={50} />
            <Tooltip content={<RechartsTooltip formatter={formatCOP} />} />
            <Area type="monotone" dataKey="revenue" name="Ingresos" stroke="#2D5A3D" strokeWidth={2.5} fill="url(#revenueGrad)" dot={{ r: 3, fill: '#2D5A3D', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#2D5A3D', stroke: '#fff', strokeWidth: 2 }} />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
};

const PaymentDonutChart = ({ data }) => {
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

const StaffBarChart = ({ data }) => {
  if (!data || data.length === 0) return null;
  const chartData = data.map(s => ({ ...s, initials: s.staff_name.split(' ').map(w => w[0]).join('').slice(0, 2) }));

  return (
    <div className="finances__recharts-container">
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 50)}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EDEDEB" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: '#8E8E85' }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${Math.round(v/1000)}k` : v} />
          <YAxis type="category" dataKey="staff_name" tick={{ fontSize: 12, fill: '#333330' }} tickLine={false} axisLine={false} width={160} />
          <Tooltip content={<RechartsTooltip formatter={formatCOP} />} />
          <Bar dataKey="revenue" name="Ingresos" radius={[0, 6, 6, 0]} barSize={24}>
            {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

const CategoryBreakdown = ({ categories }) => {
  if (!categories || categories.length === 0) return <div className="finances__empty">Sin datos por categoria</div>;
  const total = categories.reduce((s, c) => s + c.revenue, 0) || 1;

  return (
    <div className="finances__categories">
      <div className="finances__categories-bar">
        {categories.map((cat, i) => (
          <div
            key={i}
            className="finances__categories-segment"
            style={{
              width: `${Math.max((cat.revenue / total) * 100, 2)}%`,
              background: CATEGORY_COLORS[cat.category] || CATEGORY_COLORS['Otros'],
            }}
            title={`${cat.category}: ${formatCOP(cat.revenue)}`}
          />
        ))}
      </div>
      <div className="finances__categories-legend">
        {categories.map((cat, i) => (
          <div key={i} className="finances__categories-item">
            <span className="finances__categories-dot" style={{ background: CATEGORY_COLORS[cat.category] || CATEGORY_COLORS['Otros'] }} />
            <span className="finances__categories-name">{cat.category}</span>
            <span className="finances__categories-value">{formatCOP(cat.revenue)}</span>
            <span className="finances__categories-pct">{cat.pct_of_total}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const SkeletonBlock = ({ width = '100%', height = '14px' }) => (
  <div className="finances__skeleton" style={{ width, height }} />
);

const InsightsPanel = ({ data }) => {
  if (!data) return null;
  const insights = [];

  if (data.best_day_date && data.best_day_revenue > 0) {
    const d = new Date(data.best_day_date + 'T12:00:00');
    insights.push({
      icon: Icons.trophy,
      label: 'Mejor dia',
      value: `${d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' })} — ${formatCOP(data.best_day_revenue)}`,
      color: 'accent',
    });
  }
  if (data.unique_clients > 0) {
    insights.push({ icon: Icons.person, label: 'Clientes atendidos', value: `${data.unique_clients} clientes unicos`, color: 'info' });
  }
  if (data.avg_ticket > 0) {
    insights.push({ icon: Icons.zap, label: 'Ticket promedio', value: formatCOP(data.avg_ticket), color: 'success' });
  }
  if (data.busiest_day_date && data.busiest_day_visits > 0) {
    const d = new Date(data.busiest_day_date + 'T12:00:00');
    insights.push({
      icon: Icons.calendar,
      label: 'Dia mas ocupado',
      value: `${d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric' })} — ${data.busiest_day_visits} servicios`,
      color: 'primary',
    });
  }

  if (insights.length === 0) return null;

  return (
    <div className="finances__insights">
      {insights.map((ins, i) => (
        <div key={i} className={`finances__insight finances__insight--${ins.color}`}>
          <span className="finances__insight-icon">{ins.icon}</span>
          <div className="finances__insight-text">
            <span className="finances__insight-label">{ins.label}</span>
            <span className="finances__insight-value">{ins.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

const PaymentMethodsCard = ({ period, dateFrom, dateTo }) => {
  const [data, setData] = useState(null);

  useEffect(() => {
    const params = { period };
    if (period === 'custom' && dateFrom && dateTo) {
      params.date_from = dateFrom;
      params.date_to = dateTo;
    }
    financeService.paymentMethods(params).then(setData).catch(() => {});
  }, [period, dateFrom, dateTo]);

  if (!data || !data.items || data.items.length === 0) return null;

  return <PaymentDonutChart data={data} />;
};

const TabResumen = ({ data, loading, period, dateFrom, dateTo }) => {
  const hasData = data && data.total_visits > 0;

  return (
    <>
      <div className="finances__kpis">
        <div className="finances__kpi-card finances__kpi-card--primary">
          <div className="finances__kpi-icon finances__kpi-icon--primary">{Icons.dollar}</div>
          <div className="finances__kpi-info">
            {loading ? <SkeletonBlock width="110px" height="30px" /> : (
              <>
                <span className="finances__kpi-value"><AnimatedNumber value={data?.total_revenue || 0} prefix="$" /></span>
                <GrowthBadge value={data?.revenue_growth_pct} />
              </>
            )}
            <span className="finances__kpi-label">Ingresos Totales</span>
          </div>
        </div>
        <div className="finances__kpi-card">
          <div className="finances__kpi-icon finances__kpi-icon--success">{Icons.receipt}</div>
          <div className="finances__kpi-info">
            {loading ? <SkeletonBlock width="50px" height="30px" /> : (
              <>
                <span className="finances__kpi-value"><AnimatedNumber value={data?.total_visits || 0} /></span>
                <GrowthBadge value={data?.visits_growth_pct} />
              </>
            )}
            <span className="finances__kpi-label">Servicios Realizados</span>
          </div>
        </div>
        <div className="finances__kpi-card">
          <div className="finances__kpi-icon finances__kpi-icon--info">{Icons.users}</div>
          <div className="finances__kpi-info">
            {loading ? <SkeletonBlock width="40px" height="30px" /> : (
              <span className="finances__kpi-value"><AnimatedNumber value={data?.unique_clients || 0} /></span>
            )}
            <span className="finances__kpi-label">Clientes Atendidos</span>
          </div>
        </div>
        <div className="finances__kpi-card">
          <div className="finances__kpi-icon finances__kpi-icon--accent">{Icons.creditCard}</div>
          <div className="finances__kpi-info">
            {loading ? <SkeletonBlock width="70px" height="30px" /> : (
              <span className="finances__kpi-value"><AnimatedNumber value={data?.avg_ticket || 0} prefix="$" /></span>
            )}
            <span className="finances__kpi-label">Ticket Promedio</span>
          </div>
        </div>
        {(data?.pending_payments || 0) > 0 && (
          <div className="finances__kpi-card finances__kpi-card--warning">
            <div className="finances__kpi-icon finances__kpi-icon--warning">{Icons.alert}</div>
            <div className="finances__kpi-info">
              <span className="finances__kpi-value"><AnimatedNumber value={data?.pending_payments || 0} /></span>
              <span className="finances__kpi-label">Pagos Pendientes</span>
            </div>
          </div>
        )}
      </div>

      {!loading && hasData && <InsightsPanel data={data} />}
      <div className="finances__body">
        <div className="finances__card finances__card--chart">
          <div className="finances__card-header">
            <h2 className="finances__card-title">{Icons.barChart} Ingresos por Dia</h2>
            {!loading && hasData && (
              <span className="finances__card-badge">{data.revenue_by_day.length} {data.revenue_by_day.length === 1 ? 'dia' : 'dias'}</span>
            )}
          </div>
          {loading ? (
            <div className="finances__chart-skeleton">
              {[...Array(8)].map((_, i) => <SkeletonBlock key={i} width="24px" height={`${25 + Math.random() * 65}%`} />)}
            </div>
          ) : (
            <RevenueAreaChart data={data?.revenue_by_day || []} />
          )}
        </div>

        <div className="finances__card">
          <div className="finances__card-header">
            <h2 className="finances__card-title">{Icons.scissors} Top Servicios</h2>
            {!loading && hasData && <span className="finances__card-badge">{data.revenue_by_service.length} servicios</span>}
          </div>
          {loading ? (
            <div className="finances__list-skeleton">{[...Array(5)].map((_, i) => <SkeletonBlock key={i} width="100%" height="44px" />)}</div>
          ) : (
            <div className="finances__ranking-list">
              {(data?.revenue_by_service || []).slice(0, 10).map((svc, i) => {
                const maxRev = (data?.revenue_by_service?.[0]?.revenue) || 1;
                const pct = Math.round((svc.revenue / maxRev) * 100);
                const isTop3 = i < 3;
                return (
                  <div key={i} className={`finances__ranking-item ${isTop3 ? 'finances__ranking-item--top' : ''}`}>
                    <span className={`finances__ranking-pos ${isTop3 ? 'finances__ranking-pos--highlight' : ''}`}>
                      {i === 0 ? Icons.star : i + 1}
                    </span>
                    <div className="finances__ranking-info">
                      <div className="finances__ranking-top">
                        <div className="finances__ranking-name-wrap">
                          <span className="finances__ranking-name">{svc.service_name.split(',').filter(s => !s.trim().startsWith('[Producto]')).join(', ').trim() || svc.service_name.split(',')[0]}</span>
                          {svc.category && <span className="finances__ranking-cat" style={{ color: CATEGORY_COLORS[svc.category] || CATEGORY_COLORS['Otros'] }}>{svc.category}</span>}
                        </div>
                        <div className="finances__ranking-amounts">
                          <span className="finances__ranking-amount">{formatCOP(svc.revenue)}</span>
                          <span className="finances__ranking-pct">{svc.pct_of_total}%</span>
                        </div>
                      </div>
                      <div className="finances__ranking-bar-bg">
                        <div className="finances__ranking-bar" style={{ width: `${pct}%`, background: CATEGORY_COLORS[svc.category] || CATEGORY_COLORS['Otros'] }} />
                      </div>
                      <span className="finances__ranking-count">{svc.count} {svc.count === 1 ? 'servicio' : 'servicios'}</span>
                    </div>
                  </div>
                );
              })}
              {(!data?.revenue_by_service || data.revenue_by_service.length === 0) && <div className="finances__empty">Sin datos para este periodo</div>}
            </div>
          )}
        </div>
      </div>
      <div className="finances__body finances__body--bottom">
        <div className="finances__card">
          <div className="finances__card-header">
            <h2 className="finances__card-title">{Icons.pieChart} Distribucion por Categoria</h2>
          </div>
          {loading ? (
            <div className="finances__list-skeleton">
              <SkeletonBlock width="100%" height="12px" />
              {[...Array(4)].map((_, i) => <SkeletonBlock key={i} width="100%" height="32px" />)}
            </div>
          ) : (
            <CategoryBreakdown categories={data?.revenue_by_category || []} />
          )}
        </div>

        <div className="finances__card">
          <div className="finances__card-header">
            <h2 className="finances__card-title">{Icons.users} Rendimiento por Profesional</h2>
          </div>
          {loading ? (
            <div className="finances__list-skeleton">{[...Array(3)].map((_, i) => <SkeletonBlock key={i} width="100%" height="64px" />)}</div>
          ) : (
            <StaffBarChart data={data?.revenue_by_staff || []} />
          )}
        </div>
      </div>
      {!loading && <OwnerProfitPanel period={period} dateFrom={dateFrom} dateTo={dateTo} />}
      <div className="finances__body finances__body--bottom">
        {!loading && <PaymentMethodsCard period={period} dateFrom={dateFrom} dateTo={dateTo} />}
      </div>
      {!loading && <FinanceAIWidget period={period} dateFrom={dateFrom} dateTo={dateTo} />}
    </>
  );
};

const OwnerProfitPanel = ({ period, dateFrom, dateTo }) => {
  const [pnl, setPnl] = useState(null);

  useEffect(() => {
    const params = { period };
    if (period === 'custom' && dateFrom && dateTo) {
      params.date_from = dateFrom;
      params.date_to = dateTo;
    }
    financeService.getPnL(params).then(setPnl).catch(() => {});
  }, [period, dateFrom, dateTo]);

  if (!pnl) return null;

  const ivaDefault = localStorage.getItem('alpelo_iva_default') === 'true';
  const estimatedIva = ivaDefault ? Math.round(pnl.total_revenue * 0.19) : 0;
  const isProfit = pnl.net_profit >= 0;

  return (
    <div className="finances__owner-panel">
      <div className="finances__owner-hero">
        <span className="finances__owner-eyebrow">Tu Ganancia Neta</span>
        <span className={`finances__owner-big ${isProfit ? '' : 'finances__owner-big--loss'}`}>
          {formatCOP(pnl.net_profit)}
        </span>
        <div className="finances__owner-margin">
          <div className="finances__owner-margin-bar">
            <div className="finances__owner-margin-fill" style={{ width: `${Math.max(Math.min(pnl.margin_pct, 100), 0)}%` }} />
          </div>
          <span className="finances__owner-margin-label">Margen {pnl.margin_pct}%</span>
        </div>
      </div>
      <div className="finances__owner-breakdown">
        <div className="finances__owner-row">
          <div className="finances__owner-row-left">
            <span className="finances__owner-dot finances__owner-dot--green" />
            <span className="finances__owner-label">Ingresos por servicios</span>
          </div>
          <span className="finances__owner-value finances__owner-value--positive">+{formatCOP(pnl.total_revenue)}</span>
        </div>
        <div className="finances__owner-row">
          <div className="finances__owner-row-left">
            <span className="finances__owner-dot finances__owner-dot--red" />
            <span className="finances__owner-label">Comisiones equipo</span>
          </div>
          <span className="finances__owner-value finances__owner-value--negative">-{formatCOP(pnl.total_commissions)}</span>
        </div>
        <div className="finances__owner-row">
          <div className="finances__owner-row-left">
            <span className="finances__owner-dot finances__owner-dot--orange" />
            <span className="finances__owner-label">Gastos operativos</span>
          </div>
          <span className="finances__owner-value finances__owner-value--negative">-{formatCOP(pnl.total_expenses)}</span>
        </div>
        {estimatedIva > 0 && (
          <div className="finances__owner-row finances__owner-row--subtle">
            <div className="finances__owner-row-left">
              <span className="finances__owner-dot finances__owner-dot--muted" />
              <span className="finances__owner-label">IVA recaudado (est.)</span>
            </div>
            <span className="finances__owner-value finances__owner-value--muted">{formatCOP(estimatedIva)}</span>
          </div>
        )}
        <div className="finances__owner-dist">
          {pnl.total_revenue > 0 && (
            <>
              <div className="finances__owner-dist-seg finances__owner-dist-seg--profit" style={{ width: `${Math.max((pnl.net_profit / pnl.total_revenue) * 100, 0)}%` }} title={`Ganancia: ${formatCOP(pnl.net_profit)}`} />
              <div className="finances__owner-dist-seg finances__owner-dist-seg--comm" style={{ width: `${(pnl.total_commissions / pnl.total_revenue) * 100}%` }} title={`Comisiones: ${formatCOP(pnl.total_commissions)}`} />
              <div className="finances__owner-dist-seg finances__owner-dist-seg--expense" style={{ width: `${(pnl.total_expenses / pnl.total_revenue) * 100}%` }} title={`Gastos: ${formatCOP(pnl.total_expenses)}`} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const FinanceAIWidget = ({ period, dateFrom, dateTo }) => {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const periodLabel = period === 'custom' && dateFrom && dateTo
    ? `${dateFrom} a ${dateTo}`
    : { today: 'hoy', week: 'esta semana', month: 'este mes', year: 'este ano' }[period] || period;

  const chips = [
    'Cuanto gaste en productos este mes?',
    'Cual fue mi mejor dia?',
    'Cuanto le debo al equipo?',
    'Resumen financiero completo',
  ];

  const handleAsk = async (message) => {
    if (!message.trim()) return;
    setLoading(true);
    setResponse('');
    try {
      const prefixed = `[Finanzas] El usuario pregunta desde la pagina de Finanzas, periodo: ${periodLabel}. Pregunta: ${message}`;
      const res = await aiService.chat(prefixed, []);
      setResponse(res.response);
    } catch {
      setResponse('Error al consultar la IA. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleAsk(query);
  };

  return (
    <div className={`finances__ai-widget ${expanded ? 'finances__ai-widget--expanded' : ''}`}>
      <button className="finances__ai-header" onClick={() => setExpanded(!expanded)}>
        <span className="finances__ai-sparkle">{'\u2728'}</span>
        <span>Preguntale a Lina sobre tus finanzas</span>
        <svg className={`finances__ai-chevron ${expanded ? 'finances__ai-chevron--open' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {expanded && (
        <div className="finances__ai-body">
          <div className="finances__ai-chips">
            {chips.map((chip, i) => (
              <button key={i} className="finances__ai-chip" onClick={() => { setQuery(chip); handleAsk(chip); }}>{chip}</button>
            ))}
          </div>
          <form className="finances__ai-input-row" onSubmit={handleSubmit}>
            <input
              className="finances__input"
              placeholder="Escribe tu pregunta financiera..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={loading}
            />
            <button type="submit" className="finances__btn-primary" disabled={loading || !query.trim()}>
              {loading ? 'Pensando...' : 'Preguntar'}
            </button>
          </form>
          {(response || loading) && (
            <div className="finances__ai-response">
              {loading ? (
                <div className="finances__ai-loading">
                  <span className="finances__ai-dot" /><span className="finances__ai-dot" /><span className="finances__ai-dot" />
                </div>
              ) : (
                <>
                  <div className="finances__ai-answer">{response}</div>
                  <button className="finances__btn-ghost finances__btn-ghost--sm" onClick={() => { setResponse(''); setQuery(''); }}>Limpiar</button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];

const TabReportes = ({ period, dateFrom, dateTo }) => {
  const { addNotification } = useNotification();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = { period };
    if (period === 'custom' && dateFrom && dateTo) {
      params.date_from = dateFrom;
      params.date_to = dateTo;
    }
    financeService.getAnalytics(params)
      .then(setAnalytics)
      .catch(err => addNotification('Error cargando analytics: ' + err.message, 'error'))
      .finally(() => setLoading(false));
  }, [period, dateFrom, dateTo, addNotification]);

  const handleExport = async () => {
    try {
      const params = { period };
      if (period === 'custom' && dateFrom && dateTo) {
        params.date_from = dateFrom;
        params.date_to = dateTo;
      }
      const blob = await financeService.exportTransactions(params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transacciones_${period}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      addNotification('CSV descargado', 'success');
    } catch (err) {
      addNotification('Error al exportar: ' + err.message, 'error');
    }
  };

  if (loading) {
    return (
      <div className="finances__report-skeleton">
        {[...Array(4)].map((_, i) => <SkeletonBlock key={i} width="100%" height="80px" />)}
      </div>
    );
  }

  if (!analytics) return <div className="finances__empty">Sin datos de analytics</div>;

  const comparisonItems = [
    { label: 'Ingresos', current: analytics.current_revenue, previous: analytics.previous_revenue, change: analytics.revenue_change_pct, format: formatCOP },
    { label: 'Gastos', current: analytics.current_expenses, previous: analytics.previous_expenses, change: analytics.expenses_change_pct, format: formatCOP, invertColor: true },
    { label: 'Ganancia Neta', current: analytics.current_profit, previous: analytics.previous_profit, change: analytics.profit_change_pct, format: formatCOP },
    { label: 'Servicios', current: analytics.current_visits, previous: analytics.previous_visits, change: analytics.visits_change_pct, format: v => v },
    { label: 'Ticket Promedio', current: analytics.current_avg_ticket, previous: analytics.previous_avg_ticket, change: analytics.previous_avg_ticket > 0 ? Math.round((analytics.current_avg_ticket - analytics.previous_avg_ticket) / analytics.previous_avg_ticket * 1000) / 10 : 0, format: formatCOP },
  ];

  const weekdayData = (analytics.revenue_by_weekday || []).map(d => ({
    ...d,
    label: WEEKDAY_LABELS[d.weekday] || d.weekday_name,
  }));

  return (
    <>
      <div className="finances__section-header">
        <h3 className="finances__section-title">Reportes Avanzados</h3>
        <button className="finances__action-btn" onClick={handleExport}>
          {Icons.download} Exportar CSV
        </button>
        <button className="finances__action-btn" onClick={async () => {
          try {
            const params = new URLSearchParams({ period });
            if (period === 'custom' && dateFrom && dateTo) { params.set('date_from', dateFrom); params.set('date_to', dateTo); }
            const res = await fetch(`${API}/finances/export-excel?${params}`, { credentials: 'include' });
            if (!res.ok) throw new Error('Error');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `Finanzas_${period}.xlsx`; a.click();
            URL.revokeObjectURL(url);
            addNotification('Excel descargado', 'success');
          } catch (err) { addNotification('Error al exportar Excel: ' + err.message, 'error'); }
        }}>
          {Icons.download} Exportar Excel
        </button>
      </div>
      <div className="finances__comparison-grid">
        {comparisonItems.map((item, i) => {
          const isPositive = item.invertColor ? item.change <= 0 : item.change >= 0;
          return (
            <div key={i} className="finances__comparison-card">
              <span className="finances__comparison-label">{item.label}</span>
              <div className="finances__comparison-values">
                <div className="finances__comparison-current">
                  <span className="finances__comparison-current-value">{item.format(item.current)}</span>
                  <span className="finances__comparison-period-label">Actual</span>
                </div>
                <div className="finances__comparison-vs">vs</div>
                <div className="finances__comparison-previous">
                  <span className="finances__comparison-previous-value">{item.format(item.previous)}</span>
                  <span className="finances__comparison-period-label">Anterior</span>
                </div>
              </div>
              <GrowthBadge value={item.change} />
            </div>
          );
        })}
      </div>
      <div className="finances__body">
        <div className="finances__card">
          <div className="finances__card-header">
            <h2 className="finances__card-title">{Icons.users} Ranking por Profesional</h2>
          </div>
          <StaffBarChart data={analytics.revenue_by_staff || []} />
          <div className="finances__report-table">
            <table className="finances__table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Profesional</th>
                  <th>Servicios</th>
                  <th>Ticket Prom.</th>
                  <th>Ingresos</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {(analytics.revenue_by_staff || []).map((s, i) => (
                  <tr key={i}>
                    <td><span className={`finances__ranking-pos ${i < 3 ? 'finances__ranking-pos--highlight' : ''}`}>{i === 0 ? Icons.star : i + 1}</span></td>
                    <td>{s.staff_name}</td>
                    <td>{s.count}</td>
                    <td>{formatCOP(s.avg_ticket)}</td>
                    <td className="finances__amount-cell">{formatCOP(s.revenue)}</td>
                    <td>{s.pct_of_total}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="finances__card">
          <div className="finances__card-header">
            <h2 className="finances__card-title">{Icons.scissors} Revenue por Servicio</h2>
          </div>
          <div className="finances__ranking-list">
            {(analytics.revenue_by_service || []).map((svc, i) => {
              const maxRev = (analytics.revenue_by_service?.[0]?.revenue) || 1;
              const pct = Math.round((svc.revenue / maxRev) * 100);
              return (
                <div key={i} className={`finances__ranking-item ${i < 3 ? 'finances__ranking-item--top' : ''}`}>
                  <span className={`finances__ranking-pos ${i < 3 ? 'finances__ranking-pos--highlight' : ''}`}>
                    {i === 0 ? Icons.star : i + 1}
                  </span>
                  <div className="finances__ranking-info">
                    <div className="finances__ranking-top">
                      <div className="finances__ranking-name-wrap">
                        <span className="finances__ranking-name">{svc.service_name}</span>
                        {svc.category && <span className="finances__ranking-cat" style={{ color: CATEGORY_COLORS[svc.category] || CATEGORY_COLORS['Otros'] }}>{svc.category}</span>}
                      </div>
                      <div className="finances__ranking-amounts">
                        <span className="finances__ranking-amount">{formatCOP(svc.revenue)}</span>
                        <span className="finances__ranking-pct">{svc.pct_of_total}%</span>
                      </div>
                    </div>
                    <div className="finances__ranking-bar-bg">
                      <div className="finances__ranking-bar" style={{ width: `${pct}%`, background: CATEGORY_COLORS[svc.category] || CATEGORY_COLORS['Otros'] }} />
                    </div>
                    <span className="finances__ranking-count">{svc.count} {svc.count === 1 ? 'servicio' : 'servicios'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {weekdayData.length > 0 && (
        <div className="finances__card">
          <div className="finances__card-header">
            <h2 className="finances__card-title">{Icons.calendar} Revenue por Dia de la Semana</h2>
          </div>
          <div className="finances__recharts-container">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weekdayData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDEDEB" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#333330' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#8E8E85' }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${Math.round(v/1000)}k` : v} width={45} />
                <Tooltip content={<RechartsTooltip formatter={formatCOP} />} />
                <Bar dataKey="revenue" name="Ingresos" radius={[6, 6, 0, 0]} barSize={36}>
                  {weekdayData.map((d, i) => {
                    const maxRev = Math.max(...weekdayData.map(x => x.revenue), 1);
                    const intensity = d.revenue / maxRev;
                    const color = intensity > 0.8 ? '#1E3D2A' : intensity > 0.5 ? '#2D5A3D' : intensity > 0.2 ? '#3D7A52' : '#4E9466';
                    return <Cell key={i} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="finances__weekday-stats">
            {weekdayData.map((d, i) => (
              <div key={i} className="finances__weekday-stat">
                <span className="finances__weekday-label">{d.label}</span>
                <span className="finances__weekday-value">{formatCOP(d.revenue)}</span>
                <span className="finances__weekday-visits">{d.visits} servicios</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {(analytics.revenue_by_category || []).length > 0 && (
        <div className="finances__card">
          <div className="finances__card-header">
            <h2 className="finances__card-title">{Icons.pieChart} Distribucion por Categoria</h2>
          </div>
          <div className="finances__recharts-container">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={analytics.revenue_by_category} dataKey="revenue" nameKey="category" cx="50%" cy="50%" outerRadius={90} paddingAngle={2} strokeWidth={0} label={({ category, pct_of_total }) => `${category} ${pct_of_total}%`}>
                  {analytics.revenue_by_category.map((entry, i) => (
                    <Cell key={i} fill={CATEGORY_COLORS[entry.category] || CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<RechartsTooltip formatter={formatCOP} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      <div className="finances__report-summary">
        <div className="finances__report-summary-item">
          <span className="finances__report-summary-label">Clientes Unicos</span>
          <span className="finances__report-summary-value">{analytics.unique_clients}</span>
        </div>
        <div className="finances__report-summary-item">
          <span className="finances__report-summary-label">Margen Neto</span>
          <span className="finances__report-summary-value">{analytics.margin_pct}%</span>
        </div>
        <div className="finances__report-summary-item">
          <span className="finances__report-summary-label">Total Comisiones</span>
          <span className="finances__report-summary-value">{formatCOP(analytics.total_commissions)}</span>
        </div>
        <div className="finances__report-summary-item">
          <span className="finances__report-summary-label">Total Gastos</span>
          <span className="finances__report-summary-value">{formatCOP(analytics.total_expenses)}</span>
        </div>
      </div>
    </>
  );
};
const TabGastos = ({ period, dateFrom, dateTo }) => {
  const { addNotification } = useNotification();
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pnl, setPnl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const emptyForm = { category: '', subcategory: '', description: '', amount: '', date: new Date().toISOString().split('T')[0], payment_method: '', vendor: '', is_recurring: false, recurring_frequency: '' };
  const [form, setForm] = useState(emptyForm);

  const buildParams = useCallback(() => {
    const params = { period };
    if (period === 'custom' && dateFrom && dateTo) {
      params.date_from = dateFrom;
      params.date_to = dateTo;
    }
    return params;
  }, [period, dateFrom, dateTo]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildParams();
      const [exp, sum, p] = await Promise.all([
        financeService.listExpenses(params),
        financeService.expensesSummary(params),
        financeService.getPnL(params),
      ]);
      setExpenses(exp);
      setSummary(sum);
      setPnl(p);
    } catch (err) {
      addNotification('Error cargando gastos: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [buildParams, addNotification]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.category || !form.description || !form.amount || !form.date) return;
    try {
      const payload = { ...form, amount: Number(form.amount), is_recurring: form.is_recurring || false };
      if (!payload.subcategory) delete payload.subcategory;
      if (!payload.vendor) delete payload.vendor;
      if (!payload.recurring_frequency) delete payload.recurring_frequency;
      if (editingId) {
        await financeService.updateExpense(editingId, payload);
        addNotification('Gasto actualizado', 'success');
      } else {
        await financeService.createExpense(payload);
        addNotification('Gasto registrado', 'success');
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      load();
    } catch (err) {
      addNotification('Error: ' + err.message, 'error');
    }
  };

  const handleEdit = (exp) => {
    setForm({
      category: exp.category, subcategory: exp.subcategory || '', description: exp.description,
      amount: exp.amount.toString(), date: exp.date, payment_method: exp.payment_method || '',
      vendor: exp.vendor || '', is_recurring: exp.is_recurring || false, recurring_frequency: exp.recurring_frequency || '',
    });
    setEditingId(exp.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este gasto? Esta acción no se puede deshacer.')) return;
    try {
      await financeService.deleteExpense(id);
      addNotification('Gasto eliminado', 'success');
      load();
    } catch (err) {
      addNotification('Error: ' + err.message, 'error');
    }
  };

  const currentCatInfo = EXPENSE_CATEGORIES[form.category];
  const availableSubs = currentCatInfo?.subs || [];

  if (loading) return <div className="finances__list-skeleton">{[...Array(4)].map((_, i) => <SkeletonBlock key={i} width="100%" height="48px" />)}</div>;

  return (
    <>
      {pnl && (
        <div className="finances__pnl-card">
          <div className="finances__pnl-row">
            <span className="finances__pnl-label">Ingresos</span>
            <span className="finances__pnl-value finances__pnl-value--positive">{formatCOP(pnl.total_revenue)}</span>
          </div>
          <div className="finances__pnl-row">
            <span className="finances__pnl-label">Gastos</span>
            <span className="finances__pnl-value finances__pnl-value--negative">-{formatCOP(pnl.total_expenses)}</span>
          </div>
          <div className="finances__pnl-row">
            <span className="finances__pnl-label">Comisiones</span>
            <span className="finances__pnl-value finances__pnl-value--negative">-{formatCOP(pnl.total_commissions)}</span>
          </div>
          <div className="finances__pnl-divider" />
          <div className="finances__pnl-row finances__pnl-row--total">
            <span className="finances__pnl-label">Ganancia Neta</span>
            <span className={`finances__pnl-value ${pnl.net_profit >= 0 ? 'finances__pnl-value--positive' : 'finances__pnl-value--negative'}`}>
              {formatCOP(pnl.net_profit)}
            </span>
          </div>
          <span className="finances__pnl-margin">Margen: {pnl.margin_pct}%</span>
        </div>
      )}
      <div className="finances__section-header">
        <h3 className="finances__section-title">Gastos del periodo</h3>
        <button className="finances__action-btn" onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(emptyForm); }}>
          {Icons.plus} Nuevo Gasto
        </button>
      </div>
      {showForm && (
        <form className="finances__expense-form" onSubmit={handleSubmit}>
          <p className="finances__form-subtitle">Detalle del gasto</p>
          <div className="finances__form-grid">
            <select className="finances__select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value, subcategory: '' })} required>
              <option value="">Categoria *</option>
              {Object.entries(EXPENSE_CATEGORIES).map(([cat, info]) => (
                <option key={cat} value={cat}>{info.icon} {cat}</option>
              ))}
            </select>
            {availableSubs.length > 0 && (
              <select className="finances__select" value={form.subcategory} onChange={(e) => setForm({ ...form, subcategory: e.target.value })}>
                <option value="">Subcategoria</option>
                {availableSubs.map((sub) => <option key={sub} value={sub}>{sub}</option>)}
              </select>
            )}
            <input className="finances__input" placeholder="Descripcion *" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
            <input className="finances__input" placeholder="Proveedor" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
          </div>
          <p className="finances__form-subtitle">Pago</p>
          <div className="finances__form-grid">
            <input className="finances__input" type="number" placeholder="Monto (COP) *" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
            <input className="finances__input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            <select className="finances__select" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
              <option value="">Metodo de pago</option>
              {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <div className="finances__recurring-toggle">
              <label className="finances__label-inline">
                <input type="checkbox" checked={form.is_recurring} onChange={(e) => setForm({ ...form, is_recurring: e.target.checked, recurring_frequency: e.target.checked ? 'mensual' : '' })} />
                <span>Gasto recurrente</span>
              </label>
              {form.is_recurring && (
                <select className="finances__select finances__select--sm" value={form.recurring_frequency} onChange={(e) => setForm({ ...form, recurring_frequency: e.target.value })}>
                  {RECURRING_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              )}
            </div>
          </div>
          <div className="finances__form-actions">
            <button type="button" className="finances__btn-ghost" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancelar</button>
            <button type="submit" className="finances__btn-primary">{Icons.check} {editingId ? 'Actualizar' : 'Guardar'}</button>
          </div>
        </form>
      )}
      {summary && summary.by_category && summary.by_category.length > 0 && (
        <div className="finances__card">
          <div className="finances__card-header">
            <h2 className="finances__card-title">{Icons.pieChart} Gastos por Categoria</h2>
            <span className="finances__card-badge">Total: {formatCOP(summary.total)}</span>
          </div>
          <div className="finances__categories">
            <div className="finances__categories-bar">
              {summary.by_category.map((cat, i) => (
                <div key={i} className="finances__categories-segment" style={{ width: `${Math.max(cat.pct_of_total, 2)}%`, background: CATEGORY_COLORS[cat.category] || '#8B6914' }} title={`${cat.category}: ${formatCOP(cat.total)}`} />
              ))}
            </div>
            <div className="finances__categories-legend">
              {summary.by_category.map((cat, i) => (
                <div key={i} className="finances__categories-item">
                  <span className="finances__categories-dot" style={{ background: CATEGORY_COLORS[cat.category] || '#8B6914' }} />
                  <span className="finances__categories-name">{cat.category}</span>
                  <span className="finances__categories-value">{formatCOP(cat.total)}</span>
                  <span className="finances__categories-pct">{cat.pct_of_total}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="finances__table-wrap">
        <table className="finances__table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Categoria</th>
              <th>Descripcion</th>
              <th className="finances__hide-mobile">Proveedor</th>
              <th className="finances__hide-mobile">Metodo</th>
              <th>Monto</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((exp) => (
              <tr key={exp.id}>
                <td>{new Date(exp.date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</td>
                <td>
                  <span className="finances__tag">{exp.category}</span>
                  {exp.subcategory && <span className="finances__tag finances__tag--sub">{exp.subcategory}</span>}
                  {exp.is_recurring && <span className="finances__tag finances__tag--recurring">{'\u{1F501}'} {exp.recurring_frequency}</span>}
                </td>
                <td>{exp.description}</td>
                <td className="finances__hide-mobile">{exp.vendor || '—'}</td>
                <td className="finances__hide-mobile">{exp.payment_method || '—'}</td>
                <td className="finances__amount-cell">{formatCOP(exp.amount)}</td>
                <td>
                  <div className="finances__row-actions">
                    <button className="finances__icon-btn" onClick={() => handleEdit(exp)} title="Editar">{Icons.edit}</button>
                    <button className="finances__icon-btn finances__icon-btn--danger" onClick={() => handleDelete(exp.id)} title="Eliminar">{Icons.trash}</button>
                  </div>
                </td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 0, border: 'none' }}>
                <div className="finances__empty-state" style={{ margin: '0', boxShadow: 'none' }}>
                  <div className="finances__empty-state-icon">{Icons.receipt}</div>
                  <p className="finances__empty-state-title">Sin gastos registrados</p>
                  <p className="finances__empty-state-text">Registra arriendo, nomina, productos y otros gastos para ver tu estado de resultados completo</p>
                  <button type="button" className="finances__action-btn" onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm); }}>
                    {Icons.plus} Registrar primer gasto
                  </button>
                </div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};
const STAFF_COLORS = ['#2D5A3D', '#8B6914', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];

const TabComisiones = ({ period, dateFrom, dateTo }) => {
  const { addNotification } = useNotification();
  const [configs, setConfigs] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingStaff, setEditingStaff] = useState(null);
  const [editRate, setEditRate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { period };
      if (period === 'custom' && dateFrom && dateTo) {
        params.date_from = dateFrom;
        params.date_to = dateTo;
      }
      const [c, p] = await Promise.all([
        financeService.listCommissions(),
        financeService.commissionPayouts(params),
      ]);
      setConfigs(c);
      setPayouts(p);
    } catch (err) {
      addNotification('Error cargando comisiones: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [period, dateFrom, dateTo, addNotification]);

  useEffect(() => { load(); }, [load]);

  const handleSaveRate = async (staffId) => {
    const rate = parseFloat(editRate) / 100;
    if (isNaN(rate) || rate < 0 || rate > 1) {
      addNotification('La tasa debe ser entre 0 y 100', 'error');
      return;
    }
    try {
      await financeService.updateCommission(staffId, { default_rate: rate, service_overrides: {} });
      addNotification('Comision actualizada', 'success');
      setEditingStaff(null);
      load();
    } catch (err) {
      addNotification('Error: ' + err.message, 'error');
    }
  };

  const { totalCommissions, totalRevenue, totalServices, avgRate, maxPayout, staffData } = useMemo(() => {
    const tc = payouts.reduce((s, p) => s + p.commission_amount, 0);
    const tr = payouts.reduce((s, p) => s + p.total_revenue, 0);
    const ts = payouts.reduce((s, p) => s + p.services_count, 0);
    const ar = tr > 0 ? tc / tr : 0;
    const mp = Math.max(...payouts.map(p => p.commission_amount), 1);
    const sd = payouts.map((p, i) => ({
      staff_id: p.staff_id,
      staff_name: p.staff_name,
      rate: p.rate,
      revenue: p.total_revenue,
      commission: p.commission_amount,
      services: p.services_count,
      color: STAFF_COLORS[i % STAFF_COLORS.length],
    }));
    return { totalCommissions: tc, totalRevenue: tr, totalServices: ts, avgRate: ar, maxPayout: mp, staffData: sd };
  }, [payouts]);

  if (loading) {
    return (
      <div className="finances__comm-skeleton">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="finances__card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <SkeletonBlock width="56px" height="56px" />
              <div style={{ flex: 1 }}>
                <SkeletonBlock width="140px" height="18px" />
                <SkeletonBlock width="80px" height="14px" />
              </div>
              <SkeletonBlock width="60px" height="32px" />
            </div>
            <SkeletonBlock width="100%" height="8px" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="finances__kpis">
        <div className="finances__kpi-card finances__kpi-card--primary">
          <div className="finances__kpi-icon finances__kpi-icon--primary">{Icons.users}</div>
          <div className="finances__kpi-info">
            <span className="finances__kpi-value"><AnimatedNumber value={configs.length} /></span>
            <span className="finances__kpi-label">Profesionales Activos</span>
          </div>
        </div>
        <div className="finances__kpi-card">
          <div className="finances__kpi-icon finances__kpi-icon--accent">{Icons.dollar}</div>
          <div className="finances__kpi-info">
            <span className="finances__kpi-value"><AnimatedNumber value={totalCommissions} prefix="$" /></span>
            <span className="finances__kpi-label">Total Comisiones</span>
          </div>
        </div>
        <div className="finances__kpi-card">
          <div className="finances__kpi-icon finances__kpi-icon--success">{Icons.receipt}</div>
          <div className="finances__kpi-info">
            <span className="finances__kpi-value"><AnimatedNumber value={totalServices} /></span>
            <span className="finances__kpi-label">Servicios Realizados</span>
          </div>
        </div>
        <div className="finances__kpi-card">
          <div className="finances__kpi-icon finances__kpi-icon--info">{Icons.pieChart}</div>
          <div className="finances__kpi-info">
            <span className="finances__kpi-value">{(avgRate * 100).toFixed(0)}%</span>
            <span className="finances__kpi-label">Tasa Promedio</span>
          </div>
        </div>
      </div>
      {payouts.length > 0 && (
        <div className="finances__comm-dist">
          <div className="finances__comm-dist-bar">
            {staffData.filter(s => s.commission > 0).map((s, i) => (
              <div
                key={s.staff_id}
                className="finances__comm-dist-seg"
                style={{
                  width: `${Math.max((s.commission / totalCommissions) * 100, 3)}%`,
                  background: s.color,
                }}
                title={`${s.staff_name}: ${formatCOP(s.commission)}`}
              />
            ))}
          </div>
          <div className="finances__comm-dist-legend">
            {staffData.filter(s => s.commission > 0).map((s) => (
              <span key={s.staff_id} className="finances__comm-dist-item">
                <span className="finances__comm-dist-dot" style={{ background: s.color }} />
                {s.staff_name}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="finances__section-header">
        <h3 className="finances__section-title">Desglose por profesional</h3>
        <span className="finances__section-hint">Las tasas se configuran en Servicios → botón %</span>
      </div>

      {staffData.length > 0 ? (
        <div className="finances__comm-table">
          <div className="finances__comm-table-head">
            <span>Profesional</span>
            <span>Servicios</span>
            <span>Ingresos generados</span>
            <span>Tasa prom.</span>
            <span>Comisión ganada</span>
            <span>Negocio recibe</span>
          </div>
          {staffData.map((staff, i) => {
            const payoutPct = maxPayout > 0 ? (staff.commission / maxPayout) * 100 : 0;
            const negocio = staff.revenue - staff.commission;
            return (
              <div key={staff.staff_id} className="finances__comm-table-row" style={{ animationDelay: `${i * 0.04}s` }}>
                <div className="finances__comm-table-staff">
                  <div className="finances__comm-table-avatar" style={{ background: staff.color }}>
                    {staff.staff_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <span>{staff.staff_name}</span>
                </div>
                <span className="finances__comm-table-count">{staff.services}</span>
                <span className="finances__comm-table-revenue">{formatCOP(staff.revenue)}</span>
                <span className="finances__comm-table-rate">{(staff.rate * 100).toFixed(0)}%</span>
                <div className="finances__comm-table-earned">
                  <span style={{ color: staff.color, fontWeight: 700 }}>{formatCOP(staff.commission)}</span>
                  <div className="finances__comm-table-bar">
                    <div style={{ width: `${payoutPct}%`, background: staff.color }} />
                  </div>
                </div>
                <span className="finances__comm-table-negocio">{formatCOP(negocio)}</span>
              </div>
            );
          })}
          <div className="finances__comm-table-total">
            <span>Total</span>
            <span>{totalServices}</span>
            <span>{formatCOP(totalRevenue)}</span>
            <span>{(avgRate * 100).toFixed(0)}%</span>
            <span style={{ fontWeight: 700 }}>{formatCOP(totalCommissions)}</span>
            <span style={{ fontWeight: 700 }}>{formatCOP(totalRevenue - totalCommissions)}</span>
          </div>
        </div>
      ) : (
        <div className="finances__empty-state">
          <div className="finances__empty-state-icon">{Icons.users}</div>
          <p className="finances__empty-state-title">Sin comisiones en este periodo</p>
          <p className="finances__empty-state-text">No hay citas completadas o pagadas. Configura las tasas en Servicios → botón %</p>
        </div>
      )}
    </>
  );
};
const STATUS_COLORS = { draft: '#8E8E85', sent: '#3B82F6', paid: '#10B981', cancelled: '#EF4444' };
const STATUS_LABELS = { draft: 'Borrador', sent: 'Enviada', paid: 'Pagada', cancelled: 'Anulada' };
const STATUS_ICONS = {
  draft: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  sent: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  paid: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  cancelled: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
};

const TabFacturas = ({ period, dateFrom, dateTo }) => {
  const { addNotification } = useNotification();
  const { tenant } = useTenant();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [methodFilter, setMethodFilter] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [sendingWA, setSendingWA] = useState(null); // invoice id being sent

  const [allClients, setAllClients] = useState([]);
  const [allServices, setAllServices] = useState([]);
  const [allStaff, setAllStaff] = useState([]);
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const searchTimer = useRef(null);
  const clientSearchRef = useRef(null);

  const [uninvoicedVisits, setUninvoicedVisits] = useState([]);
  const [showVisitImport, setShowVisitImport] = useState(false);

  const savedIvaDefault = localStorage.getItem('alpelo_iva_default') === 'true';

  const [form, setForm] = useState({
    client_name: '', client_phone: '', client_document: '', client_document_type: 'CC',
    client_email: '', client_address: '',
    payment_method: '', payment_terms: 'contado', due_date: '',
    tax_rate: savedIvaDefault ? 0.19 : 0.19,
    discount_type: '', discount_value: '',
    notes: '',
    items: [{ service_name: '', quantity: 1, unit_price: '', staff_name: '', visit_id: null }],
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await financeService.listInvoices();
      setInvoices(data);
    } catch (err) {
      addNotification('Error cargando facturas: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    clientService.list({ sort_by: 'name' }).then(setAllClients).catch(() => {});
    servicesService.list({ active: true }).then(setAllServices).catch(() => {});
    staffService.list({ active: true }).then(setAllStaff).catch(() => {});
  }, []);

  const handleClientSearch = (value) => {
    setClientSearch(value);
    setShowClientDropdown(true);
    if (selectedClient) { setSelectedClient(null); setForm(f => ({ ...f, client_name: '', client_phone: '', client_document: '' })); }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.trim().length < 2) { setClientResults([]); return; }
    searchTimer.current = setTimeout(() => {
      const q = value.toLowerCase();
      const results = allClients.filter(c =>
        c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q)) || (c.client_id && c.client_id.toLowerCase().includes(q))
      ).slice(0, 8);
      setClientResults(results);
    }, 150);
  };

  const handleSelectClient = (client) => {
    setSelectedClient(client);
    setClientSearch(client.name);
    setShowClientDropdown(false);
    setClientResults([]);
    setForm(f => ({
      ...f,
      client_name: client.name,
      client_phone: client.phone || '',
      client_document: '',
    }));
    financeService.getUninvoicedVisits({ client_id: client.id }).then(setUninvoicedVisits).catch(() => setUninvoicedVisits([]));
  };

  const handleImportVisit = (visit) => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items.filter(it => it.service_name), {
        service_name: visit.service_name,
        quantity: 1,
        unit_price: visit.amount.toString(),
        staff_name: visit.staff_name,
        visit_id: visit.id,
      }],
    }));
    setUninvoicedVisits(prev => prev.filter(v => v.id !== visit.id));
  };

  const handleServiceSelect = (idx, serviceName) => {
    const svc = allServices.find(s => s.name === serviceName);
    setForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === idx ? {
        ...item,
        service_name: serviceName,
        unit_price: svc ? svc.price.toString() : item.unit_price,
      } : item),
    }));
  };

  const handleStaffSelect = (idx, staffName) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === idx ? { ...item, staff_name: staffName } : item),
    }));
  };

  const addItem = () => {
    setForm((prev) => ({ ...prev, items: [...prev.items, { service_name: '', quantity: 1, unit_price: '', staff_name: '', visit_id: null }] }));
  };

  const removeItem = (idx) => {
    if (form.items.length <= 1) return;
    setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };

  const updateItem = (idx, field, value) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => i === idx ? { ...item, [field]: value } : item),
    }));
  };

  const subtotal = form.items.reduce((s, it) => s + (Number(it.unit_price) || 0) * (Number(it.quantity) || 1), 0);
  const discountAmount = form.discount_type === 'percent' ? Math.round(subtotal * (Number(form.discount_value) || 0) / 100)
    : form.discount_type === 'fixed' ? Math.min(Number(form.discount_value) || 0, subtotal) : 0;
  const taxable = subtotal - discountAmount;
  const taxAmount = Math.round(taxable * form.tax_rate);
  const total = taxable + taxAmount;

  const resetForm = () => {
    setShowForm(false);
    setSelectedClient(null);
    setClientSearch('');
    setUninvoicedVisits([]);
    setShowVisitImport(false);
    setForm({
      client_name: '', client_phone: '', client_document: '', client_document_type: 'CC',
      client_email: '', client_address: '',
      payment_method: '', payment_terms: 'contado', due_date: '',
      tax_rate: savedIvaDefault ? 0.19 : 0.19,
      discount_type: '', discount_value: '',
      notes: '',
      items: [{ service_name: '', quantity: 1, unit_price: '', staff_name: '', visit_id: null }],
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const finalClientName = form.client_name || clientSearch.trim();
    if (!finalClientName || form.items.some((it) => !it.service_name || !it.unit_price)) {
      addNotification('Completa nombre del cliente y todos los servicios', 'error');
      return;
    }
    try {
      localStorage.setItem('alpelo_iva_default', form.tax_rate > 0 ? 'true' : 'false');
      await financeService.createInvoice({
        ...form,
        client_name: finalClientName,
        discount_type: form.discount_type || undefined,
        discount_value: Number(form.discount_value) || 0,
        due_date: form.payment_terms === 'credito' && form.due_date ? form.due_date : undefined,
        items: form.items.map((it) => ({ ...it, unit_price: Number(it.unit_price), quantity: Number(it.quantity) || 1, visit_id: it.visit_id || undefined })),
      });
      addNotification('Factura creada', 'success');
      resetForm();
      load();
    } catch (err) {
      addNotification('Error: ' + err.message, 'error');
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await financeService.updateInvoice(id, { status });
      addNotification(`Factura marcada como ${STATUS_LABELS[status] || status}`, 'success');
      load();
    } catch (err) {
      addNotification('Error: ' + err.message, 'error');
    }
  };

  const { totalFacturado, paidCount, pendingCount, pendingAmount } = useMemo(() => {
    let total = 0, paid = 0, pending = 0, pendingAmt = 0;
    for (const inv of invoices) {
      if (inv.status !== 'cancelled') total += inv.total;
      if (inv.status === 'paid') paid++;
      if (inv.status === 'draft' || inv.status === 'sent') { pending++; pendingAmt += inv.total; }
    }
    return { totalFacturado: total, paidCount: paid, pendingCount: pending, pendingAmount: pendingAmt };
  }, [invoices]);

  const servicesByCategory = useMemo(() => allServices.reduce((acc, svc) => {
    const cat = svc.category || 'Otros';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(svc);
    return acc;
  }, {}), [allServices]);

  if (loading) {
    return (
      <div className="finances__comm-skeleton">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="finances__card" style={{ padding: '20px' }}>
            <SkeletonBlock width="100%" height="80px" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="finances__kpis">
        <div className="finances__kpi-card finances__kpi-card--primary">
          <div className="finances__kpi-icon finances__kpi-icon--primary">{Icons.fileText}</div>
          <div className="finances__kpi-info">
            <span className="finances__kpi-value">{invoices.length}</span>
            <span className="finances__kpi-label">Facturas Emitidas</span>
          </div>
        </div>
        <div className="finances__kpi-card">
          <div className="finances__kpi-icon finances__kpi-icon--success">{Icons.dollar}</div>
          <div className="finances__kpi-info">
            <span className="finances__kpi-value"><AnimatedNumber value={totalFacturado} prefix="$" /></span>
            <span className="finances__kpi-label">Total Facturado</span>
          </div>
        </div>
        <div className="finances__kpi-card">
          <div className="finances__kpi-icon finances__kpi-icon--accent">{Icons.check}</div>
          <div className="finances__kpi-info">
            <span className="finances__kpi-value">{paidCount}</span>
            <span className="finances__kpi-label">Pagadas</span>
          </div>
        </div>
        {pendingCount > 0 && (
          <div className="finances__kpi-card finances__kpi-card--warning">
            <div className="finances__kpi-icon finances__kpi-icon--warning">{Icons.alert}</div>
            <div className="finances__kpi-info">
              <span className="finances__kpi-value">{pendingCount}</span>
              <span className="finances__kpi-label">Pendientes ({formatCOP(pendingAmount)})</span>
            </div>
          </div>
        )}
      </div>
      <div className="finances__section-header">
        <h3 className="finances__section-title">
          {invoices.length > 0 ? `${invoices.length} factura${invoices.length !== 1 ? 's' : ''}` : 'Facturas'}
        </h3>
        <button className="finances__action-btn" onClick={() => { showForm ? resetForm() : setShowForm(true); }}>
          {Icons.plus} Nueva Factura
        </button>
      </div>
      {showForm && (
        <form className="finances__invoice-form" onSubmit={handleSubmit}>
          <p className="finances__form-subtitle">Datos del cliente</p>
          <div className="finances__client-search-wrap" ref={clientSearchRef}>
            {selectedClient ? (
              <div className="finances__client-selected">
                <div className="finances__client-selected-avatar">
                  {selectedClient.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="finances__client-selected-info">
                  <span className="finances__client-selected-name">{selectedClient.name}</span>
                  <span className="finances__client-selected-meta">{selectedClient.client_id} · {formatPhone(selectedClient.phone)}</span>
                </div>
                <button type="button" className="finances__btn-ghost finances__btn-ghost--sm" onClick={() => {
                  setSelectedClient(null);
                  setClientSearch('');
                  setForm(f => ({ ...f, client_name: '', client_phone: '', client_document: '' }));
                }}>Cambiar</button>
              </div>
            ) : (
              <div className="finances__client-search-box">
                <svg className="finances__client-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  className="finances__input"
                  type="text"
                  placeholder="Buscar cliente por nombre o teléfono..."
                  value={clientSearch}
                  onChange={(e) => handleClientSearch(e.target.value)}
                  onFocus={() => clientSearch.length >= 2 && setShowClientDropdown(true)}
                  onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                />
                {showClientDropdown && clientResults.length > 0 && (
                  <div className="finances__client-dropdown">
                    {clientResults.map((c) => (
                      <button key={c.id} type="button" className="finances__client-dropdown-item" onClick={() => handleSelectClient(c)}>
                        <span className="finances__client-dropdown-avatar">{c.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>
                        <div className="finances__client-dropdown-info">
                          <span className="finances__client-dropdown-name">{c.name}</span>
                          <span className="finances__client-dropdown-meta">{c.client_id} · {formatPhone(c.phone)} · {c.total_visits || 0} visitas</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {clientSearch.length >= 2 && clientResults.length === 0 && showClientDropdown && (
                  <div className="finances__client-dropdown">
                    <div className="finances__client-dropdown-empty">
                      No se encontró — se creará como cliente nuevo
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          {!selectedClient && clientSearch.length >= 2 && (
            <div className="finances__form-grid">
              <input className="finances__input" placeholder="Nombre *" value={form.client_name || clientSearch} onChange={(e) => setForm({ ...form, client_name: e.target.value })} required />
              <input className="finances__input" placeholder="Teléfono" value={form.client_phone} onChange={(e) => setForm({ ...form, client_phone: e.target.value })} />
            </div>
          )}

          <p className="finances__form-subtitle" style={{ marginTop: 12 }}>Datos del receptor</p>
          <div className="finances__form-grid finances__form-grid--4">
            <select className="finances__select" value={form.client_document_type} onChange={(e) => setForm({ ...form, client_document_type: e.target.value })}>
              <option value="CC">CC</option>
              <option value="NIT">NIT</option>
              <option value="CE">CE</option>
              <option value="TI">TI</option>
              <option value="Pasaporte">Pasaporte</option>
              <option value="DIE">DIE</option>
            </select>
            <input className="finances__input" placeholder="Nro. documento" value={form.client_document} onChange={(e) => setForm({ ...form, client_document: e.target.value })} />
            <input className="finances__input" type="email" placeholder="Email" value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })} />
            <input className="finances__input" placeholder="Dirección" value={form.client_address} onChange={(e) => setForm({ ...form, client_address: e.target.value })} />
          </div>

          <p className="finances__form-subtitle" style={{ marginTop: 12 }}>Pago y condiciones</p>
          <div className="finances__form-grid finances__form-grid--4">
            <select className="finances__select" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
              <option value="">Método de pago</option>
              {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <select className="finances__select" value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}>
              <option value="contado">Contado</option>
              <option value="credito">Crédito</option>
            </select>
            {form.payment_terms === 'credito' && (
              <input className="finances__input" type="date" placeholder="Fecha vencimiento" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            )}
            <div className="finances__tax-toggle">
              <label className="finances__label-inline">
                <input type="checkbox" checked={form.tax_rate > 0} onChange={(e) => setForm({ ...form, tax_rate: e.target.checked ? 0.19 : 0 })} />
                <span>IVA (19%)</span>
              </label>
            </div>
          </div>

          <div className="finances__form-grid" style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select className="finances__select" style={{ width: 120 }} value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value, discount_value: '' })}>
                <option value="">Sin descuento</option>
                <option value="percent">% Porcentaje</option>
                <option value="fixed">$ Valor fijo</option>
              </select>
              {form.discount_type && (
                <input className="finances__input" type="number" min="0" placeholder={form.discount_type === 'percent' ? '% descuento' : '$ descuento'}
                  value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} style={{ width: 130 }} />
              )}
              {discountAmount > 0 && <span style={{ fontSize: 12, color: '#DC2626', fontWeight: 600 }}>-{formatCOP(discountAmount)}</span>}
            </div>
            <input className="finances__input" placeholder="Notas / observaciones" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          {selectedClient && uninvoicedVisits.length > 0 && (
            <div className="finances__uninvoiced">
              <button type="button" className="finances__btn-ghost finances__btn-ghost--sm" onClick={() => setShowVisitImport(!showVisitImport)}>
                {Icons.receipt} Importar desde visitas ({uninvoicedVisits.length} sin facturar)
              </button>
              {showVisitImport && (
                <div className="finances__uninvoiced-list">
                  {uninvoicedVisits.map((v) => (
                    <button key={v.id} type="button" className="finances__uninvoiced-item" onClick={() => handleImportVisit(v)}>
                      <span className="finances__uninvoiced-date">{new Date(v.visit_date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</span>
                      <span className="finances__uninvoiced-service">{v.service_name}</span>
                      <span className="finances__uninvoiced-staff">{v.staff_name}</span>
                      <span className="finances__uninvoiced-amount">{formatCOP(v.amount)}</span>
                      <span className="finances__uninvoiced-add">{Icons.plus}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <p className="finances__form-subtitle">Servicios facturados</p>
          <div className="finances__invoice-items">
            {form.items.map((item, idx) => (
              <div key={idx} className="finances__invoice-item-row">
                <select
                  className="finances__select"
                  value={item.service_name}
                  onChange={(e) => handleServiceSelect(idx, e.target.value)}
                  required
                >
                  <option value="">Servicio *</option>
                  {Object.entries(servicesByCategory).map(([cat, svcs]) => (
                    <optgroup key={cat} label={cat}>
                      {svcs.map(s => (
                        <option key={s.id} value={s.name}>{s.name} — {formatCOP(s.price)}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                <input className="finances__input finances__input--sm" type="number" min="1" placeholder="Cant" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} />
                <input className="finances__input" type="number" placeholder="Precio *" value={item.unit_price} onChange={(e) => updateItem(idx, 'unit_price', e.target.value)} required />
                <select
                  className="finances__select"
                  value={item.staff_name}
                  onChange={(e) => handleStaffSelect(idx, e.target.value)}
                >
                  <option value="">Profesional</option>
                  {allStaff.map(s => (
                    <option key={s.id} value={s.name}>{s.name}{s.role ? ` — ${s.role}` : ''}</option>
                  ))}
                </select>

                {form.items.length > 1 && (
                  <button type="button" className="finances__icon-btn finances__icon-btn--danger" onClick={() => removeItem(idx)}>{Icons.trash}</button>
                )}
              </div>
            ))}
            <button type="button" className="finances__btn-ghost finances__btn-ghost--sm" onClick={addItem}>{Icons.plus} Agregar servicio</button>
          </div>

          <div className="finances__invoice-totals">
            <div className="finances__pnl-row"><span>Subtotal</span><span>{formatCOP(subtotal)}</span></div>
            {discountAmount > 0 && (
              <div className="finances__pnl-row" style={{ color: '#DC2626' }}><span>Descuento {form.discount_type === 'percent' ? `(${form.discount_value}%)` : ''}</span><span>-{formatCOP(discountAmount)}</span></div>
            )}
            {form.tax_rate > 0 && (
              <div className="finances__pnl-row"><span>IVA ({(form.tax_rate * 100).toFixed(0)}%)</span><span>{formatCOP(taxAmount)}</span></div>
            )}
            <div className="finances__pnl-divider" />
            <div className="finances__pnl-row finances__pnl-row--total"><span>Total</span><span>{formatCOP(total)}</span></div>
          </div>

          <div className="finances__form-actions">
            <button type="button" className="finances__btn-ghost" onClick={resetForm}>Cancelar</button>
            <button type="submit" className="finances__btn-primary">{Icons.check} Crear Factura</button>
          </div>
        </form>
      )}
      {invoices.length > 0 ? (
        <>
        <div className="finances__inv-filters">
          <div className="finances__inv-search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input
              type="text"
              placeholder="Buscar por cliente, factura, servicio, monto..."
              value={invoiceSearch}
              onChange={e => setInvoiceSearch(e.target.value)}
            />
            {invoiceSearch && (
              <button onClick={() => setInvoiceSearch('')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            )}
          </div>
          <div className="finances__method-filters">
            <button className={`finances__method-chip ${!methodFilter ? 'finances__method-chip--active' : ''}`} onClick={() => setMethodFilter('')}>Todos</button>
            {[...new Set(invoices.map(inv => inv.payment_method).filter(Boolean))].map(m => (
              <button key={m} className={`finances__method-chip ${methodFilter === m ? 'finances__method-chip--active' : ''}`} onClick={() => setMethodFilter(prev => prev === m ? '' : m)}>
                {PAYMENT_METHODS.find(p => p.value === m)?.label || m}
                <span className="finances__method-chip-count">{invoices.filter(inv => inv.payment_method === m).length}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="finances__sale-table">
          <div className="finances__sale-thead">
            <span className="finances__sale-th" style={{ width: '80px' }}>Hora</span>
            <span className="finances__sale-th" style={{ width: '80px' }}>Estado</span>
            <span className="finances__sale-th" style={{ flex: 1 }}>Cliente</span>
            <span className="finances__sale-th" style={{ flex: 1.5 }}>Servicio / Producto</span>
            <span className="finances__sale-th" style={{ width: '110px', textAlign: 'right' }}>Valor</span>
            <span className="finances__sale-th" style={{ width: '130px' }}>Medio de pago</span>
            <span className="finances__sale-th" style={{ width: '50px' }} />
          </div>
          {invoices
            .filter(inv => {
              if (methodFilter && inv.payment_method !== methodFilter) return false;
              if (!invoiceSearch) return true;
              const q = invoiceSearch.toLowerCase();
              const haystack = [
                inv.client_name, inv.client_phone, inv.invoice_number,
                inv.payment_method, String(inv.total),
                ...(inv.items || []).map(it => it.service_name),
                ...(inv.items || []).map(it => it.staff_name),
              ].filter(Boolean).join(' ').toLowerCase();
              return haystack.includes(q);
            })
            .sort((a, b) => new Date(b.paid_at || b.created_at) - new Date(a.paid_at || a.created_at))
            .map((inv) => {
            const isExpanded = expandedId === inv.id;
            const commissionRate = inv.staff_commission_rate || 0.5;
            const tipAmount = inv.tip || 0;
            // Commission on full price. IVA is business cost, not staff's.
            const serviceRevenue = inv.total - tipAmount;
            const staffCommission = Math.round(serviceRevenue * commissionRate);
            const staffEarnings = staffCommission + tipAmount;
            const ivaAmount = inv.tax_amount || 0;
            const businessEarnings = serviceRevenue - staffCommission - ivaAmount;
            const staffNames = [...new Set((inv.items || []).filter(it => it.staff_name).map(it => it.staff_name))];
            const primaryStaff = staffNames.length > 0 ? staffNames[0] : null;
            const paidTime = inv.paid_at ? new Date(inv.paid_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
            const visitCodeMatch = (inv.notes || '').match(/\[CODIGO:([^\]]+)\]/);
            const visitCode = visitCodeMatch ? visitCodeMatch[1] : null;
            const methodLabel = PAYMENT_METHODS.find(p => p.value === inv.payment_method)?.label || inv.payment_method || '—';

            return (
              <div key={inv.id} className={`finances__sale-row-wrap ${isExpanded ? 'finances__sale-row-wrap--expanded' : ''}`}>
                <div className="finances__sale-row" onClick={() => setExpandedId(isExpanded ? null : inv.id)}>
                  <span className="finances__sale-td finances__sale-td--time" style={{ width: '80px' }}>
                    <span className="finances__sale-time">{paidTime || '—'}</span>
                    <span className="finances__sale-invnum">{inv.invoice_number}</span>
                  </span>
                  <span className="finances__sale-td" style={{ width: '80px' }}>
                    <span className={`finances__inv-badge finances__inv-badge--${inv.status}`}>
                      {STATUS_LABELS[inv.status]}
                    </span>
                  </span>
                  <span className="finances__sale-td finances__sale-td--client" style={{ flex: 1 }}>
                    <strong>{inv.client_name}</strong>
                    {inv.client_phone && <small>{inv.client_phone}</small>}
                  </span>
                  <span className="finances__sale-td finances__sale-td--services" style={{ flex: 1.5 }}>
                    {(inv.items || []).map((item, idx) => (
                      <div key={idx} className="finances__sale-svc-line">
                        <span className="finances__sale-svc-name">{item.service_name}</span>
                        {item.staff_name && <span className="finances__sale-svc-staff">{item.staff_name}</span>}
                      </div>
                    ))}
                  </span>
                  <span className="finances__sale-td" style={{ width: '110px', textAlign: 'right' }}>
                    <strong className="finances__sale-amount">{formatCOP(inv.total)}</strong>
                  </span>
                  <span className="finances__sale-td" style={{ width: '130px' }}>
                    <span className={`finances__inv-method-tag finances__inv-method-tag--${inv.payment_method}`}>{methodLabel}</span>
                  </span>
                  <span className="finances__sale-td" style={{ width: '50px' }}>
                    <svg className={`finances__inv-chevron ${isExpanded ? 'finances__inv-chevron--open' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
                  </span>
                </div>

                {isExpanded && (
                  <div className="finances__sale-detail">
                    <div className="finances__sale-detail-grid">
                      <div className="finances__sale-detail-col">
                        <h4>Detalle de venta</h4>
                        <div className="finances__sale-detail-items">
                          {(inv.items || []).map((item, idx) => (
                            <div key={idx} className="finances__sale-detail-item">
                              <div className="finances__sale-detail-item-main">
                                <span className="finances__sale-detail-item-name">{item.service_name}</span>
                                <span className="finances__sale-detail-item-price">{formatCOP(item.total)}</span>
                              </div>
                              <div className="finances__sale-detail-item-meta">
                                {item.staff_name && <span>Profesional: {item.staff_name}</span>}
                                <span>Cant: {item.quantity}</span>
                                <span>P/U: {formatCOP(item.unit_price)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="finances__sale-detail-col">
                        <h4>Resumen financiero</h4>
                        <div className="finances__sale-detail-summary">
                          <div className="finances__sale-summary-line"><span>Subtotal</span><span>{formatCOP(inv.subtotal)}</span></div>
                          {inv.discount_amount > 0 && <div className="finances__sale-summary-line finances__sale-summary-line--discount"><span>Descuento</span><span>-{formatCOP(inv.discount_amount)}</span></div>}
                          {inv.tax_amount > 0 && <div className="finances__sale-summary-line"><span>IVA ({(inv.tax_rate * 100).toFixed(0)}%)</span><span>{formatCOP(inv.tax_amount)}</span></div>}
                          {inv.tip > 0 && <div className="finances__sale-summary-line"><span>Propina</span><span>+{formatCOP(inv.tip)}</span></div>}
                          <div className="finances__sale-summary-line finances__sale-summary-line--total"><span>TOTAL</span><span>{formatCOP(inv.total)}</span></div>
                        </div>

                        {(() => {
                          // Group items by staff with per-service rates
                          const byStaff = {};
                          (inv.items || []).forEach(it => {
                            const name = it.staff_name || 'Sin asignar';
                            if (!byStaff[name]) byStaff[name] = { name, staffId: it.staff_id, items: [], total: 0, comm: 0 };
                            const rate = it.commission_rate ?? commissionRate;
                            const c = Math.round((it.unit_price || 0) * (it.quantity || 1) * rate);
                            byStaff[name].items.push({ ...it, rate, commAmount: c });
                            byStaff[name].total += (it.unit_price || 0) * (it.quantity || 1);
                            byStaff[name].comm += c;
                          });
                          const entries = Object.values(byStaff);
                          const totalComm = entries.reduce((s, e) => s + e.comm, 0);
                          const bizEarnings = (inv.total || 0) - (inv.tip || 0) - totalComm - (inv.tax_amount || 0);
                          if (!entries.length) return null;
                          return (
                            <div className="finances__sale-detail-commission">
                              {entries.map((s, idx) => (
                                <div key={idx}>
                                  <div className="finances__sale-commission-row" style={{ fontWeight: 700 }}>
                                    <span className="finances__sale-commission-dot finances__sale-commission-dot--staff" />
                                    <span>{s.name}</span>
                                    <strong>{formatCOP(s.total)}</strong>
                                  </div>
                                  {s.items.map((it, j) => (
                                    <div key={j} className="finances__sale-commission-row" style={{ paddingLeft: 20, fontSize: '0.78rem', color: '#64748B' }}>
                                      <span>{it.service_name} ({(it.rate * 100).toFixed(0)}%)</span>
                                      <strong style={{ color: '#059669' }}>{formatCOP(it.commAmount)}</strong>
                                    </div>
                                  ))}
                                  {idx < entries.length - 1 && <div style={{ borderBottom: '1px dashed #e2e8f0', margin: '4px 0' }} />}
                                </div>
                              ))}
                              <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 6, paddingTop: 6 }}>
                                <div className="finances__sale-commission-row">
                                  <span className="finances__sale-commission-dot finances__sale-commission-dot--staff" />
                                  <span>Total comisiones</span>
                                  <strong style={{ color: '#059669' }}>{formatCOP(totalComm)}</strong>
                                </div>
                                <div className="finances__sale-commission-row">
                                  <span className="finances__sale-commission-dot finances__sale-commission-dot--biz" />
                                  <span>Ganancia negocio</span>
                                  <strong>{formatCOP(bizEarnings)}</strong>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="finances__sale-detail-footer">
                      <div className="finances__sale-detail-meta">
                        <span>Factura: {inv.invoice_number}</span>
                        {visitCode && <span style={{ fontWeight: 700, color: '#2D5A3D' }}>Codigo: {visitCode}</span>}
                        <span>Fecha: {new Date(inv.issued_date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                        <span>Pago: {methodLabel}{inv.payment_terms === 'credito' ? ' (Credito)' : ''}</span>
                        {inv.due_date && <span style={{ color: new Date(inv.due_date) < new Date() && inv.status !== 'paid' ? '#DC2626' : '#D97706' }}>Vence: {new Date(inv.due_date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                        {inv.client_document && <span>{inv.client_document_type || 'CC'}: {inv.client_document}</span>}
                        {inv.client_email && <span>{inv.client_email}</span>}
                      </div>
                      {inv.receipt_url && (
                        <div className="finances__sale-receipt">
                          <span className="finances__sale-receipt-label">Comprobante adjunto</span>
                          <img src={inv.receipt_url} alt="Comprobante" className="finances__sale-receipt-img" onClick={() => {
                          const w = window.open('', '_blank');
                          if (w) { w.document.write(`<html><body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#111"><img src="${inv.receipt_url}" style="max-width:100%;max-height:100vh;object-fit:contain"></body></html>`); w.document.close(); }
                        }} />
                        </div>
                      )}
                      <div className="finances__sale-detail-actions">
                        {(inv.status === 'draft' || inv.status === 'sent') && (
                          <button className="finances__btn-primary" style={{ padding: '6px 14px', fontSize: '12px' }} onClick={() => handleStatusChange(inv.id, 'paid')}>
                            {Icons.check} Marcar pagada
                          </button>
                        )}
                        {inv.status !== 'cancelled' && (
                          <button className="finances__icon-btn finances__icon-btn--danger" onClick={() => handleStatusChange(inv.id, 'cancelled')} title="Anular">
                            {Icons.trash}
                          </button>
                        )}
                        <button className="finances__btn-ghost finances__btn-ghost--sm" onClick={() => {
                          const win = window.open('', '_blank', 'width=900,height=700');
                          const dateStr = new Date(inv.issued_date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
                          const timeStr = inv.paid_at ? new Date(inv.paid_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
                          const ml = PAYMENT_METHODS.find(p => p.value === inv.payment_method)?.label || inv.payment_method;
                          const tn = tenant || {};
                          win.document.write(`<html><head><title>Factura ${inv.invoice_number}</title><style>
                            *{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:48px;color:#1a1a1a;max-width:780px;margin:0 auto;font-size:13px}
                            .biz{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #2D5A3D}
                            .biz-left{display:flex;align-items:center;gap:12px}.biz-logo{width:48px;height:48px;border-radius:10px;object-fit:cover}
                            .biz-name{font-size:20px;font-weight:800;letter-spacing:-0.02em}.biz-info{font-size:11px;color:#64748b;text-align:right}
                            .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px}
                            .header h2{font-size:18px;letter-spacing:-0.02em}.header-right{text-align:right;font-size:12px;color:#64748b}
                            .header-right strong{font-size:16px;color:#1a1a1a;display:block;margin-bottom:2px}
                            .client{background:#f8f9fb;padding:14px 20px;border-radius:10px;margin-bottom:20px;display:flex;gap:24px;flex-wrap:wrap;font-size:12px}
                            .client strong{font-size:13px;display:block;margin-bottom:1px}.client span{color:#64748b}
                            table{width:100%;border-collapse:collapse;margin:16px 0}
                            th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;padding:8px 0;border-bottom:2px solid #e5e7eb}th.r{text-align:right}
                            td{padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:13px}td.r{text-align:right;font-variant-numeric:tabular-nums}td.staff{font-size:11px;color:#64748b}
                            .product td{color:#92400e;font-style:italic}
                            .subtotal-row td{color:#64748b;font-size:12px;border-bottom:none;padding:5px 0}
                            .discount-row td{color:#dc2626;font-size:12px;border-bottom:none;padding:5px 0}
                            .total-row td{font-weight:800;font-size:18px;border-top:2px solid #1a1a1a;border-bottom:none;padding-top:12px}
                            .breakdown{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:20px}
                            .box{padding:14px;background:#f8f9fb;border-radius:10px}.box h3{font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin-bottom:8px}
                            .box-row{display:flex;justify-content:space-between;padding:3px 0;font-size:12px;color:#475569}.box-row strong{color:#1a1a1a}
                            .box-row.green strong{color:#059669}.box-row.blue strong{color:#2563eb}
                            .footer{margin-top:28px;padding-top:14px;border-top:1px dashed #d1d5db;display:flex;justify-content:space-between;font-size:11px;color:#94a3b8}
                            .no-print{text-align:center;margin-top:20px}@media print{.no-print{display:none!important}body{padding:24px}}
                          </style></head><body>`);
                          // Business header
                          win.document.write(`<div class="biz"><div class="biz-left">${tn.logo_url ? `<img src="${tn.logo_url}" class="biz-logo">` : ''}<div><div class="biz-name">${tn.name || 'Negocio'}</div>${tn.nit ? `<span style="font-size:11px;color:#64748b">NIT: ${tn.nit}</span>` : ''}</div></div><div class="biz-info">${tn.address || ''}${tn.phone ? `<br>${tn.phone}` : ''}${tn.owner_email ? `<br>${tn.owner_email}` : ''}</div></div>`);
                          // Invoice header
                          win.document.write(`<div class="header"><div><h2>Factura ${inv.invoice_number}</h2><span style="color:#64748b;font-size:12px">${dateStr}${timeStr ? ' — ' + timeStr : ''}${visitCode ? ' — Codigo: ' + visitCode : ''}${inv.payment_terms === 'credito' && inv.due_date ? ` — Vence: ${new Date(inv.due_date+'T12:00:00').toLocaleDateString('es-CO',{day:'numeric',month:'short',year:'numeric'})}` : ''}</span></div><div class="header-right"><strong>${formatCOP(inv.total)}</strong>${ml}${inv.payment_terms === 'credito' ? ' — Credito' : ''}</div></div>`);
                          // Client info
                          win.document.write(`<div class="client"><div><strong>${inv.client_name}</strong><span>Cliente</span></div>${inv.client_phone ? `<div><strong>${inv.client_phone}</strong><span>Telefono</span></div>` : ''}${inv.client_document ? `<div><strong>${inv.client_document_type || 'CC'} ${inv.client_document}</strong><span>Documento</span></div>` : ''}${inv.client_email ? `<div><strong>${inv.client_email}</strong><span>Email</span></div>` : ''}${inv.client_address ? `<div><strong>${inv.client_address}</strong><span>Direccion</span></div>` : ''}</div>`);
                          // Items table
                          win.document.write('<table><tr><th>Servicio / Producto</th><th>Profesional</th><th>Cant.</th><th class="r">P/U</th><th class="r">Total</th></tr>');
                          (inv.items || []).forEach(it => {
                            const isProduct = it.service_name?.startsWith('[Producto]');
                            win.document.write(`<tr class="${isProduct ? 'product' : ''}"><td>${it.service_name}</td><td class="staff">${it.staff_name || '—'}</td><td>${it.quantity}</td><td class="r">${formatCOP(it.unit_price)}</td><td class="r">${formatCOP(it.total)}</td></tr>`);
                          });
                          win.document.write(`<tr class="subtotal-row"><td colspan="4">Subtotal</td><td class="r">${formatCOP(inv.subtotal)}</td></tr>`);
                          if (inv.discount_amount > 0) win.document.write(`<tr class="discount-row"><td colspan="4">Descuento${inv.discount_type === 'percent' ? ` (${inv.discount_value}%)` : ''}</td><td class="r">-${formatCOP(inv.discount_amount)}</td></tr>`);
                          if (inv.tax_amount > 0) win.document.write(`<tr class="subtotal-row"><td colspan="4">IVA (${(inv.tax_rate*100).toFixed(0)}%)</td><td class="r">${formatCOP(inv.tax_amount)}</td></tr>`);
                          if (inv.tip > 0) win.document.write(`<tr class="subtotal-row"><td colspan="4">Propina</td><td class="r">+${formatCOP(inv.tip)}</td></tr>`);
                          win.document.write(`<tr class="total-row"><td colspan="4">TOTAL</td><td class="r">${formatCOP(inv.total)}</td></tr></table>`);
                          // Breakdown
                          win.document.write('<div class="breakdown">');
                          if (primaryStaff) {
                            win.document.write(`<div class="box"><h3>Distribucion</h3><div class="box-row green"><span>Comision ${primaryStaff} (${(commissionRate*100).toFixed(0)}%)</span><strong>${formatCOP(staffEarnings)}</strong></div><div class="box-row blue"><span>Ganancia negocio</span><strong>${formatCOP(businessEarnings)}</strong></div></div>`);
                          }
                          win.document.write(`<div class="box"><h3>Detalles de pago</h3><div class="box-row"><span>Metodo</span><strong>${ml}</strong></div><div class="box-row"><span>Condicion</span><strong>${inv.payment_terms === 'credito' ? 'Credito' : 'Contado'}</strong></div><div class="box-row"><span>Estado</span><strong>${STATUS_LABELS[inv.status] || inv.status}</strong></div><div class="box-row"><span>Fecha</span><strong>${dateStr}</strong></div>${timeStr ? `<div class="box-row"><span>Hora</span><strong>${timeStr}</strong></div>` : ''}</div>`);
                          win.document.write('</div>');
                          win.document.write(`<div class="footer"><span>Factura ${inv.invoice_number} — ${dateStr}</span><span>Generado por Plexify Studio</span></div>`);
                          win.document.write('<div class="no-print"><button onclick="window.print()" style="background:#2D5A3D;color:#fff;border:none;padding:10px 28px;border-radius:8px;font-size:13px;cursor:pointer;font-weight:600">Imprimir</button></div>');
                          win.document.write('</body></html>');
                          win.document.close();
                        }} title="Imprimir">
                          {Icons.fileText} Imprimir
                        </button>
                        {inv.client_phone && (
                          <button className="finances__btn-ghost finances__btn-ghost--sm" disabled={sendingWA === inv.id} onClick={async () => {
                            setSendingWA(inv.id);
                            try {
                              const res = await fetch(`${API_URL}/whatsapp/send-document`, {
                                method: 'POST', credentials: 'include',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ phone: inv.client_phone, invoice_id: inv.id, name: inv.client_name }),
                              });
                              if (!res.ok) {
                                const err = await res.json().catch(() => ({}));
                                throw new Error(typeof err.detail === 'string' ? err.detail : 'Error enviando');
                              }
                              addNotification('Factura PDF enviada por WhatsApp', 'success');
                              if (inv.status === 'draft') handleStatusChange(inv.id, 'sent');
                            } catch (err) { addNotification('Error: ' + err.message, 'error'); }
                            finally { setSendingWA(null); }
                          }} title="Enviar factura PDF por WhatsApp">
                            {sendingWA === inv.id ? (
                              <><svg className="finances__spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Enviando PDF...</>
                            ) : (
                              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg> Enviar PDF</>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </>
      ) : (
        <div className="finances__empty-state">
          <div className="finances__empty-state-icon">{Icons.fileText}</div>
          <p className="finances__empty-state-title">Sin facturas emitidas</p>
          <p className="finances__empty-state-text">Crea tu primera factura para comenzar a llevar un registro profesional de tus cobros</p>
          <button className="finances__action-btn" onClick={() => setShowForm(true)}>
            {Icons.plus} Crear primera factura
          </button>
        </div>
      )}
    </>
  );
};

const TabCaja = () => {
  const { addNotification } = useNotification();
  const [register, setRegister] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openingAmount, setOpeningAmount] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [history, setHistory] = useState([]);
  const [subTab, setSubTab] = useState('hoy');
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [countedCash, setCountedCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchRegister = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/cash-register/today`, { credentials: 'include' });
      if (res.status === 404) {
        setRegister(null);
      } else if (res.ok) {
        const data = await res.json();
        setRegister(data);
      } else {
        setRegister(null);
      }
    } catch {
      setRegister(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch(`${API_URL}/checkouts?from=${today}&to=${today}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setTransactions(Array.isArray(data) ? data : data.items || []);
      }
    } catch { /* silent */ }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/cash-register/history`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setHistory(Array.isArray(data) ? data : data.items || []);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchRegister();
  }, [fetchRegister]);

  useEffect(() => {
    if (register && register.status === 'open') {
      fetchTransactions();
    }
  }, [register, fetchTransactions]);

  useEffect(() => {
    if (subTab === 'historial') {
      fetchHistory();
    }
  }, [subTab, fetchHistory]);

  const handleOpen = async () => {
    const amount = Number(openingAmount) || 0;
    if (amount < 0) {
      addNotification('El monto inicial no puede ser negativo', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/cash-register/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ opening_amount: amount }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Error abriendo caja');
      }
      addNotification('Caja abierta correctamente', 'success');
      setOpeningAmount('');
      fetchRegister();
    } catch (err) {
      addNotification(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = async () => {
    const counted = Number(countedCash) || 0;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/cash-register/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ counted_cash: counted, notes: closeNotes }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Error cerrando caja');
      }
      addNotification('Caja cerrada correctamente', 'success');
      setShowCloseModal(false);
      setCountedCash('');
      setCloseNotes('');
      fetchRegister();
    } catch (err) {
      addNotification(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="finances__caja-loading">
        <div className="finances__spinner" />
        <span>Cargando caja...</span>
      </div>
    );
  }

  const isOpen = register && register.status === 'open';

  const totalSales = transactions.reduce((s, t) => s + (Number(t.total || t.amount || 0)), 0);
  const totalCash = transactions.filter(t => t.payment_method === 'efectivo').reduce((s, t) => s + (Number(t.total || t.amount || 0)), 0);
  const totalDigital = transactions.filter(t => ['nequi', 'daviplata', 'transferencia', 'tarjeta'].includes(t.payment_method)).reduce((s, t) => s + (Number(t.total || t.amount || 0)), 0);
  const totalTips = transactions.reduce((s, t) => s + (Number(t.tip || 0)), 0);
  const expectedCash = (Number(register?.opening_amount) || 0) + totalCash;

  return (
    <div className="finances__caja">
      <div className="finances__caja-subtabs">
        <button
          className={`finances__caja-subtab ${subTab === 'hoy' ? 'finances__caja-subtab--active' : ''}`}
          onClick={() => setSubTab('hoy')}
        >
          Hoy
        </button>
        <button
          className={`finances__caja-subtab ${subTab === 'historial' ? 'finances__caja-subtab--active' : ''}`}
          onClick={() => setSubTab('historial')}
        >
          Historial
        </button>
      </div>

      {subTab === 'hoy' && (
        <>
          {!isOpen && (
            <div className="finances__caja-closed">
              <div className="finances__caja-closed-banner">
                <div className="finances__caja-closed-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="6" width="20" height="14" rx="2" />
                    <path d="M12 12v4" /><circle cx="12" cy="10" r="1" />
                    <path d="M2 10h20" />
                  </svg>
                </div>
                <div className="finances__caja-closed-text">
                  <h3>Caja cerrada</h3>
                  <p>No hay una caja abierta hoy. Ingresa el monto inicial para abrir.</p>
                </div>
              </div>
              <div className="finances__caja-open-form">
                <label className="finances__caja-label">Monto inicial en efectivo</label>
                <div className="finances__caja-open-row">
                  <div className="finances__caja-input-wrap">
                    <span className="finances__caja-input-prefix">$</span>
                    <input
                      type="number"
                      className="finances__caja-input"
                      placeholder="0"
                      value={openingAmount}
                      onChange={(e) => setOpeningAmount(e.target.value)}
                      min="0"
                    />
                  </div>
                  <button
                    className="finances__caja-btn finances__caja-btn--open"
                    onClick={handleOpen}
                    disabled={submitting}
                  >
                    {submitting ? 'Abriendo...' : 'Abrir caja'}
                  </button>
                </div>
              </div>
            </div>
          )}
          {isOpen && (
            <>
              <div className="finances__caja-status">
                <div className="finances__caja-status-left">
                  <span className="finances__caja-status-dot" />
                  <span className="finances__caja-status-text">
                    Caja abierta desde {register.opened_at ? new Date(register.opened_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                  </span>
                  {register.opened_by_name && (
                    <span className="finances__caja-status-user">por {register.opened_by_name}</span>
                  )}
                </div>
                <button
                  className="finances__caja-btn finances__caja-btn--close"
                  onClick={() => setShowCloseModal(true)}
                >
                  Cerrar caja
                </button>
              </div>
              <div className="finances__caja-summary">
                <div className="finances__caja-card">
                  <span className="finances__caja-card-label">Total ventas hoy</span>
                  <span className="finances__caja-card-value">{formatCOP(totalSales)}</span>
                </div>
                <div className="finances__caja-card">
                  <span className="finances__caja-card-label">Efectivo</span>
                  <span className="finances__caja-card-value">{formatCOP(totalCash)}</span>
                </div>
                <div className="finances__caja-card">
                  <span className="finances__caja-card-label">Digital</span>
                  <span className="finances__caja-card-value">{formatCOP(totalDigital)}</span>
                </div>
                <div className="finances__caja-card">
                  <span className="finances__caja-card-label">Propinas</span>
                  <span className="finances__caja-card-value">{formatCOP(totalTips)}</span>
                </div>
              </div>
              <div className="finances__caja-table-wrap">
                <h4 className="finances__caja-table-title">Transacciones de hoy</h4>
                {transactions.length === 0 ? (
                  <div className="finances__caja-empty">
                    <p>No hay transacciones registradas hoy</p>
                  </div>
                ) : (
                  <div className="finances__table-wrap">
                    <table className="finances__table">
                      <thead>
                        <tr>
                          <th>Hora</th>
                          <th>Cliente</th>
                          <th>Servicio</th>
                          <th>Método</th>
                          <th style={{ textAlign: 'right' }}>Monto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((tx, i) => (
                          <tr key={tx.id || i}>
                            <td>{tx.created_at ? new Date(tx.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</td>
                            <td>{tx.client_name || '—'}</td>
                            <td>{tx.service_name || tx.description || '—'}</td>
                            <td>
                              <span className="finances__caja-method">
                                {tx.payment_method || '—'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                              {formatCOP(tx.total || tx.amount || 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
      {subTab === 'historial' && (
        <div className="finances__caja-history">
          <h4 className="finances__caja-table-title">Historial de cajas</h4>
          {history.length === 0 ? (
            <div className="finances__caja-empty">
              <p>No hay registros de caja anteriores</p>
            </div>
          ) : (
            <div className="finances__table-wrap">
              <table className="finances__table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Abierta por</th>
                    <th style={{ textAlign: 'right' }}>Monto inicial</th>
                    <th style={{ textAlign: 'right' }}>Total ventas</th>
                    <th style={{ textAlign: 'right' }}>Efectivo esperado</th>
                    <th style={{ textAlign: 'right' }}>Efectivo contado</th>
                    <th style={{ textAlign: 'right' }}>Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => {
                    const diff = (Number(h.counted_cash) || 0) - (Number(h.expected_cash) || 0);
                    return (
                      <tr key={h.id || i}>
                        <td>{h.opened_at ? new Date(h.opened_at).toLocaleDateString('es-CO') : '—'}</td>
                        <td>{h.opened_by_name || '—'}</td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCOP(h.opening_amount)}</td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCOP(h.total_sales)}</td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCOP(h.expected_cash)}</td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCOP(h.counted_cash)}</td>
                        <td style={{
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: 700,
                          color: diff === 0 ? '#059669' : '#EF4444',
                        }}>
                          {diff >= 0 ? '+' : ''}{formatCOP(diff)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {showCloseModal && (
        <div className="finances__caja-overlay" onClick={() => setShowCloseModal(false)}>
          <div className="finances__caja-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="finances__caja-modal-title">Cerrar caja</h3>

            <div className="finances__caja-modal-row">
              <span className="finances__caja-modal-label">Efectivo esperado</span>
              <span className="finances__caja-modal-value">{formatCOP(expectedCash)}</span>
            </div>

            <div className="finances__caja-modal-field">
              <label className="finances__caja-label">Efectivo contado</label>
              <div className="finances__caja-input-wrap">
                <span className="finances__caja-input-prefix">$</span>
                <input
                  type="number"
                  className="finances__caja-input"
                  placeholder="0"
                  value={countedCash}
                  onChange={(e) => setCountedCash(e.target.value)}
                  min="0"
                />
              </div>
            </div>

            {countedCash !== '' && (
              <div className={`finances__caja-discrepancy ${
                Number(countedCash) - expectedCash === 0
                  ? 'finances__caja-discrepancy--match'
                  : 'finances__caja-discrepancy--diff'
              }`}>
                <span>Diferencia:</span>
                <strong>
                  {(Number(countedCash) - expectedCash) >= 0 ? '+' : ''}
                  {formatCOP(Number(countedCash) - expectedCash)}
                </strong>
              </div>
            )}

            <div className="finances__caja-modal-field">
              <label className="finances__caja-label">Notas (opcional)</label>
              <textarea
                className="finances__caja-textarea"
                placeholder="Observaciones del cierre..."
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="finances__caja-modal-actions">
              <button
                className="finances__caja-btn finances__caja-btn--cancel"
                onClick={() => setShowCloseModal(false)}
              >
                Cancelar
              </button>
              <button
                className="finances__caja-btn finances__caja-btn--close-confirm"
                onClick={handleClose}
                disabled={submitting}
              >
                {submitting ? 'Cerrando...' : 'Cerrar caja'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const TabForecast = () => {
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(`${API_URL}/finances/forecast`, { credentials: 'include' });
        if (resp.ok) setForecast(await resp.json());
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="finances__forecast-loading">Calculando proyección...</div>;
  if (!forecast) return <div className="finances__forecast-loading">Sin datos suficientes para proyectar. Necesitas al menos historial de visitas.</div>;

  const { week, month } = forecast;
  const trendUp = month.trend_pct >= 0;
  const monthPct = month.prev_month_total > 0 ? Math.min(100, Math.round(month.actual_so_far / month.prev_month_total * 100)) : 0;
  const projPct = month.prev_month_total > 0 ? Math.min(150, Math.round(month.projected_total / month.prev_month_total * 100)) : 0;

  return (
    <div className="finances__forecast">
      <div className="finances__fc-hero">
        <div className="finances__fc-hero-left">
          <p className="finances__fc-hero-label">Llevas facturado este mes</p>
          <h2 className="finances__fc-hero-amount">{formatCOP(month.actual_so_far)}</h2>
          <p className="finances__fc-hero-sub">en {month.days_elapsed} dias — quedan {month.days_remaining} dias</p>
        </div>
        <div className="finances__fc-hero-right">
          <div className="finances__fc-hero-card">
            <span className="finances__fc-hero-card-label">Si sigues asi, cierras en</span>
            <span className="finances__fc-hero-card-value">{formatCOP(month.projected_total)}</span>
          </div>
          <div className={`finances__fc-hero-card ${trendUp ? 'finances__fc-hero-card--green' : 'finances__fc-hero-card--red'}`}>
            <span className="finances__fc-hero-card-label">vs mes anterior</span>
            <span className="finances__fc-hero-card-value">{trendUp ? '+' : ''}{month.trend_pct}%</span>
          </div>
        </div>
      </div>
      {month.prev_month_total > 0 && (
        <div className="finances__fc-progress-section">
          <div className="finances__fc-progress-head">
            <span>Meta: igualar mes anterior ({formatCOP(month.prev_month_total)})</span>
            <span className="finances__fc-progress-pct">{monthPct}%</span>
          </div>
          <div className="finances__fc-progress-track">
            <div className="finances__fc-progress-fill" style={{ width: `${monthPct}%` }} />
          </div>
        </div>
      )}
      <div className="finances__fc-kpis">
        <div className="finances__fc-kpi">
          <span className="finances__fc-kpi-icon" style={{ background: '#ECFDF5', color: '#059669' }}>$</span>
          <div>
            <span className="finances__fc-kpi-value">{formatCOP(month.daily_run_rate)}</span>
            <span className="finances__fc-kpi-label">Promedio por dia</span>
          </div>
        </div>
        <div className="finances__fc-kpi">
          <span className="finances__fc-kpi-icon" style={{ background: '#EFF6FF', color: '#2563EB' }}>&#10003;</span>
          <div>
            <span className="finances__fc-kpi-value">{formatCOP(month.future_confirmed)}</span>
            <span className="finances__fc-kpi-label">Citas confirmadas por cobrar</span>
          </div>
        </div>
        <div className="finances__fc-kpi">
          <span className="finances__fc-kpi-icon" style={{ background: '#F5F3FF', color: '#7C3AED' }}>&#9650;</span>
          <div>
            <span className="finances__fc-kpi-value">{formatCOP(month.prev_month_total)}</span>
            <span className="finances__fc-kpi-label">Total mes anterior</span>
          </div>
        </div>
      </div>
      <div className="finances__fc-week-card">
        <div className="finances__fc-week-head">
          <h3>Esta semana dia por dia</h3>
          <div className="finances__fc-week-totals">
            <span>Confirmado <strong>{formatCOP(week.total_confirmed)}</strong></span>
            <span>Proyectado <strong>{formatCOP(week.total_projected)}</strong></span>
          </div>
        </div>

        <div className="finances__fc-chart">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={week.daily} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="day_name" tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
              <Tooltip
                formatter={(value, name) => [formatCOP(value), name]}
                contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '0.85rem' }}
              />
              <Bar dataKey="projected" name="Proyectado" fill="#E2E8F0" radius={[6, 6, 0, 0]} />
              <Bar dataKey="confirmed" name="Citas confirmadas" fill="#3B82F6" radius={[6, 6, 0, 0]} />
              {week.daily.some(d => d.actual > 0) && (
                <Bar dataKey="actual" name="Ya facturado" fill="#059669" radius={[6, 6, 0, 0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="finances__fc-days">
          {week.daily.map((d) => {
            const mainValue = d.is_past ? d.actual : d.confirmed;
            const isGood = d.is_past && d.actual > 0;
            return (
              <div key={d.date} className={`finances__fc-day ${d.is_today ? 'finances__fc-day--today' : ''} ${d.is_past ? 'finances__fc-day--past' : ''}`}>
                <div className="finances__fc-day-header">
                  <span className="finances__fc-day-name">{d.day_name}</span>
                  <span className="finances__fc-day-num">{d.day_number}</span>
                  {d.is_today && <span className="finances__fc-day-badge">HOY</span>}
                </div>
                <div className="finances__fc-day-amount" style={{ color: isGood ? '#059669' : d.confirmed > 0 ? '#2563EB' : '#94A3B8' }}>
                  {mainValue > 0 ? formatCOP(mainValue) : '—'}
                </div>
                <div className="finances__fc-day-sub">
                  {d.is_past ? 'Facturado' : d.confirmed > 0 ? 'Confirmado' : 'Sin citas'}
                </div>
                {!d.is_past && d.historical_avg > 0 && (
                  <div className="finances__fc-day-hint">Promedio: {formatCOP(d.historical_avg)}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
const PRODUCTS_TAG = '<!--PRODUCTS:';
const PRODUCTS_TAG_END = ':PRODUCTS-->';
const parseProducts = (notes) => {
  if (!notes) return [];
  const s = notes.indexOf(PRODUCTS_TAG);
  if (s === -1) return [];
  const e = notes.indexOf(PRODUCTS_TAG_END);
  if (e === -1) return [];
  try { return JSON.parse(notes.substring(s + PRODUCTS_TAG.length, e)); } catch { return []; }
};

const StaffVisitsList = ({ staffId, dateFrom: parentFrom, dateTo: parentTo, commissionRate, selectable = false, selectedIds, onSelectionChange, onVisitsLoaded }) => {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [localFrom, setLocalFrom] = useState(parentFrom);
  const [localTo, setLocalTo] = useState(parentTo);
  const API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

  useEffect(() => { setLocalFrom(parentFrom); setLocalTo(parentTo); }, [parentFrom, parentTo]);

  const loadVisits = useCallback(() => {
    setLoading(true);
    fetch(`${API}/appointments/?date_from=${localFrom}&date_to=${localTo}&staff_id=${staffId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const completed = (Array.isArray(data) ? data : []).filter(a => a.status === 'completed' || a.status === 'paid');
        const sorted = completed.sort((a, b) => new Date(b.date + 'T' + b.time) - new Date(a.date + 'T' + a.time));
        setVisits(sorted);
        if (onVisitsLoaded) onVisitsLoaded(sorted);
      })
      .catch(() => setVisits([]))
      .finally(() => setLoading(false));
  }, [staffId, localFrom, localTo]);

  useEffect(() => { loadVisits(); }, [loadVisits]);

  const [filter, setFilter] = useState('all');

  if (loading) return <p style={{ fontSize: 12, color: 'rgba(0,0,0,0.3)', padding: 8 }}>Cargando visitas...</p>;
  if (!visits.length) return <p style={{ fontSize: 12, color: 'rgba(0,0,0,0.3)', padding: 8 }}>Sin servicios completados en este periodo</p>;

  // A visit is "paid" if staff_payment_id is a truthy number
  const isPaidVisit = (v) => typeof v.staff_payment_id === 'number' && v.staff_payment_id > 0;
  const paidCount = visits.filter(isPaidVisit).length;
  const unpaidCount = visits.length - paidCount;

  // Filter by payment status
  const byStatus = filter === 'paid' ? visits.filter(isPaidVisit)
    : filter === 'unpaid' ? visits.filter(v => !isPaidVisit(v))
    : visits;

  const filtered = search ? byStatus.filter(v => {
    const q = search.toLowerCase();
    return [v.client_name, v.service_name, String(v.id), String(v.price), v.date, v.visit_code].some(x => x?.toLowerCase().includes(q));
  }) : byStatus;

  const totalRevenue = filtered.reduce((s, v) => s + (v.price || 0), 0);
  const getCommission = (v) => {
    if (v.commission_amount != null) return v.commission_amount;
    if (v.commission_rate != null) return Math.round((v.price || 0) * v.commission_rate);
    return Math.round((v.price || 0) * commissionRate);
  };
  const totalCommission = filtered.reduce((s, v) => s + getCommission(v), 0);
  const totalProducts = filtered.reduce((s, v) => {
    const prods = parseProducts(v.notes);
    return s + prods.reduce((ps, p) => ps + ((p.sale || 0) * (p.qty || 1)), 0);
  }, 0);

  // Selection helpers
  const isSelected = (id) => selectedIds && selectedIds.includes(id);
  const toggleSelect = (id) => {
    if (!onSelectionChange) return;
    const next = isSelected(id) ? selectedIds.filter(x => x !== id) : [...(selectedIds || []), id];
    onSelectionChange(next);
  };
  const selectAllUnpaid = () => {
    if (!onSelectionChange) return;
    onSelectionChange(filtered.filter(v => !isPaidVisit(v)).map(v => v.id));
  };
  const selectNone = () => onSelectionChange && onSelectionChange([]);

  return (
    <div className="finances__vl">
      <div className="finances__vl-dates">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <input type="date" value={localFrom} onChange={e => setLocalFrom(e.target.value)} />
        <span className="finances__vl-dates-sep">hasta</span>
        <input type="date" value={localTo} onChange={e => setLocalTo(e.target.value)} />
      </div>

      <div className="finances__vl-controls">
        <div className="finances__vl-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Buscar cliente, servicio, ticket..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="finances__vl-filters">
          {[
            { id: 'all', label: 'Todas', icon: null },
            { id: 'unpaid', label: 'Sin pagar', count: unpaidCount, color: '#D97706' },
            { id: 'paid', label: 'Pagadas', count: paidCount, color: '#10B981' },
          ].map(f => (
            <button key={f.id} className={`finances__vl-filter ${filter === f.id ? 'finances__vl-filter--active' : ''}`} onClick={() => setFilter(f.id)}>
              {f.label}
              {f.count > 0 && <span className="finances__vl-filter-badge" style={filter === f.id ? {} : { background: `${f.color}15`, color: f.color }}>{f.count}</span>}
            </button>
          ))}
        </div>
      </div>

      {selectable && (
        <div className="finances__vl-actions">
          <button className="finances__vl-action" onClick={selectAllUnpaid}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/></svg>
            Seleccionar pendientes
          </button>
          {selectedIds && selectedIds.length > 0 && (
            <>
              <button className="finances__vl-action finances__vl-action--clear" onClick={selectNone}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                Limpiar
              </button>
              <span className="finances__vl-selected-count">{selectedIds.length} seleccionadas</span>
            </>
          )}
        </div>
      )}

      <div className="finances__vl-table">
        <div className="finances__vl-thead">
          {selectable && <span style={{ width: 32 }} />}
          <span style={{ width: 70 }}>Ticket</span>
          <span style={{ width: 120 }}>Fecha</span>
          <span style={{ width: 50 }}>Hora</span>
          <span style={{ flex: 1 }}>Cliente</span>
          <span className="finances__vl-thead-r" style={{ width: 90 }}>Precio</span>
          <span className="finances__vl-thead-r" style={{ width: 90 }}>Comisión</span>
          <span style={{ width: 100 }}>Estado</span>
        </div>
        {filtered.map(v => {
          const commission = getCommission(v);
          const products = parseProducts(v.notes);
          const dur = v.duration_minutes;
          const paid = isPaidVisit(v);
          return (
            <div key={v.id}>
              <div className={`finances__vl-row ${paid ? 'finances__vl-row--paid' : ''} ${selectable && isSelected(v.id) ? 'finances__vl-row--selected' : ''}`}
                onClick={selectable && !paid ? () => toggleSelect(v.id) : undefined}
                style={selectable && !paid ? { cursor: 'pointer' } : undefined}>
                {selectable && (
                  <span className="finances__vl-check" style={{ width: 32 }}>
                    {paid
                      ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                      : <span className={`finances__vl-checkbox ${isSelected(v.id) ? 'finances__vl-checkbox--on' : ''}`}>
                          {isSelected(v.id) && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                        </span>
                    }
                  </span>
                )}
                <span className="finances__vl-ticket" style={{ width: 70 }}>{v.visit_code ? `#${v.visit_code}` : `#${v.id}`}</span>
                <span className="finances__vl-date" style={{ width: 120 }}>{new Date(v.date + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                <span className="finances__vl-time" style={{ width: 50 }}>{v.time}</span>
                <span className="finances__vl-client" style={{ flex: 1 }}>
                  <strong>{v.client_name}</strong>
                  <small>{v.service_name}{dur ? ` · ${dur}min` : ''}</small>
                </span>
                <span className="finances__vl-price" style={{ width: 90 }}>{formatCOP(v.price || 0)}</span>
                <span className="finances__vl-comm" style={{ width: 90 }}>{formatCOP(commission)}</span>
                <span style={{ width: 100 }}>
                  {paid ? (
                    <div className="finances__vl-status-wrap">
                      <span className="finances__vl-badge finances__vl-badge--paid">Pagada</span>
                      <button className="finances__vl-return" onClick={(e) => {
                        e.stopPropagation();
                        fetch(`${API}/appointments/${v.id}`, {
                          method: 'PUT', credentials: 'include',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ staff_payment_id: null }),
                        }).then(() => setVisits(prev => prev.map(x => x.id === v.id ? { ...x, staff_payment_id: null } : x))).catch(() => {});
                      }}>↩</button>
                    </div>
                  ) : (
                    <span className="finances__vl-badge finances__vl-badge--pending">Pendiente</span>
                  )}
                </span>
              </div>
              {products.length > 0 && (
                <div className="finances__vl-products">
                  {products.map((p, i) => (
                    <span key={i} className="finances__vl-product">{p.name} x{p.qty} {formatCOP((p.sale || 0) * (p.qty || 1))}</span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="finances__vl-summary">
        <div className="finances__vl-summary-row"><span>{filtered.length} servicios</span><span>{formatCOP(totalRevenue)}</span></div>
        <div className="finances__vl-summary-row finances__vl-summary-row--accent"><span>Comisión del profesional</span><span>{formatCOP(totalCommission)}</span></div>
        {totalProducts > 0 && <div className="finances__vl-summary-row"><span>Productos vendidos</span><span>{formatCOP(totalProducts)}</span></div>}
        <div className="finances__vl-summary-total"><span>Total a pagar</span><span>{formatCOP(totalCommission)}</span></div>
      </div>
    </div>
  );
};

const openPaymentReceipt = (paymentId, apiBase) => {
  const w = window.open('', '_blank', 'width=800,height=900');
  if (!w) return;
  w.document.write('<html><head><title>Comprobante de Pago</title></head><body style="font-family:system-ui,-apple-system,sans-serif;padding:40px;color:#1a1a1a;max-width:700px;margin:0 auto"><p style="text-align:center;color:#888">Cargando comprobante...</p></body></html>');
  fetch(`${apiBase}/staff-payments/${paymentId}/detail`, { credentials: 'include' })
    .then(r => r.ok ? r.json() : Promise.reject('Error'))
    .then(d => {
      const visits = d.visits || [];
      const commRate = d.commission_total && visits.length ? (d.commission_total / visits.reduce((s, v) => s + (v.amount || 0), 0) || 0.4) : 0.4;
      const visitRows = visits.map(v => {
        const comm = Math.round((v.amount || 0) * commRate);
        const code = v.notes || (v.notes || '').match(/\[CODIGO:([^\]]+)\]/)?.[1] || `#${v.id}`;
        return `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:13px">${new Date(v.visit_date + 'T12:00:00').toLocaleDateString('es-CO',{day:'numeric',month:'short'})}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:13px">${v.service_name}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:13px">${v.client_name||''}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:13px;text-align:center">${code.startsWith('#') ? code : '#'+code}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:13px;text-align:right">$${(v.amount||0).toLocaleString('es-CO')}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:13px;text-align:right">$${comm.toLocaleString('es-CO')}</td></tr>`;
      }).join('');
      const bank = d.staff_bank;
      const bankLine = bank ? (bank.preferred_payment_method === 'nequi' && bank.nequi_phone_masked ? `Nequi ${bank.nequi_phone_masked}` : bank.preferred_payment_method === 'daviplata' && bank.daviplata_phone_masked ? `Daviplata ${bank.daviplata_phone_masked}` : bank.bank_name && bank.bank_account_number_masked ? `${bank.bank_name} ${bank.bank_account_type||''} ${bank.bank_account_number_masked}` : d.payment_method) : d.payment_method;
      const periodFrom = new Date(d.period_from+'T12:00:00').toLocaleDateString('es-CO',{day:'numeric',month:'long'});
      const periodTo = new Date(d.period_to+'T12:00:00').toLocaleDateString('es-CO',{day:'numeric',month:'long',year:'numeric'});
      w.document.open();
      w.document.write(`<!DOCTYPE html><html><head><title>Comprobante ${d.receipt_number||'CP'}</title><style>@media print{.no-print{display:none!important}body{padding:20px!important}}body{font-family:system-ui,-apple-system,sans-serif;padding:40px;color:#1a1a1a;max-width:700px;margin:0 auto;line-height:1.5}table{width:100%;border-collapse:collapse}.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #2D5A3D}.logo-area{display:flex;align-items:center;gap:12px}.biz-info{font-size:12px;color:#666;text-align:right}.title{text-align:center;background:#f8f9fa;padding:12px;border-radius:8px;margin:16px 0}.staff-info{background:#f0fdf4;padding:16px;border-radius:8px;margin:16px 0;display:grid;grid-template-columns:1fr 1fr;gap:8px}.staff-info dt{font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.5px}.staff-info dd{font-size:14px;font-weight:600;margin:0 0 8px}.totals{margin-top:16px;border-top:2px solid #e5e7eb;padding-top:12px}.totals .row{display:flex;justify-content:space-between;padding:4px 0;font-size:13px}.totals .total{font-size:16px;font-weight:700;border-top:2px solid #1a1a1a;padding-top:8px;margin-top:4px}.footer{margin-top:32px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#888;text-align:center}</style></head><body>
      <div class="hdr"><div class="logo-area">${d.tenant_logo_url?`<img src="${d.tenant_logo_url}" style="width:48px;height:48px;border-radius:8px;object-fit:cover">`:''}<div><strong style="font-size:18px">${d.tenant_name||'Negocio'}</strong>${d.tenant_nit?`<br><span style="font-size:12px;color:#666">NIT: ${d.tenant_nit}</span>`:''}</div></div><div class="biz-info">${d.tenant_address||''}${d.tenant_phone?`<br>${d.tenant_phone}`:''}</div></div>
      <div class="title"><strong style="font-size:15px;color:#2D5A3D">COMPROBANTE DE PAGO DE NOMINA</strong><br><span style="font-size:13px;color:#666">No. ${d.receipt_number||'—'}</span></div>
      <div class="staff-info"><div><dt>Beneficiario</dt><dd>${d.staff_name}</dd></div><div><dt>Cargo</dt><dd>${d.staff_role||'—'}</dd></div><div><dt>Documento</dt><dd>${bank?.document_type||''} ${bank?.document_number_masked||'—'}</dd></div><div><dt>Cuenta destino</dt><dd>${bankLine}</dd></div><div><dt>Periodo</dt><dd>${periodFrom} — ${periodTo}</dd></div><div><dt>Fecha de pago</dt><dd>${d.paid_at?new Date(d.paid_at+'Z').toLocaleDateString('es-CO',{timeZone:'America/Bogota',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—'}</dd></div></div>
      ${visits.length?`<h4 style="font-size:13px;color:#666;margin:20px 0 8px;text-transform:uppercase;letter-spacing:0.5px">Detalle de servicios</h4><table><thead><tr style="background:#f8f9fa"><th style="padding:8px;text-align:left;font-size:11px;color:#666;text-transform:uppercase">Fecha</th><th style="padding:8px;text-align:left;font-size:11px;color:#666;text-transform:uppercase">Servicio</th><th style="padding:8px;text-align:left;font-size:11px;color:#666;text-transform:uppercase">Cliente</th><th style="padding:8px;text-align:center;font-size:11px;color:#666;text-transform:uppercase">Codigo</th><th style="padding:8px;text-align:right;font-size:11px;color:#666;text-transform:uppercase">Precio</th><th style="padding:8px;text-align:right;font-size:11px;color:#666;text-transform:uppercase">Comision</th></tr></thead><tbody>${visitRows}</tbody></table>`:''}
      <div class="totals"><div class="row"><span>Comisiones servicios</span><strong>$${(d.commission_total||0).toLocaleString('es-CO')}</strong></div>${d.tips_total?`<div class="row"><span>Propinas</span><strong>$${d.tips_total.toLocaleString('es-CO')}</strong></div>`:''}${d.product_commissions?`<div class="row"><span>Comisiones productos</span><strong>$${d.product_commissions.toLocaleString('es-CO')}</strong></div>`:''}${d.deductions?`<div class="row" style="color:#DC2626"><span>Deducciones</span><strong>-$${d.deductions.toLocaleString('es-CO')}</strong></div>`:''}
      <div class="row total"><span>TOTAL PAGADO</span><span style="color:#2D5A3D">$${(d.amount||0).toLocaleString('es-CO')}</span></div></div>
      <div style="margin-top:20px;font-size:13px;color:#444"><strong>Metodo:</strong> ${d.payment_method}${d.reference?` &nbsp;|&nbsp; <strong>Ref:</strong> ${d.reference}`:''}${d.paid_by?` &nbsp;|&nbsp; <strong>Pagado por:</strong> ${d.paid_by}`:''}</div>
      <div class="footer">Comprobante generado por Plexify Studio<br>${new Date().toLocaleDateString('es-CO',{day:'numeric',month:'long',year:'numeric'})}</div>
      <div class="no-print" style="text-align:center;margin-top:24px"><button onclick="window.print()" style="background:#2D5A3D;color:#fff;border:none;padding:10px 32px;border-radius:8px;font-size:14px;cursor:pointer;font-weight:600">Imprimir</button></div>
      </body></html>`);
      w.document.close();
    })
    .catch((err) => { w.document.body.innerHTML = `<p style="color:red;text-align:center">Error cargando comprobante</p><p style="color:#888;text-align:center;font-size:12px">${err?.message || err || 'Error desconocido'}</p>`; });
};

// ============================================================================
// TAB RENDIMIENTO — Staff Performance Dashboard v2
// ============================================================================
const TabRendimiento = ({ period, dateFrom, dateTo }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [filterStaff, setFilterStaff] = useState('');
  const [sortBy, setSortBy] = useState('revenue');
  const API_R = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

  useEffect(() => {
    setLoading(true);
    const params = period === 'custom' && dateFrom && dateTo
      ? `?period=custom&date_from=${dateFrom}&date_to=${dateTo}`
      : `?period=${period || 'month'}`;

    fetch(`${API_R}/finances/staff-performance${params}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(d => setData(Array.isArray(d) ? d : []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [period, dateFrom, dateTo]);

  if (loading) return <div className="finances__comm-skeleton">{[...Array(3)].map((_, i) => <div key={i} className="finances__card" style={{ padding: 20 }}><SkeletonBlock width="100%" height="80px" /></div>)}</div>;
  if (!data.length) return <div className="finances__empty">Sin datos de rendimiento para este periodo</div>;

  const filtered = filterStaff ? data.filter(s => s.staff_name.toLowerCase().includes(filterStaff.toLowerCase())) : data;
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'services') return b.services_count - a.services_count;
    if (sortBy === 'clients') return b.unique_clients - a.unique_clients;
    if (sortBy === 'ticket') return b.avg_ticket - a.avg_ticket;
    if (sortBy === 'growth') return b.revenue_growth - a.revenue_growth;
    return b.revenue - a.revenue;
  });

  const totalRevenue = data.reduce((s, st) => s + st.revenue, 0);
  const totalServices = data.reduce((s, st) => s + st.services_count, 0);
  const totalClients = data.reduce((s, st) => s + st.unique_clients, 0);
  const maxRev = sorted[0]?.revenue || 1;
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <>
      <div className="finances__kpis">
        <div className="finances__kpi-card finances__kpi-card--primary">
          <div className="finances__kpi-icon finances__kpi-icon--primary">{Icons.users}</div>
          <div className="finances__kpi-info">
            <span className="finances__kpi-value">{data.length}</span>
            <span className="finances__kpi-label">Profesionales</span>
          </div>
        </div>
        <div className="finances__kpi-card">
          <div className="finances__kpi-icon finances__kpi-icon--success">{Icons.dollar}</div>
          <div className="finances__kpi-info">
            <span className="finances__kpi-value"><AnimatedNumber value={totalRevenue} prefix="$" /></span>
            <span className="finances__kpi-label">Ingresos totales</span>
          </div>
        </div>
        <div className="finances__kpi-card">
          <div className="finances__kpi-icon finances__kpi-icon--accent">{Icons.receipt}</div>
          <div className="finances__kpi-info">
            <span className="finances__kpi-value"><AnimatedNumber value={totalServices} /></span>
            <span className="finances__kpi-label">Servicios</span>
          </div>
        </div>
        <div className="finances__kpi-card">
          <div className="finances__kpi-icon finances__kpi-icon--info">{Icons.users}</div>
          <div className="finances__kpi-info">
            <span className="finances__kpi-value"><AnimatedNumber value={totalClients} /></span>
            <span className="finances__kpi-label">Clientes unicos</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="finances__perf-filters">
        <input className="finances__input" style={{ maxWidth: 220 }} placeholder="Buscar profesional..." value={filterStaff} onChange={e => setFilterStaff(e.target.value)} />
        <div className="finances__perf-sort">
          {[
            { value: 'revenue', label: 'Ingresos' },
            { value: 'services', label: 'Servicios' },
            { value: 'clients', label: 'Clientes' },
            { value: 'ticket', label: 'Ticket' },
            { value: 'growth', label: 'Crecimiento' },
          ].map(opt => (
            <button key={opt.value} className={`finances__visit-filter-chip ${sortBy === opt.value ? 'finances__visit-filter-chip--active' : ''}`} onClick={() => setSortBy(opt.value)}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="finances__perf-list">
        {sorted.map((st, i) => {
          const pct = Math.round((st.revenue / maxRev) * 100);
          const sharePct = totalRevenue > 0 ? Math.round((st.revenue / totalRevenue) * 100) : 0;
          const isExpanded = expandedId === st.staff_id;
          return (
            <div key={st.staff_id} className={`finances__perf-card ${isExpanded ? 'finances__perf-card--expanded' : ''}`}>
              <div className="finances__perf-item" onClick={() => setExpandedId(isExpanded ? null : st.staff_id)}>
                <span className="finances__perf-pos">{i < 3 ? medals[i] : i + 1}</span>
                <div className="finances__perf-avatar" style={{ background: st.photo_url ? 'transparent' : '#2D5A3D' }}>
                  {st.photo_url ? <img src={st.photo_url} alt="" /> : st.staff_name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                </div>
                <div className="finances__perf-info">
                  <div className="finances__perf-header">
                    <div>
                      <strong className="finances__perf-name">{st.staff_name}</strong>
                      <span className="finances__perf-role">{st.staff_role}</span>
                    </div>
                    <div className="finances__perf-stats">
                      <span className="finances__perf-revenue">{formatCOP(st.revenue)}</span>
                      <span className="finances__perf-share">{sharePct}%</span>
                      {st.revenue_growth !== 0 && (
                        <span className={`finances__perf-growth ${st.revenue_growth > 0 ? 'finances__perf-growth--up' : 'finances__perf-growth--down'}`}>
                          {st.revenue_growth > 0 ? '↑' : '↓'}{Math.abs(st.revenue_growth)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="finances__perf-bar-bg">
                    <div className="finances__perf-bar" style={{ width: `${pct}%`, background: i === 0 ? '#F59E0B' : i === 1 ? '#94A3B8' : i === 2 ? '#CD7F32' : '#2D5A3D' }} />
                  </div>
                  <div className="finances__perf-meta">
                    <span>{st.services_count} servicios</span>
                    <span>{st.unique_clients} clientes</span>
                    <span>Ticket: {formatCOP(st.avg_ticket)}</span>
                    <span>Comision ({(st.commission_rate * 100).toFixed(0)}%): {formatCOP(st.commission_amount)}</span>
                  </div>
                </div>
                <svg className={`finances__inv-chevron ${isExpanded ? 'finances__inv-chevron--open' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
              </div>

              {isExpanded && (
                <div className="finances__perf-detail">
                  <div className="finances__perf-detail-grid">
                    {/* Comparison cards */}
                    <div className="finances__perf-compare">
                      <h4>Comparacion vs periodo anterior</h4>
                      <div className="finances__perf-compare-cards">
                        <div className="finances__perf-compare-card">
                          <span className="finances__perf-compare-label">Ingresos</span>
                          <strong>{formatCOP(st.revenue)}</strong>
                          <small>Anterior: {formatCOP(st.prev_revenue)}</small>
                          <span className={st.revenue_growth >= 0 ? 'finances__perf-growth--up' : 'finances__perf-growth--down'}>{st.revenue_growth > 0 ? '+' : ''}{st.revenue_growth}%</span>
                        </div>
                        <div className="finances__perf-compare-card">
                          <span className="finances__perf-compare-label">Servicios</span>
                          <strong>{st.services_count}</strong>
                          <small>Anterior: {st.prev_services}</small>
                          <span className={st.services_growth >= 0 ? 'finances__perf-growth--up' : 'finances__perf-growth--down'}>{st.services_growth > 0 ? '+' : ''}{st.services_growth}%</span>
                        </div>
                        <div className="finances__perf-compare-card">
                          <span className="finances__perf-compare-label">Clientes unicos</span>
                          <strong>{st.unique_clients}</strong>
                        </div>
                        <div className="finances__perf-compare-card">
                          <span className="finances__perf-compare-label">Mejor dia</span>
                          <strong>{st.best_day ? formatCOP(st.best_day.revenue) : '—'}</strong>
                          {st.best_day && <small>{new Date(st.best_day.date + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}</small>}
                        </div>
                      </div>
                    </div>

                    {/* Category breakdown */}
                    <div className="finances__perf-categories">
                      <h4>Ingresos por categoria</h4>
                      {Object.entries(st.category_breakdown || {}).sort((a, b) => b[1] - a[1]).map(([cat, rev]) => (
                        <div key={cat} className="finances__perf-cat-row">
                          <span className="finances__perf-cat-name" style={{ color: CATEGORY_COLORS[cat] || '#666' }}>{cat}</span>
                          <div className="finances__perf-cat-bar-bg">
                            <div className="finances__perf-cat-bar" style={{ width: `${Math.round((rev / st.revenue) * 100)}%`, background: CATEGORY_COLORS[cat] || '#999' }} />
                          </div>
                          <span className="finances__perf-cat-value">{formatCOP(rev)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Top services */}
                  {st.top_services && st.top_services.length > 0 && (
                    <div className="finances__perf-top-services">
                      <h4>Servicios mas realizados</h4>
                      <div className="finances__perf-service-chips">
                        {st.top_services.map((svc, j) => (
                          <span key={j} className="finances__perf-service-chip">{svc.name} <strong>{svc.count}</strong></span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mini daily chart */}
                  {st.daily_revenue && st.daily_revenue.length > 1 && (
                    <div className="finances__perf-daily">
                      <h4>Ingresos por dia</h4>
                      <ResponsiveContainer width="100%" height={120}>
                        <BarChart data={st.daily_revenue.map(d => ({ ...d, label: new Date(d.date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) }))}>
                          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#999' }} tickLine={false} axisLine={false} />
                          <Tooltip content={<RechartsTooltip formatter={formatCOP} />} />
                          <Bar dataKey="revenue" name="Ingresos" fill={i === 0 ? '#F59E0B' : '#2D5A3D'} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
};

// ============================================================================
// TAB DIAN — Electronic invoicing status and operations
// ============================================================================
const TabDian = () => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const API_D = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

  useEffect(() => {
    fetch(`${API_D}/settings/dian`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => setConfig(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="finances__comm-skeleton"><SkeletonBlock width="100%" height="200px" /></div>;

  const completeness = config?.completeness || 0;
  const isConfigured = completeness >= 80;
  const hasProvider = !!config?.billing_provider;
  const hasResolution = !!config?.dian_resolution_number;

  return (
    <>
      {/* Status overview */}
      <div className="finances__kpis">
        <div className={`finances__kpi-card ${isConfigured ? '' : 'finances__kpi-card--warning'}`}>
          <div className="finances__kpi-icon" style={{ background: isConfigured ? 'rgba(5,150,105,0.1)' : 'rgba(217,119,6,0.1)', color: isConfigured ? '#059669' : '#D97706' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <div className="finances__kpi-info">
            <span className="finances__kpi-value">{completeness}%</span>
            <span className="finances__kpi-label">Config fiscal</span>
          </div>
        </div>
        <div className="finances__kpi-card">
          <div className="finances__kpi-icon" style={{ background: hasResolution ? 'rgba(5,150,105,0.1)' : 'rgba(0,0,0,0.05)', color: hasResolution ? '#059669' : '#999' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
          </div>
          <div className="finances__kpi-info">
            <span className="finances__kpi-value">{hasResolution ? 'Activa' : 'Pendiente'}</span>
            <span className="finances__kpi-label">Resolucion DIAN</span>
          </div>
        </div>
        <div className="finances__kpi-card">
          <div className="finances__kpi-icon" style={{ background: hasProvider ? 'rgba(59,130,246,0.1)' : 'rgba(0,0,0,0.05)', color: hasProvider ? '#3B82F6' : '#999' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          </div>
          <div className="finances__kpi-info">
            <span className="finances__kpi-value">{config?.billing_provider || 'Ninguno'}</span>
            <span className="finances__kpi-label">Proveedor</span>
          </div>
        </div>
        <div className="finances__kpi-card">
          <div className="finances__kpi-icon" style={{ background: 'rgba(0,0,0,0.05)', color: '#999' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          </div>
          <div className="finances__kpi-info">
            <span className="finances__kpi-value">Proximo</span>
            <span className="finances__kpi-label">Facturas electronicas</span>
          </div>
        </div>
      </div>

      {/* Config summary */}
      <div className="finances__card" style={{ marginBottom: 16 }}>
        <div className="finances__card-header">
          <h2 className="finances__card-title">Estado de configuracion</h2>
        </div>
        <div style={{ padding: '16px 20px' }}>
          {/* Progress bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 8, background: 'rgba(0,0,0,0.06)', borderRadius: 4 }}>
              <div style={{ width: `${completeness}%`, height: '100%', borderRadius: 4, background: completeness === 100 ? '#059669' : completeness >= 60 ? '#D97706' : '#DC2626', transition: 'width 400ms' }} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: completeness === 100 ? '#059669' : '#D97706' }}>{completeness}%</span>
          </div>

          {/* Checklist */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'NIT', done: !!config?.nit },
              { label: 'Razon social', done: !!config?.legal_name },
              { label: 'Regimen fiscal', done: !!config?.tax_regime },
              { label: 'Direccion fiscal', done: !!config?.fiscal_address },
              { label: 'Email fiscal', done: !!config?.fiscal_email },
              { label: 'Resolucion DIAN', done: !!config?.dian_resolution_number },
              { label: 'Prefijo facturacion', done: !!config?.invoice_prefix },
              { label: 'Proveedor tecnologico', done: !!config?.billing_provider },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: item.done ? 'rgba(5,150,105,0.04)' : 'rgba(0,0,0,0.02)' }}>
                {item.done ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2"><circle cx="12" cy="12" r="10"/></svg>
                )}
                <span style={{ fontSize: 13, fontWeight: item.done ? 600 : 400, color: item.done ? '#059669' : 'rgba(0,0,0,0.45)' }}>{item.label}</span>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 12, color: 'rgba(0,0,0,0.35)', marginTop: 16 }}>
            Configura los datos fiscales en <strong>Settings → Facturacion / DIAN</strong>. Una vez completo, podras emitir facturas electronicas validas ante la DIAN.
          </p>
        </div>
      </div>

      {/* Info cards */}
      {config?.nit && (
        <div className="finances__card" style={{ marginBottom: 16 }}>
          <div className="finances__card-header">
            <h2 className="finances__card-title">Datos del negocio</h2>
          </div>
          <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div><span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(0,0,0,0.3)', display: 'block' }}>NIT</span><strong style={{ fontSize: 15 }}>{config.nit}</strong></div>
            <div><span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(0,0,0,0.3)', display: 'block' }}>Razon social</span><strong style={{ fontSize: 15 }}>{config.legal_name || '—'}</strong></div>
            <div><span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(0,0,0,0.3)', display: 'block' }}>Regimen</span><strong style={{ fontSize: 15 }}>{config.tax_regime === 'rst' ? 'RST' : config.tax_regime === 'responsable_iva' ? 'Responsable IVA' : config.tax_regime === 'no_responsable' ? 'No responsable' : '—'}</strong></div>
            {config.invoice_prefix && <div><span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(0,0,0,0.3)', display: 'block' }}>Prefijo</span><strong style={{ fontSize: 15 }}>{config.invoice_prefix}</strong></div>}
            {config.invoice_range_from && <div><span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(0,0,0,0.3)', display: 'block' }}>Rango</span><strong style={{ fontSize: 15 }}>{config.invoice_range_from} — {config.invoice_range_to}</strong></div>}
            {config.billing_provider && <div><span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(0,0,0,0.3)', display: 'block' }}>Proveedor</span><strong style={{ fontSize: 15, textTransform: 'capitalize' }}>{config.billing_provider} ({config.billing_environment || 'test'})</strong></div>}
          </div>
        </div>
      )}

      {/* What's next */}
      <div className="finances__card">
        <div className="finances__card-header">
          <h2 className="finances__card-title">Proximos pasos</h2>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { step: 1, title: 'Completar datos fiscales', desc: 'NIT, razon social, regimen, direccion fiscal en Settings', done: completeness >= 80 },
              { step: 2, title: 'Obtener resolucion DIAN', desc: 'Tramitar habilitacion como facturador electronico ante la DIAN', done: hasResolution },
              { step: 3, title: 'Conectar proveedor tecnologico', desc: 'Dataico o Alegra — ellos generan el XML, firman y envian a la DIAN', done: hasProvider },
              { step: 4, title: 'Emitir primera factura electronica', desc: 'El sistema genera factura DIAN-valida con CUFE y QR automaticamente', done: false },
            ].map(s => (
              <div key={s.step} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', borderRadius: 10, background: s.done ? 'rgba(5,150,105,0.03)' : 'rgba(0,0,0,0.02)' }}>
                <span style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0, background: s.done ? '#059669' : 'rgba(0,0,0,0.08)', color: s.done ? '#fff' : 'rgba(0,0,0,0.35)' }}>{s.done ? '✓' : s.step}</span>
                <div>
                  <strong style={{ fontSize: 14, display: 'block', color: s.done ? '#059669' : '#1a1a1a' }}>{s.title}</strong>
                  <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)' }}>{s.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

const NOMINA_PERIODS = [
  { value: 'month', label: 'Este Mes' },
  { value: 'last_month', label: 'Mes Anterior' },
  { value: 'fortnight', label: 'Última Quincena' },
  { value: 'year', label: 'Este Año' },
  { value: 'custom', label: 'Personalizado' },
];

const TabNomina = () => {
  const { addNotification } = useNotification();

  const [nominaPeriod, setNominaPeriod] = useState('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const computedDates = useMemo(() => {
    const today = new Date();
    const toStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const to = toStr(today);
    if (nominaPeriod === 'custom' && customFrom && customTo) return { from: customFrom, to: customTo };
    if (nominaPeriod === 'last_month') {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: toStr(first), to: toStr(last) };
    }
    if (nominaPeriod === 'fortnight') {
      const fort = new Date(today); fort.setDate(today.getDate() - 15);
      return { from: toStr(fort), to };
    }
    if (nominaPeriod === 'year') {
      return { from: `${today.getFullYear()}-01-01`, to };
    }
    // Default: month
    return { from: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`, to };
  }, [nominaPeriod, customFrom, customTo]);

  const dateFrom = computedDates.from;
  const dateTo = computedDates.to;

  const [summary, setSummary] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPayModal, setShowPayModal] = useState(null);
  const [payForm, setPayForm] = useState({ amount: '', concept: '', payment_method: 'efectivo', reference: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [expandedStaff, setExpandedStaff] = useState(null);
  const [selectedVisitIds, setSelectedVisitIds] = useState([]);
  const [bankInfo, setBankInfo] = useState(null);
  const [staffVisitsMap, setStaffVisitsMap] = useState({}); // staffId -> visits[]
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkSelections, setBulkSelections] = useState({}); // staffId -> true/false
  const [bulkPaying, setBulkPaying] = useState(false);
  const API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

  const fetchApi = async (url, options = {}) => {
    const res = await fetch(`${API}${url}`, { credentials: 'include', ...options });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = typeof err.detail === 'string' ? err.detail : Array.isArray(err.detail) ? err.detail.map(e => e.msg || JSON.stringify(e)).join(', ') : `Error ${res.status}`;
      throw new Error(msg);
    }
    return res.json();
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [summ, pays] = await Promise.all([
        fetchApi(`/staff-payments/summary?period_from=${dateFrom}&period_to=${dateTo}`),
        fetchApi('/staff-payments/'),
      ]);
      setSummary(summ);
      setPayments(pays);
    } catch (err) {
      addNotification('Error cargando nómina: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, addNotification]);

  useEffect(() => { load(); }, [load]);

  const totalOwed = summary.reduce((s, st) => s + Math.max(0, st.balance), 0);
  const totalPaid = summary.reduce((s, st) => s + st.total_paid, 0);
  const totalEarned = summary.reduce((s, st) => s + st.total_earned, 0);

  const fmtDate = (d) => {
    if (!d) return '—';
    const parts = d.split('-');
    if (parts.length !== 3) return d;
    const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12);
    return dt.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  };
  const fmtDateFull = (d) => {
    if (!d) return '—';
    const parts = d.split('-');
    if (parts.length !== 3) return d;
    const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12);
    return dt.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const openPayModal = async (staff, keepSelection = false) => {
    setShowPayModal(staff);
    if (!keepSelection) setSelectedVisitIds([]);
    setBankInfo(null);

    // Calculate amount: if we have selected visits, sum their commissions; otherwise use full balance
    let amount = Math.max(0, staff.balance);
    const currentSelected = keepSelection ? selectedVisitIds : [];
    if (currentSelected.length > 0) {
      const visits = staffVisitsMap[staff.staff_id] || [];
      const selectedRevenue = visits.filter(v => currentSelected.includes(v.id)).reduce((s, v) => s + (v.price || 0), 0);
      amount = Math.round(selectedRevenue * staff.commission_rate);
    }

    setPayForm({
      amount: String(amount),
      concept: `Comisiones ${fmtDate(dateFrom)} — ${fmtDateFull(dateTo)}`,
      payment_method: staff.preferred_payment_method || 'efectivo',
      reference: '',
      notes: '',
    });
    // Fetch bank info
    try {
      const info = await fetchApi(`/staff-payments/bank-info/${staff.staff_id}`);
      setBankInfo(info);
    } catch {}
  };

  const handlePay = async (e) => {
    e.preventDefault();
    if (!showPayModal || !payForm.amount) return;
    setSubmitting(true);
    try {
      await fetchApi('/staff-payments/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: showPayModal.staff_id,
          amount: parseInt(payForm.amount) || 0,
          period_from: dateFrom,
          period_to: dateTo,
          concept: payForm.concept,
          payment_method: payForm.payment_method,
          reference: payForm.reference || null,
          notes: payForm.notes || null,
          commission_total: showPayModal.total_earned,
          tips_total: 0,
          product_commissions: 0,
          deductions: 0,
          appointment_ids: selectedVisitIds.length > 0 ? selectedVisitIds : null,
        }),
      });
      addNotification(`Pago registrado para ${showPayModal.staff_name}`, 'success');

      // Send WhatsApp notification to staff
      try {
        const staffRes = await fetch(`${API}/staff/${showPayModal.staff_id}`, { credentials: 'include' });
        if (staffRes.ok) {
          const staffData = await staffRes.json();
          const phone = staffData.phone || staffData.personal_phone;
          if (phone) {
            const amt = formatCOP(parseInt(payForm.amount) || 0);
            const msg = `Hola ${showPayModal.staff_name.split(' ')[0]}, se ha registrado un pago de ${amt} por concepto de: ${payForm.concept}. Método: ${payForm.payment_method}${payForm.reference ? '. Ref: ' + payForm.reference : ''}. Gracias por tu trabajo.`;
            await fetch(`${API}/whatsapp/send-text`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ phone, message: msg }),
            }).catch(() => {});
          }
        }
      } catch {}

      setShowPayModal(null);
      setSelectedVisitIds([]);
      load();
    } catch (err) {
      addNotification('Error: ' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePayment = async (id) => {
    try {
      await fetchApi(`/staff-payments/${id}`, { method: 'DELETE' });
      addNotification('Pago eliminado', 'success');
      load();
    } catch (err) {
      addNotification('Error: ' + err.message, 'error');
    }
  };

  const staffWithBalance = summary.filter(st => st.balance > 0);

  const openBulkModal = () => {
    const sel = {};
    staffWithBalance.forEach(st => { sel[st.staff_id] = true; });
    setBulkSelections(sel);
    setShowBulkModal(true);
  };

  const bulkTotal = staffWithBalance.filter(st => bulkSelections[st.staff_id]).reduce((s, st) => s + st.balance, 0);

  const handleBulkPay = async () => {
    setBulkPaying(true);
    const toPay = staffWithBalance.filter(st => bulkSelections[st.staff_id]);
    let ok = 0;
    let fail = 0;
    for (const st of toPay) {
      try {
        await fetchApi('/staff-payments/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            staff_id: st.staff_id,
            amount: Math.max(0, st.balance),
            period_from: dateFrom,
            period_to: dateTo,
            concept: `Comisiones ${fmtDate(dateFrom)} — ${fmtDateFull(dateTo)}`,
            payment_method: st.preferred_payment_method || 'efectivo',
            commission_total: st.total_earned,
            tips_total: 0,
            product_commissions: 0,
            deductions: 0,
          }),
        });
        ok++;
        // WA notification
        try {
          const staffRes = await fetch(`${API}/staff/${st.staff_id}`, { credentials: 'include' });
          if (staffRes.ok) {
            const staffData = await staffRes.json();
            const phone = staffData.phone;
            if (phone) {
              await fetch(`${API}/whatsapp/send-text`, {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, message: `Hola ${st.staff_name.split(' ')[0]}, se ha registrado un pago de ${formatCOP(st.balance)}. Gracias por tu trabajo.` }),
              }).catch(() => {});
            }
          }
        } catch {}
      } catch { fail++; }
    }
    addNotification(`Nomina liquidada: ${ok} pagos registrados${fail ? `, ${fail} fallidos` : ''}`, ok > 0 ? 'success' : 'error');
    setShowBulkModal(false);
    setBulkPaying(false);
    load();
  };

  if (loading) return <div className="finances__comm-skeleton">{[...Array(3)].map((_, i) => <div key={i} className="finances__card" style={{ padding: 20 }}><SkeletonBlock width="100%" height="80px" /></div>)}</div>;

  return (
    <>
      <div className="finances__nom-stats">
        <div className="finances__nom-stat">
          <div className="finances__nom-stat-icon" style={{ background: 'linear-gradient(135deg, #2D5A3D, #3D7A52)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div className="finances__nom-stat-data">
            <span className="finances__nom-stat-value">{summary.length}</span>
            <span className="finances__nom-stat-label">Profesionales</span>
          </div>
        </div>
        <div className="finances__nom-stat">
          <div className="finances__nom-stat-icon" style={{ background: 'linear-gradient(135deg, #059669, #10B981)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div className="finances__nom-stat-data">
            <span className="finances__nom-stat-value"><AnimatedNumber value={totalEarned} prefix="$" /></span>
            <span className="finances__nom-stat-label">Total comisiones</span>
          </div>
        </div>
        <div className="finances__nom-stat">
          <div className="finances__nom-stat-icon" style={{ background: 'linear-gradient(135deg, #3B82F6, #60A5FA)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div className="finances__nom-stat-data">
            <span className="finances__nom-stat-value"><AnimatedNumber value={totalPaid} prefix="$" /></span>
            <span className="finances__nom-stat-label">Pagado</span>
          </div>
        </div>
        {totalOwed > 0 && (
          <div className="finances__nom-stat finances__nom-stat--alert">
            <div className="finances__nom-stat-icon" style={{ background: 'linear-gradient(135deg, #DC2626, #EF4444)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div className="finances__nom-stat-data">
              <span className="finances__nom-stat-value" style={{ color: '#DC2626' }}><AnimatedNumber value={totalOwed} prefix="$" /></span>
              <span className="finances__nom-stat-label">Pendiente</span>
            </div>
          </div>
        )}
      </div>

      <div className="finances__nom-controls">
        <div className="finances__nom-periods">
          {NOMINA_PERIODS.map(p => (
            <button key={p.value} className={`finances__nom-period ${nominaPeriod === p.value ? 'finances__nom-period--active' : ''}`} onClick={() => setNominaPeriod(p.value)}>
              {p.label}
            </button>
          ))}
        </div>
        {nominaPeriod === 'custom' && (
          <div className="finances__nom-custom-dates">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
            <span>—</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} />
          </div>
        )}
        <div className="finances__nom-controls-right">
          <span className="finances__nom-date-range">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            {fmtDate(dateFrom)} — {fmtDateFull(dateTo)}
          </span>
          {staffWithBalance.length > 0 && (
            <button className="finances__nom-pay-all" onClick={openBulkModal}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              Liquidar nómina ({staffWithBalance.length})
            </button>
          )}
        </div>
      </div>

      <div className="finances__nomina-table">
        <div className="finances__nomina-thead">
          <span style={{ flex: 1 }}>Profesional</span>
          <span className="finances__nom-col-center" style={{ width: 80 }}>Servicios</span>
          <span className="finances__nom-col-center" style={{ width: 80 }}>Pendientes</span>
          <span className="finances__nom-col-right" style={{ width: 120 }}>Ganado</span>
          <span className="finances__nom-col-right" style={{ width: 120 }}>Pagado</span>
          <span className="finances__nom-col-right" style={{ width: 120 }}>Saldo</span>
          <span style={{ width: 140 }} />
        </div>
        {summary.map(st => {
          const isExpanded = expandedStaff === st.staff_id;
          const staffPayments = payments.filter(p => p.staff_id === st.staff_id);
          return (
            <div key={st.staff_id} className={`finances__nomina-row-wrap ${isExpanded ? 'finances__nomina-row-wrap--expanded' : ''}`}>
              <div className="finances__nomina-row" onClick={() => { setExpandedStaff(isExpanded ? null : st.staff_id); setSelectedVisitIds([]); }}>
                <span className="finances__nomina-staff" style={{ flex: 1 }}>
                  <span className="finances__nomina-avatar" style={{ background: st.photo_url ? 'transparent' : '#2D5A3D' }}>
                    {st.photo_url ? <img src={st.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }} /> : st.staff_name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                  </span>
                  <span className="finances__nomina-name">
                    <strong>{st.staff_name}</strong>
                    <small>
                      {st.staff_role}
                      <span className="finances__nom-rate-pill">{(st.commission_rate * 100).toFixed(0)}%</span>
                      {st.has_bank_info && <span className="finances__nom-bank-dot" title="Datos bancarios">$</span>}
                    </small>
                  </span>
                </span>
                <span className="finances__nom-col-center finances__nom-cell" style={{ width: 80 }}>{st.services_count}</span>
                <span className="finances__nom-col-center finances__nom-cell" style={{ width: 80 }}>
                  {(st.unpaid_services_count || 0) > 0
                    ? <span className="finances__nom-unpaid-badge">{st.unpaid_services_count}</span>
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  }
                </span>
                <span className="finances__nom-col-right finances__nom-cell finances__nom-cell--earned" style={{ width: 120 }}>{formatCOP(st.total_earned)}</span>
                <span className="finances__nom-col-right finances__nom-cell finances__nom-cell--paid" style={{ width: 120 }}>{formatCOP(st.total_paid)}</span>
                <span className="finances__nom-col-right" style={{ width: 120 }}>
                  {st.balance > 0
                    ? <span className="finances__nom-balance-owed">{formatCOP(st.balance)}</span>
                    : <span className="finances__nom-balance-ok">Al día</span>
                  }
                </span>
                <span style={{ width: 140, display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                  {st.balance > 0 && (
                    <button className="finances__nom-pay-btn" onClick={(e) => { e.stopPropagation(); openPayModal(st); }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                      Pagar
                    </button>
                  )}
                  <div className={`finances__nom-chevron ${isExpanded ? 'finances__nom-chevron--open' : ''}`}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
                  </div>
                </span>
              </div>

              {isExpanded && (
                <div className="finances__nom-expand">
                  <div className="finances__nom-expand-grid">
                    <div className="finances__nom-expand-col">
                      <div className="finances__nom-expand-head">
                        <div className="finances__nom-expand-title">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                          Servicios realizados
                        </div>
                        {selectedVisitIds.length > 0 && (
                          <button className="finances__nom-pay-selected" onClick={() => openPayModal(st, true)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                            Pagar {selectedVisitIds.length} seleccionadas
                          </button>
                        )}
                      </div>
                      <StaffVisitsList
                        staffId={st.staff_id}
                        dateFrom={dateFrom}
                        dateTo={dateTo}
                        commissionRate={st.commission_rate}
                        selectable={true}
                        selectedIds={selectedVisitIds}
                        onSelectionChange={setSelectedVisitIds}
                        onVisitsLoaded={(v) => setStaffVisitsMap(prev => ({ ...prev, [st.staff_id]: v }))}
                      />
                    </div>
                    <div className="finances__nom-expand-col">
                      <div className="finances__nom-expand-title">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        Historial de pagos
                        {staffPayments.length > 0 && <span className="finances__nom-expand-count">{staffPayments.length}</span>}
                      </div>
                      {staffPayments.length > 0 ? (
                        <div className="finances__nom-payments">
                          {staffPayments.map(p => (
                            <div key={p.id} className="finances__nom-payment-card">
                              <div className="finances__nom-payment-top">
                                <div className="finances__nom-payment-info">
                                  <span className="finances__nom-payment-date">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg>
                                    {new Date(p.paid_at + 'Z').toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short', year: 'numeric' })}
                                  </span>
                                  <span className="finances__nom-payment-concept">{p.concept}</span>
                                </div>
                                <div className="finances__nom-payment-right">
                                  <span className="finances__nom-payment-method">{p.payment_method}</span>
                                  <span className="finances__nom-payment-amount">{formatCOP(p.amount)}</span>
                                </div>
                              </div>
                              <div className="finances__nom-payment-bottom">
                                {p.receipt_number && <span className="finances__nom-receipt-tag">{p.receipt_number}</span>}
                                {p.paid_by && <span className="finances__nom-payment-by">Por: {p.paid_by}</span>}
                                {p.reference && <span className="finances__nom-payment-ref">Ref: {p.reference}</span>}
                                <div className="finances__nom-payment-actions">
                                  {p.receipt_number && (
                                    <button className="finances__nom-action-btn" onClick={() => openPaymentReceipt(p.id, API)} title="Ver comprobante">
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                    </button>
                                  )}
                                  <button className="finances__nom-action-btn finances__nom-action-btn--danger" onClick={() => handleDeletePayment(p.id)} title="Eliminar">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="finances__nom-empty-payments">
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
                          <p>Sin pagos registrados</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showPayModal && createPortal(
        <div className="finances__pay-overlay" onClick={() => { setShowPayModal(null); setSelectedVisitIds([]); }}>
          <form className="finances__pay-modal" onClick={e => e.stopPropagation()} onSubmit={handlePay}>
            <div className="finances__pay-header">
              <h2>Registrar pago</h2>
              <button type="button" onClick={() => { setShowPayModal(null); setSelectedVisitIds([]); }} className="finances__modal-close">&times;</button>
            </div>

            <div className="finances__pay-staff">
              <span className="finances__nomina-avatar" style={{ background: showPayModal.photo_url ? 'transparent' : '#2D5A3D', width: 44, height: 44, fontSize: 15 }}>
                {showPayModal.photo_url ? <img src={showPayModal.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : showPayModal.staff_name.split(' ').map(w => w[0]).join('').slice(0, 2)}
              </span>
              <div>
                <strong>{showPayModal.staff_name}</strong>
                <small style={{ display: 'block', color: 'rgba(0,0,0,0.4)', fontSize: 12 }}>
                  {showPayModal.staff_role} · {(showPayModal.commission_rate * 100).toFixed(0)}%
                </small>
                <small style={{ display: 'block', color: 'rgba(0,0,0,0.5)', fontSize: 12, marginTop: 2 }}>
                  Ganado: {formatCOP(showPayModal.total_earned)} · Pagado: {formatCOP(showPayModal.total_paid)} · <strong style={{ color: showPayModal.balance > 0 ? '#DC2626' : '#059669' }}>Saldo: {formatCOP(showPayModal.balance)}</strong>
                </small>
              </div>
            </div>

            {/* Bank info destination */}
            {bankInfo && (bankInfo.bank_account_number || bankInfo.nequi_phone || bankInfo.daviplata_phone) && (
              <div className="finances__pay-bank">
                <span className="finances__pay-bank-label">Cuenta destino</span>
                <div className="finances__pay-bank-info">
                  {(bankInfo.preferred_payment_method === 'nequi' && bankInfo.nequi_phone) ? (
                    <span>Nequi: <strong>{bankInfo.nequi_phone.replace(/(\d{3})(\d+)(\d{4})/, '$1-***-$3')}</strong></span>
                  ) : (bankInfo.preferred_payment_method === 'daviplata' && bankInfo.daviplata_phone) ? (
                    <span>Daviplata: <strong>{bankInfo.daviplata_phone.replace(/(\d{3})(\d+)(\d{4})/, '$1-***-$3')}</strong></span>
                  ) : ((bankInfo.preferred_payment_method === 'transferencia' || bankInfo.preferred_payment_method === 'bancolombia') && bankInfo.bank_name && bankInfo.bank_account_number) ? (
                    <span>{bankInfo.bank_name} · {bankInfo.bank_account_type} · <strong>****{bankInfo.bank_account_number.slice(-4)}</strong></span>
                  ) : (
                    <span style={{ color: '#999' }}>Metodo: {bankInfo.preferred_payment_method || '—'}</span>
                  )}
                  {bankInfo.document_type && bankInfo.document_number && (
                    <small style={{ display: 'block', color: 'rgba(0,0,0,0.4)', fontSize: 11, marginTop: 2 }}>
                      {bankInfo.document_type}: ****{bankInfo.document_number.slice(-4)}
                    </small>
                  )}
                </div>
              </div>
            )}

            {selectedVisitIds.length > 0 && (
              <div className="finances__pay-selected-info">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2D5A3D" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <span>{selectedVisitIds.length} servicios seleccionados — Comision: {formatCOP(parseInt(payForm.amount) || 0)}</span>
              </div>
            )}

            <div className="finances__pay-fields">
              <div className="finances__pay-field">
                <label>Monto a pagar *</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: 'rgba(0,0,0,0.35)', fontWeight: 600 }}>$</span>
                  <input type="number" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} required className="finances__input" />
                </div>
              </div>
              <div className="finances__pay-field">
                <label>Concepto *</label>
                <input value={payForm.concept} onChange={e => setPayForm(f => ({ ...f, concept: e.target.value }))} required className="finances__input" />
              </div>
              <div className="finances__pay-field">
                <label>Metodo de pago *</label>
                <select value={payForm.payment_method} onChange={e => setPayForm(f => ({ ...f, payment_method: e.target.value }))} className="finances__select">
                  <option value="efectivo">Efectivo</option>
                  <option value="nequi">Nequi</option>
                  <option value="daviplata">Daviplata</option>
                  <option value="transferencia">Transferencia bancaria</option>
                </select>
              </div>
              <div className="finances__pay-field">
                <label>Referencia / Nro. transferencia</label>
                <input value={payForm.reference} onChange={e => setPayForm(f => ({ ...f, reference: e.target.value }))} className="finances__input" placeholder="Opcional" />
              </div>
              <div className="finances__pay-field">
                <label>Notas</label>
                <textarea value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} className="finances__input" rows={2} placeholder="Opcional" />
              </div>
            </div>
            <div className="finances__pay-actions">
              <button type="button" className="finances__btn-ghost" onClick={() => { setShowPayModal(null); setSelectedVisitIds([]); }}>Cancelar</button>
              <button type="submit" className="finances__btn-primary" disabled={submitting}>
                {submitting ? 'Procesando...' : `Pagar ${formatCOP(parseInt(payForm.amount) || 0)}`}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {showBulkModal && createPortal(
        <div className="finances__pay-overlay" onClick={() => setShowBulkModal(false)}>
          <div className="finances__pay-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="finances__pay-header">
              <h2>Liquidar nomina</h2>
              <button type="button" onClick={() => setShowBulkModal(false)} className="finances__modal-close">&times;</button>
            </div>
            <div style={{ padding: '16px 24px' }}>
              <p style={{ fontSize: 13, color: 'rgba(0,0,0,0.5)', marginBottom: 16 }}>
                Selecciona los profesionales a pagar. Se creara un pago individual para cada uno.
              </p>
              <div className="finances__bulk-list">
                {staffWithBalance.map(st => (
                  <label key={st.staff_id} className={`finances__bulk-item ${bulkSelections[st.staff_id] ? 'finances__bulk-item--selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={!!bulkSelections[st.staff_id]}
                      onChange={() => setBulkSelections(prev => ({ ...prev, [st.staff_id]: !prev[st.staff_id] }))}
                    />
                    <span className="finances__nomina-avatar" style={{ background: st.photo_url ? 'transparent' : '#2D5A3D', width: 32, height: 32, fontSize: 11, flexShrink: 0 }}>
                      {st.photo_url ? <img src={st.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : st.staff_name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                    </span>
                    <span style={{ flex: 1 }}>
                      <strong style={{ fontSize: 13 }}>{st.staff_name}</strong>
                      <small style={{ display: 'block', fontSize: 11, color: 'rgba(0,0,0,0.4)' }}>{st.staff_role} · {(st.commission_rate * 100).toFixed(0)}%</small>
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#DC2626' }}>{formatCOP(st.balance)}</span>
                  </label>
                ))}
              </div>
              <div className="finances__bulk-total">
                <span>Total a dispersar ({staffWithBalance.filter(st => bulkSelections[st.staff_id]).length} profesionales)</span>
                <strong>{formatCOP(bulkTotal)}</strong>
              </div>
            </div>
            <div className="finances__pay-actions">
              <button className="finances__btn-ghost" onClick={() => setShowBulkModal(false)}>Cancelar</button>
              <button className="finances__btn-primary" onClick={handleBulkPay} disabled={bulkPaying || bulkTotal === 0}>
                {bulkPaying ? 'Procesando...' : `Liquidar ${formatCOP(bulkTotal)}`}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

const Finances = () => {
  const { tenant } = useTenant();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('month');
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('resumen');

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showCustomRange, setShowCustomRange] = useState(false);

  const fetchData = useCallback(async (p, isRefresh = false, customFrom, customTo) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      let url = `${API_URL}/finances/summary?period=${p}`;
      if (p === 'custom' && customFrom && customTo) {
        url = `${API_URL}/finances/summary?period=custom&date_from=${customFrom}&date_to=${customTo}`;
      }
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Error de servidor' }));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (period === 'custom' && dateFrom && dateTo) {
      fetchData(period, false, dateFrom, dateTo);
    } else if (period !== 'custom') {
      fetchData(period);
    }
  }, [period, dateFrom, dateTo, fetchData]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (period === 'custom' && dateFrom && dateTo) {
        fetchData(period, true, dateFrom, dateTo);
      } else if (period !== 'custom') {
        fetchData(period, true);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [period, dateFrom, dateTo, fetchData]);

  const handlePeriodChange = (p) => {
    setPeriod(p);
    if (p !== 'custom') {
      setShowCustomRange(false);
    }
  };

  const handleCustomToggle = () => {
    if (period === 'custom') {
      setPeriod('month');
      setShowCustomRange(false);
    } else {
      setShowCustomRange(true);
      const today = new Date();
      const thirtyAgo = new Date(today);
      thirtyAgo.setDate(today.getDate() - 30);
      const from = thirtyAgo.toISOString().split('T')[0];
      const to = today.toISOString().split('T')[0];
      setDateFrom(from);
      setDateTo(to);
      setPeriod('custom');
    }
  };

  if (error && !data) {
    return (
      <div className="finances">
        <div className="finances__header">
          <div className="finances__header-left"><h1 className="finances__title">Finanzas</h1></div>
        </div>
        <div className="finances__error">
          <div className="finances__error-icon">{Icons.alert}</div>
          <p className="finances__error-text">No se pudieron cargar los datos financieros</p>
          <p className="finances__error-detail">{error}</p>
          <button className="finances__error-btn" onClick={() => fetchData(period, false, dateFrom, dateTo)}>Reintentar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="finances">
      <div className="finances__header">
        <div className="finances__header-left">
          <div className="finances__header-title-row">
            <h1 className="finances__title">Finanzas</h1>
            {data?.date_from && (
              <span className="finances__date-range">{Icons.calendar} {formatDateRange(data.date_from, data.date_to)}</span>
            )}
          </div>
          <p className="finances__subtitle">Control financiero — {tenant.name}</p>
        </div>
        <div className="finances__header-right">
          <button
            className={`finances__refresh-btn ${refreshing ? 'finances__refresh-btn--spinning' : ''}`}
            onClick={() => fetchData(period, true, dateFrom, dateTo)}
            disabled={refreshing}
            title="Actualizar datos"
          >
            {Icons.refresh}
          </button>
          <div className="finances__period-selector">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`finances__period-btn ${period === opt.value ? 'finances__period-btn--active' : ''}`}
                onClick={() => handlePeriodChange(opt.value)}
                disabled={loading}
              >
                {opt.label}
              </button>
            ))}
            <button
              className={`finances__period-btn ${period === 'custom' ? 'finances__period-btn--active' : ''}`}
              onClick={handleCustomToggle}
              disabled={loading}
            >
              {Icons.calendar} Personalizado
            </button>
          </div>
          {showCustomRange && (
            <div className="finances__period-custom">
              <input
                className="finances__input finances__input--date"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <span className="finances__period-custom-sep">—</span>
              <input
                className="finances__input finances__input--date"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>
      <div className="finances__tab-selector">
        {TAB_OPTIONS.map((tab) => (
          <button
            key={tab.value}
            className={`finances__tab-btn ${activeTab === tab.value ? 'finances__tab-btn--active' : ''}`}
            onClick={() => setActiveTab(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === 'resumen' && <TabResumen data={data} loading={loading} period={period} dateFrom={dateFrom} dateTo={dateTo} />}
      {activeTab === 'forecast' && <TabForecast />}
      {activeTab === 'reportes' && <TabReportes period={period} dateFrom={dateFrom} dateTo={dateTo} />}
      {activeTab === 'rendimiento' && <TabRendimiento period={period} dateFrom={dateFrom} dateTo={dateTo} />}
      {activeTab === 'gastos' && <TabGastos period={period} dateFrom={dateFrom} dateTo={dateTo} />}
      {activeTab === 'facturas' && <TabFacturas period={period} dateFrom={dateFrom} dateTo={dateTo} />}
      {activeTab === 'nomina' && <TabNomina />}
      {activeTab === 'dian' && <TabDian />}
    </div>
  );
};

export default Finances;
