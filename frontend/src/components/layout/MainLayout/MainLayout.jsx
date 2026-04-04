import { useState, useEffect, useCallback, memo } from 'react';
import Sidebar from '../Sidebar/Sidebar';
import { useTenant } from '../../../context/TenantContext';
import whatsappService from '../../../services/whatsappService';

const MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'agenda', label: 'Agenda' },
  { id: 'clients', label: 'Clientes' },
  { id: 'campaigns', label: 'Campañas' },
  { id: 'services', label: 'Servicios' },
  { id: 'inventory', label: 'Inventario' },
  { id: 'finances', label: 'Finanzas' },
  { id: 'team', label: 'Equipo' },
  { id: 'automations', label: 'Automatizaciones' },
  { id: 'inbox', label: 'WhatsApp' },
  { id: 'instagram', label: 'Instagram' },
];

const MOBILE_BREAKPOINT = 1024;

const AIPauseBanner = memo(() => {
  const { tenant } = useTenant();
  if (!tenant.ai_is_paused) return null;

  return (
    <div className="ai-pause-banner">
      <div className="ai-pause-banner__icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="10" y1="15" x2="10" y2="9" />
          <line x1="14" y1="15" x2="14" y2="9" />
        </svg>
      </div>
      <div className="ai-pause-banner__text">
        <strong>Lina IA esta pausada</strong>
        <span>La inteligencia artificial fue desactivada por el equipo de soporte. No se enviaran respuestas automaticas hasta que sea reactivada.</span>
      </div>
    </div>
  );
});

const MainLayout = ({ children, user, activeSection, onNavigate, onLogout }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= MOBILE_BREAKPOINT);
  const [inboxUnread, setInboxUnread] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= MOBILE_BREAKPOINT;
      setIsMobile(mobile);
      if (!mobile) setIsMobileMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const data = await whatsappService.getUnreadCount();
        setInboxUnread(data.total_unread || 0);
      } catch {}
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleNavigate = useCallback((section) => {
    onNavigate(section);
    if (isMobile) setIsMobileMenuOpen(false);
  }, [onNavigate, isMobile]);

  const handleOpenMobileMenu = useCallback(() => setIsMobileMenuOpen(true), []);
  const handleCloseMobileMenu = useCallback(() => setIsMobileMenuOpen(false), []);
  const handleToggleCollapse = useCallback(() => setIsSidebarCollapsed(prev => !prev), []);

  return (
    <div className={`main-layout ${isSidebarCollapsed ? 'main-layout--collapsed' : ''} ${isMobile ? 'main-layout--mobile' : ''}`}>
      {isMobile && isMobileMenuOpen && (
        <div className="main-layout__backdrop" onClick={handleCloseMobileMenu} />
      )}
      <Sidebar
        menuItems={MENU_ITEMS}
        activeItem={activeSection}
        onItemClick={handleNavigate}
        onNavigate={handleNavigate}
        user={user}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleCollapse}
        onLogout={onLogout}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={handleCloseMobileMenu}
        badgeCounts={{ inbox: inboxUnread || null }}
      />
      <div className="main-layout__content">
        {isMobile && (
          <button className="main-layout__mobile-trigger" onClick={handleOpenMobileMenu} aria-label="Abrir menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}
        <AIPauseBanner />
        <main className="main-layout__main">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
