import { useState } from 'react';

const SVG_ICONS = {
  dashboard: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  clients: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  team: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  inbox: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />
      <path d="M8 12h.01" />
      <path d="M12 12h.01" />
      <path d="M16 12h.01" />
    </svg>
  ),
  messaging: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 8h10" />
      <path d="M7 12h6" />
    </svg>
  ),
  'chat-ai': (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a4 4 0 0 1 4 4v1a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" />
      <path d="M6.5 10a6.5 6.5 0 0 0 11 0" />
      <circle cx="9" cy="6" r="0.5" fill="currentColor" />
      <circle cx="15" cy="6" r="0.5" fill="currentColor" />
      <path d="M8 22v-2a4 4 0 0 1 4-4h0a4 4 0 0 1 4 4v2" />
      <path d="M12 16v-3" />
    </svg>
  ),
};

const Sidebar = ({ menuItems, activeItem, onItemClick, user, isCollapsed, onToggleCollapse, onLogout, isMobileOpen, onCloseMobile, badgeCounts = {} }) => {
  const [openSections, setOpenSections] = useState({});
  const b = 'sidebar';

  const sections = menuItems.reduce((acc, item) => {
    const section = item.section || 'General';
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {});

  const toggleSection = (section) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const isSectionOpen = (section) => openSections[section] !== false;

  const userInitials = user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'AP';
  const userFirstName = user?.name?.split(' ')[0] || 'Admin';
  const userRole = user?.role === 'admin' ? 'Administrador' : 'Barbero';

  return (
    <aside className={`${b} ${isCollapsed ? `${b}--collapsed` : ''} ${isMobileOpen ? `${b}--mobile-open` : ''}`}>
      {/* Brand */}
      <div className={`${b}__brand`}>
        <div className={`${b}__brand-inner`}>
          <div className={`${b}__logo-icon`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="currentColor" opacity="0.15" />
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <path d="M8 12l2.5 2.5L16 9" stroke="currentColor" strokeWidth="2" fill="none" />
            </svg>
          </div>
          {!isCollapsed && (
            <div className={`${b}__brand-text`}>
              <h1 className={`${b}__logo`}>AlPelo</h1>
              <span className={`${b}__logo-sub`}>Peluqueria</span>
            </div>
          )}
        </div>
        {isMobileOpen ? (
          <button
            className={`${b}__close-mobile`}
            onClick={onCloseMobile}
            aria-label="Cerrar menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        ) : !isCollapsed && (
          <button
            className={`${b}__toggle`}
            onClick={onToggleCollapse}
            aria-label="Colapsar sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}
      </div>

      <div className={`${b}__brand-divider`} />

      {/* Navigation */}
      <nav className={`${b}__nav`}>
        {Object.entries(sections).map(([sectionName, items]) => (
          <div key={sectionName} className={`${b}__section`}>
            {!isCollapsed && (
              <button
                className={`${b}__section-header`}
                onClick={() => toggleSection(sectionName)}
              >
                <span className={`${b}__section-title`}>{sectionName}</span>
                <svg
                  className={`${b}__section-chevron ${isSectionOpen(sectionName) ? '' : `${b}__section-chevron--closed`}`}
                  width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            )}
            {isCollapsed && (
              <div className={`${b}__section-dot`} />
            )}
            {(isCollapsed || isSectionOpen(sectionName)) && (
              <ul className={`${b}__menu`}>
                {items.map((item, index) => (
                  <li
                    key={item.id}
                    className={`${b}__item ${activeItem === item.id ? `${b}__item--active` : ''} ${item.disabled ? `${b}__item--disabled` : ''}`}
                    onClick={() => !item.disabled && onItemClick(item.id)}
                    data-tooltip={item.label}
                    role="button"
                    tabIndex={item.disabled ? -1 : 0}
                    onKeyDown={(e) => e.key === 'Enter' && !item.disabled && onItemClick(item.id)}
                    style={{ '--item-index': index }}
                  >
                    <span className={`${b}__icon`}>
                      {SVG_ICONS[item.id] || item.icon}
                    </span>
                    {!isCollapsed && (
                      <>
                        <div className={`${b}__item-text`}>
                          <span className={`${b}__label`}>{item.label}</span>
                          {item.description && (
                            <span className={`${b}__description`}>{item.description}</span>
                          )}
                        </div>
                        {item.disabled ? (
                          <span className={`${b}__badge ${b}__badge--soon`}>Pronto</span>
                        ) : badgeCounts[item.id] ? (
                          <span className={`${b}__badge`}>
                            {badgeCounts[item.id]}
                          </span>
                        ) : null}
                      </>
                    )}
                    {isCollapsed && badgeCounts[item.id] && !item.disabled && (
                      <span className={`${b}__badge ${b}__badge--dot`} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className={`${b}__footer`}>
        <div className={`${b}__footer-divider`} />

        {/* User profile card */}
        <div className={`${b}__user`}>
          <div className={`${b}__user-avatar`}>
            {userInitials}
          </div>
          {!isCollapsed && (
            <div className={`${b}__user-info`}>
              <span className={`${b}__user-name`}>{userFirstName}</span>
              <span className={`${b}__user-role`}>{userRole}</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        {!isCollapsed && (
          <div className={`${b}__footer-actions`}>
            {onLogout && (
              <button
                className={`${b}__logout`}
                onClick={onLogout}
                aria-label="Cerrar sesion"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>Cerrar sesion</span>
              </button>
            )}
          </div>
        )}

        {/* Collapsed: toggle expand button */}
        {isCollapsed && (
          <button
            className={`${b}__toggle ${b}__toggle--collapsed`}
            onClick={onToggleCollapse}
            aria-label="Expandir sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
