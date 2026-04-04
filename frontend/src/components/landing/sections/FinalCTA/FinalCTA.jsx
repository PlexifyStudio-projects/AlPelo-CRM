import { Link } from 'react-router-dom';
import LightBurst from '../../common/LightBurst';

export default function FinalCTA() {
  return (
    <section className="final-cta" id="final-cta" aria-label="Empiece a gestionar su negocio con PlexifyStudio" style={{ position: 'relative' }}>
      <LightBurst position="bottom" color="pink" intensity="large" />
      {/* Decorative background elements */}
      <div className="final-cta__bg" aria-hidden="true">
        <div className="final-cta__shape final-cta__shape--1" />
        <div className="final-cta__shape final-cta__shape--2" />
        <div className="final-cta__dots final-cta__dots--1" />
        <div className="final-cta__dots final-cta__dots--2" />
        <div className="final-cta__ring final-cta__ring--1" />
        <div className="final-cta__ring final-cta__ring--2" />
      </div>

      <div className="final-cta__container" style={{ position: 'relative', zIndex: 1 }}>
        <h2 className="final-cta__title">Empiece a transformar su negocio hoy</h2>
        <p className="final-cta__subtitle">
          Gestione clientes, automatice WhatsApp y haga crecer su negocio con el CRM disenado para peluquerias y negocios de servicios en Colombia.
        </p>

        <div className="final-cta__actions">
          <Link
            to="/register"
            className="final-cta__btn final-cta__btn--primary"
            aria-label="Crear cuenta gratis en PlexifyStudio"
          >
            Empiece gratis hoy
          </Link>
          <Link
            to="/contact"
            className="final-cta__btn final-cta__btn--outline"
            aria-label="Contactar al equipo de PlexifyStudio"
          >
            Hablar con nuestro equipo
          </Link>
        </div>

        <p className="final-cta__contact">
          ¿Preguntas? Escribanos a{' '}
          <a
            className="final-cta__link"
            href="mailto:contact@plexifystudio.com"
          >
            contact@plexifystudio.com
          </a>
        </p>
      </div>
    </section>
  );
}
