import { useState, useCallback } from 'react';

const DEV_MENU = [
  { id: 'dev-dashboard', label: 'Dashboard', icon: 'grid' },
  { id: 'dev-tenants', label: 'Agencias', icon: 'building' },
  { id: 'dev-usage', label: 'Consumo', icon: 'bar-chart' },
  { id: 'dev-billing', label: 'Facturacion', icon: 'dollar' },
];

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

  return (
    <div className={`${b} ${collapsed ? `${b}--collapsed` : ''}`}>
      {/* Sidebar */}
      <aside className={`${b}__sidebar`}>
        <div className={`${b}__brand`}>
          <div className={`${b}__brand-icon`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
          {DEV_MENU.map((item) => (
            <button
              key={item.id}
              className={`${b}__nav-item ${activeSection === item.id ? `${b}__nav-item--active` : ''}`}
              onClick={() => handleNav(item.id)}
              title={collapsed ? item.label : undefined}
            >
              <span className={`${b}__nav-icon`}>{Icons[item.icon]}</span>
              {!collapsed && <span className={`${b}__nav-label`}>{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className={`${b}__sidebar-footer`}>
          <button
            className={`${b}__collapse-btn`}
            onClick={() => setCollapsed(!collapsed)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <polyline points={collapsed ? '9 18 15 12 9 6' : '15 18 9 12 15 6'} />
            </svg>
          </button>
          {!collapsed && user && (
            <div className={`${b}__user`}>
              <span className={`${b}__user-name`}>{user.name || 'Dev'}</span>
              <button className={`${b}__logout`} onClick={onLogout} title="Cerrar sesion">
                {Icons.logout}
              </button>
            </div>
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
