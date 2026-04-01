import { useState, useEffect, useCallback, useMemo } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const b = 'dev-mrr';

const formatCOP = (val) => `$${Number(val || 0).toLocaleString('es-CO')}`;

const DevMRR = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/dev/mrr-history`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed');
      setData(await res.json());
    } catch {
      setData({ months: [], current_mrr: 0, growth_rate: 0, projection_next_3: [0, 0, 0] });
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className={b}>
        <div className={`${b}__header`}><h1 className={`${b}__title`}>MRR & Tendencias</h1></div>
        <p className={`${b}__loading`}>Cargando historial de ingresos...</p>
      </div>
    );
  }

  const months = data?.months || [];
  const projection = data?.projection_next_3 || [0, 0, 0];

  const { actualLine, projLine, gridLines, W, H, PAD, getX, getY } = useMemo(() => {
    const allValues = [...months.map((m) => m.mrr), ...projection];
    const max = Math.max(...allValues, 1);
    const w = 800, h = 300, pad = 50;
    const chartW = w - pad * 2;
    const chartH = h - pad * 2;
    const tp = months.length + projection.length;
    const gx = (i) => pad + (i / Math.max(tp - 1, 1)) * chartW;
    const gy = (v) => pad + chartH - (v / max) * chartH;
    return {
      W: w, H: h, PAD: pad, getX: gx, getY: gy,
      actualLine: months.map((m, i) => `${gx(i)},${gy(m.mrr)}`).join(' '),
      projLine: [
        `${gx(months.length - 1)},${gy(months[months.length - 1]?.mrr || 0)}`,
        ...projection.map((v, i) => `${gx(months.length + i)},${gy(v)}`),
      ].join(' '),
      gridLines: [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
        y: pad + chartH * (1 - pct),
        label: formatCOP(max * pct),
      })),
    };
  }, [months, projection]);

  return (
    <div className={b}>
      <div className={`${b}__header`}>
        <div>
          <h1 className={`${b}__title`}>MRR & Tendencias</h1>
          <p className={`${b}__subtitle`}>Ingresos recurrentes mensuales — ultimos 12 meses</p>
        </div>
        <button className={`${b}__refresh`} onClick={fetchData}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2v6h-6M3 12a9 9 0 0115.36-6.36L21 8M3 22v-6h6M21 12a9 9 0 01-15.36 6.36L3 16"/></svg>
        </button>
      </div>

      <div className={`${b}__kpis`}>
        <div className={`${b}__kpi`}>
          <div className={`${b}__kpi-icon ${b}__kpi-icon--primary`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
          </div>
          <div className={`${b}__kpi-info`}>
            <span className={`${b}__kpi-value`}>{formatCOP(data?.current_mrr)}</span>
            <span className={`${b}__kpi-label`}>MRR Actual</span>
          </div>
        </div>
        <div className={`${b}__kpi`}>
          <div className={`${b}__kpi-icon ${data?.growth_rate >= 0 ? `${b}__kpi-icon--success` : `${b}__kpi-icon--danger`}`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/></svg>
          </div>
          <div className={`${b}__kpi-info`}>
            <span className={`${b}__kpi-value`}>{data?.growth_rate >= 0 ? '+' : ''}{data?.growth_rate}%</span>
            <span className={`${b}__kpi-label`}>Crecimiento MoM</span>
          </div>
        </div>
        <div className={`${b}__kpi`}>
          <div className={`${b}__kpi-icon ${b}__kpi-icon--accent`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div className={`${b}__kpi-info`}>
            <span className={`${b}__kpi-value`}>{formatCOP(projection[2])}</span>
            <span className={`${b}__kpi-label`}>Proyeccion 3 meses</span>
          </div>
        </div>
        <div className={`${b}__kpi`}>
          <div className={`${b}__kpi-icon ${b}__kpi-icon--info`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
          </div>
          <div className={`${b}__kpi-info`}>
            <span className={`${b}__kpi-value`}>{months[months.length - 1]?.active_tenants || 0}</span>
            <span className={`${b}__kpi-label`}>Tenants Activos</span>
          </div>
        </div>
      </div>

      <div className={`${b}__chart`}>
        <svg viewBox={`0 0 ${W} ${H}`} className={`${b}__svg`}>
          {gridLines.map((g, i) => (
            <g key={i}>
              <line x1={PAD} y1={g.y} x2={W - PAD} y2={g.y} stroke="#E2E8F0" strokeWidth="1" />
              <text x={PAD - 8} y={g.y + 4} textAnchor="end" fill="#94A3B8" fontSize="10">{g.label}</text>
            </g>
          ))}

          {months.map((m, i) => (
            <text key={i} x={getX(i)} y={H - 10} textAnchor="middle" fill="#94A3B8" fontSize="9">
              {m.period.slice(5)}
            </text>
          ))}
          {projection.map((_, i) => (
            <text key={`p${i}`} x={getX(months.length + i)} y={H - 10} textAnchor="middle" fill="#CBD5E1" fontSize="9" fontStyle="italic">
              P{i + 1}
            </text>
          ))}

          {months.length > 1 && (
            <polyline points={actualLine} fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          )}

          {projection.length > 0 && months.length > 0 && (
            <polyline points={projLine} fill="none" stroke="#3B82F6" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.5" />
          )}

          {months.map((m, i) => (
            <circle key={i} cx={getX(i)} cy={getY(m.mrr)} r="4" fill="#3B82F6" stroke="#fff" strokeWidth="2" />
          ))}
          {projection.map((v, i) => (
            <circle key={`p${i}`} cx={getX(months.length + i)} cy={getY(v)} r="3" fill="#3B82F6" opacity="0.4" />
          ))}
        </svg>
        <div className={`${b}__legend`}>
          <span className={`${b}__legend-item`}><span className={`${b}__legend-line`} /> MRR Real</span>
          <span className={`${b}__legend-item`}><span className={`${b}__legend-line ${b}__legend-line--dashed`} /> Proyeccion</span>
        </div>
      </div>

      <div className={`${b}__table-wrap`}>
        <table className={`${b}__table`}>
          <thead>
            <tr>
              <th>Periodo</th>
              <th>MRR</th>
              <th>Tenants Activos</th>
              <th>Nuevos</th>
              <th>Tokens IA</th>
              <th>Mensajes WA</th>
            </tr>
          </thead>
          <tbody>
            {[...months].reverse().map((m) => (
              <tr key={m.period}>
                <td className={`${b}__td-mono`}>{m.period}</td>
                <td className={`${b}__td-mono`}>{formatCOP(m.mrr)}</td>
                <td className={`${b}__td-mono`}>{m.active_tenants}</td>
                <td className={`${b}__td-mono`}>{m.new_tenants}</td>
                <td className={`${b}__td-mono`}>{Number(m.ai_tokens || 0).toLocaleString('es-CO')}</td>
                <td className={`${b}__td-mono`}>{Number(m.messages_sent || 0).toLocaleString('es-CO')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DevMRR;
