import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import SEO from '../../../components/landing/common/SEO';

export default function Legal() {
  const { hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const el = document.querySelector(hash);
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    }
  }, [hash]);

  return (
    <>
      <SEO
        title="Aviso Legal"
        description="Pol&iacute;tica de privacidad y t&eacute;rminos de uso de PlexifyStudio CRM."
        url="/legal"
        noindex
      />

      <section className="page-hero" aria-label="Aviso Legal">
        <div className="page-hero__container">
          <h1 className="page-hero__title">Aviso Legal</h1>
          <p className="page-hero__subtitle">
            Conoce nuestras pol&iacute;ticas de privacidad y condiciones de uso.
          </p>
        </div>
      </section>

      <section className="legal" aria-label="Contenido legal">
        <div className="legal__container">

          <article className="legal__section" id="privacy">
            <h2 className="legal__heading">Pol&iacute;tica de Privacidad</h2>
            <p className="legal__updated">
              &Uacute;ltima actualizaci&oacute;n: marzo 2026
            </p>

            <h3 className="legal__subheading">1. Responsable del Tratamiento</h3>
            <p className="legal__text">
              PlexifyStudio (&ldquo;nosotros&rdquo;, &ldquo;nuestro&rdquo;) es responsable del tratamiento de los datos personales que recopilamos a trav&eacute;s de este sitio web y de la plataforma CRM.
            </p>

            <h3 className="legal__subheading">2. Datos que Recopilamos</h3>
            <p className="legal__text">
              Recopilamos la informaci&oacute;n que nos proporcionas voluntariamente al registrarte, registrarte o contactarnos: nombre, correo electr&oacute;nico, tel&eacute;fono y nombre del negocio. Tambi&eacute;n recopilamos datos de uso anonimizados mediante cookies anal&iacute;ticas.
            </p>

            <h3 className="legal__subheading">3. Finalidad del Tratamiento</h3>
            <p className="legal__text">
              Utilizamos sus datos para: gestionar su cuenta y prestarle el servicio CRM, enviarle comunicaciones relacionadas con el servicio, mejorar la plataforma y cumplir obligaciones legales.
            </p>

            <h3 className="legal__subheading">4. Sus Derechos</h3>
            <p className="legal__text">
              Puede ejercer sus derechos de acceso, rectificaci&oacute;n, supresi&oacute;n, portabilidad y oposici&oacute;n escribiendo a{' '}
              <a href="mailto:contact@plexifystudio.com" className="legal__link">contact@plexifystudio.com</a>.
            </p>
          </article>

          <article className="legal__section" id="terms">
            <h2 className="legal__heading">T&eacute;rminos y Condiciones</h2>
            <p className="legal__updated">
              &Uacute;ltima actualizaci&oacute;n: marzo 2026
            </p>

            <h3 className="legal__subheading">1. Aceptaci&oacute;n</h3>
            <p className="legal__text">
              Al acceder y utilizar PlexifyStudio CRM, aceptas estos t&eacute;rminos y condiciones en su totalidad. Si no est&aacute;s de acuerdo, no utilices la plataforma.
            </p>

            <h3 className="legal__subheading">2. Uso del Servicio</h3>
            <p className="legal__text">
              PlexifyStudio CRM es una plataforma de gesti&oacute;n de clientes y automatizaci&oacute;n. Te comprometes a usar el servicio de forma l&iacute;cita y conforme a la legislaci&oacute;n aplicable.
            </p>

            <h3 className="legal__subheading">3. Propiedad Intelectual</h3>
            <p className="legal__text">
              Todo el contenido, dise&ntilde;o, c&oacute;digo y marca de PlexifyStudio son propiedad exclusiva de PlexifyStudio. Queda prohibida su reproducci&oacute;n sin autorizaci&oacute;n.
            </p>

            <h3 className="legal__subheading">4. Limitaci&oacute;n de Responsabilidad</h3>
            <p className="legal__text">
              PlexifyStudio no se responsabiliza por da&ntilde;os indirectos derivados del uso de la plataforma. El servicio se proporciona &ldquo;tal cual&rdquo;.
            </p>

            <h3 className="legal__subheading">5. Contacto</h3>
            <p className="legal__text">
              Para cualquier consulta legal, escr&iacute;benos a{' '}
              <a href="mailto:contact@plexifystudio.com" className="legal__link">contact@plexifystudio.com</a>.
            </p>
          </article>

        </div>
      </section>
    </>
  );
}
