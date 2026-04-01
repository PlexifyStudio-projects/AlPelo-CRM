import { memo } from 'react';

const Input = memo(({ label, type = 'text', name, value, onChange, onBlur, placeholder, error, required, disabled, className = '' }) => {
  const baseClass = 'input';

  return (
    <div className={`${baseClass} ${error ? `${baseClass}--error` : ''} ${className}`}>
      {label && <label className={`${baseClass}__label`}>{label}{required && <span className={`${baseClass}__required`}> *</span>}</label>}
      <input
        className={`${baseClass}__field`}
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        aria-required={required}
        aria-invalid={!!error}
      />
      {error && <span className={`${baseClass}__error-message`}>{error}</span>}
    </div>
  );
});

export default Input;
