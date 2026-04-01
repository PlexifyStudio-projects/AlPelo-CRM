import { useAuth } from '../context/AuthContext';
import MainLayout from '../components/layout/MainLayout/MainLayout';
import DevRouter from '../components/Developer/DevRouter/DevRouter';
import StaffRouter from '../components/Staff/StaffRouter/StaffRouter';
import Login from '../pages/Login/Login';
import Dashboard from '../pages/Dashboard/Dashboard';
import Clients from '../pages/Clients/Clients';
import ChatAI from '../pages/ChatAI/ChatAI';
import Team from '../pages/Team/Team';
import Inbox from '../pages/Inbox/Inbox';
import Services from '../pages/Services/Services';
import Inventory from '../pages/Inventory/Inventory';
import Agenda from '../pages/Agenda/Agenda';
import Finances from '../pages/Finances/Finances';
import LinaActivity from '../pages/LinaActivity/LinaActivity';
import Campaigns from '../pages/Campaigns/Campaigns';
import ContentStudio from '../pages/ContentStudio/ContentStudio';
import Automations from '../pages/Automations/AutomationStudio';
import AdminProfile from '../pages/AdminProfile/AdminProfile';
import Settings from '../pages/Settings/Settings';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNotification } from '../context/NotificationContext';

const DEV_ROLES = ['dev', 'super_admin'];

const AppRouter = () => {
  const { isAuthenticated, loading, user, login, logout, updateProfile } = useAuth();
  const { clearAll } = useNotification();
  const [activeSection, setActiveSection] = useState('dashboard');
  const prevUserId = useRef(null);

  useEffect(() => {
    const currentId = user?.id || null;
    if (prevUserId.current !== null && prevUserId.current !== currentId) {
      clearAll();
    }
    prevUserId.current = currentId;
  }, [user?.id, clearAll]);

  const renderSection = useCallback(() => {
    switch (activeSection) {
      case 'dashboard': return <Dashboard onNavigate={setActiveSection} />;
      case 'agenda': return <Agenda />;
      case 'clients': return <Clients />;
      case 'campaigns': return <Campaigns />;
      case 'automations': return <Automations />;
      case 'content-studio': return <ContentStudio />;
      case 'services': return <Services />;
      case 'inventory': return <Inventory />;
      case 'finances': return <Finances />;
      case 'lina-activity': return <LinaActivity />;
      case 'inbox': return <Inbox />;
      case 'messaging': return null;
      case 'chat-ai': return <ChatAI />;
      case 'team': return <Team />;
      case 'profile': return <AdminProfile user={user} onUpdate={updateProfile} />;
      case 'settings': return <Settings />;
      default: return <Dashboard />;
    }
  }, [activeSection, user, updateProfile]);

  if (loading) return null;
  if (!isAuthenticated) return <Login onLogin={login} />;
  if (DEV_ROLES.includes(user?.role)) return <DevRouter user={user} onLogout={logout} />;
  if (user?.role === 'staff') return <StaffRouter user={user} onLogout={logout} />;

  return (
    <MainLayout
      user={user}
      activeSection={activeSection}
      onNavigate={setActiveSection}
      onLogout={logout}
    >
      {renderSection()}
    </MainLayout>
  );
};

export default AppRouter;
