import { useState, useRef, useEffect, memo } from 'react';
import { useLocation } from '../../../context/LocationContext';

const b = 'sidebar';

const LocationSelector = () => {
  const { locations, selectedLocationId, selectLocation, currentLocation, hasMultipleLocations, isStaffMode } = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!hasMultipleLocations) return null;

  const label = currentLocation ? currentLocation.name : 'Todas las sedes';

  return (
    <div className={`${b}__location`} ref={ref}>
      <button className={`${b}__location-btn`} onClick={() => !isStaffMode && setOpen(!open)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <span className={`${b}__location-label`}>{label}</span>
        {!isStaffMode && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`${b}__location-chevron ${open ? `${b}__location-chevron--open` : ''}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </button>
      {open && (
        <div className={`${b}__location-drop`}>
          <button
            className={`${b}__location-option ${!selectedLocationId ? `${b}__location-option--active` : ''}`}
            onClick={() => { selectLocation(null); setOpen(false); }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            <span>Todas las sedes</span>
            {!selectedLocationId && <span className={`${b}__location-check`}>&#10003;</span>}
          </button>
          {locations.map(loc => (
            <button key={loc.id}
              className={`${b}__location-option ${selectedLocationId === loc.id ? `${b}__location-option--active` : ''}`}
              onClick={() => { selectLocation(loc.id); setOpen(false); }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
              <span>{loc.name}</span>
              {loc.is_default && <span className={`${b}__location-badge`}>Principal</span>}
              {selectedLocationId === loc.id && <span className={`${b}__location-check`}>&#10003;</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default memo(LocationSelector);
