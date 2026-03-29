import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';

const TenantContext = createContext(null);

const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

// Default tenant config (used while loading or as fallback)
const DEFAULT_TENANT = {
  id: null,
  slug: '',
  name: 'Mi Negocio',
  business_type: 'servicios',
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
  // Booking
  booking_url: null,
  // Staff roles (tenant-configurable, fallback to defaults)
  staff_roles: null,
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

  // Apply tenant brand colors to CSS custom properties for dynamic theming
  useEffect(() => {
    if (!tenant?.primary_color) return;
    const root = document.documentElement;
    const hex = tenant.primary_color;

    // Set primary color
    root.style.setProperty('--color-primary', hex);

    // Parse hex to RGB for rgba() usage in SCSS
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    root.style.setProperty('--color-primary-rgb', `${r}, ${g}, ${b}`);

    // Generate light variant (lighter by mixing with white)
    const lighten = (c, pct) => Math.min(255, Math.round(c + (255 - c) * pct));
    const lightR = lighten(r, 0.2);
    const lightG = lighten(g, 0.2);
    const lightB = lighten(b, 0.2);
    root.style.setProperty('--color-primary-light', `rgb(${lightR}, ${lightG}, ${lightB})`);

    // Generate dark variant (darker by mixing with black)
    const darken = (c, pct) => Math.round(c * (1 - pct));
    const darkR = darken(r, 0.25);
    const darkG = darken(g, 0.25);
    const darkB = darken(b, 0.25);
    root.style.setProperty('--color-primary-dark', `rgb(${darkR}, ${darkG}, ${darkB})`);
  }, [tenant?.primary_color]);

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
