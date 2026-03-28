// ============================================
// CRM Shell — The authenticated CRM application
// This is the original AlPelo CRM, untouched.
// Loaded only when user is NOT on a landing page.
// ============================================

import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { TenantProvider } from './context/TenantContext';
import AppRouter from './routes/AppRouter';

export default function CRMShell() {
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
