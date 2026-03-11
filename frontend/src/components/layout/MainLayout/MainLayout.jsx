import { useState, useEffect, useCallback } from 'react';
import Sidebar from '../Sidebar/Sidebar';
import Header from '../Header/Header';
import whatsappService from '../../../services/whatsappService';

const MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', description: 'PANEL EJECUTIVO', section: 'GESTION PRINCIPAL' },
  { id: 'agenda', label: 'Agenda', description: 'CITAS Y CALENDARIO', section: 'GESTION PRINCIPAL' },
  { id: 'clients', label: 'Clientes', description: 'CRM Y GESTION DE CLIENTES', section: 'GESTION PRINCIPAL' },
  { id: 'campaigns', label: 'Campañas', description: 'RECUPERACIÓN Y RETENCIÓN', section: 'GESTION PRINCIPAL' },
  { id: 'services', label: 'Servicios', description: 'CATALOGO Y PRECIOS', section: 'GESTION PRINCIPAL' },
  { id: 'finances', label: 'Finanzas', description: 'INGRESOS Y METRICAS', section: 'GESTION PRINCIPAL' },
  { id: 'lina-activity', label: 'Actividad Lina', description: 'MONITOREO EN TIEMPO REAL', section: 'GESTION PRINCIPAL' },
  { id: 'team', label: 'Equipo', description: 'RENDIMIENTO Y FEEDBACK', section: 'GESTION PRINCIPAL' },
  { id: 'inbox', label: 'Inbox', description: 'CONVERSACIONES WHATSAPP', section: 'WHATSAPP' },
  { id: 'messaging', label: 'Plantillas', description: 'MENSAJES MASIVOS', section: 'WHATSAPP' },
  { id: 'chat-ai', label: 'Lina IA', description: 'ASISTENTE INTELIGENTE', section: 'WHATSAPP' },
];

const MOBILE_BREAKPOINT = 768;

const MainLayout = ({ children, user, activeSection, onNavigate, onLogout }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);
  const [inboxUnread, setInboxUnread] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT;
      setIsMobile(mobile);
      if (!mobile) setIsMobileMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch inbox unread count on mount and poll every 10s
  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const data = await whatsappService.getUnreadCount();
        setInboxUnread(data.total_unread || 0);
      } catch { /* silent */ }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleNavigate = useCallback((section) => {
    onNavigate(section);
    if (isMobile) setIsMobileMenuOpen(false);
  }, [onNavigate, isMobile]);

  const handleOpenMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(true);
  }, []);

  const handleCloseMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false);
  }, []);

  return (
    <div className={`main-layout ${isSidebarCollapsed ? 'main-layout--collapsed' : ''} ${isMobile ? 'main-layout--mobile' : ''}`}>
      {isMobile && isMobileMenuOpen && (
        <div className="main-layout__backdrop" onClick={handleCloseMobileMenu} />
      )}
      <Sidebar
        menuItems={MENU_ITEMS}
        activeItem={activeSection}
        onItemClick={handleNavigate}
        user={user}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onLogout={onLogout}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={handleCloseMobileMenu}
        badgeCounts={{ inbox: inboxUnread || null }}
      />
      <div className="main-layout__content">
        <Header
          user={user}
          onLogout={onLogout}
          onNavigate={handleNavigate}
          isMobile={isMobile}
          onOpenMobileMenu={handleOpenMobileMenu}
        />
        <main className="main-layout__main">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
