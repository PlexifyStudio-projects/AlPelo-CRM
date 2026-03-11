import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { TenantProvider } from './context/TenantContext';
import AppRouter from './routes/AppRouter';
import './styles/main.scss';

function App() {
  return (
    <AuthProvider>
      <TenantProvider>
        <NotificationProvider>
          <AppRouter />
        </NotificationProvider>
      </TenantProvider>
    </AuthProvider>
  );
}

export default App;
