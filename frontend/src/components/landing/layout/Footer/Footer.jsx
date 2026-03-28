import { Link } from 'react-router-dom';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer" role="contentinfo">
      {/* CTA strip */}
      <div className="footer__cta-strip">
        <div className="footer__cta-inner">
          <div>
            <h3 className="footer__cta-title">¿Listo para gestionar tu <span className="footer__cta-highlight">negocio</span>?</h3>
            <p className="footer__cta-desc">Empieza a usar PlexifyStudio CRM hoy mismo.</p>
          </div>
          <a className="footer__cta-btn" href="#" onClick={(e) => { e.preventDefault(); window.location.href = (import.meta.env.BASE_URL || '/') + 'login'; }}>
            Iniciar Sesión
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </a>
        </div>
      </div>

      <div className="footer__container">
        <div className="footer__grid">
          {/* Brand — left */}
          <div className="footer__brand">
            <Link to="/" className="footer__logo">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <rect width="32" height="32" rx="8" fill="url(#fl)"/>
                <path d="M10 22V10h5.5c1.3 0 2.4.4 3.2 1.2.8.8 1.3 1.8 1.3 3 0 1.2-.4 2.2-1.3 3-.8.8-1.9 1.2-3.2 1.2H13.5V22H10z" fill="white"/>
                <defs><linearGradient id="fl" x1="0" y1="0" x2="32" y2="32"><stop offset="0%" stopColor="#4f46e5"/><stop offset="100%" stopColor="#6366f1"/></linearGradient></defs>
              </svg>
              <div>
                <span className="footer__logo-name">PlexifyStudio</span>
                <span className="footer__logo-sub">CRM Solutions</span>
              </div>
            </Link>
            <p className="footer__description">
              La plataforma CRM con inteligencia artificial que gestiona clientes, automatiza WhatsApp y hace crecer tu negocio.
            </p>
            <div className="footer__social">
              <a href="https://wa.me/573151573329" className="footer__social-link" aria-label="WhatsApp" target="_blank" rel="noopener noreferrer">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </a>
              <a href="mailto:contact@plexifystudio.com" className="footer__social-link" aria-label="Email" target="_blank" rel="noopener noreferrer">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 4l-10 8L2 4"/></svg>
              </a>
              <a href="https://www.instagram.com/plexifystudio/" className="footer__social-link" aria-label="Instagram" target="_blank" rel="noopener noreferrer">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              </a>
              <a href="https://www.tiktok.com/@plexifystudio" className="footer__social-link" aria-label="TikTok" target="_blank" rel="noopener noreferrer">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.43v-7.15a8.16 8.16 0 005.58 2.18v-3.47a4.85 4.85 0 01-1-.1z"/></svg>
              </a>
            </div>
          </div>

          {/* Navigation — center */}
          <div>
            <h3 className="footer__column-title">Navegación</h3>
            <ul>
              <li><Link to="/" className="footer__link">Inicio</Link></li>
              <li><Link to="/lina-ia" className="footer__link">Lina IA</Link></li>
              <li><Link to="/pricing" className="footer__link">Precios</Link></li>
              <li><Link to="/about" className="footer__link">Nosotros</Link></li>
              <li><Link to="/contact" className="footer__link">Contacto</Link></li>
              <li><Link to="/faq" className="footer__link">Preguntas Frecuentes</Link></li>
            </ul>
          </div>

          {/* Producto — center */}
          <div>
            <h3 className="footer__column-title">Producto</h3>
            <ul>
              <li><Link to="/producto/clientes" className="footer__link">Gestión de Clientes</Link></li>
              <li><Link to="/producto/agenda" className="footer__link">Agenda y Citas</Link></li>
              <li><Link to="/producto/campanas" className="footer__link">Campañas WhatsApp</Link></li>
              <li><Link to="/producto/servicios" className="footer__link">Servicios y Catálogo</Link></li>
              <li><Link to="/producto/equipo" className="footer__link">Equipo</Link></li>
              <li><Link to="/automatizaciones" className="footer__link">Automatizaciones</Link></li>
              <li><Link to="/finanzas" className="footer__link">Finanzas</Link></li>
            </ul>
          </div>

          {/* Contact — right (cards like plexifystudio.com) */}
          <div>
            <h3 className="footer__column-title">Contacto</h3>
            <div className="footer__contact-cards">
              <a href="mailto:contact@plexifystudio.com" className="footer__contact-card">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 4l-10 8L2 4"/></svg>
                <div>
                  <span className="footer__contact-label">EMAIL</span>
                  <span className="footer__contact-value">contact@plexifystudio.com</span>
                </div>
              </a>
              <a href="https://wa.me/573151573329" className="footer__contact-card" target="_blank" rel="noopener noreferrer">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                <div>
                  <span className="footer__contact-label">WHATSAPP</span>
                  <span className="footer__contact-value">+57 (315) 157-3329</span>
                </div>
              </a>
            </div>
          </div>
        </div>

        <div className="footer__bottom">
          <p className="footer__copyright">
            &copy; {currentYear} PlexifyStudio. Todos los derechos reservados.
          </p>
          <div className="footer__bottom-links">
            <Link to="/legal#privacy" className="footer__bottom-link">Privacidad</Link>
            <Link to="/legal#terms" className="footer__bottom-link">Términos</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
