import SEO from '../../../components/landing/common/SEO';
import Button from '../../../components/landing/common/Button';

export default function NotFound() {
  return (
    <>
      <SEO title="404 — Página no encontrada" noindex />
      <section className="not-found">
        <div className="not-found__container">
          <h1 className="not-found__code">404</h1>
          <h2 className="not-found__title">Página no encontrada</h2>
          <p className="not-found__text">
            Lo sentimos, la página que buscas no existe o ha sido movida.
          </p>
          <Button variant="primary" size="lg" to="/">
            Volver al inicio
          </Button>
        </div>
      </section>
    </>
  );
}
