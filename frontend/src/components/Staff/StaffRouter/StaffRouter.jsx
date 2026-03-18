import { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from '../../layout/Sidebar/Sidebar';
import Header from '../../layout/Header/Header';
import StaffDashboard from '../StaffDashboard/StaffDashboard';
import StaffAgenda from '../StaffAgenda/StaffAgenda';
import StaffFinances from '../StaffFinances/StaffFinances';
import staffMeService from '../../../services/staffMeService';
import { useNotification } from '../../../context/NotificationContext';

const MENU_ITEMS = [
  { id: 'staff-dashboard', label: 'Mi Panel', description: 'RESUMEN DEL DIA', section: 'MI DIA' },
  { id: 'staff-agenda', label: 'Mi Agenda', description: 'MIS CITAS DE HOY', section: 'MI DIA' },
  { id: 'staff-finances', label: 'Mis Ingresos', description: 'COMISIONES Y GANANCIAS', section: 'MI DIA' },
];

const MOBILE_BREAKPOINT = 768;

const StaffRouter = ({ user, onLogout }) => {
  const [activeSection, setActiveSection] = useState('staff-dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);
  const { addNotification } = useNotification();
  const knownApptIds = useRef(new Set());

  // Poll for new appointments and create notifications
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

  const renderSection = () => {
    switch (activeSection) {
      case 'staff-dashboard': return <StaffDashboard user={user} onNavigate={setActiveSection} />;
      case 'staff-agenda': return <StaffAgenda user={user} />;
      case 'staff-finances': return <StaffFinances user={user} />;
      default: return <StaffDashboard user={user} onNavigate={setActiveSection} />;
    }
  };

  return (
    <div className={`main-layout ${isSidebarCollapsed ? 'main-layout--collapsed' : ''} ${isMobile ? 'main-layout--mobile' : ''}`}>
      {isMobile && isMobileMenuOpen && (
        <div className="main-layout__backdrop" onClick={() => setIsMobileMenuOpen(false)} />
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
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        badgeCounts={{}}
      />
      <div className="main-layout__content">
        <Header
          user={user}
          onLogout={onLogout}
          onNavigate={handleNavigate}
          isMobile={isMobile}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        />
        <main className="main-layout__main">
          {renderSection()}
        </main>
      </div>
    </div>
  );
};

export default StaffRouter;
