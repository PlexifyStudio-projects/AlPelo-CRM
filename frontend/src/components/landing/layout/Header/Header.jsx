import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import Button from '../../common/Button';

// --- Inline SVG Icon Components ---
const IconHome = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const IconGrid = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const IconUsers = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87" />
    <path d="M16 3.13a4 4 0 010 7.75" />
  </svg>
);

const IconCalendar = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const IconSend = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const IconList = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
  </svg>
);

const IconTeam = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a4 4 0 014 4 4 4 0 01-4 4 4 4 0 01-4-4 4 4 0 014-4z" />
    <path d="M16 21v-1a4 4 0 00-8 0v1" />
    <path d="M5 8a3 3 0 013-3" />
    <path d="M19 8a3 3 0 00-3-3" />
    <path d="M3 21v-1a3 3 0 013-3" />
    <path d="M21 21v-1a3 3 0 00-3-3" />
  </svg>
);

const IconStar = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const IconSparkle = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" />
    <path d="M18 14l.75 2.25L21 17l-2.25.75L18 20l-.75-2.25L15 17l2.25-.75L18 14z" />
  </svg>
);

const IconChart = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="20" x2="12" y2="10" />
    <line x1="18" y1="20" x2="18" y2="4" />
    <line x1="6" y1="20" x2="6" y2="16" />
    <path d="M3 20h18" />
  </svg>
);

const IconZap = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const IconTag = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);

const IconMail = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

// Dropdown child icons map
const DROPDOWN_ICONS = {
  'Gestión de Clientes': IconUsers,
  'Agenda y Citas': IconCalendar,
  'Campañas WhatsApp': IconSend,
  'Servicios y Catálogo': IconList,
  'Equipo': IconTeam,
  'Automatizaciones': IconStar,
};

const NAV_ITEMS = [
  { label: 'Inicio', path: '/', icon: IconHome },
  { label: 'Producto', icon: IconGrid, children: [
    { label: 'Gestión de Clientes', path: '/producto/clientes', desc: 'Historial, estados, seguimiento inteligente' },
    { label: 'Agenda y Citas', path: '/producto/agenda', desc: 'Calendario, reservas y recordatorios' },
    { label: 'Campañas WhatsApp', path: '/producto/campanas', desc: 'Plantillas y envío masivo' },
    { label: 'Servicios y Catálogo', path: '/producto/servicios', desc: 'Precios y profesionales' },
    { label: 'Equipo', path: '/producto/equipo', desc: 'Comisiones y rendimiento' },
    { label: 'Automatizaciones', path: '/automatizaciones', desc: 'Flujos automáticos y recordatorios' },
  ]},
  { label: 'Lina IA', path: '/lina-ia', icon: IconSparkle, animated: true },
  { label: 'Precios', path: '/pricing', icon: IconTag },
  { label: 'Nosotros', path: '/about' },
  { label: 'Contacto', path: '/contact', icon: IconMail },
];

function ChevronDown({ className }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 4.5L6 7.5L9 4.5" />
    </svg>
  );
}

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [mobileAccordion, setMobileAccordion] = useState(null);
  const dropdownTimeoutRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileOpen(false);
    setMobileAccordion(null);
    setOpenDropdown(null);
  }, [location.pathname]);

  const closeMobile = () => {
    setIsMobileOpen(false);
    setMobileAccordion(null);
  };

  const handleDropdownEnter = useCallback((label) => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
      dropdownTimeoutRef.current = null;
    }
    setOpenDropdown(label);
  }, []);

  const handleDropdownLeave = useCallback(() => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setOpenDropdown(null);
    }, 150);
  }, []);

  const toggleMobileAccordion = (label) => {
    setMobileAccordion((prev) => (prev === label ? null : label));
  };

  return (
    <header className={`site-header${isScrolled ? ' header--scrolled' : ''}`}>
      {/* Hidden SVG defs for gradient references */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="nav-icon-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="50%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
        </defs>
      </svg>

      <div className="site-header__container">
        <Link to="/" className="site-header__logo" aria-label="PlexifyStudio CRM - Inicio">
          <svg className="site-header__logo-mark" width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="url(#logo-gradient)"/>
            <path d="M10 22V10h5.5c1.3 0 2.4.4 3.2 1.2.8.8 1.3 1.8 1.3 3 0 1.2-.4 2.2-1.3 3-.8.8-1.9 1.2-3.2 1.2H13.5V22H10z" fill="white"/>
            <defs>
              <linearGradient id="logo-gradient" x1="0" y1="0" x2="32" y2="32">
                <stop offset="0%" stopColor="#4f46e5"/>
                <stop offset="100%" stopColor="#6366f1"/>
              </linearGradient>
            </defs>
          </svg>
          <span>PlexifyStudio</span>
        </Link>

        <nav className="site-header__nav" aria-label="Navegación principal">
          {NAV_ITEMS.map((item) =>
            item.children ? (
              <div
                key={item.label}
                className={`site-header__nav-item${openDropdown === item.label ? ' header__nav-item--open' : ''}`}
                onMouseEnter={() => handleDropdownEnter(item.label)}
                onMouseLeave={handleDropdownLeave}
              >
                <button
                  className="site-header__nav-item-trigger"
                  aria-expanded={openDropdown === item.label}
                  aria-haspopup="true"
                  onClick={() => setOpenDropdown(openDropdown === item.label ? null : item.label)}
                >
                  {item.icon && (
                    <span className="site-header__nav-icon">
                      <item.icon />
                    </span>
                  )}
                  {item.label}
                  <ChevronDown className="site-header__nav-item-chevron" />
                </button>

                <div
                  className={`site-header__dropdown${openDropdown === item.label ? ' site-header__dropdown--visible' : ''}`}
                  role="menu"
                >
                  {item.children.map((child) => {
                    const ChildIcon = DROPDOWN_ICONS[child.label];
                    return (
                      <Link
                        key={child.path + child.label}
                        to={child.path}
                        className="site-header__dropdown-item"
                        role="menuitem"
                        onClick={() => setOpenDropdown(null)}
                      >
                        {ChildIcon && (
                          <span className="site-header__dropdown-icon">
                            <ChildIcon />
                          </span>
                        )}
                        <div className="site-header__dropdown-text">
                          <span className="site-header__dropdown-label">{child.label}</span>
                          <span className="site-header__dropdown-desc">{child.desc}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `site-header__nav-link${isActive ? ' header__nav-link--active' : ''}`
                }
              >
                {item.icon && (
                  <span className={`site-header__nav-icon${item.animated ? ' header__nav-icon--animated' : ''}`}>
                    <item.icon />
                  </span>
                )}
                {item.label}
              </NavLink>
            )
          )}
        </nav>

        <div className="site-header__actions">
          <Button variant="primary" size="sm" href="/login" onClick={(e) => { e.preventDefault(); window.location.href = (import.meta.env.BASE_URL || '/') + 'login'; }}>
            Iniciar Sesión
          </Button>
        </div>

        <button
          className="site-header__menu-toggle"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          aria-expanded={isMobileOpen}
          aria-label="Abrir menú de navegación"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {isMobileOpen ? (
              <path d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {isMobileOpen && (
        <nav className="site-header__mobile-nav" aria-label="Navegación móvil">
          {NAV_ITEMS.map((item) =>
            item.children ? (
              <div key={item.label} className="site-header__mobile-accordion">
                <button
                  className={`site-header__mobile-accordion-trigger${mobileAccordion === item.label ? ' header__mobile-accordion-trigger--open' : ''}`}
                  onClick={() => toggleMobileAccordion(item.label)}
                  aria-expanded={mobileAccordion === item.label}
                >
                  {item.icon && (
                    <span className="site-header__nav-icon">
                      <item.icon />
                    </span>
                  )}
                  {item.label}
                  <ChevronDown className="site-header__mobile-accordion-chevron" />
                </button>

                {mobileAccordion === item.label && (
                  <div className="site-header__mobile-accordion-content">
                    {item.children.map((child) => {
                      const ChildIcon = DROPDOWN_ICONS[child.label];
                      return (
                        <Link
                          key={child.path + child.label}
                          to={child.path}
                          className="site-header__mobile-accordion-item"
                          onClick={closeMobile}
                        >
                          {ChildIcon && (
                            <span className="site-header__dropdown-icon">
                              <ChildIcon />
                            </span>
                          )}
                          <div className="site-header__mobile-accordion-text">
                            <span className="site-header__mobile-accordion-label">{child.label}</span>
                            <span className="site-header__mobile-accordion-desc">{child.desc}</span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <NavLink
                key={item.path}
                to={item.path}
                className="site-header__mobile-link"
                onClick={closeMobile}
              >
                {item.icon && (
                  <span className={`site-header__nav-icon${item.animated ? ' header__nav-icon--animated' : ''}`}>
                    <item.icon />
                  </span>
                )}
                {item.label}
              </NavLink>
            )
          )}
          <div className="site-header__mobile-actions">
            <Button variant="primary" size="md" full href="/login" onClick={(e) => { e.preventDefault(); closeMobile(); window.location.href = (import.meta.env.BASE_URL || '/') + 'login'; }}>
              Iniciar Sesión
            </Button>
          </div>
        </nav>
      )}
    </header>
  );
}
