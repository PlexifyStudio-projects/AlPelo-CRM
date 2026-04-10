import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import authService from '../services/authService';
import { registerPush } from '../services/pushService';
import staffService from '../services/staffService';
import servicesService from '../services/servicesService';

const warmupCache = () => {
  staffService.list().catch(() => {});
  servicesService.list().catch(() => {});
};

const AuthContext = createContext(null);

const STORAGE_KEY = 'plexify_auth';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        setLoading(false);
        return;
      }

      const refreshData = await authService.refreshToken();
      if (!refreshData || !refreshData.refreshed) {
        localStorage.removeItem(STORAGE_KEY);
        setLoading(false);
        return;
      }

      const profile = await authService.getProfile();
      if (profile) {
        const restoredUser = {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          username: profile.username,
          phone: profile.phone,
          role: profile.role,
        };
        setUser(restoredUser);
        setIsAuthenticated(true);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(restoredUser));
        registerPush().catch(() => {});
        warmupCache();
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }

      setLoading(false);
    };

    restoreSession();
  }, []);

  useEffect(() => {
    const handleSessionReplaced = () => {
      setUser(null);
      setIsAuthenticated(false);
      setLoading(false);
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.setItem('session_replaced', '1');
    };
    window.addEventListener('session-replaced', handleSessionReplaced);
    return () => window.removeEventListener('session-replaced', handleSessionReplaced);
  }, []);

  const login = useCallback(async (username, password, forceSession = false) => {
    const credentials = await authService.verifyCredentials(username, password);

    if (credentials.has_active_session && !forceSession) {
      const err = new Error('Hay otra sesion activa con esta cuenta. ¿Deseas cerrarla e iniciar aqui?');
      err.code = 'ACTIVE_SESSION';
      err.credentials = credentials;
      throw err;
    }

    if (forceSession && credentials.has_active_session) {
      await authService.forceLogout(credentials.user_id, credentials.role);
    }

    const tokenData = await authService.createToken(credentials);

    const loggedUser = {
      id: tokenData.user.user_id,
      username: tokenData.user.username,
      role: tokenData.user.role,
    };

    const profile = await authService.getProfile();
    if (profile) {
      loggedUser.name = profile.name;
      loggedUser.email = profile.email;
      loggedUser.phone = profile.phone;
      if (profile.tenant_id) loggedUser.tenant_id = profile.tenant_id;
      if (profile.staff_role) loggedUser.staff_role = profile.staff_role;
      if (profile.specialty) loggedUser.specialty = profile.specialty;
    }

    setUser(loggedUser);
    setIsAuthenticated(true);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loggedUser));
    registerPush().catch(() => {});
    warmupCache();
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const updateProfile = useCallback((updates) => {
    setUser((prev) => {
      const updated = { ...prev, ...updates };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const value = useMemo(() => ({
    user, isAuthenticated, loading, login, logout, updateProfile,
  }), [user, isAuthenticated, loading, login, logout, updateProfile]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
};
