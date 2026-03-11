import { useState } from 'react';
import DevLayout from '../DevLayout/DevLayout';
import DevDashboard from '../DevDashboard/DevDashboard';
import DevTenants from '../DevTenants/DevTenants';
import DevUsage from '../DevUsage/DevUsage';
import DevBilling from '../DevBilling/DevBilling';
import DevProfile from '../DevProfile/DevProfile';

const DevRouter = ({ user, onLogout }) => {
  const [activeSection, setActiveSection] = useState('dev-dashboard');

  const renderSection = () => {
    switch (activeSection) {
      case 'dev-dashboard': return <DevDashboard />;
      case 'dev-tenants': return <DevTenants />;
      case 'dev-usage': return <DevUsage />;
      case 'dev-billing': return <DevBilling />;
      case 'dev-profile': return <DevProfile user={user} />;
      default: return <DevDashboard />;
    }
  };

  return (
    <DevLayout
      activeSection={activeSection}
      onNavigate={setActiveSection}
      onLogout={onLogout}
      user={user}
    >
      {renderSection()}
    </DevLayout>
  );
};

export default DevRouter;
