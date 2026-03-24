import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const NotificationContext = createContext(null);

// Show native browser notification (works when tab is open)
function showBrowserNotification(title, body, link) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') {
    // Request permission on first notification
    Notification.requestPermission();
    return;
  }
  try {
    const n = new Notification(title, {
      body: body || '',
      icon: '/AlPelo-CRM/icon-192.png',
      badge: '/AlPelo-CRM/badge-72.png',
      tag: 'plexify-' + Date.now(),
      silent: false,
    });
    if (link) {
      n.onclick = () => {
        window.focus();
        window.location.hash = '';
        window.location.pathname = '/AlPelo-CRM' + link;
        n.close();
      };
    }
    // Auto-close after 8 seconds
    setTimeout(() => n.close(), 8000);
  } catch {
    // Fallback: ignore if Notification constructor fails
  }
}

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [dbNotifications, setDbNotifications] = useState([]);
  const lastSeenIdRef = useRef(0);
  const initialLoadRef = useRef(true);

  // Fetch persistent notifications from DB every 10 seconds
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/notifications?limit=30`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      const items = data.notifications || [];

      // Detect NEW notifications and show browser notification
      if (!initialLoadRef.current && items.length > 0) {
        const maxId = Math.max(...items.map(n => n.id));
        if (maxId > lastSeenIdRef.current) {
          // Find new unread notifications
          const newOnes = items.filter(n => n.id > lastSeenIdRef.current && !n.is_read);
          for (const n of newOnes) {
            showBrowserNotification(n.title, n.detail, n.link);
          }
        }
        lastSeenIdRef.current = maxId;
      } else if (items.length > 0) {
        // First load — set the baseline without showing notifications
        lastSeenIdRef.current = Math.max(...items.map(n => n.id));
        initialLoadRef.current = false;
      }

      setDbNotifications(items);
    } catch {
      // Silent fail — not critical
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Add local notification (toasts — ephemeral, for UI feedback like "template enviada")
  const addNotification = useCallback((message, type = 'info') => {
    const id = `local-${Date.now()}`;
    setNotifications((prev) => [
      { id, message, type, read: false, timestamp: new Date(), isLocal: true },
      ...prev,
    ]);
    return id;
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Combine: DB notifications (persistent) + local toasts (ephemeral)
  const allNotifications = useMemo(() => {
    const dbMapped = dbNotifications.map(n => ({
      id: `db-${n.id}`,
      dbId: n.id,
      message: n.title,
      detail: n.detail,
      type: n.type,
      icon: n.icon,
      read: n.is_read,
      link: n.link,
      timestamp: n.created_at ? new Date(n.created_at) : new Date(),
      isLocal: false,
    }));
    return [...notifications, ...dbMapped];
  }, [notifications, dbNotifications]);

  const markAsRead = useCallback(async (id) => {
    if (String(id).startsWith('db-')) {
      const dbId = String(id).replace('db-', '');
      try {
        await fetch(`${API_URL}/notifications/${dbId}/read`, { method: 'POST', credentials: 'include' });
        setDbNotifications(prev => prev.map(n => n.id === parseInt(dbId) ? { ...n, is_read: true } : n));
      } catch { /* silent */ }
    } else {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await fetch(`${API_URL}/notifications/mark-read`, { method: 'POST', credentials: 'include' });
      setDbNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch { /* silent */ }
  }, []);

  const clearAll = useCallback(async () => {
    setNotifications([]);
    try {
      await fetch(`${API_URL}/notifications/clear`, { method: 'DELETE', credentials: 'include' });
      setDbNotifications([]);
    } catch { /* silent */ }
  }, []);

  const unreadCount = useMemo(
    () => allNotifications.filter((n) => !n.read).length,
    [allNotifications]
  );

  return (
    <NotificationContext.Provider
      value={{
        notifications: allNotifications,
        addNotification,
        removeNotification,
        markAsRead,
        markAllAsRead,
        clearAll,
        unreadCount,
        fetchNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotification debe usarse dentro de NotificationProvider');
  return context;
};
