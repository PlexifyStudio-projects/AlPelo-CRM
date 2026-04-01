import { useState, useCallback, memo } from 'react';
import { useTenant } from '../../../context/TenantContext';
import LocationSelector from './LocationSelector';

const SVG_ICONS = {
  dashboard: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  agenda: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="M8 14h.01" /><path d="M12 14h.01" /><path d="M16 14h.01" />
      <path d="M8 18h.01" /><path d="M12 18h.01" />
    </svg>
  ),
  services: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  ),
  inventory: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  ),
  finances: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
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
  'lina-activity': (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
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
  campaigns: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
      <line x1="22" y1="12" x2="18" y2="12" />
      <line x1="6" y1="12" x2="2" y2="12" />
      <line x1="12" y1="6" x2="12" y2="2" />
      <line x1="12" y1="22" x2="12" y2="18" />
    </svg>
  ),
  automations: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  'content-studio': (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" />
    </svg>
  ),
};

const BUSINESS_TYPES = {
  peluqueria: 'Peluquería', barberia: 'Barbería', spa: 'Spa',
  centro_estetico: 'Centro Estético', clinica: 'Clínica', odontologia: 'Odontología',
  fisioterapia: 'Fisioterapia', psicologia: 'Psicología', veterinaria: 'Veterinaria',
  nutricion: 'Nutrición', gimnasio: 'Gimnasio', academia: 'Academia',
  yoga_pilates: 'Yoga / Pilates', restaurante: 'Restaurante', hotel: 'Hotel',
  tatuajes: 'Estudio de Tatuajes', estudio_foto: 'Estudio Fotográfico',
  taller_mecanico: 'Taller Mecánico', lavanderia: 'Lavandería',
  consultoria: 'Consultoría', otro: 'Negocio',
};

const Sidebar = ({ menuItems, activeItem, onItemClick, user, isCollapsed, onToggleCollapse, onLogout, isMobileOpen, onCloseMobile, badgeCounts = {} }) => {
  const [openSections, setOpenSections] = useState({});
  const { tenant } = useTenant();
  const b = 'sidebar';

  const sections = menuItems.reduce((acc, item) => {
    const section = item.section || 'General';
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {});

  const toggleSection = useCallback((section) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const isSectionOpen = (section) => openSections[section] !== false;

  const userInitials = user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'AP';
  const userFirstName = user?.name?.split(' ')[0] || 'Admin';
  const userRole = user?.role === 'admin' ? 'Administrador' : user?.role === 'dev' ? 'Desarrollador' : 'Profesional';

  return (
    <aside className={`${b} ${isCollapsed ? `${b}--collapsed` : ''} ${isMobileOpen ? `${b}--mobile-open` : ''}`}>
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
              <h1 className={`${b}__logo`}>{tenant.name || 'Mi Negocio'}</h1>
              <span className={`${b}__logo-sub`}>{BUSINESS_TYPES[tenant.business_type] || 'CRM'}</span>
            </div>
          )}
        </div>
        {isMobileOpen ? (
          <button className={`${b}__close-mobile`} onClick={onCloseMobile} aria-label="Cerrar menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        ) : !isCollapsed && (
          <button className={`${b}__toggle`} onClick={onToggleCollapse} aria-label="Colapsar sidebar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}
      </div>

      <div className={`${b}__brand-divider`} />

      <LocationSelector />

      <nav className={`${b}__nav`}>
        {Object.entries(sections).map(([sectionName, items]) => (
          <div key={sectionName} className={`${b}__section`}>
            {!isCollapsed && (
              <button className={`${b}__section-header`} onClick={() => toggleSection(sectionName)}>
                <span className={`${b}__section-title`}>{sectionName}</span>
                <svg
                  className={`${b}__section-chevron ${isSectionOpen(sectionName) ? '' : `${b}__section-chevron--closed`}`}
                  width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            )}
            {isCollapsed && <div className={`${b}__section-dot`} />}
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

      <div className={`${b}__footer`}>
        <div className={`${b}__footer-divider`} />

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

        {!isCollapsed && (
          <div className={`${b}__footer-actions`}>
            {onLogout && (
              <button className={`${b}__logout`} onClick={onLogout} aria-label="Cerrar sesion">
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

        {isCollapsed && (
          <button className={`${b}__toggle ${b}__toggle--collapsed`} onClick={onToggleCollapse} aria-label="Expandir sidebar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}
      </div>
    </aside>
  );
};

export default memo(Sidebar);
