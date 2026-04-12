import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { useTenant } from '../../../context/TenantContext';
import { useNotification } from '../../../context/NotificationContext';
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
  orders: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3h5v5" /><path d="M8 3H3v5" />
      <path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3" />
      <path d="m15 9 6-6" />
      <path d="M16 21h5v-5" /><path d="M8 21H3v-5" />
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
  peluqueria: 'Peluqueria', barberia: 'Barberia', spa: 'Spa',
  centro_estetico: 'Centro Estetico', clinica: 'Clinica', odontologia: 'Odontologia',
  fisioterapia: 'Fisioterapia', psicologia: 'Psicologia', veterinaria: 'Veterinaria',
  nutricion: 'Nutricion', gimnasio: 'Gimnasio', academia: 'Academia',
  yoga_pilates: 'Yoga / Pilates', restaurante: 'Restaurante', hotel: 'Hotel',
  tatuajes: 'Estudio de Tatuajes', estudio_foto: 'Estudio Fotografico',
  taller_mecanico: 'Taller Mecanico', lavanderia: 'Lavanderia',
  consultoria: 'Consultoria', otro: 'Negocio',
};

const formatTimeAgo = (timestamp) => {
  const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (diff < 60) return 'Ahora';
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)}h`;
  return `Hace ${Math.floor(diff / 86400)}d`;
};

const getNotificationIcon = (type) => {
  switch (type) {
    case 'success':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
    case 'warning':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case 'error':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      );
    default:
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      );
  }
};

const PREFETCH_MAP = {
  dashboard: () => import('../../../pages/Dashboard/Dashboard'),
  agenda: () => import('../../../pages/Agenda/Agenda'),
  clients: () => import('../../../pages/Clients/Clients'),
  orders: () => import('../../../pages/Orders/Orders'),
  campaigns: () => import('../../../pages/Campaigns/Campaigns'),
  services: () => import('../../../pages/Services/Services'),
  inventory: () => import('../../../pages/Inventory/Inventory'),
  finances: () => import('../../../pages/Finances/Finances'),
  team: () => import('../../../pages/Team/Team'),
  automations: () => import('../../../pages/Automations/AutomationStudio'),
  inbox: () => import('../../../pages/Inbox/Inbox'),
  settings: () => import('../../../pages/Settings/Settings'),
};
const _prefetched = new Set();
const prefetchPage = (id) => {
  if (_prefetched.has(id) || !PREFETCH_MAP[id]) return;
  _prefetched.add(id);
  PREFETCH_MAP[id]();
};

const Sidebar = ({ menuItems, activeItem, onItemClick, user, isCollapsed, onToggleCollapse, onLogout, isMobileOpen, onCloseMobile, badgeCounts = {}, onNavigate }) => {
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const { tenant } = useTenant();
  const {
    notifications,
    removeNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
    unreadCount,
  } = useNotification();
  const b = 'sidebar';
  const userDropdownRef = useRef(null);
  const notifRef = useRef(null);

  const userInitials = user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'AP';
  const userFirstName = user?.name?.split(' ')[0] || 'Admin';
  const userRole = user?.role === 'admin' ? 'Administrador' : user?.role === 'dev' ? 'Desarrollador' : 'Profesional';

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target)) setIsUserDropdownOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setIsNotificationsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Escape key closes dropdowns
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setIsUserDropdownOpen(false);
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleToggleNotifications = useCallback(() => {
    setIsNotificationsOpen((prev) => !prev);
    setIsUserDropdownOpen(false);
  }, []);

  const handleToggleUserDropdown = useCallback(() => {
    setIsUserDropdownOpen((prev) => !prev);
    setIsNotificationsOpen(false);
  }, []);

  const handleNotificationClick = useCallback((notif) => {
    if (!notif.read) markAsRead(notif.id);
  }, [markAsRead]);

  return (
    <aside className={`${b} ${isCollapsed ? `${b}--collapsed` : ''} ${isMobileOpen ? `${b}--mobile-open` : ''}`}>
      <div className={`${b}__brand`}>
        <div className={`${b}__brand-inner`}>
          <div className={`${b}__logo-icon`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="currentColor" opacity="0.15" />
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <path d="M8 12l2.5 2.5L16 9" stroke="currentColor" strokeWidth="2" fill="none" />
            </svg>
          </div>
          {!isCollapsed && (
            <h1 className={`${b}__logo`}>{tenant.name || 'Mi Negocio'}</h1>
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
        <ul className={`${b}__menu`}>
          {menuItems.map((item, index) => (
            <li
              key={item.id}
              className={`${b}__item ${activeItem === item.id ? `${b}__item--active` : ''} ${item.disabled ? `${b}__item--disabled` : ''}`}
              onClick={() => !item.disabled && onItemClick(item.id)}
              onMouseEnter={() => prefetchPage(item.id)}
              data-tooltip={item.label}
              data-id={item.id}
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
                  <span className={`${b}__label`}>{item.label}</span>
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
      </nav>

      <div className={`${b}__footer`}>
        <div className={`${b}__footer-divider`} />

        {!isCollapsed && (
          <div className={`${b}__footer-icons`}>
            <div className={`${b}__footer-notif`} ref={notifRef}>
              <button
                className={`${b}__footer-btn ${isNotificationsOpen ? `${b}__footer-btn--active` : ''}`}
                onClick={handleToggleNotifications}
                aria-label="Notificaciones"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
                {unreadCount > 0 && (
                  <span className={`${b}__footer-btn-badge`}>{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </button>

              {isNotificationsOpen && (
                <div className={`${b}__notif-panel`}>
                  <div className={`${b}__notif-header`}>
                    <div className={`${b}__notif-title-row`}>
                      <h4 className={`${b}__notif-title`}>Notificaciones</h4>
                      {unreadCount > 0 && (
                        <span className={`${b}__notif-unread-badge`}>{unreadCount}</span>
                      )}
                    </div>
                    <div className={`${b}__notif-actions`}>
                      {unreadCount > 0 && (
                        <button className={`${b}__notif-mark-read`} onClick={markAllAsRead}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Marcar todas
                        </button>
                      )}
                      {notifications.length > 0 && (
                        <button className={`${b}__notif-clear`} onClick={clearAll}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                          Limpiar
                        </button>
                      )}
                    </div>
                  </div>

                  <div className={`${b}__notif-list`}>
                    {notifications.length > 0 ? (
                      notifications.map((notif, index) => (
                        <div
                          key={notif.id}
                          className={`${b}__notif-item ${!notif.read ? `${b}__notif-item--unread` : ''}`}
                          onClick={() => handleNotificationClick(notif)}
                          style={{ animationDelay: `${0.04 * (index + 1)}s` }}
                        >
                          <div className={`${b}__notif-border ${b}__notif-border--${notif.type}`} />
                          <div className={`${b}__notif-icon ${b}__notif-icon--${notif.type}`}>
                            {getNotificationIcon(notif.type)}
                          </div>
                          <div className={`${b}__notif-content`}>
                            <p className={`${b}__notif-message`}>{notif.message}</p>
                            <span className={`${b}__notif-time`}>{formatTimeAgo(notif.timestamp)}</span>
                          </div>
                          <button
                            className={`${b}__notif-dismiss`}
                            onClick={(e) => { e.stopPropagation(); removeNotification(notif.id); }}
                            aria-label="Descartar notificacion"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className={`${b}__notif-empty`}>
                        <div className={`${b}__notif-empty-icon`}>
                          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                          </svg>
                        </div>
                        <p className={`${b}__notif-empty-title`}>Todo al dia</p>
                        <p className={`${b}__notif-empty-desc`}>No tienes notificaciones pendientes</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              className={`${b}__footer-btn`}
              onClick={() => onItemClick('settings')}
              aria-label="Configuracion"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
        )}

        <div className={`${b}__user-section`} ref={userDropdownRef}>
          <div className={`${b}__user`} onClick={handleToggleUserDropdown}>
            <div className={`${b}__user-avatar`}>
              {userInitials}
            </div>
            {!isCollapsed && (
              <>
                <div className={`${b}__user-info`}>
                  <span className={`${b}__user-name`}>{userFirstName}</span>
                  <span className={`${b}__user-role`}>{userRole}</span>
                </div>
                <span className={`${b}__user-chevron ${isUserDropdownOpen ? `${b}__user-chevron--open` : ''}`}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </>
            )}
          </div>

          {isUserDropdownOpen && !isCollapsed && (
            <div className={`${b}__user-dropdown`}>
              {onLogout && (
                <button
                  className={`${b}__user-dropdown-item ${b}__user-dropdown-item--danger`}
                  onClick={onLogout}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span>Cerrar Sesion</span>
                </button>
              )}
            </div>
          )}
        </div>

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
