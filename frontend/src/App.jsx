import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { TenantProvider } from './context/TenantContext';
import AppRouter from './routes/AppRouter';
import { Component } from 'react';
import './styles/main.scss';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, fontFamily: 'monospace', background: '#1a1a2e', color: '#e94560', minHeight: '100vh' }}>
          <h1 style={{ color: '#e94560', fontSize: 24 }}>Error en la aplicacion</h1>
          <pre style={{ background: '#16213e', padding: 20, borderRadius: 8, overflow: 'auto', color: '#eee', fontSize: 14, marginTop: 16 }}>
            {this.state.error?.toString()}
          </pre>
          <pre style={{ background: '#16213e', padding: 20, borderRadius: 8, overflow: 'auto', color: '#999', fontSize: 12, marginTop: 12 }}>
            {this.state.errorInfo?.componentStack}
          </pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: 20, padding: '10px 24px', background: '#e94560', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <TenantProvider>
          <NotificationProvider>
            <AppRouter />
          </NotificationProvider>
        </TenantProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
