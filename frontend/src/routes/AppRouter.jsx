import { useAuth } from '../context/AuthContext';
import MainLayout from '../components/layout/MainLayout/MainLayout';
import Login from '../pages/Login/Login';
import Dashboard from '../pages/Dashboard/Dashboard';
import Clients from '../pages/Clients/Clients';
import Appointments from '../pages/Appointments/Appointments';
import Messaging from '../pages/Messaging/Messaging';
import ChatAI from '../pages/ChatAI/ChatAI';
import Team from '../pages/Team/Team';
import Profile from '../pages/Profile/Profile';
import Settings from '../pages/Settings/Settings';
import ChangePassword from '../pages/ChangePassword/ChangePassword';
import { useState } from 'react';

const AppRouter = () => {
  const { isAuthenticated, user, login, logout, updateProfile } = useAuth();
  const [activeSection, setActiveSection] = useState('dashboard');

  if (!isAuthenticated) {
    return <Login onLogin={login} />;
  }

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard': return <Dashboard />;
      case 'clients': return <Clients />;
      case 'appointments': return <Appointments />;
      case 'messaging': return <Messaging />;
      case 'chat-ai': return <ChatAI />;
      case 'team': return <Team />;
      case 'profile': return <Profile user={user} onUpdate={updateProfile} />;
      case 'settings': return <Settings />;
      case 'change-password': return <ChangePassword />;
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
