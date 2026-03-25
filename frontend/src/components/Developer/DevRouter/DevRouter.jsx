import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import DevLayout from '../DevLayout/DevLayout';
import DevDashboard from '../DevDashboard/DevDashboard';
import DevTenants from '../DevTenants/DevTenants';
import DevUsage from '../DevUsage/DevUsage';
import DevBilling from '../DevBilling/DevBilling';
import DevProfile from '../DevProfile/DevProfile';
import DevWhatsApp from '../DevWhatsApp/DevWhatsApp';
import DevSystem from '../DevSystem/DevSystem';
import DevProspector from '../DevProspector/DevProspector';

const DevRouter = ({ user, onLogout }) => {
  const [activeSection, setActiveSection] = useState('dev-dashboard');
  const { updateProfile } = useAuth();

  const handleProfileUpdate = (data) => {
    updateProfile({ name: data.name, email: data.email, phone: data.phone, username: data.username });
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'dev-dashboard': return <DevDashboard onNavigate={setActiveSection} />;
      case 'dev-tenants': return <DevTenants />;
      case 'dev-usage': return <DevUsage />;
      case 'dev-billing': return <DevBilling />;
      case 'dev-whatsapp': return <DevWhatsApp />;
      case 'dev-system': return <DevSystem />;
      case 'dev-prospector': return <DevProspector />;
      case 'dev-profile': return <DevProfile user={user} onUpdate={handleProfileUpdate} />;
      default: return <DevDashboard onNavigate={setActiveSection} />;
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
