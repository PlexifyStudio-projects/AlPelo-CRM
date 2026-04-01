import { memo } from 'react';

const Card = memo(({ title, children, className = '', actions }) => {
  const baseClass = 'card';

  return (
    <div className={`${baseClass} ${className}`}>
      {title && (
        <div className={`${baseClass}__header`}>
          <h3 className={`${baseClass}__title`}>{title}</h3>
          {actions && <div className={`${baseClass}__actions`}>{actions}</div>}
        </div>
      )}
      <div className={`${baseClass}__body`}>
        {children}
      </div>
    </div>
  );
});

export default Card;
