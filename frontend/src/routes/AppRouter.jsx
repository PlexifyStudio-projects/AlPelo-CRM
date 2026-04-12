import { lazy, Suspense, useState, useEffect, useRef, useCallback, memo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import MainLayout from '../components/layout/MainLayout/MainLayout';
import Login from '../pages/Login/Login';

const Dashboard = lazy(() => import('../pages/Dashboard/Dashboard'));
const Clients = lazy(() => import('../pages/Clients/Clients'));
const Team = lazy(() => import('../pages/Team/Team'));
const Inbox = lazy(() => import('../pages/Inbox/Inbox'));
const Services = lazy(() => import('../pages/Services/Services'));
const Inventory = lazy(() => import('../pages/Inventory/Inventory'));
const Agenda = lazy(() => import('../pages/Agenda/Agenda'));
const Finances = lazy(() => import('../pages/Finances/Finances'));
const Orders = lazy(() => import('../pages/Orders/Orders'));
const Campaigns = lazy(() => import('../pages/Campaigns/Campaigns'));
const ContentStudio = lazy(() => import('../pages/ContentStudio/ContentStudio'));
const Automations = lazy(() => import('../pages/Automations/AutomationStudio'));
const AdminProfile = lazy(() => import('../pages/AdminProfile/AdminProfile'));
const Settings = lazy(() => import('../pages/Settings/Settings'));
const DevRouter = lazy(() => import('../components/Developer/DevRouter/DevRouter'));
const StaffRouter = lazy(() => import('../components/Staff/StaffRouter/StaffRouter'));

const DEV_ROLES = ['dev', 'super_admin'];

const PageLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', opacity: 0.5 }}>
    <div style={{ width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
  </div>
);

const SectionRenderer = memo(({ section, user, updateProfile }) => {
  switch (section) {
    case 'dashboard': return <Dashboard />;
    case 'agenda': return <Agenda />;
    case 'clients': return <Clients />;
    case 'orders': return <Orders />;
    case 'campaigns': return <Campaigns />;
    case 'automations': return <Automations />;
    case 'content-studio': return <ContentStudio />;
    case 'services': return <Services />;
    case 'inventory': return <Inventory />;
    case 'finances': return <Finances />;
    case 'inbox': return <Inbox />;
    case 'team': return <Team />;
    case 'profile': return <AdminProfile user={user} onUpdate={updateProfile} />;
    case 'settings': return <Settings />;
    default: return <Dashboard />;
  }
});

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

  if (loading) return null;
  if (!isAuthenticated) return <Login onLogin={login} />;

  if (DEV_ROLES.includes(user?.role)) {
    return (
      <Suspense fallback={<PageLoader />}>
        <DevRouter user={user} onLogout={logout} />
      </Suspense>
    );
  }

  if (user?.role === 'staff') {
    return (
      <Suspense fallback={<PageLoader />}>
        <StaffRouter user={user} onLogout={logout} />
      </Suspense>
    );
  }

  return (
    <MainLayout
      user={user}
      activeSection={activeSection}
      onNavigate={setActiveSection}
      onLogout={logout}
    >
      <Suspense fallback={<PageLoader />}>
        <SectionRenderer section={activeSection} user={user} updateProfile={updateProfile} />
      </Suspense>
    </MainLayout>
  );
};

export default AppRouter;
