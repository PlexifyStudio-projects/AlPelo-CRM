import { useState, useEffect, useRef, useCallback } from 'react';

const SmokeCanvas = () => {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const particlesRef = useRef([]);
  const animRef = useRef(null);

  const COLORS = [
    { r: 59, g: 130, b: 246 },   // blue #3B82F6
    { r: 236, g: 72, b: 153 },   // pink #EC4899
    { r: 6, g: 182, b: 212 },    // cyan #06B6D4
    { r: 139, g: 92, b: 246 },   // purple #8B5CF6
    { r: 16, g: 185, b: 129 },   // green #10B981
  ];

  const createParticle = useCallback((x, y, isAmbient = false) => {
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const size = isAmbient
      ? 80 + Math.random() * 180
      : 40 + Math.random() * 120;

    return {
      x: x + (Math.random() - 0.5) * (isAmbient ? 400 : 60),
      y: y + (Math.random() - 0.5) * (isAmbient ? 400 : 60),
      vx: (Math.random() - 0.5) * (isAmbient ? 0.3 : 1.5),
      vy: (Math.random() - 0.5) * (isAmbient ? 0.3 : 1.5),
      size,
      maxSize: size,
      color,
      alpha: isAmbient ? 0.04 + Math.random() * 0.06 : 0.08 + Math.random() * 0.12,
      maxAlpha: isAmbient ? 0.04 + Math.random() * 0.06 : 0.08 + Math.random() * 0.12,
      life: isAmbient ? 9999 : 200 + Math.random() * 300,
      maxLife: isAmbient ? 9999 : 200 + Math.random() * 300,
      isAmbient,
      driftX: (Math.random() - 0.5) * 0.15,
      driftY: (Math.random() - 0.5) * 0.15,
      pulseSpeed: 0.005 + Math.random() * 0.01,
      pulseOffset: Math.random() * Math.PI * 2,
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width, height;

    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resize();
    window.addEventListener('resize', resize);

    const ambient = [];
    for (let i = 0; i < 12; i++) {
      ambient.push(createParticle(
        Math.random() * (width || 600),
        Math.random() * (height || 800),
        true
      ));
    }
    particlesRef.current = ambient;

    let frameCount = 0;

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      frameCount++;

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const particles = particlesRef.current;

      if (mx > 0 && my > 0 && frameCount % 3 === 0) {
        particles.push(createParticle(mx, my, false));
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        if (!p.isAmbient) {
          p.life--;
          if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
          }
          const lifeRatio = p.life / p.maxLife;
          p.alpha = p.maxAlpha * lifeRatio;
          p.size = p.maxSize * (0.5 + lifeRatio * 0.5);
        } else {
          const pulse = Math.sin(frameCount * p.pulseSpeed + p.pulseOffset);
          p.alpha = p.maxAlpha * (0.7 + pulse * 0.3);
          p.size = p.maxSize * (0.95 + pulse * 0.05);
        }

        if (mx > 0 && my > 0) {
          const dx = p.x - mx;
          const dy = p.y - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const repelRadius = p.isAmbient ? 250 : 180;
          if (dist < repelRadius && dist > 0) {
            const force = (1 - dist / repelRadius) * (p.isAmbient ? 0.8 : 2);
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
          }
        }

        p.vx += p.driftX;
        p.vy += p.driftY;

        p.vx *= 0.96;
        p.vy *= 0.96;

        p.x += p.vx;
        p.y += p.vy;

        if (p.isAmbient) {
          if (p.x < -p.size) p.x = width + p.size;
          if (p.x > width + p.size) p.x = -p.size;
          if (p.y < -p.size) p.y = height + p.size;
          if (p.y > height + p.size) p.y = -p.size;
        }

        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        gradient.addColorStop(0, `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${p.alpha})`);
        gradient.addColorStop(0.4, `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${p.alpha * 0.5})`);
        gradient.addColorStop(1, `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, 0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      if (particles.length > 80) {
        const removeCount = particles.length - 80;
        let removed = 0;
        for (let i = particles.length - 1; i >= 0 && removed < removeCount; i--) {
          if (!particles[i].isAmbient) {
            particles.splice(i, 1);
            removed++;
          }
        }
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [createParticle]);

  const handleMouseMove = useCallback((e) => {
    const rect = canvasRef.current?.parentElement?.getBoundingClientRect();
    if (!rect) return;
    mouseRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const handleMouseLeave = useCallback(() => {
    mouseRef.current = { x: -1000, y: -1000 };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="login__canvas"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    />
  );
};

const Login = ({ onLogin }) => {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [suspended, setSuspended] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [activeSessionPrompt, setActiveSessionPrompt] = useState(false);

  const b = 'login';

  useEffect(() => {
    const saved = localStorage.getItem('alpelo_remember_user');
    if (saved) {
      setCredentials((prev) => ({ ...prev, username: saved }));
      setRememberMe(true);
    }
    if (sessionStorage.getItem('session_replaced')) {
      sessionStorage.removeItem('session_replaced');
      setError('Tu sesion fue cerrada porque alguien inicio sesion desde otro dispositivo.');
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
      if (err.code === 'ACTIVE_SESSION') {
        setActiveSessionPrompt(true);
        setError('');
      } else if (err.code === 'SUSPENDED') {
        setSuspended(true);
        setError(err.message);
      } else {
        setSuspended(false);
        setError(err.message || 'Error al iniciar sesion');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForceLogin = async () => {
    setIsLoading(true);
    setActiveSessionPrompt(false);
    try {
      await onLogin(credentials.username, credentials.password, true);
      if (rememberMe) localStorage.setItem('alpelo_remember_user', credentials.username);
      else localStorage.removeItem('alpelo_remember_user');
    } catch (err) {
      setError(err.message || 'Error al iniciar sesion');
    } finally {
      setIsLoading(false);
    }
  };

  const hasValue = (field) => credentials[field]?.length > 0;

  return (
    <div className={`${b} ${mounted ? `${b}--mounted` : ''}`}>
      <div className={`${b}__wrapper`}>
        {/* Left panel: Dark canvas with interactive smoke */}
        <div className={`${b}__showcase`}>
          <SmokeCanvas />

          <div className={`${b}__showcase-content`}>
            <div className={`${b}__showcase-icon`}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
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

            <div className={`${b}__showcase-divider`} />

            <p className={`${b}__showcase-tagline`}>
              Tu negocio,<br />bajo control total
            </p>

            <p className={`${b}__showcase-description`}>
              CRM inteligente con IA para tu negocio
            </p>

            <div className={`${b}__showcase-badges`}>
              <div className={`${b}__showcase-badge`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a10 10 0 1 0 10 10H12V2z" />
                </svg>
                <span>IA WhatsApp</span>
              </div>
              <div className={`${b}__showcase-badge`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span>CRM Completo</span>
              </div>
              <div className={`${b}__showcase-badge`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>24/7 Activo</span>
              </div>
            </div>
          </div>
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

                {/* Active Session Warning */}
                {activeSessionPrompt && (
                  <div className={`${b}__session-warning`}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    <strong>Sesion activa detectada</strong>
                    <span>Hay otro dispositivo conectado con esta cuenta. Solo puede haber una sesion activa a la vez.</span>
                    <div className={`${b}__session-actions`}>
                      <button type="button" className={`${b}__session-btn ${b}__session-btn--force`} onClick={handleForceLogin}>
                        Cerrar otra sesion e ingresar aqui
                      </button>
                      <button type="button" className={`${b}__session-btn ${b}__session-btn--cancel`} onClick={() => setActiveSessionPrompt(false)}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {/* Error */}
                {error && !suspended && !activeSessionPrompt && (
                  <div className={`${b}__error`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>{error}</span>
                  </div>
                )}

                {/* Suspended account */}
                {suspended && (
                  <div className={`${b}__suspended`}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <strong>Cuenta suspendida</strong>
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

            {/* Back to landing */}
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <a
                href={import.meta.env.BASE_URL || '/'}
                onClick={(e) => { e.preventDefault(); localStorage.removeItem('token'); window.location.href = import.meta.env.BASE_URL || '/'; }}
                style={{ fontSize: 13, color: '#6366f1', textDecoration: 'none', cursor: 'pointer', fontWeight: 500 }}
              >
                ← Volver al inicio
              </a>
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
