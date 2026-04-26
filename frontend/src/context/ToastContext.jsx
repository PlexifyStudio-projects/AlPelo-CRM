import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { playSuccess, playError, playWarning, playNotif } from '../utils/sounds';

const ToastContext = createContext(null);

const ICONS = {
  success: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  error: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  warning: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  info: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
};

const playForType = (type) => {
  if (type === 'success') playSuccess();
  else if (type === 'error') playError();
  else if (type === 'warning') playWarning();
  else playNotif();
};

const Toast = ({ toast, onDismiss }) => {
  const [exiting, setExiting] = useState(false);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 220);
  }, [onDismiss, toast.id]);

  useEffect(() => {
    if (toast.persist) return;
    const t = setTimeout(dismiss, toast.duration || 5000);
    return () => clearTimeout(t);
  }, [dismiss, toast.persist, toast.duration]);

  return (
    <div className={`toast toast--${toast.type} ${exiting ? 'toast--exit' : ''}`} role="alert">
      <span className={`toast__icon toast__icon--${toast.type}`}>{ICONS[toast.type]}</span>
      <div className="toast__body">
        {toast.title && <strong className="toast__title">{toast.title}</strong>}
        {toast.message && <p className="toast__msg">{toast.message}</p>}
        {toast.solution && (
          <div className="toast__solution">
            <span className="toast__solution-label">Solución:</span>
            <span>{toast.solution}</span>
          </div>
        )}
        {toast.action && (
          <button
            className="toast__action"
            onClick={() => {
              try { toast.action.onClick(); } catch {}
              dismiss();
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button className="toast__close" onClick={dismiss} aria-label="Cerrar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      {!toast.persist && <span className="toast__progress" style={{ animationDuration: `${toast.duration || 5000}ms` }} />}
    </div>
  );
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((toast) => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const t = {
      id,
      type: 'info',
      duration: 5000,
      ...toast,
    };
    setToasts(prev => [...prev, t]);
    playForType(t.type);
    return id;
  }, []);

  // Sugar API
  const api = {
    show: showToast,
    success: (opts) => showToast({ ...(typeof opts === 'string' ? { message: opts } : opts), type: 'success' }),
    error: (opts) => showToast({ ...(typeof opts === 'string' ? { message: opts } : opts), type: 'error' }),
    warning: (opts) => showToast({ ...(typeof opts === 'string' ? { message: opts } : opts), type: 'warning' }),
    info: (opts) => showToast({ ...(typeof opts === 'string' ? { message: opts } : opts), type: 'info' }),
    dismiss,
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      {typeof document !== 'undefined' && createPortal(
        <div className="toast-stack">
          {toasts.map(t => (
            <Toast key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider');
  return ctx;
};
