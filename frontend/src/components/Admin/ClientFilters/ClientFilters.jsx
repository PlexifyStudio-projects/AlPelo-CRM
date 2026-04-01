import { useState, useCallback, memo } from 'react';

const ClientFilters = memo(({ onSearch, onFilterStatus, activeStatus, counts }) => {
  const [searchValue, setSearchValue] = useState('');
  const b = 'client-filters';

  const handleSearch = useCallback((e) => {
    setSearchValue(e.target.value);
    onSearch(e.target.value);
  }, [onSearch]);

  const handleClear = useCallback(() => {
    setSearchValue('');
    onSearch('');
  }, [onSearch]);

  const statuses = [
    { id: 'all', label: 'Todos', count: counts?.total },
    { id: 'nuevo', label: 'Nuevos', count: counts?.nuevo, variant: 'nuevo' },
    { id: 'activo', label: 'Activos', count: counts?.activo },
    { id: 'en_riesgo', label: 'En Riesgo', count: counts?.en_riesgo, variant: 'en_riesgo' },
    { id: 'inactivo', label: 'Inactivos', count: counts?.inactivo },
    { id: 'vip', label: 'VIP', count: counts?.vip, variant: 'vip' },
  ];

  return (
    <div className={b}>
      <div className={`${b}__search`}>
        <svg className={`${b}__search-icon`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          className={`${b}__search-input`}
          type="text"
          placeholder="Buscar por nombre, teléfono o email..."
          value={searchValue}
          onChange={handleSearch}
        />
        {searchValue && (
          <button className={`${b}__search-clear`} onClick={handleClear}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      <div className={`${b}__status-tabs`}>
        {statuses.map((status) => (
          <button
            key={status.id}
            className={`${b}__status-tab ${activeStatus === status.id ? `${b}__status-tab--active` : ''} ${status.variant ? `${b}__status-tab--${status.variant}` : ''}`}
            onClick={() => onFilterStatus(status.id)}
          >
            {status.id === 'vip' && (
              <svg className={`${b}__tab-icon`} width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />
              </svg>
            )}
            {status.id === 'en_riesgo' && (
              <svg className={`${b}__tab-icon`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            )}
            {status.id === 'nuevo' && (
              <svg className={`${b}__tab-icon`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            )}
            <span>{status.label}</span>
            {status.count !== undefined && (
              <span className={`${b}__tab-count`}>{status.count}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
});

export default ClientFilters;
