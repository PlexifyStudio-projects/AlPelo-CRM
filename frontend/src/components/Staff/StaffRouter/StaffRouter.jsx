import { useState, useEffect, useCallback, useRef } from 'react';
import { lazy, Suspense } from 'react';
import Sidebar from '../../layout/Sidebar/Sidebar';
import StaffDashboard from '../StaffDashboard/StaffDashboard';
import StaffAgenda from '../StaffAgenda/StaffAgenda';
import StaffFinances from '../StaffFinances/StaffFinances';
import staffMeService from '../../../services/staffMeService';
import { useNotification } from '../../../context/NotificationContext';

const Orders = lazy(() => import('../../../pages/Orders/Orders'));

const MENU_ITEMS = [
  { id: 'staff-dashboard', label: 'Mi Panel', icon: 'dashboard' },
  { id: 'staff-agenda', label: 'Mi Agenda', icon: 'agenda' },
  { id: 'staff-orders', label: 'Ordenes', icon: 'orders' },
  { id: 'staff-finances', label: 'Mis Ingresos', icon: 'finances' },
];

const MOBILE_BREAKPOINT = 768;

const StaffRouter = ({ user, onLogout }) => {
  const [activeSection, setActiveSection] = useState('staff-dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);
  const { addNotification } = useNotification();
  const knownApptIds = useRef(new Set());

  useEffect(() => {
    let firstLoad = true;

    const pollAppointments = async () => {
      try {
        const notifs = await staffMeService.getNotifications();
        notifs.forEach((n) => {
          if (!knownApptIds.current.has(n.id)) {
            knownApptIds.current.add(n.id);
            const msg = firstLoad
              ? `Cita con ${n.client_name} a las ${n.time} — ${n.service_name}`
              : `Nueva cita asignada: ${n.client_name} a las ${n.time} — ${n.service_name}`;
            addNotification(msg, 'info');
          }
        });
        firstLoad = false;
      } catch { /* silent */ }
    };

    pollAppointments();
    const interval = setInterval(pollAppointments, 30000);
    return () => clearInterval(interval);
  }, [addNotification]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT;
      setIsMobile(mobile);
      if (!mobile) setIsMobileMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleNavigate = useCallback((section) => {
    setActiveSection(section);
    if (isMobile) setIsMobileMenuOpen(false);
  }, [isMobile]);

  const handleToggleCollapse = useCallback(() => setIsSidebarCollapsed(prev => !prev), []);
  const handleCloseMobile = useCallback(() => setIsMobileMenuOpen(false), []);
  const handleOpenMobile = useCallback(() => setIsMobileMenuOpen(true), []);

  const renderSection = () => {
    switch (activeSection) {
      case 'staff-dashboard': return <StaffDashboard user={user} onNavigate={setActiveSection} />;
      case 'staff-agenda': return <StaffAgenda user={user} />;
      case 'staff-orders': return <Suspense fallback={<div style={{ padding: 32, textAlign: 'center', color: '#94A3B8' }}>Cargando...</div>}><Orders /></Suspense>;
      case 'staff-finances': return <StaffFinances />;
      default: return <StaffDashboard user={user} onNavigate={setActiveSection} />;
    }
  };

  return (
    <div className={`main-layout ${isSidebarCollapsed ? 'main-layout--collapsed' : ''} ${isMobile ? 'main-layout--mobile' : ''}`}>
      {isMobile && isMobileMenuOpen && (
        <div className="main-layout__backdrop" onClick={handleCloseMobile} />
      )}
      <Sidebar
        menuItems={MENU_ITEMS}
        activeItem={activeSection}
        onItemClick={handleNavigate}
        user={user}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleCollapse}
        onLogout={onLogout}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={handleCloseMobile}
        badgeCounts={{}}
      />
      <div className="main-layout__content">
        {isMobile && (
          <div className="main-layout__mobile-header">
            <button className="main-layout__mobile-menu-btn" onClick={handleOpenMobile}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
            </button>
          </div>
        )}
        <main className="main-layout__main">
          {renderSection()}
        </main>
      </div>
    </div>
  );
};

export default StaffRouter;
