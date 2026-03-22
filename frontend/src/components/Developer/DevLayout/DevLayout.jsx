import { useState, useCallback } from 'react';

const DEV_MENU = [
  { id: 'dev-dashboard', label: 'Dashboard', sub: 'PANEL EJECUTIVO', icon: 'grid', group: 'main' },
  { id: 'dev-tenants', label: 'Agencias', sub: 'GESTION DE NEGOCIOS', icon: 'building', group: 'main' },
  { id: 'dev-activity', label: 'Actividad IA', sub: 'MONITOREO EN TIEMPO REAL', icon: 'zap', group: 'monitor' },
  { id: 'dev-whatsapp', label: 'WhatsApp', sub: 'METRICAS DE MENSAJERIA', icon: 'message-circle', group: 'monitor' },
  { id: 'dev-clients', label: 'Nuestros Clientes', sub: 'TODOS LOS NEGOCIOS', icon: 'users', group: 'analytics' },
  { id: 'dev-performance', label: 'Rendimiento', sub: 'METRICAS GLOBALES', icon: 'trending-up', group: 'analytics' },
  { id: 'dev-usage', label: 'Consumo', sub: 'USO DE RECURSOS', icon: 'bar-chart', group: 'billing' },
  { id: 'dev-billing', label: 'Facturacion', sub: 'COBROS Y PAGOS', icon: 'dollar', group: 'billing' },
  { id: 'dev-system', label: 'Sistema', sub: 'CONFIGURACION', icon: 'settings', group: 'system' },
];

const GROUP_LABELS = {
  main: null,
  monitor: 'Monitor',
  analytics: 'Analiticas',
  billing: 'Financiero',
  system: null,
};

const Icons = {
  grid: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  building: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
    </svg>
  ),
  zap: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  'message-circle': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />
    </svg>
  ),
  users: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  'trending-up': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  'bar-chart': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  dollar: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  settings: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  user: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  logout: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
};

const DevLayout = ({ children, activeSection, onNavigate, onLogout, user }) => {
  const [collapsed, setCollapsed] = useState(false);
  const b = 'dev-layout';

  const handleNav = useCallback((id) => {
    onNavigate(id);
  }, [onNavigate]);

  // Group items
  let lastGroup = null;

  return (
    <div className={`${b} ${collapsed ? `${b}--collapsed` : ''}`}>
      {/* Sidebar */}
      <aside className={`${b}__sidebar`}>
        <div className={`${b}__brand`}>
          <div className={`${b}__brand-icon`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
              <line x1="12" y1="22" x2="12" y2="15.5" />
              <polyline points="22 8.5 12 15.5 2 8.5" />
              <polyline points="2 15.5 12 8.5 22 15.5" />
              <line x1="12" y1="2" x2="12" y2="8.5" />
            </svg>
          </div>
          {!collapsed && (
            <div className={`${b}__brand-text`}>
              <span className={`${b}__brand-name`}>Plexify</span>
              <span className={`${b}__brand-sub`}>Studio</span>
            </div>
          )}
        </div>

        <nav className={`${b}__nav`}>
          {DEV_MENU.map((item) => {
            const showGroup = !collapsed && item.group !== lastGroup && GROUP_LABELS[item.group];
            lastGroup = item.group;
            return (
              <div key={item.id}>
                {showGroup && (
                  <span className={`${b}__nav-group`}>{GROUP_LABELS[item.group]}</span>
                )}
                <button
                  className={`${b}__nav-item ${activeSection === item.id ? `${b}__nav-item--active` : ''}`}
                  onClick={() => handleNav(item.id)}
                  title={collapsed ? item.label : undefined}
                >
                  <span className={`${b}__nav-icon`}>{Icons[item.icon]}</span>
                  {!collapsed && (
                    <span className={`${b}__nav-text`}>
                      <span className={`${b}__nav-label`}>{item.label}</span>
                      {item.sub && <span className={`${b}__nav-sub`}>{item.sub}</span>}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </nav>

        <div className={`${b}__sidebar-footer`}>
          <button
            className={`${b}__collapse-btn`}
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expandir' : 'Colapsar'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <polyline points={collapsed ? '9 18 15 12 9 6' : '15 18 9 12 15 6'} />
            </svg>
          </button>

          {/* User profile section */}
          {user && (
            <>
              <div className={`${b}__user-section`}>
                <div className={`${b}__user-avatar-wrap`}>
                  <button
                    className={`${b}__user-avatar`}
                    onClick={() => handleNav('dev-profile')}
                    title={collapsed ? 'Mi Perfil' : undefined}
                  >
                    {(user.name || 'D').charAt(0).toUpperCase()}
                  </button>
                  <span className={`${b}__user-status-dot`} />
                </div>
                {!collapsed && (
                  <div className={`${b}__user-info`}>
                    <button
                      className={`${b}__user-name`}
                      onClick={() => handleNav('dev-profile')}
                      title="Mi Perfil"
                    >
                      {user.name || 'Developer'}
                    </button>
                    <span className={`${b}__user-role`}>Desarrollador</span>
                  </div>
                )}
              </div>
              {!collapsed && (
                <button className={`${b}__logout-btn`} onClick={onLogout}>
                  {Icons.logout}
                  <span>Cerrar sesion</span>
                </button>
              )}
            </>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className={`${b}__main`}>
        {children}
      </main>
    </div>
  );
};

export default DevLayout;
