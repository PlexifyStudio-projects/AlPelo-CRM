import { useState, useCallback, useRef, useEffect } from 'react';

const DEV_MENU = [
  { id: 'dev-dashboard', label: 'Dashboard', sub: 'PANEL EJECUTIVO', icon: 'grid', group: 'main' },
  { id: 'dev-tenants', label: 'Agencias', sub: 'GESTION DE NEGOCIOS', icon: 'building', group: 'main' },
  { id: 'dev-activity', label: 'Actividad IA', sub: 'MONITOREO EN TIEMPO REAL', icon: 'zap', group: 'monitor' },
  { id: 'dev-whatsapp', label: 'WhatsApp', sub: 'METRICAS DE MENSAJERIA', icon: 'message-circle', group: 'monitor' },
  { id: 'dev-health', label: 'Estado', sub: 'SALUD DEL SISTEMA', icon: 'heart-pulse', group: 'monitor' },
  { id: 'dev-alerts', label: 'Alertas', sub: 'NOTIFICACIONES CRITICAS', icon: 'bell-ring', group: 'monitor' },
  { id: 'dev-errors', label: 'Errores', sub: 'LOG DE ERRORES', icon: 'alert-triangle', group: 'monitor' },
  { id: 'dev-clients', label: 'Nuestros Clientes', sub: 'TODOS LOS NEGOCIOS', icon: 'users', group: 'analytics' },
  { id: 'dev-performance', label: 'Rendimiento', sub: 'METRICAS GLOBALES', icon: 'trending-up', group: 'analytics' },
  { id: 'dev-comparison', label: 'Comparativa', sub: 'CROSS-TENANT', icon: 'bar-chart-2', group: 'analytics' },
  { id: 'dev-mrr', label: 'MRR', sub: 'INGRESOS Y TENDENCIAS', icon: 'dollar-sign', group: 'analytics' },
  { id: 'dev-prospector', label: 'Tendencias', sub: 'PROSPECTOR IA', icon: 'search', group: 'analytics' },
  { id: 'dev-usage', label: 'Consumo', sub: 'USO DE RECURSOS', icon: 'bar-chart', group: 'billing' },
  { id: 'dev-billing', label: 'Facturacion', sub: 'COBROS Y PAGOS', icon: 'dollar', group: 'billing' },
  { id: 'dev-system', label: 'Configuracion', sub: 'PLATAFORMA E INTEGRACIONES', icon: 'settings', group: 'system' },
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
  'heart-pulse': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19.5 12.572l-7.5 7.428-7.5-7.428a5 5 0 117.5-6.566 5 5 0 117.5 6.572" />
      <path d="M4 12h4l2-4 4 8 2-4h4" />
    </svg>
  ),
  'bell-ring': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
      <path d="M2 8a8 8 0 013.35-6.5M21.65 1.5A8 8 0 0122 8" />
    </svg>
  ),
  'alert-triangle': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  'bar-chart-2': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
      <rect x="1" y="1" width="22" height="22" rx="3" />
    </svg>
  ),
  'dollar-sign': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  ),
  search: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
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

const DevTopbar = ({ user, onNavigate, onLogout, b }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = (name) => {
    if (!name) return 'DV';
    return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  };

  return (
    <header className={`${b}__topbar`}>
      <div className={`${b}__topbar-left`}>
        <span className={`${b}__topbar-env`}>Plexify Studio</span>
        <span className={`${b}__topbar-separator`}>/</span>
        <span className={`${b}__topbar-role`}>Developer</span>
      </div>

      <div className={`${b}__topbar-right`} ref={ref}>
        <button
          className={`${b}__topbar-profile`}
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className={`${b}__topbar-avatar`}>
            {getInitials(user?.name)}
          </div>
          <span className={`${b}__topbar-name`}>{user?.name || 'Developer'}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
        </button>

        {isOpen && (
          <div className={`${b}__topbar-dropdown`}>
            <div className={`${b}__topbar-dd-header`}>
              <span>{user?.email || user?.username}</span>
            </div>
            <button className={`${b}__topbar-dd-item`} onClick={() => { onNavigate('dev-profile'); setIsOpen(false); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 00-16 0"/></svg>
              Mi Perfil
            </button>
            <button className={`${b}__topbar-dd-item`} onClick={() => { onNavigate('dev-system'); setIsOpen(false); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
              Configuracion
            </button>
            <div className={`${b}__topbar-dd-divider`} />
            <button className={`${b}__topbar-dd-item ${b}__topbar-dd-item--danger`} onClick={onLogout}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Cerrar Sesion
            </button>
          </div>
        )}
      </div>
    </header>
  );
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
                <button
                  className={`${b}__user-avatar`}
                  onClick={() => handleNav('dev-profile')}
                  title={collapsed ? 'Mi Perfil' : undefined}
                >
                  {(user.name || 'D').charAt(0).toUpperCase()}
                </button>
                {!collapsed && (
                  <div className={`${b}__user-info`}>
                    <button
                      className={`${b}__user-name`}
                      onClick={() => handleNav('dev-profile')}
                      title="Mi Perfil"
                    >
                      {user.name || 'Developer'}
                    </button>
                    <span className={`${b}__user-role`}>
                      <span className={`${b}__user-status-dot`} />
                      Desarrollador
                    </span>
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

      {/* Main content with topbar */}
      <div className={`${b}__content-area`}>
        {/* Topbar */}
        <DevTopbar user={user} onNavigate={onNavigate} onLogout={onLogout} b={b} />

        <main className={`${b}__main`}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default DevLayout;
