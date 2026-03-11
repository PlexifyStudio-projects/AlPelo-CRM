import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';

const TenantContext = createContext(null);

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

// Default tenant config (used while loading or as fallback)
const DEFAULT_TENANT = {
  id: null,
  slug: '',
  name: 'Mi Negocio',
  business_type: 'peluqueria',
  currency: 'COP',
  timezone: 'America/Bogota',
  ai_name: 'Lina',
  plan: 'trial',
  // Usage / metering
  messages_used: 0,
  messages_limit: 5000,
  ai_is_paused: false,
  // Branding
  logo_url: null,
  primary_color: '#2D5A3D',
};

export const TenantProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [tenant, setTenant] = useState(DEFAULT_TENANT);
  const [loading, setLoading] = useState(true);

  // Fetch tenant info after authentication
  const fetchTenant = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/tenant/me`, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('No tenant data');
      const data = await res.json();
      setTenant((prev) => ({ ...prev, ...data }));
    } catch {
      // If endpoint doesn't exist yet, use defaults
      // This ensures backward compatibility during migration
    } finally {
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

  // Refresh tenant data (e.g. after usage changes)
  const refreshTenant = useCallback(() => {
    return fetchTenant();
  }, [fetchTenant]);

  // Computed values
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

  const isLowMessages = useMemo(() => messagesRemaining <= 500, [messagesRemaining]);
  const isCriticalMessages = useMemo(() => messagesRemaining <= 100, [messagesRemaining]);
  const isOutOfMessages = useMemo(() => messagesRemaining <= 0, [messagesRemaining]);

  const value = useMemo(() => ({
    tenant,
    loading,
    refreshTenant,
    // Usage helpers
    messagesRemaining,
    usagePercent,
    isLowMessages,
    isCriticalMessages,
    isOutOfMessages,
  }), [tenant, loading, refreshTenant, messagesRemaining, usagePercent, isLowMessages, isCriticalMessages, isOutOfMessages]);

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
