import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import DevLayout from '../DevLayout/DevLayout';
import DevDashboard from '../DevDashboard/DevDashboard';
import DevTenants from '../DevTenants/DevTenants';
import DevUsage from '../DevUsage/DevUsage';
import DevBilling from '../DevBilling/DevBilling';
import DevProfile from '../DevProfile/DevProfile';
import DevActivity from '../DevActivity/DevActivity';
import DevWhatsApp from '../DevWhatsApp/DevWhatsApp';
import DevClients from '../DevClients/DevClients';
import DevPerformance from '../DevPerformance/DevPerformance';
import DevSystem from '../DevSystem/DevSystem';
import DevComparison from '../DevComparison/DevComparison';
import DevMRR from '../DevMRR/DevMRR';
import DevHealth from '../DevHealth/DevHealth';
import DevAlerts from '../DevAlerts/DevAlerts';
import DevErrors from '../DevErrors/DevErrors';
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
      case 'dev-activity': return <DevActivity />;
      case 'dev-whatsapp': return <DevWhatsApp />;
      case 'dev-clients': return <DevClients />;
      case 'dev-performance': return <DevPerformance />;
      case 'dev-system': return <DevSystem />;
      case 'dev-comparison': return <DevComparison />;
      case 'dev-mrr': return <DevMRR />;
      case 'dev-health': return <DevHealth />;
      case 'dev-alerts': return <DevAlerts />;
      case 'dev-errors': return <DevErrors />;
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
