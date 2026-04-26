import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';

const TenantContext = createContext(null);

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

const DEFAULT_TENANT = {
  id: null,
  slug: '',
  name: 'Mi Negocio',
  business_type: 'servicios',
  currency: 'COP',
  timezone: 'America/Bogota',
  ai_name: 'Lina',
  plan: 'trial',
  messages_used: 0,
  messages_limit: 5000,
  ai_is_paused: false,
  logo_url: null,
  primary_color: '#2D5A3D',
  booking_url: null,
  address: null,
  city: null,
  staff_roles: null,
};

export const TenantProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [tenant, setTenant] = useState(DEFAULT_TENANT);
  const [loading, setLoading] = useState(true);

  const fetchTenant = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/tenant/me`, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('No tenant data');
      const data = await res.json();
      setTenant((prev) => ({ ...prev, ...data }));
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchTenant();
    } else {
      setTenant(DEFAULT_TENANT);
      setLoading(false);
    }
  }, [isAuthenticated, fetchTenant]);

  useEffect(() => {
    if (!tenant?.primary_color) return;
    const root = document.documentElement;
    const hex = tenant.primary_color;

    root.style.setProperty('--color-primary', hex);

    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    root.style.setProperty('--color-primary-rgb', `${r}, ${g}, ${b}`);

    const lighten = (c, pct) => Math.min(255, Math.round(c + (255 - c) * pct));
    root.style.setProperty('--color-primary-light', `rgb(${lighten(r, 0.2)}, ${lighten(g, 0.2)}, ${lighten(b, 0.2)})`);

    const darken = (c, pct) => Math.round(c * (1 - pct));
    root.style.setProperty('--color-primary-dark', `rgb(${darken(r, 0.25)}, ${darken(g, 0.25)}, ${darken(b, 0.25)})`);
  }, [tenant?.primary_color]);

  const refreshTenant = useCallback(() => fetchTenant(), [fetchTenant]);

  const messagesRemaining = useMemo(
    () => Math.max(0, tenant.messages_limit - tenant.messages_used),
    [tenant.messages_limit, tenant.messages_used]
  );

  const usagePercent = useMemo(
    () => tenant.messages_limit > 0
      ? Math.min(100, Math.round((tenant.messages_used / tenant.messages_limit) * 100))
      : 0,
    [tenant.messages_used, tenant.messages_limit]
  );

  const value = useMemo(() => ({
    tenant,
    loading,
    refreshTenant,
    messagesRemaining,
    usagePercent,
    isLowMessages: messagesRemaining <= 500,
    isCriticalMessages: messagesRemaining <= 100,
    isOutOfMessages: messagesRemaining <= 0,
  }), [tenant, loading, refreshTenant, messagesRemaining, usagePercent]);

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) throw new Error('useTenant debe usarse dentro de TenantProvider');
  return context;
};
