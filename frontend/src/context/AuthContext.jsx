import { createContext, useContext, useState, useEffect } from 'react';
import authService from '../services/authService';

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
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }

      setLoading(false);
    };

    restoreSession();
  }, []);

  const login = async (username, password) => {
    const credentials = await authService.verifyCredentials(username, password);
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
    }

    setUser(loggedUser);
    setIsAuthenticated(true);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loggedUser));
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem(STORAGE_KEY);
  };

  const updateProfile = (updates) => {
    setUser((prev) => {
      const updated = { ...prev, ...updates };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, loading, login, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
};
