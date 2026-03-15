import { useState, useRef, useEffect } from 'react';
import { useNotification } from '../../../context/NotificationContext';

const Header = ({ user, onLogout, onNavigate, isMobile, onOpenMobileMenu }) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const profileRef = useRef(null);
  const notifRef = useRef(null);
  const b = 'header';

  const {
    notifications,
    removeNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
    unreadCount,
  } = useNotification();

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setIsProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setIsProfileOpen(false);
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const getInitials = (name) => {
    if (!name) return 'AD';
    return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const diff = Math.floor((now - new Date(timestamp)) / 1000);
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

  const handleToggleNotifications = () => {
    setIsNotificationsOpen(!isNotificationsOpen);
    setIsProfileOpen(false);
  };

  const handleToggleProfile = () => {
    setIsProfileOpen(!isProfileOpen);
    setIsNotificationsOpen(false);
  };

  const handleNotificationClick = (notif) => {
    if (!notif.read) {
      markAsRead(notif.id);
    }
  };

  return (
    <header className={b}>
      {isMobile && (
        <button
          className={`${b}__hamburger`}
          onClick={onOpenMobileMenu}
          aria-label="Abrir menu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      )}
      <div className={`${b}__actions`}>
        {/* Notification Bell */}
        <div className={`${b}__notification`} ref={notifRef}>
          <button
            className={`${b}__notification-btn ${isNotificationsOpen ? `${b}__notification-btn--active` : ''}`}
            aria-label="Notificaciones"
            onClick={handleToggleNotifications}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            {unreadCount > 0 && (
              <span className={`${b}__badge`}>{unreadCount > 9 ? '9+' : unreadCount}</span>
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
                    <button
                      className={`${b}__notif-mark-read`}
                      onClick={markAllAsRead}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Marcar todas como leidas
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      className={`${b}__notif-clear`}
                      onClick={clearAll}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                      Limpiar todo
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
                        onClick={(e) => {
                          e.stopPropagation();
                          removeNotification(notif.id);
                        }}
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

        <div className={`${b}__divider`} />

        <div className={`${b}__profile`} ref={profileRef}>
          <button
            className={`${b}__profile-trigger`}
            onClick={handleToggleProfile}
          >
            <div className={`${b}__avatar`}>
              {getInitials(user?.name)}
            </div>
            <div className={`${b}__user-info`}>
              <span className={`${b}__user-name`}>{user?.name || 'Admin'}</span>
              <span className={`${b}__user-role`}>
                {user?.role === 'admin' ? 'Administrador' : user?.role === 'dev' ? 'Desarrollador' : 'Profesional'}
              </span>
            </div>
            <span className={`${b}__chevron ${isProfileOpen ? `${b}__chevron--open` : ''}`}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </span>
          </button>

          {isProfileOpen && (
            <div className={`${b}__dropdown`}>
              <div className={`${b}__dropdown-header`}>
                <span className={`${b}__dropdown-email`}>{user?.email}</span>
              </div>

              <button
                className={`${b}__dropdown-item`}
                onClick={() => { onNavigate('profile'); setIsProfileOpen(false); }}
              >
                <span className={`${b}__dropdown-icon`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="5" />
                    <path d="M20 21a8 8 0 0 0-16 0" />
                  </svg>
                </span>
                Mi Perfil
              </button>

              <button
                className={`${b}__dropdown-item`}
                onClick={() => { onNavigate('settings'); setIsProfileOpen(false); }}
              >
                <span className={`${b}__dropdown-icon`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </span>
                Configuracion
              </button>

              <div className={`${b}__dropdown-divider`} />

              <button
                className={`${b}__dropdown-item ${b}__dropdown-item--danger`}
                onClick={onLogout}
              >
                <span className={`${b}__dropdown-icon`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" x2="9" y1="12" y2="12" />
                  </svg>
                </span>
                Cerrar Sesion
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
