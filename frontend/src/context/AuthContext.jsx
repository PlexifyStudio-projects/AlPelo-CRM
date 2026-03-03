import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const STORAGE_KEY = 'alpelo_auth';

const defaultUser = {
  id: 1,
  name: 'Jaime Ruiz',
  email: 'admin@alpelo.com',
  role: 'admin',
  avatar: null,
  phone: '+573001234567',
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored).user : null;
  });
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem(STORAGE_KEY);
  });

  useEffect(() => {
    if (isAuthenticated && user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, token: 'mock-jwt-token' }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [isAuthenticated, user]);

  const login = (credentials) => {
    const loggedUser = { ...defaultUser, email: credentials.email };
    setUser(loggedUser);
    setIsAuthenticated(true);
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem(STORAGE_KEY);
  };

  const updateProfile = (updates) => {
    setUser((prev) => ({ ...prev, ...updates }));
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
};
