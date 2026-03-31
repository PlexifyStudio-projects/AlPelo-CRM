import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import '../../../styles/landing-entry.scss';
import Header from './Header';
import Footer from './Footer';
import ScrollTop from '../common/ScrollTop';
import MeshGradient from '../common/MeshGradient';

export default function Layout() {
  const { pathname } = useLocation();
  const isBooking = pathname.includes('/book/');

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // Booking pages render standalone (no header/footer/background)
  if (isBooking) {
    return <Outlet />;
  }

  return (
    <>
      <a href="#main-content" className="skip-to-content">
        Saltar al contenido principal
      </a>
      <MeshGradient />
      <Header />
      <main className="main" id="main-content" key={pathname}>
        <Outlet />
      </main>
      <Footer />
      <ScrollTop />
    </>
  );
}
