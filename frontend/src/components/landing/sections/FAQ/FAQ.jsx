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
      'Ofrecemos 3 planes mensuales en pesos colombianos (COP): Starter a $190.000/mes (ideal para negocios que comienzan), Pro a $390.000/mes (para negocios en crecimiento con más mensajes de IA y automatizaciones) y Business a $590.000/mes (máxima capacidad de IA y soporte dedicado). Todos los planes incluyen todas las funcionalidades: CRM completo, WhatsApp Business, Lina IA, finanzas, automatizaciones, programa de lealtad, inventario y booking online. La diferencia entre planes es solo el límite de mensajes de IA y automatizaciones activas.',
  },
  {
    question: '¿Necesito conocimientos tecnicos para usarlo?',
    answer:
      'No. PlexifyStudio esta disenado para ser intuitivo. La configuracion inicial toma minutos y Lina IA le guia en cada paso. No necesita saber de tecnologia para gestionar clientes, enviar campanas o ver sus finanzas.',
  },
  {
    question: '¿Como funciona la integracion con WhatsApp Business?',
    answer:
      'Conectamos su WhatsApp Business a traves de la API oficial de Meta. Desde PlexifyStudio puede enviar mensajes automaticos, campanas masivas con plantillas aprobadas, recibir y responder mensajes en un inbox unificado, y Lina IA puede responder a sus clientes automaticamente 24/7.',
  },
  {
    question: '¿Qué es Lina IA?',
    answer:
      'Lina es su asistente ejecutiva con inteligencia artificial integrada en PlexifyStudio. Cuenta con 48 acciones: responde mensajes de WhatsApp, gestiona la agenda completa (crear, mover, cancelar citas), administra clientes y servicios, genera campañas de marketing, analiza métricas del negocio, predice demanda, detecta clientes en riesgo y sugiere estrategias de crecimiento. Cada mensaje pasa por un pipeline de 4 fases de verificación antes de enviarse.',
  },
  {
    question: '¿Qué módulos incluye la plataforma?',
    answer:
      'PlexifyStudio incluye: Dashboard ejecutivo con KPIs, Agenda con drag-and-drop y detección de conflictos, CRM de clientes con perfil 360° y estados automáticos, Campañas WhatsApp masivas, Catálogo de servicios, Finanzas completas (ingresos, gastos, P&L, facturas, nómina, IVA y rendimiento por profesional), Automation Studio con 29 triggers y marketplace de packs, Inbox WhatsApp en tiempo real, Lina IA con 48 acciones, Programa de Lealtad con niveles y referidos, Gestión de equipo con comisiones, Inventario con alertas de stock, Booking online con micrositio premium, y soporte multi-sede.',
  },
  {
    question: '¿Puedo migrar mis datos desde otro sistema?',
    answer:
      'Si. Ofrecemos importacion de clientes desde Excel, CSV y otros CRMs. Nuestro equipo le asiste durante la migracion sin costo adicional.',
  },
  {
    question: '¿Hay contrato de permanencia?',
    answer:
      'No. Todos los planes son mensuales. Puede cancelar en cualquier momento sin penalizaciones ni letra pequena.',
  },
  {
    question: '¿Mis datos estan seguros?',
    answer:
      'Si. Usamos encriptacion SSL, servidores seguros y cumplimos con las politicas de Meta. Cada negocio tiene sus datos completamente aislados y nunca se comparten con terceros.',
  },
  {
    question: '¿Ofrecen soporte en espanol?',
    answer:
      'Si. Todo nuestro equipo de soporte habla espanol. Ademas, Lina IA le asiste en espanol las 24 horas. Puede contactarnos en contact@plexifystudio.com.',
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
    <section className="faq" id="faq" aria-label="Preguntas frecuentes sobre el software para peluquerias y negocios de servicios">
      <div className="faq__container">
        <div className="faq__header">
          <h2 className="faq__title">Preguntas Frecuentes sobre PlexifyStudio</h2>
          <p className="faq__subtitle">
            Todo lo que necesita saber antes de comenzar a gestionar su negocio con nuestra plataforma.
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
