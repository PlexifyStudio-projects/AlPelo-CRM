import { useState } from 'react';
import { Link } from 'react-router-dom';

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    price: '190.000',
    description: 'Ideal para negocios que inician su transformación digital.',
    messages: '1.500',
    features: [
      { text: 'CRM completo — clientes ilimitados', included: true },
      { text: 'Agenda y calendario visual', included: true },
      { text: 'Inbox WhatsApp en tiempo real', included: true },
      { text: 'Lina IA — 1.500 mensajes/mes', included: true },
      { text: '5 automatizaciones activas', included: true },
      { text: 'Catálogo de servicios', included: true },
      { text: 'Dashboard básico', included: true },
      { text: 'Soporte por email', included: true },
      { text: 'Finanzas y reportes avanzados', included: false },
      { text: 'Comisiones automáticas', included: false },
      { text: 'Programa de lealtad', included: false },
    ],
    highlighted: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '390.000',
    description: 'Para negocios que necesitan escalar su operación.',
    badge: 'Recomendado',
    messages: '4.000',
    features: [
      { text: 'Todo lo del plan Starter', included: true },
      { text: 'Lina IA — 4.000 mensajes/mes', included: true },
      { text: '12 automatizaciones activas', included: true },
      { text: 'Finanzas y reportes avanzados', included: true },
      { text: 'Comisiones automáticas', included: true },
      { text: 'Programa de lealtad completo', included: true },
      { text: 'Campañas de WhatsApp masivas', included: true },
      { text: 'Google Reviews integrado', included: true },
      { text: 'Referidos y bonos', included: true },
      { text: 'Soporte prioritario', included: true },
      { text: 'Soporte dedicado 24/7', included: false },
    ],
    highlighted: true,
  },
  {
    id: 'business',
    name: 'Business',
    price: '590.000',
    description: 'Operación completa para negocios con alto volumen.',
    messages: '7.000',
    features: [
      { text: 'Todo lo del plan Pro', included: true },
      { text: 'Lina IA — 7.000 mensajes/mes', included: true },
      { text: '20 automatizaciones activas', included: true },
      { text: 'Campañas masivas ilimitadas', included: true },
      { text: 'Reportes ejecutivos avanzados', included: true },
      { text: 'Multi-profesionales ilimitados', included: true },
      { text: 'Soporte dedicado 24/7', included: true },
      { text: 'Onboarding personalizado', included: true },
      { text: 'Account manager asignado', included: true },
    ],
    highlighted: false,
  },
];

const FAQ = [
  { q: '¿Puedo cambiar de plan en cualquier momento?', a: 'Sí. Puedes subir o bajar de plan cuando lo necesites. El cambio se aplica en tu próximo ciclo de facturación sin penalización.' },
  { q: '¿Qué sucede si se agotan los mensajes de Lina IA?', a: 'Puedes adquirir paquetes adicionales: 1.000 mensajes por $80.000 COP o 3.000 mensajes por $200.000 COP. Se activan al instante.' },
  { q: '¿Existe algún tipo de permanencia o contrato?', a: 'No. Todos los planes son mensuales sin permanencia. Puedes cancelar en cualquier momento sin costos adicionales.' },
  { q: '¿La integración con WhatsApp Business está incluida?', a: 'Sí. Todos los planes incluyen conexión completa con la API oficial de WhatsApp Business a través de Meta.' },
  { q: '¿Cómo funciona la demo personalizada?', a: 'Agendamos una sesión donde configuramos el sistema con los datos de tu negocio real. Ves todo funcionando antes de tomar una decisión.' },
  { q: '¿Mis datos están seguros?', a: 'Absolutamente. Utilizamos encriptación de extremo a extremo, cumplimos con las políticas de Meta y nunca compartimos tu información con terceros.' },
];

export default function Pricing() {
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <div className="pr">
      {/* Hero */}
      <section className="pr__hero">
        <div className="pr__hero-inner">
          <p className="pr__hero-eyebrow">Precios</p>
          <h1 className="pr__hero-title">
            Planes diseñados para <span className="pr__hero-title--accent">crecer contigo</span>
          </h1>
          <p className="pr__hero-sub">
            Sin contratos. Sin costos ocultos. Cancela cuando quieras.
          </p>
        </div>
      </section>

      {/* Cards */}
      <section className="pr__cards">
        <div className="pr__cards-inner">
          {plans.map((plan) => (
            <div key={plan.id} className={`pr__card ${plan.highlighted ? 'pr__card--featured' : ''}`}>
              {plan.badge && <span className="pr__card-badge">{plan.badge}</span>}

              <div className="pr__card-header">
                <h3 className="pr__card-name">{plan.name}</h3>
                <p className="pr__card-desc">{plan.description}</p>
              </div>

              <div className="pr__card-price">
                <span className="pr__card-currency">$</span>
                <span className="pr__card-amount">{plan.price}</span>
                <span className="pr__card-period">/mes COP</span>
              </div>

              <Link to="/register" className={`pr__card-cta ${plan.highlighted ? 'pr__card-cta--primary' : 'pr__card-cta--outline'}`}>
                Comenzar ahora
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
              </Link>

              <ul className="pr__card-features">
                {plan.features.map((f, i) => (
                  <li key={i} className={!f.included ? 'pr__card-features--disabled' : ''}>
                    {f.included ? (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13.333 4L6 11.333 2.667 8" stroke={plan.highlighted ? '#a78bfa' : '#10b981'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><line x1="4" y1="8" x2="12" y2="8" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round"/></svg>
                    )}
                    <span>{f.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Addon */}
      <section className="pr__addon-section">
        <div className="pr__addon">
          <div className="pr__addon-left">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            <div>
              <strong>Mensajes adicionales de Lina IA</strong>
              <span>Disponibles para todos los planes. Se activan al instante.</span>
            </div>
          </div>
          <div className="pr__addon-right">
            <div className="pr__addon-pill"><strong>1.000</strong> mensajes <span>$80.000 COP</span></div>
            <div className="pr__addon-pill"><strong>3.000</strong> mensajes <span>$200.000 COP</span></div>
          </div>
        </div>
      </section>

      {/* Payments */}
      <section className="pr__payments">
        <div className="pr__payments-inner">
          <div className="pr__payments-header">
            <h3 className="pr__payments-title">Pagos seguros y flexibles</h3>
            <p className="pr__payments-sub">
              Procesamos todos los pagos a través de pasarelas certificadas con encriptación bancaria.
              Elige el método que prefieras.
            </p>
          </div>

          <div className="pr__payments-methods">
            <div className="pr__payment-group">
              <span className="pr__payment-group-label">Tarjetas de crédito y débito</span>
              <div className="pr__payment-logos">
                <div className="pr__payment-logo">
                  <svg viewBox="0 0 38 24" width="38" height="24"><rect width="38" height="24" rx="3" fill="#1A1F71"/><text x="19" y="16" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">VISA</text></svg>
                </div>
                <div className="pr__payment-logo">
                  <svg viewBox="0 0 38 24" width="38" height="24"><rect width="38" height="24" rx="3" fill="#252525"/><circle cx="15" cy="12" r="7" fill="#EB001B"/><circle cx="23" cy="12" r="7" fill="#F79E1B"/><path d="M19 7.3a7 7 0 010 9.4 7 7 0 000-9.4z" fill="#FF5F00"/></svg>
                </div>
                <div className="pr__payment-logo">
                  <svg viewBox="0 0 38 24" width="38" height="24"><rect width="38" height="24" rx="3" fill="#016FD0"/><text x="19" y="15" textAnchor="middle" fill="white" fontSize="6" fontWeight="bold">AMEX</text></svg>
                </div>
              </div>
            </div>

            <div className="pr__payment-group">
              <span className="pr__payment-group-label">Billeteras digitales</span>
              <div className="pr__payment-logos">
                <div className="pr__payment-logo">
                  <svg viewBox="0 0 38 24" width="38" height="24"><rect width="38" height="24" rx="3" fill="#009EE3"/><text x="19" y="15" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold">PayPal</text></svg>
                </div>
                <div className="pr__payment-logo pr__payment-logo--nequi">
                  <svg viewBox="0 0 38 24" width="38" height="24"><rect width="38" height="24" rx="3" fill="#E6007E"/><text x="19" y="15" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold">Nequi</text></svg>
                </div>
                <div className="pr__payment-logo">
                  <svg viewBox="0 0 38 24" width="38" height="24"><rect width="38" height="24" rx="3" fill="#EE3124"/><text x="19" y="15" textAnchor="middle" fill="white" fontSize="6" fontWeight="bold">Davi</text></svg>
                </div>
              </div>
            </div>

            <div className="pr__payment-group">
              <span className="pr__payment-group-label">Transferencia bancaria</span>
              <div className="pr__payment-logos">
                <div className="pr__payment-logo">
                  <svg viewBox="0 0 38 24" width="38" height="24"><rect width="38" height="24" rx="3" fill="#003087"/><text x="19" y="15" textAnchor="middle" fill="white" fontSize="5" fontWeight="bold">Bancolombia</text></svg>
                </div>
                <div className="pr__payment-logo">
                  <svg viewBox="0 0 38 24" width="38" height="24"><rect width="38" height="24" rx="3" fill="#232323"/><text x="19" y="15" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold">PSE</text></svg>
                </div>
              </div>
            </div>
          </div>

          <div className="pr__payments-trust">
            <div className="pr__payments-trust-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <span>Encriptación SSL de 256 bits</span>
            </div>
            <div className="pr__payments-trust-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              <span>PCI DSS Nivel 1 certificado</span>
            </div>
            <div className="pr__payments-trust-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              <span>Datos nunca almacenados en nuestros servidores</span>
            </div>
            <div className="pr__payments-trust-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
              <span>Facturación automática mensual</span>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="pr__faq-section">
        <div className="pr__faq-inner">
          <h2 className="pr__faq-title">Preguntas frecuentes</h2>
          <div className="pr__faq-list">
            {FAQ.map((f, i) => (
              <div key={i} className={`pr__faq-item ${openFaq === i ? 'pr__faq-item--open' : ''}`}>
                <button className="pr__faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <span>{f.q}</span>
                  <svg className="pr__faq-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <div className="pr__faq-a-wrap">
                  <p className="pr__faq-a">{f.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
