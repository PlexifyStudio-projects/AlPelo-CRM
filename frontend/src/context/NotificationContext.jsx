import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const NotificationContext = createContext(null);

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

async function showBrowserNotification(title, body, link, type) {
  if (!('Notification' in window)) return;

  if (Notification.permission === 'default') {
    const result = await Notification.requestPermission();
    if (result !== 'granted') return;
  }
  if (Notification.permission !== 'granted') return;

  if (document.hasFocus()) return;

  const options = {
    body: body || '',
    icon: '/AlPelo-CRM/icon-192.svg',
    badge: '/AlPelo-CRM/badge-72.svg',
    tag: 'plexify-' + (type || 'general') + '-' + Date.now(),
    silent: false,
    data: { url: link },
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration('/AlPelo-CRM/');
      if (reg) {
        await reg.showNotification(title || 'Plexify Studio', options);
        return;
      }
    }
    const n = new Notification(title || 'Plexify Studio', options);
    if (link) {
      n.onclick = () => {
        window.focus();
        window.location.href = window.location.origin + '/AlPelo-CRM' + link;
        n.close();
      };
    }
    setTimeout(() => n.close(), 10000);
  } catch { /* silent */ }
}

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [dbNotifications, setDbNotifications] = useState([]);
  const lastSeenIdRef = useRef(0);
  const initialLoadRef = useRef(true);

  const intervalRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/notifications?limit=30`, { credentials: 'include' });
      if (res.status === 401) {
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      const items = data.notifications || [];

      if (!initialLoadRef.current && items.length > 0) {
        const maxId = Math.max(...items.map(n => n.id));
        if (maxId > lastSeenIdRef.current) {
          const newOnes = items.filter(n => n.id > lastSeenIdRef.current && !n.is_read);
          for (const n of newOnes) {
            showBrowserNotification(n.title, n.detail, n.link, n.type);
          }
        }
        lastSeenIdRef.current = maxId;
      } else if (items.length > 0) {
        lastSeenIdRef.current = Math.max(...items.map(n => n.id));
        initialLoadRef.current = false;
      }

      setDbNotifications(items);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    requestNotificationPermission();
    fetchNotifications();
    intervalRef.current = setInterval(fetchNotifications, 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchNotifications]);

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

  const value = useMemo(() => ({
    notifications: allNotifications,
    addNotification,
    removeNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
    unreadCount,
    fetchNotifications,
  }), [allNotifications, addNotification, removeNotification, markAsRead, markAllAsRead, clearAll, unreadCount, fetchNotifications]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotification debe usarse dentro de NotificationProvider');
  return context;
};
