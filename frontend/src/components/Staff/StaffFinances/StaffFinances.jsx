import { lazy, Suspense } from 'react';

const Finances = lazy(() => import('../../../pages/Finances/Finances'));

const StaffFinances = () => (
  <Suspense fallback={<div style={{ padding: 32, textAlign: 'center', color: '#94A3B8' }}>Cargando...</div>}>
    <Finances />
  </Suspense>
);

export default StaffFinances;
