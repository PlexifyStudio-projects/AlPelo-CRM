import { useState } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../../../components/landing/common/SEO';

const API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || 'Usuario o contraseña incorrectos');
        setLoading(false);
        return;
      }

      const data = await res.json();

      // Store token — CRMShell's AuthContext will pick it up
      if (data.access_token) {
        localStorage.setItem('token', data.access_token);
      }

      // Redirect to CRM — App.jsx detects token and switches to CRMShell
      window.location.href = '/dashboard';
    } catch (err) {
      setError('Error de conexion. Intenta de nuevo.');
      setLoading(false);
    }
  };

  return (
    <>
      <SEO
        title="Iniciar Sesion"
        description="Accede a tu cuenta de PlexifyStudio CRM."
        url="/login"
        noindex
      />

      <section className="page-hero" aria-label="Iniciar Sesion">
        <div className="page-hero__container">
          <h1 className="page-hero__title">Iniciar Sesion</h1>
          <p className="page-hero__subtitle">
            Accede a tu cuenta de PlexifyStudio CRM.
          </p>
        </div>
      </section>

      <section className="login" aria-label="Formulario de inicio de sesion">
        <div className="login__container">
          <form className="login__form" onSubmit={handleSubmit} aria-label="Formulario de login">
            {error && (
              <div className="login__error" role="alert">
                {error}
              </div>
            )}

            <div className="login__field">
              <label className="login__label" htmlFor="login-username">Usuario o correo</label>
              <input
                className="login__input"
                id="login-username"
                type="text"
                required
                autoComplete="username"
                placeholder="tu usuario o correo"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="login__field">
              <label className="login__label" htmlFor="login-password">Contrasena</label>
              <input
                className="login__input"
                id="login-password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="Tu contrasena"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="button button--primary button--lg button--full"
              disabled={loading}
            >
              {loading ? 'Ingresando...' : 'Iniciar Sesion'}
            </button>

            <p className="login__footer-text">
              ¿No tienes cuenta?{' '}
              <Link to="/register" className="login__link">Registra tu negocio</Link>
            </p>
          </form>
        </div>
      </section>
    </>
  );
}
