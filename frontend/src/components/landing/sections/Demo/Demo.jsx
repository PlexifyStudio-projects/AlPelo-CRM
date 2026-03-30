import { useState, useEffect, useRef } from 'react';

const businessTypes = [
  { value: '', label: 'Selecciona tipo de negocio' },
  { value: 'peluqueria-barberia', label: 'Peluquería / Barbería' },
  { value: 'clinica-consultorio', label: 'Clínica / Consultorio' },
  { value: 'restaurante-cafeteria', label: 'Restaurante / Cafetería' },
  { value: 'gimnasio-centro-deportivo', label: 'Gimnasio / Centro deportivo' },
  { value: 'academia-formacion', label: 'Academia / Centro de formación' },
  { value: 'spa-bienestar', label: 'Spa / Centro de bienestar' },
  { value: 'veterinaria', label: 'Veterinaria' },
  { value: 'estudio-tatuaje', label: 'Estudio de tatuaje / Piercing' },
  { value: 'consultoria-profesional', label: 'Consultoría / Servicios profesionales' },
  { value: 'tienda-retail', label: 'Tienda / Retail' },
  { value: 'otro', label: 'Otro' },
];

const teamSizes = [
  { value: '', label: '¿Cuántos profesionales tienes?' },
  { value: '1-3', label: '1-3 profesionales' },
  { value: '4-10', label: '4-10 profesionales' },
  { value: '11-25', label: '11-25 profesionales' },
  { value: '25+', label: '25+ profesionales' },
];

const benefits = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    text: 'Demo personalizada de 30 minutos',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    text: 'Sin compromiso, sin costo',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    text: 'Te mostramos con datos de tu negocio',
  },
];

export default function Demo() {
  const sectionRef = useRef(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    business: '',
    businessType: '',
    teamSize: '',
    message: '',
  });

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('demo--visible');
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    alert('¡Gracias! Nos pondremos en contacto contigo pronto para agendar tu demo.');
  };

  return (
    <section
      className="demo"
      ref={sectionRef}
      aria-label="Agendar demostración"
    >
      <div className="demo__container">
        <header className="demo__header">
          <h2 className="demo__title">Agenda tu demo personalizada</h2>
          <p className="demo__subtitle">
            Uno de nuestros especialistas te mostrará cómo PlexifyStudio puede
            transformar tu negocio en 30 minutos.
          </p>
        </header>

        <div className="demo__layout">
          {/* Left — Info */}
          <div className="demo__info">
            <ul className="demo__benefits">
              {benefits.map((b, i) => (
                <li key={i} className="demo__benefit">
                  <span className="demo__benefit-icon">{b.icon}</span>
                  <span className="demo__benefit-text">{b.text}</span>
                </li>
              ))}
            </ul>

            <div className="demo__contact">
              <p className="demo__contact-text">
                ¿Prefieres escribirnos?{' '}
                <a
                  href="mailto:contact@plexifystudio.com"
                  className="demo__contact-link"
                >
                  contact@plexifystudio.com
                </a>
              </p>
            </div>

            <div className="demo__trust">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="demo__trust-icon"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span className="demo__trust-text">
                Tu información está segura
              </span>
            </div>
          </div>

          {/* Right — Form */}
          <form
            className="demo__form"
            onSubmit={handleSubmit}
            aria-label="Formulario para agendar demo"
          >
            <div className="demo__field">
              <label className="demo__label" htmlFor="demo-name">
                Nombre completo
              </label>
              <input
                className="demo__input"
                type="text"
                id="demo-name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="Tu nombre completo"
              />
            </div>

            <div className="demo__field">
              <label className="demo__label" htmlFor="demo-email">
                Email
              </label>
              <input
                className="demo__input"
                type="email"
                id="demo-email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="tu@email.com"
              />
            </div>

            <div className="demo__field">
              <label className="demo__label" htmlFor="demo-phone">
                Teléfono
              </label>
              <input
                className="demo__input"
                type="tel"
                id="demo-phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                placeholder="+57 (300) 123-4567"
              />
            </div>

            <div className="demo__field">
              <label className="demo__label" htmlFor="demo-business">
                Nombre del negocio
              </label>
              <input
                className="demo__input"
                type="text"
                id="demo-business"
                name="business"
                value={formData.business}
                onChange={handleChange}
                required
                placeholder="Mi negocio"
              />
            </div>

            <div className="demo__field">
              <label className="demo__label" htmlFor="demo-business-type">
                Tipo de negocio
              </label>
              <select
                className="demo__select"
                id="demo-business-type"
                name="businessType"
                value={formData.businessType}
                onChange={handleChange}
                required
              >
                {businessTypes.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.value === ''}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="demo__field">
              <label className="demo__label" htmlFor="demo-team-size">
                ¿Cuántos profesionales tienes?
              </label>
              <select
                className="demo__select"
                id="demo-team-size"
                name="teamSize"
                value={formData.teamSize}
                onChange={handleChange}
                required
              >
                {teamSizes.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.value === ''}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="demo__field">
              <label className="demo__label" htmlFor="demo-message">
                ¿Qué te gustaría mejorar?{' '}
                <span className="demo__label--optional">(opcional)</span>
              </label>
              <textarea
                className="demo__textarea"
                id="demo-message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                rows="3"
                placeholder="Cuéntanos sobre tus necesidades..."
              />
            </div>

            <button type="submit" className="demo__submit">
              Agendar Demo
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
