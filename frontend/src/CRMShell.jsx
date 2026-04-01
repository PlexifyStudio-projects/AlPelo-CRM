import './styles/main.scss';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { TenantProvider } from './context/TenantContext';
import { LocationProvider } from './context/LocationContext';
import AppRouter from './routes/AppRouter';

export default function CRMShell() {
  return (
    <AuthProvider>
      <TenantProvider>
        <LocationProvider>
          <NotificationProvider>
            <AppRouter />
          </NotificationProvider>
        </LocationProvider>
      </TenantProvider>
    </AuthProvider>
  );
}
