import { useState, useEffect } from 'react';

const Login = ({ onLogin }) => {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [mounted, setMounted] = useState(false);

  const b = 'login';

  useEffect(() => {
    const saved = localStorage.getItem('alpelo_remember_user');
    if (saved) {
      setCredentials((prev) => ({ ...prev, username: saved }));
      setRememberMe(true);
    }
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!credentials.username || !credentials.password) {
      setError('Todos los campos son obligatorios');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await onLogin(credentials.username, credentials.password);

      if (rememberMe) {
        localStorage.setItem('alpelo_remember_user', credentials.username);
      } else {
        localStorage.removeItem('alpelo_remember_user');
      }
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  };

  const hasValue = (field) => credentials[field]?.length > 0;

  return (
    <div className={`${b} ${mounted ? `${b}--mounted` : ''}`}>
      <div className={`${b}__bg-gradient`} />

      <div className={`${b}__ambient`}>
        <div className={`${b}__ambient-orb ${b}__ambient-orb--1`} />
        <div className={`${b}__ambient-orb ${b}__ambient-orb--2`} />
        <div className={`${b}__ambient-orb ${b}__ambient-orb--3`} />
        <div className={`${b}__ambient-orb ${b}__ambient-orb--4`} />
      </div>

      <div className={`${b}__pattern`} />

      <div className={`${b}__particles`}>
        {[...Array(6)].map((_, i) => (
          <div key={i} className={`${b}__particle ${b}__particle--${i + 1}`} />
        ))}
      </div>

      <div className={`${b}__wrapper`}>
        {/* Left panel: Brand */}
        <div className={`${b}__showcase`}>
          <div className={`${b}__showcase-border-glow`} />

          <div className={`${b}__showcase-content`}>
            <div className={`${b}__showcase-icon`}>
              <div className={`${b}__showcase-icon-ring`} />
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="6" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <line x1="20" y1="4" x2="8.12" y2="15.88" />
                <line x1="14.47" y1="14.48" x2="20" y2="20" />
                <line x1="8.12" y1="8.12" x2="12" y2="12" />
              </svg>
            </div>

            <h1 className={`${b}__showcase-title`}>
              Plexify<span className={`${b}__showcase-title-accent`}>Studio</span>
            </h1>

            <div className={`${b}__showcase-divider`}>
              <div className={`${b}__showcase-divider-glow`} />
            </div>

            <p className={`${b}__showcase-tagline`}>
              Tu negocio,<br />bajo control<br />total
            </p>

            <p className={`${b}__showcase-description`}>
              CRM inteligente con IA para tu negocio
            </p>

            <div className={`${b}__showcase-stats`}>
              <div className={`${b}__showcase-stat`}>
                <span className={`${b}__showcase-stat-number`}>IA</span>
                <span className={`${b}__showcase-stat-label`}>WhatsApp</span>
              </div>
              <div className={`${b}__showcase-stat-divider`} />
              <div className={`${b}__showcase-stat`}>
                <span className={`${b}__showcase-stat-number`}>CRM</span>
                <span className={`${b}__showcase-stat-label`}>Completo</span>
              </div>
              <div className={`${b}__showcase-stat-divider`} />
              <div className={`${b}__showcase-stat`}>
                <span className={`${b}__showcase-stat-number`}>24/7</span>
                <span className={`${b}__showcase-stat-label`}>Activo</span>
              </div>
            </div>
          </div>

          <div className={`${b}__showcase-corner ${b}__showcase-corner--tl`} />
          <div className={`${b}__showcase-corner ${b}__showcase-corner--br`} />
        </div>

        {/* Right panel: Login form */}
        <div className={`${b}__panel`}>
          <div className={`${b}__panel-glow`} />
          <div className={`${b}__panel-content`}>
            <div className={`${b}__view ${b}__view--login`}>
              <div className={`${b}__accent-line`} />

              <div className={`${b}__header`}>
                <div className={`${b}__header-badge`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                </div>
                <h2 className={`${b}__header-title`}>Bienvenido</h2>
                <p className={`${b}__header-subtitle`}>
                  Ingresa tus credenciales para acceder al panel de gestion
                </p>
              </div>

              <form className={`${b}__form`} onSubmit={handleSubmit}>
                {/* Username field */}
                <div className={`${b}__field ${focusedField === 'username' ? `${b}__field--focused` : ''} ${hasValue('username') ? `${b}__field--filled` : ''}`}>
                  <div className={`${b}__field-icon`}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <div className={`${b}__field-inner`}>
                    <input
                      className={`${b}__input`}
                      type="text"
                      name="username"
                      id="login-username"
                      value={credentials.username}
                      onChange={handleChange}
                      onFocus={() => setFocusedField('username')}
                      onBlur={() => setFocusedField(null)}
                      autoComplete="username"
                      required
                    />
                    <label className={`${b}__floating-label`} htmlFor="login-username">
                      Usuario
                    </label>
                  </div>
                  <div className={`${b}__field-line`} />
                </div>

                {/* Password field */}
                <div className={`${b}__field ${focusedField === 'password' ? `${b}__field--focused` : ''} ${hasValue('password') ? `${b}__field--filled` : ''}`}>
                  <div className={`${b}__field-icon`}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                  <div className={`${b}__field-inner`}>
                    <input
                      className={`${b}__input`}
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      id="login-password"
                      value={credentials.password}
                      onChange={handleChange}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      autoComplete="current-password"
                      required
                    />
                    <label className={`${b}__floating-label`} htmlFor="login-password">
                      Contrasena
                    </label>
                  </div>
                  <button
                    type="button"
                    className={`${b}__toggle-password`}
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                  <div className={`${b}__field-line`} />
                </div>

                {/* Options */}
                <div className={`${b}__options`}>
                  <label className={`${b}__checkbox`}>
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span className={`${b}__checkbox-box`}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    <span className={`${b}__checkbox-text`}>Recordarme</span>
                  </label>
                </div>

                {/* Error */}
                {error && (
                  <div className={`${b}__error`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>{error}</span>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  className={`${b}__submit ${isLoading ? `${b}__submit--loading` : ''}`}
                  disabled={isLoading}
                >
                  <span className={`${b}__submit-shimmer`} />
                  <span className={`${b}__submit-content`}>
                    {isLoading ? (
                      <>
                        <span className={`${b}__spinner`} />
                        <span>Verificando...</span>
                      </>
                    ) : (
                      <>
                        <span>Iniciar sesion</span>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="5" y1="12" x2="19" y2="12" />
                          <polyline points="12 5 19 12 12 19" />
                        </svg>
                      </>
                    )}
                  </span>
                </button>
              </form>
            </div>

            {/* Footer */}
            <div className={`${b}__footer`}>
              <div className={`${b}__footer-divider`} />
              <p className={`${b}__footer-copyright`}>
                2026 Plexify Studio. Todos los derechos reservados.
              </p>
              <p className={`${b}__footer-address`}>
                CRM inteligente con IA
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
