import { useState, useEffect } from 'react';

const Login = ({ onLogin }) => {
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [mounted, setMounted] = useState(false);

  // Forgot password flow
  const [view, setView] = useState('login'); // 'login' | 'forgot' | 'forgot-success'
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [isRecovering, setIsRecovering] = useState(false);

  const b = 'login';

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!credentials.email || !credentials.password) {
      setError('Todos los campos son obligatorios');
      return;
    }
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    onLogin(credentials);
    setIsLoading(false);
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!recoveryEmail) {
      setRecoveryError('Ingresa tu correo electrónico');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recoveryEmail)) {
      setRecoveryError('Ingresa un correo válido');
      return;
    }
    setIsRecovering(true);
    setRecoveryError('');
    await new Promise((r) => setTimeout(r, 1500));
    setIsRecovering(false);
    setView('forgot-success');
  };

  const handleBackToLogin = () => {
    setView('login');
    setRecoveryEmail('');
    setRecoveryError('');
  };

  const hasValue = (field) => credentials[field]?.length > 0;

  return (
    <div className={`${b} ${mounted ? `${b}--mounted` : ''}`}>
      {/* Animated background gradient mesh */}
      <div className={`${b}__bg-gradient`} />

      {/* Ambient orbs */}
      <div className={`${b}__ambient`}>
        <div className={`${b}__ambient-orb ${b}__ambient-orb--1`} />
        <div className={`${b}__ambient-orb ${b}__ambient-orb--2`} />
        <div className={`${b}__ambient-orb ${b}__ambient-orb--3`} />
        <div className={`${b}__ambient-orb ${b}__ambient-orb--4`} />
      </div>

      {/* Dot pattern overlay */}
      <div className={`${b}__pattern`} />

      {/* Floating particles */}
      <div className={`${b}__particles`}>
        {[...Array(6)].map((_, i) => (
          <div key={i} className={`${b}__particle ${b}__particle--${i + 1}`} />
        ))}
      </div>

      <div className={`${b}__wrapper`}>
        {/* ─── LEFT PANEL: Brand showcase ─── */}
        <div className={`${b}__showcase`}>
          {/* Animated gradient border overlay */}
          <div className={`${b}__showcase-border-glow`} />

          <div className={`${b}__showcase-content`}>
            {/* Decorative scissors icon */}
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
              Al<span className={`${b}__showcase-title-accent`}>Pelo</span>
            </h1>

            <div className={`${b}__showcase-divider`}>
              <div className={`${b}__showcase-divider-glow`} />
            </div>

            <p className={`${b}__showcase-tagline`}>
              Tu barbería,<br />bajo control<br />total
            </p>

            <p className={`${b}__showcase-description`}>
              Sistema de gestión integral para AlPelo Peluquería
            </p>

            {/* Stats */}
            <div className={`${b}__showcase-stats`}>
              <div className={`${b}__showcase-stat`}>
                <span className={`${b}__showcase-stat-number`}>+500</span>
                <span className={`${b}__showcase-stat-label`}>Clientes</span>
              </div>
              <div className={`${b}__showcase-stat-divider`} />
              <div className={`${b}__showcase-stat`}>
                <span className={`${b}__showcase-stat-number`}>5★</span>
                <span className={`${b}__showcase-stat-label`}>Calificación</span>
              </div>
              <div className={`${b}__showcase-stat-divider`} />
              <div className={`${b}__showcase-stat`}>
                <span className={`${b}__showcase-stat-number`}>3+</span>
                <span className={`${b}__showcase-stat-label`}>Años</span>
              </div>
            </div>
          </div>

          {/* Decorative corner accents */}
          <div className={`${b}__showcase-corner ${b}__showcase-corner--tl`} />
          <div className={`${b}__showcase-corner ${b}__showcase-corner--br`} />
        </div>

        {/* ─── RIGHT PANEL: Login / Recovery form ─── */}
        <div className={`${b}__panel`}>
          <div className={`${b}__panel-glow`} />
          <div className={`${b}__panel-content`}>
            {/* ─── LOGIN VIEW ─── */}
            {view === 'login' && (
              <div className={`${b}__view ${b}__view--login`} key="login-view">
                {/* Accent line */}
                <div className={`${b}__accent-line`} />

                {/* Welcome header */}
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
                    Ingresa tus credenciales para acceder al panel de gestión
                  </p>
                </div>

                {/* Form */}
                <form className={`${b}__form`} onSubmit={handleSubmit}>
                  {/* Email field */}
                  <div className={`${b}__field ${focusedField === 'email' ? `${b}__field--focused` : ''} ${hasValue('email') ? `${b}__field--filled` : ''}`}>
                    <div className={`${b}__field-icon`}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="20" height="16" x="2" y="4" rx="2" />
                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                      </svg>
                    </div>
                    <div className={`${b}__field-inner`}>
                      <input
                        className={`${b}__input`}
                        type="email"
                        name="email"
                        id="login-email"
                        value={credentials.email}
                        onChange={handleChange}
                        onFocus={() => setFocusedField('email')}
                        onBlur={() => setFocusedField(null)}
                        autoComplete="email"
                        required
                      />
                      <label className={`${b}__floating-label`} htmlFor="login-email">
                        Correo electrónico
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
                        Contraseña
                      </label>
                    </div>
                    <button
                      type="button"
                      className={`${b}__toggle-password`}
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
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

                  {/* Options row */}
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
                    <button
                      type="button"
                      className={`${b}__forgot`}
                      onClick={() => setView('forgot')}
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>

                  {/* Error message */}
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

                  {/* Submit button */}
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
                          <span>Iniciar sesión</span>
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
            )}

            {/* ─── FORGOT PASSWORD VIEW ─── */}
            {view === 'forgot' && (
              <div className={`${b}__view ${b}__view--forgot`} key="forgot-view">
                <div className={`${b}__accent-line`} />

                <div className={`${b}__header`}>
                  <div className={`${b}__header-badge ${b}__header-badge--recovery`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                  <h2 className={`${b}__header-title`}>Recuperar contraseña</h2>
                  <p className={`${b}__header-subtitle`}>
                    Ingresa tu correo y te enviaremos instrucciones para restablecer tu contraseña
                  </p>
                </div>

                <form className={`${b}__form`} onSubmit={handleForgotSubmit}>
                  <div className={`${b}__field ${focusedField === 'recovery' ? `${b}__field--focused` : ''} ${recoveryEmail ? `${b}__field--filled` : ''}`}>
                    <div className={`${b}__field-icon`}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="20" height="16" x="2" y="4" rx="2" />
                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                      </svg>
                    </div>
                    <div className={`${b}__field-inner`}>
                      <input
                        className={`${b}__input`}
                        type="email"
                        name="recovery-email"
                        id="recovery-email"
                        value={recoveryEmail}
                        onChange={(e) => {
                          setRecoveryEmail(e.target.value);
                          if (recoveryError) setRecoveryError('');
                        }}
                        onFocus={() => setFocusedField('recovery')}
                        onBlur={() => setFocusedField(null)}
                        autoComplete="email"
                        autoFocus
                        required
                      />
                      <label className={`${b}__floating-label`} htmlFor="recovery-email">
                        Correo electrónico
                      </label>
                    </div>
                    <div className={`${b}__field-line`} />
                  </div>

                  {recoveryError && (
                    <div className={`${b}__error`}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span>{recoveryError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    className={`${b}__submit ${isRecovering ? `${b}__submit--loading` : ''}`}
                    disabled={isRecovering}
                  >
                    <span className={`${b}__submit-shimmer`} />
                    <span className={`${b}__submit-content`}>
                      {isRecovering ? (
                        <>
                          <span className={`${b}__spinner`} />
                          <span>Enviando...</span>
                        </>
                      ) : (
                        <>
                          <span>Enviar instrucciones</span>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                          </svg>
                        </>
                      )}
                    </span>
                  </button>
                </form>

                <button
                  type="button"
                  className={`${b}__back-link`}
                  onClick={handleBackToLogin}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                  </svg>
                  <span>Volver al login</span>
                </button>
              </div>
            )}

            {/* ─── SUCCESS VIEW ─── */}
            {view === 'forgot-success' && (
              <div className={`${b}__view ${b}__view--success`} key="success-view">
                <div className={`${b}__success`}>
                  <div className={`${b}__success-icon`}>
                    <div className={`${b}__success-icon-ring`} />
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>

                  <h2 className={`${b}__success-title`}>Revisa tu correo electrónico</h2>
                  <p className={`${b}__success-text`}>
                    Hemos enviado instrucciones de recuperación a <strong>{recoveryEmail}</strong>. Revisa también tu carpeta de spam.
                  </p>

                  <button
                    type="button"
                    className={`${b}__submit`}
                    onClick={handleBackToLogin}
                  >
                    <span className={`${b}__submit-shimmer`} />
                    <span className={`${b}__submit-content`}>
                      <span>Volver al login</span>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className={`${b}__footer`}>
              <div className={`${b}__footer-divider`} />
              <p className={`${b}__footer-copyright`}>
                © 2026 AlPelo Peluquería. Todos los derechos reservados.
              </p>
              <p className={`${b}__footer-address`}>
                Cabecera, Bucaramanga, Colombia
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
