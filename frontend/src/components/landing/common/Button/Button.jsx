import { Link } from 'react-router-dom';

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  href,
  to,
  full = false,
  className = '',
  ...props
}) {
  const classes = [
    'button',
    `button--${variant}`,
    `button--${size}`,
    full && 'button--full',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {children}
      </Link>
    );
  }

  if (href) {
    return (
      <a href={href} className={classes} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    );
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
