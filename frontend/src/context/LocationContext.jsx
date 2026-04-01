import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';

const LocationContext = createContext(null);
const API_URL = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const STORAGE_KEY = 'plexify_location';

export const LocationProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [locations, setLocations] = useState([]);
  const [selectedLocationId, setSelectedLocationId] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchLocations = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/locations/`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setLocations(data);
        if (user?.role === 'staff' || user?._auth_role === 'staff') {
          const meRes = await fetch(`${API_URL}/locations/me`, { credentials: 'include' });
          if (meRes.ok) {
            const meData = await meRes.json();
            if (meData.length === 1) {
              setSelectedLocationId(meData[0].id);
              localStorage.setItem(STORAGE_KEY, String(meData[0].id));
            }
          }
        } else {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved && saved !== 'all' && data.some(l => l.id === parseInt(saved))) {
            setSelectedLocationId(parseInt(saved));
          }
        }
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchLocations();
    } else {
      setLocations([]);
      setSelectedLocationId(null);
      setLoading(false);
    }
  }, [isAuthenticated, fetchLocations]);

  const selectLocation = useCallback((id) => {
    if (id === null || id === 'all') {
      setSelectedLocationId(null);
      localStorage.setItem(STORAGE_KEY, 'all');
    } else {
      setSelectedLocationId(parseInt(id));
      localStorage.setItem(STORAGE_KEY, String(id));
    }
  }, []);

  const currentLocation = useMemo(
    () => locations.find(l => l.id === selectedLocationId) || null,
    [locations, selectedLocationId]
  );

  const hasMultipleLocations = locations.length > 1;
  const isStaffMode = user?.role === 'staff' || user?._auth_role === 'staff';

  const value = useMemo(() => ({
    locations,
    selectedLocationId,
    selectLocation,
    currentLocation,
    hasMultipleLocations,
    isStaffMode,
    loading,
    refreshLocations: fetchLocations,
  }), [locations, selectedLocationId, selectLocation, currentLocation, hasMultipleLocations, isStaffMode, loading, fetchLocations]);

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation debe usarse dentro de LocationProvider');
  return ctx;
};
