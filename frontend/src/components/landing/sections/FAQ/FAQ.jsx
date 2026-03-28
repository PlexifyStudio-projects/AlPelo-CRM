import { useState } from 'react';

const faqItems = [
  {
    question: '¿Qué es PlexifyStudio CRM?',
    answer:
      'PlexifyStudio CRM es una plataforma integral diseñada para todo tipo de negocio que gestione clientes: peluquerías, clínicas, restaurantes, gimnasios, academias, veterinarias, spas, estudios de tatuaje y más. Integra gestión de clientes, agenda y citas, finanzas, WhatsApp Business, automatizaciones, programa de lealtad e inteligencia artificial con Lina IA — todo en una sola herramienta.',
  },
  {
    question: '¿Cuánto cuesta PlexifyStudio?',
    answer:
      'Ofrecemos 3 planes mensuales en pesos colombianos (COP): Starter a $190.000/mes (ideal para negocios que comienzan), Pro a $350.000/mes (para negocios en crecimiento, incluye finanzas avanzadas y programa de lealtad completo) y Business a $490.000/mes (para negocios consolidados con campañas masivas ilimitadas y soporte dedicado). Todos incluyen CRM completo, WhatsApp Business y Lina IA.',
  },
  {
    question: '¿Necesito conocimientos técnicos para usarlo?',
    answer:
      'No. PlexifyStudio está diseñado para ser intuitivo. La configuración inicial toma minutos y Lina IA te guía en cada paso. No necesitas saber de tecnología para gestionar clientes, enviar campañas o ver tus finanzas.',
  },
  {
    question: '¿Cómo funciona la integración con WhatsApp?',
    answer:
      'Conectamos tu WhatsApp Business a través de la API oficial de Meta. Desde PlexifyStudio puedes enviar mensajes automáticos, campañas masivas con plantillas aprobadas, recibir y responder mensajes en un inbox unificado, y Lina IA puede responder a tus clientes automáticamente 24/7.',
  },
  {
    question: '¿Qué es Lina IA?',
    answer:
      'Lina es tu asistente ejecutiva con inteligencia artificial integrada en PlexifyStudio. Responde mensajes de WhatsApp, genera campañas de marketing, analiza métricas de tu negocio, predice demanda en tu agenda, diagnostica la salud de tu negocio y sugiere estrategias de crecimiento y retención.',
  },
  {
    question: '¿Qué módulos incluye la plataforma?',
    answer:
      'PlexifyStudio incluye: Dashboard ejecutivo con KPIs, Agenda y calendario de citas, Gestión de clientes con estados y segmentación, Campañas WhatsApp masivas, Catálogo de servicios, Finanzas (reportes, gastos, comisiones, facturas), Automatizaciones inteligentes, Inbox WhatsApp en tiempo real, Plantillas WhatsApp aprobadas por Meta, Lina IA, Programa de Lealtad con niveles y referidos, y Gestión de equipo con rendimiento.',
  },
  {
    question: '¿Puedo migrar mis datos desde otro sistema?',
    answer:
      'Sí. Ofrecemos importación de clientes desde Excel, CSV y otros CRMs. Nuestro equipo te asiste durante la migración sin costo adicional.',
  },
  {
    question: '¿Hay contrato de permanencia?',
    answer:
      'No. Todos los planes son mensuales. Puedes cancelar en cualquier momento sin penalizaciones ni letra pequeña.',
  },
  {
    question: '¿Mis datos están seguros?',
    answer:
      'Sí. Usamos encriptación de nivel bancario, servidores seguros y cumplimos con las regulaciones de protección de datos. Tu información y la de tus clientes están protegidas.',
  },
  {
    question: '¿Ofrecen soporte en español?',
    answer:
      'Sí. Todo nuestro equipo de soporte habla español. Además, Lina IA te asiste en español las 24 horas. Puedes contactarnos en contact@plexifystudio.com.',
  },
];

const faqStructuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": faqItems.map((item) => ({
    "@type": "Question",
    "name": item.question,
    "acceptedAnswer": {
      "@type": "Answer",
      "text": item.answer,
    },
  })),
};

export default function FAQ() {
  const [activeIndex, setActiveIndex] = useState(null);

  const handleToggle = (index) => {
    setActiveIndex(activeIndex === index ? null : index);
  };

  return (
    <section className="faq" id="faq" aria-label="Preguntas frecuentes">
      <div className="faq__container">
        <div className="faq__header">
          <h2 className="faq__title">Preguntas Frecuentes</h2>
          <p className="faq__subtitle">
            Todo lo que necesitas saber antes de comenzar.
          </p>
        </div>

        <div className="faq__list" role="list">
          {faqItems.map((item, index) => {
            const isOpen = activeIndex === index;
            return (
              <div
                key={index}
                className={`faq__item ${isOpen ? 'faq__item--active' : ''}`}
                role="listitem"
              >
                <button
                  className="faq__question"
                  onClick={() => handleToggle(index)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${index}`}
                  id={`faq-question-${index}`}
                >
                  <span className="faq__question-text">{item.question}</span>
                  <span className="faq__icon" aria-hidden="true">
                    <svg
                      className={`faq__icon-svg ${isOpen ? 'faq__icon-svg--open' : ''}`}
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="none"
                    >
                      <path
                        d="M10 4V16"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        className="faq__icon-vertical"
                      />
                      <path
                        d="M4 10H16"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                </button>
                <div
                  className={`faq__answer ${isOpen ? 'faq__answer--open' : ''}`}
                  id={`faq-answer-${index}`}
                  role="region"
                  aria-labelledby={`faq-question-${index}`}
                >
                  <div className="faq__answer-inner">
                    <p className="faq__answer-text">{item.answer}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* FAQ Schema JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
      />
    </section>
  );
}
