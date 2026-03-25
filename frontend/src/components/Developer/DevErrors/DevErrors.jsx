import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const b = 'dev-errors';

const DevErrors = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const [expandedId, setExpandedId] = useState(null);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/dev/errors?days=${days}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed');
      setData(await res.json());
    } catch {
      setData({ errors: [], total: 0, by_type: {} });
    }
    setLoading(false);
  }, [days]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className={b}>
        <div className={`${b}__header`}><h1 className={`${b}__title`}>Log de Errores</h1></div>
        <p className={`${b}__loading`}>Cargando errores...</p>
      </div>
    );
  }

  const errors = data?.errors || [];
  const filtered = search
    ? errors.filter((e) =>
        (e.endpoint || '').toLowerCase().includes(search.toLowerCase()) ||
        (e.message || '').toLowerCase().includes(search.toLowerCase()) ||
        (e.error_type || '').toLowerCase().includes(search.toLowerCase())
      )
    : errors;

  const byType = data?.by_type || {};

  return (
    <div className={b}>
      <div className={`${b}__header`}>
        <div>
          <h1 className={`${b}__title`}>Log de Errores</h1>
          <p className={`${b}__subtitle`}>{data?.total || 0} errores en los ultimos {days} dias</p>
        </div>
        <button className={`${b}__refresh`} onClick={fetchData}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2v6h-6M3 12a9 9 0 0115.36-6.36L21 8M3 22v-6h6M21 12a9 9 0 01-15.36 6.36L3 16"/></svg>
        </button>
      </div>

      {/* Filters */}
      <div className={`${b}__controls`}>
        <div className={`${b}__range`}>
          {[1, 7, 14, 30].map((d) => (
            <button
              key={d}
              className={`${b}__range-btn ${days === d ? `${b}__range-btn--active` : ''}`}
              onClick={() => setDays(d)}
            >
              {d}d
            </button>
          ))}
        </div>
        <input
          type="text"
          className={`${b}__search`}
          placeholder="Buscar por endpoint, tipo o mensaje..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Error type summary */}
      {Object.keys(byType).length > 0 && (
        <div className={`${b}__summary`}>
          {Object.entries(byType).map(([type, count]) => (
            <span key={type} className={`${b}__type-badge`}>
              {type}: {count}
            </span>
          ))}
        </div>
      )}

      {/* Error List */}
      {filtered.length === 0 ? (
        <div className={`${b}__empty`}>
          <div className={`${b}__empty-icon`}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="1.5"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <h3 className={`${b}__empty-title`}>Sin errores</h3>
          <p className={`${b}__empty-text`}>No se encontraron errores en el periodo seleccionado</p>
        </div>
      ) : (
        <div className={`${b}__list`}>
          {filtered.map((err) => {
            const isExpanded = expandedId === err.id;
            const statusColor = err.status_code >= 500 ? '#EF4444' : err.status_code >= 400 ? '#F59E0B' : '#94A3B8';
            return (
              <div
                key={err.id}
                className={`${b}__row ${isExpanded ? `${b}__row--expanded` : ''}`}
                onClick={() => setExpandedId(isExpanded ? null : err.id)}
              >
                <div className={`${b}__row-main`}>
                  <span className={`${b}__status-code`} style={{ color: statusColor }}>
                    {err.status_code || '???'}
                  </span>
                  <span className={`${b}__method`}>{err.method || 'GET'}</span>
                  <span className={`${b}__endpoint`}>{err.endpoint || 'unknown'}</span>
                  <span className={`${b}__error-type`}>{err.error_type || 'Error'}</span>
                  <span className={`${b}__timestamp`}>
                    {err.created_at ? new Date(err.created_at).toLocaleString('es-CO') : ''}
                  </span>
                  <svg className={`${b}__chevron`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points={isExpanded ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
                  </svg>
                </div>
                {isExpanded && (
                  <div className={`${b}__detail`}>
                    <div className={`${b}__detail-section`}>
                      <strong>Mensaje:</strong>
                      <p>{err.message || 'Sin mensaje'}</p>
                    </div>
                    {err.traceback && (
                      <div className={`${b}__detail-section`}>
                        <strong>Traceback:</strong>
                        <pre className={`${b}__traceback`}>{err.traceback}</pre>
                      </div>
                    )}
                    {err.tenant_id && (
                      <div className={`${b}__detail-section`}>
                        <strong>Tenant ID:</strong> {err.tenant_id}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DevErrors;
