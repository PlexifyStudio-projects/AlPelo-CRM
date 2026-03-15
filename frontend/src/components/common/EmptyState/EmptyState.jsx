const DefaultIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M8 12h8" />
  </svg>
);

const EmptyState = ({ icon, title, description, actionLabel, onAction }) => (
  <div className="empty-state">
    <div className="empty-state__icon">
      {icon || <DefaultIcon />}
    </div>
    <h3 className="empty-state__title">{title}</h3>
    {description && <p className="empty-state__description">{description}</p>}
    {actionLabel && onAction && (
      <button className="empty-state__action" onClick={onAction}>
        {actionLabel}
      </button>
    )}
  </div>
);

export default EmptyState;
