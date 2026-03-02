# AlPelo CRM - Guía del Proyecto

## Información del Cliente

- **Negocio:** AlPelo Peluquería
- **Ubicación:** Cabecera, Bucaramanga, Colombia
- **Reservas:** https://book.weibook.co/alpelo-peluqueria
- **Facebook:** https://www.facebook.com/SomosAlpelo/?locale=es_LA
- **Tipo de proyecto:** CRM + Sistema de Gestión para peluquería

---

## Descripción del Proyecto

Sistema de gestión integral (CRM) para AlPelo Peluquería con las siguientes capacidades:

### Módulo Admin (rol: admin)
- **Dashboard** con métricas en tiempo real (clientes activos, citas del día, ingresos, campañas)
- **CRM de Clientes** — Perfil completo: días sin visita, servicios utilizados, preferencias, historial, estado (activo/inactivo/VIP)
- **Mensajería Masiva** — Integración con Meta API y WhatsApp Business API para envío de +500 mensajes simultáneos, campañas en cadena, segmentación de clientes
- **Chat con IA** — Asistente inteligente integrado para consultas sobre clientes, recomendaciones y análisis
- **Notificaciones** — Sistema de alertas sutiles y elegantes en toda la interfaz

### Módulo Barbero (rol: barber)
- **Gestión de Citas** — Vista de agenda personal con tiempos, movimiento de citas
- **Confirmaciones automáticas** — Al mover una cita se envía mensaje de confirmación al cliente vía WhatsApp; al confirmar el cliente, el estado se actualiza automáticamente

### Integraciones
- **Meta API** (Facebook/Instagram)
- **WhatsApp Business API** — Mensajes masivos, confirmaciones automáticas de citas
- **IA Chat** — Asistente contextual del negocio

---

## Stack Tecnológico

- **Frontend:** React 19+ con Vite
- **Estilos:** SCSS con metodología BEM obligatoria
- **Backend:** (Pendiente) — Carpeta `backend/` reservada
- **Moneda:** COP (Pesos colombianos)
- **Idioma de interfaz:** Español (Colombia)

---

## Reglas de Código — OBLIGATORIAS

### BEM (Block Element Modifier)
```
.block {}
.block__element {}
.block--modifier {}
.block__element--modifier {}
```
- TODO componente DEBE usar BEM sin excepciones
- Los bloques son los nombres de componentes en kebab-case
- Los elementos usan `__` (doble guion bajo)
- Los modificadores usan `--` (doble guion)
- NUNCA anidar selectores más de 2 niveles de profundidad

### Estructura de Archivos
```
AlPelo/
├── CLAUDE.md
├── backend/                    # Backend (pendiente)
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   │   ├── images/
│   │   │   └── fonts/
│   │   ├── components/
│   │   │   ├── common/         # Componentes reutilizables (Button, Input, Modal, etc.)
│   │   │   ├── layout/         # Sidebar, Header, MainLayout
│   │   │   ├── dashboard/
│   │   │   ├── crm/
│   │   │   ├── chat/
│   │   │   ├── appointments/
│   │   │   └── messaging/
│   │   ├── pages/              # Páginas principales (Login, Dashboard, Clients, etc.)
│   │   ├── hooks/              # Custom hooks
│   │   ├── context/            # React Context (Auth, Notifications)
│   │   ├── services/           # Lógica de API y servicios
│   │   ├── utils/              # Constantes, helpers, formatters
│   │   ├── routes/             # Router de la app
│   │   ├── data/               # Mock data para simulación
│   │   ├── styles/             # TODA la SCSS aquí
│   │   │   ├── abstracts/      # Variables, mixins, funciones
│   │   │   ├── base/           # Reset, tipografía, base
│   │   │   ├── components/     # Estilos de componentes BEM
│   │   │   ├── layout/         # Estilos de layout
│   │   │   ├── pages/          # Estilos por página
│   │   │   └── main.scss       # Punto de entrada SCSS
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
```

### Reglas de Componentes
- Cada componente en su propia carpeta: `ComponentName/ComponentName.jsx`
- Los componentes JSX van en `src/components/` o `src/pages/`
- Los estilos SCSS van SIEMPRE en `src/styles/` (NO junto al componente)
- Nombrar componentes en PascalCase
- Nombrar archivos SCSS con kebab-case y prefijo `_` para parciales

### Reglas de SCSS
- NUNCA usar CSS inline ni CSS modules
- Todo estilo nuevo va en `src/styles/` en su subcarpeta correspondiente
- Todo archivo SCSS nuevo debe importarse en `main.scss`
- Usar las variables de `_variables.scss` — NUNCA valores hardcodeados de colores, fuentes o espaciado
- Usar los mixins de `_mixins.scss` para responsive, flex, transiciones

### Paleta de Colores (identidad AlPelo)
| Variable | Valor | Uso |
|---|---|---|
| `$color-primary` | `#2D5A3D` | Verde bosque principal |
| `$color-primary-light` | `#3D7A52` | Verde claro para hover |
| `$color-primary-dark` | `#1E3D2A` | Verde oscuro para active |
| `$color-secondary` | `#1A1A1A` | Negro elegante |
| `$color-accent` | `#8B6914` | Dorado/madera |
| `$bg-main` | `#F0EDE8` | Fondo cálido principal |

### Convenciones Generales
- Idioma del código: inglés (nombres de variables, funciones, componentes)
- Idioma de la interfaz: español colombiano
- Formateo de moneda: COP sin decimales (`$25,000`)
- Fechas: formato colombiano (`dd de mes de yyyy`)
- TODO dato actual es simulado (mock) — preparado para conectar con backend real

---

## Comandos

```bash
cd frontend
npm run dev      # Servidor de desarrollo
npm run build    # Build de producción
npm run preview  # Preview del build
```

---

## Objetivo Final

Conocer mejor los gustos del cliente que el propio cliente. Cada interacción, cada visita, cada preferencia alimenta el sistema para ofrecer un servicio personalizado y de alto nivel.
