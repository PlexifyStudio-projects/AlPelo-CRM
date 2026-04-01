import { memo } from 'react';

const Button = memo(({ children, variant = 'primary', size = 'md', onClick, disabled = false, type = 'button', className = '' }) => {
  const baseClass = 'button';
  const classes = `${baseClass} ${baseClass}--${variant} ${baseClass}--${size} ${className}`.trim();

  return (
    <button className={classes} onClick={onClick} disabled={disabled} type={type}>
      {children}
    </button>
  );
});

export default Button;
