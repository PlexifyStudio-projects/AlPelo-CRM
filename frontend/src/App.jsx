import { Component, lazy, Suspense } from 'react';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

const LANDING_PATHS = [
  '/', '/about', '/features', '/pricing', '/contact',
  '/faq', '/legal', '/register', '/lina-ia', '/finanzas',
  '/automatizaciones',
];

function getRoute() {
  const raw = window.location.pathname;
  const path = raw.startsWith(BASE) ? raw.slice(BASE.length) || '/' : raw;

  if (path.startsWith('/receipt/')) return { kind: 'receipt', id: path.replace('/receipt/', '').split('/')[0] };
  if (LANDING_PATHS.includes(path)) return { kind: 'landing' };
  if (path.startsWith('/producto/')) return { kind: 'landing' };
  if (path.startsWith('/book/')) return { kind: 'landing' };
  return { kind: 'app' };
}

const LandingRouter = lazy(() => import('./routes/LandingRouter'));
const CRMShell = lazy(() => import('./CRMShell'));
const PublicReceipt = lazy(() => import('./pages/PublicReceipt/PublicReceipt'));

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
  const route = getRoute();
  const hasToken = !!localStorage.getItem('plexify_token');

  // Public receipt: render with no auth requirement, regardless of session
  if (route.kind === 'receipt') {
    return (
      <ErrorBoundary>
        <Suspense fallback={null}>
          <PublicReceipt receiptId={route.id} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  const showLanding = route.kind === 'landing' && !hasToken;

  return (
    <ErrorBoundary>
      <Suspense fallback={null}>
        {showLanding ? <LandingRouter /> : <CRMShell />}
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
