import { useTenant } from '../../../context/TenantContext';

const UsageMeter = ({ variant = 'default', showDetails = true }) => {
  const {
    tenant,
    messagesRemaining,
    usagePercent,
    isLowMessages,
    isCriticalMessages,
    isOutOfMessages,
  } = useTenant();

  const b = 'usage-meter';

  const getStatusModifier = () => {
    if (isOutOfMessages) return 'depleted';
    if (isCriticalMessages) return 'critical';
    if (isLowMessages) return 'warning';
    return 'normal';
  };

  const status = getStatusModifier();

  const getStatusLabel = () => {
    if (isOutOfMessages) return 'Sin mensajes — IA pausada';
    if (isCriticalMessages) return 'Quedan muy pocos mensajes';
    if (isLowMessages) return 'Mensajes bajos';
    return 'Mensajes disponibles';
  };

  // Compact variant for Inbox header
  if (variant === 'compact') {
    return (
      <div className={`${b} ${b}--compact ${b}--${status}`}>
        <div className={`${b}__bar-track`}>
          <div
            className={`${b}__bar-fill ${b}__bar-fill--${status}`}
            style={{ width: `${Math.min(usagePercent, 100)}%` }}
          />
        </div>
        <span className={`${b}__compact-label`}>
          {messagesRemaining.toLocaleString('es-CO')} restantes
        </span>
      </div>
    );
  }

  // Badge variant for inline indicators
  if (variant === 'badge') {
    return (
      <span className={`${b} ${b}--badge ${b}--${status}`}>
        <span className={`${b}__badge-dot`} />
        <span className={`${b}__badge-text`}>
          {messagesRemaining.toLocaleString('es-CO')}
        </span>
      </span>
    );
  }

  // Default: full meter with details
  return (
    <div className={`${b} ${b}--${status}`}>
      <div className={`${b}__header`}>
        <span className={`${b}__title`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />
          </svg>
          {getStatusLabel()}
        </span>
        {showDetails && (
          <span className={`${b}__count`}>
            {tenant.messages_used.toLocaleString('es-CO')} / {tenant.messages_limit.toLocaleString('es-CO')}
          </span>
        )}
      </div>

      <div className={`${b}__bar-track`}>
        <div
          className={`${b}__bar-fill ${b}__bar-fill--${status}`}
          style={{ width: `${Math.min(usagePercent, 100)}%` }}
        />
      </div>

      {showDetails && (
        <div className={`${b}__footer`}>
          <span className={`${b}__remaining`}>
            {messagesRemaining.toLocaleString('es-CO')} mensajes restantes
          </span>
          <span className={`${b}__percent`}>{usagePercent}% usado</span>
        </div>
      )}

      {isOutOfMessages && (
        <div className={`${b}__alert`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          La IA esta pausada. Contacta a soporte para recargar mensajes.
        </div>
      )}
    </div>
  );
};

export default UsageMeter;
