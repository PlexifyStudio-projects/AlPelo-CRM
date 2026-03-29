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

    const parseHex = (h) => {
      const c = h.replace('#', '');
      return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
    };
    const lighten = (c, pct) => Math.min(255, Math.round(c + (255 - c) * pct));
    const darken = (c, pct) => Math.round(c * (1 - pct));

    // Primary color
    const [r, g, b] = parseHex(hex);
    root.style.setProperty('--color-primary', hex);
    root.style.setProperty('--color-primary-rgb', `${r}, ${g}, ${b}`);
    root.style.setProperty('--color-primary-light', `rgb(${lighten(r, 0.2)}, ${lighten(g, 0.2)}, ${lighten(b, 0.2)})`);
    root.style.setProperty('--color-primary-lighter', `rgb(${lighten(r, 0.4)}, ${lighten(g, 0.4)}, ${lighten(b, 0.4)})`);

    // Dark variant — from DB or auto-generated
    if (tenant.brand_color_dark) {
      root.style.setProperty('--color-primary-dark', tenant.brand_color_dark);
      const [dr, dg, db] = parseHex(tenant.brand_color_dark);
      root.style.setProperty('--color-primary-darker', `rgb(${darken(dr, 0.3)}, ${darken(dg, 0.3)}, ${darken(db, 0.3)})`);
    } else {
      root.style.setProperty('--color-primary-dark', `rgb(${darken(r, 0.25)}, ${darken(g, 0.25)}, ${darken(b, 0.25)})`);
      root.style.setProperty('--color-primary-darker', `rgb(${darken(r, 0.45)}, ${darken(g, 0.45)}, ${darken(b, 0.45)})`);
    }

    // Accent color
    if (tenant.brand_color_accent) {
      root.style.setProperty('--color-accent', tenant.brand_color_accent);
      const [ar, ag, ab] = parseHex(tenant.brand_color_accent);
      root.style.setProperty('--color-accent-light', `rgb(${lighten(ar, 0.25)}, ${lighten(ag, 0.25)}, ${lighten(ab, 0.25)})`);
    }

    // Glow/ghost variants for buttons
    root.style.setProperty('--color-primary-glow', `rgba(${r}, ${g}, ${b}, 0.25)`);
    root.style.setProperty('--color-primary-ghost', `rgba(${r}, ${g}, ${b}, 0.06)`);

    // Update page title
    const brandName = tenant.brand_name || tenant.name;
    if (brandName && brandName !== 'Mi Negocio') {
      document.title = `${brandName} — CRM`;
    }
  }, [tenant?.primary_color, tenant?.brand_color_dark, tenant?.brand_color_accent, tenant?.brand_name, tenant?.name]);

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
