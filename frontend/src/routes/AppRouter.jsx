import { useAuth } from '../context/AuthContext';
import MainLayout from '../components/layout/MainLayout/MainLayout';
import Login from '../pages/Login/Login';
import Dashboard from '../pages/Dashboard/Dashboard';
import Clients from '../pages/Clients/Clients';
import Messaging from '../pages/Messaging/Messaging';
import ChatAI from '../pages/ChatAI/ChatAI';
import Team from '../pages/Team/Team';
import Inbox from '../pages/Inbox/Inbox';
import Services from '../pages/Services/Services';
import Agenda from '../pages/Agenda/Agenda';
import Finances from '../pages/Finances/Finances';
import LinaActivity from '../pages/LinaActivity/LinaActivity';
import Campaigns from '../pages/Campaigns/Campaigns';
import Profile from '../pages/Profile/Profile';
import Settings from '../pages/Settings/Settings';
import { useState } from 'react';

const AppRouter = () => {
  const { isAuthenticated, loading, user, login, logout, updateProfile } = useAuth();
  const [activeSection, setActiveSection] = useState('dashboard');

  if (loading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Login onLogin={login} />;
  }

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard': return <Dashboard onNavigate={setActiveSection} />;
      case 'agenda': return <Agenda />;
      case 'clients': return <Clients />;
      case 'campaigns': return <Campaigns />;
      case 'services': return <Services />;
      case 'finances': return <Finances />;
      case 'lina-activity': return <LinaActivity />;
      case 'inbox': return <Inbox />;
      case 'messaging': return <Messaging />;
      case 'chat-ai': return <ChatAI />;
      case 'team': return <Team />;
      case 'profile': return <Profile user={user} onUpdate={updateProfile} />;
      case 'settings': return <Settings />;
      default: return <Dashboard />;
    }
  };

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
