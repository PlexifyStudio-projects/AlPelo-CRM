// ============================================
// AlPelo CRM - Mock Data v4.0
// Comprehensive dataset for CRM system
// Real data from AlPelo Peluquería, Bucaramanga
// 30 clients, ~217 visit history entries
// totalSpent = sum of completed visit amounts
// totalVisits = count of completed + no_show entries
// loyaltyPoints = Math.round(totalSpent / 1000)
// ============================================

export const mockBusinessInfo = {
  name: 'ALPELO PELUQUERÍA',
  address: 'Carrera 31 n 50-21, Bucaramanga',
  phone: '3176608487',
  rating: 5.0,
  totalServices: 102,
  hours: {
    weekdays: { open: '8:15 AM', close: '8:00 PM' },
    saturday: { open: '8:15 AM', close: '8:00 PM' },
    sunday: { open: '9:30 AM', close: '2:00 PM' },
  },
  categories: ['Barbería', 'Belleza', 'Uñas', 'Spa'],
};

// ============================================
// Status distribution (computed at runtime by clientStatus.js):
//   VIP: IDs 1, 3, 5, 13, 15 (high visits/year, top spenders)
//   Activo: IDs 6, 7, 9, 10, 12, 16, 26, 27, 28, 29, 30
//   Nuevo: IDs 17, 18
//   En Riesgo: IDs 2, 11, 19, 20, 21 (46-60 days since last visit)
//   Inactivo: IDs 4, 8, 14, 22, 23, 24, 25 (>60 days)
// ============================================

export const mockClients = [
  {
    id: 1,
    name: 'Carlos Mendoza',
    phone: '+573001234567',
    email: 'carlos.mendoza@email.com',
    lastVisit: '2026-02-25',
    firstVisit: '2024-06-15',
    totalVisits: 10,
    totalSpent: 545000,
    favoriteService: 'Corte + Barba',
    preferredBarber: 1,
    notes: 'Prefiere los cortes modernos. Alérgico a algunos productos capilares.',
    tags: ['VIP', 'Mensual'],
    avatar: null,
    birthday: '1990-03-15',
    gender: 'M',
    source: 'Instagram',
    haircutStyleNotes: 'Mid fade con textura arriba, línea diagonal en la sien',
    beardStyleNotes: 'Barba delineada, largo medio, bordes definidos',
    noShowCount: 0,
    cancellationCount: 1,
    loyaltyPoints: 545,
    acceptsWhatsApp: true,
  },
  {
    id: 2,
    name: 'Andrés Ruiz Parra',
    phone: '+573009876543',
    email: 'andres.ruiz@email.com',
    lastVisit: '2026-01-08',
    firstVisit: '2025-03-20',
    totalVisits: 8,
    totalSpent: 280000,
    favoriteService: 'Corte Hipster',
    preferredBarber: 2,
    notes: 'Le gusta conversar durante el corte. Prefiere citas temprano.',
    tags: ['Ocasional'],
    avatar: null,
    birthday: '1988-07-22',
    gender: 'M',
    source: 'Google Maps',
    haircutStyleNotes: 'Corte clásico con tijera, sin máquina',
    beardStyleNotes: 'Sin barba',
    noShowCount: 1,
    cancellationCount: 0,
    loyaltyPoints: 280,
    acceptsWhatsApp: true,
  },
  {
    id: 3,
    name: 'Miguel Ángel Torres',
    phone: '+573005551234',
    email: 'miguel.torres@email.com',
    lastVisit: '2026-02-26',
    firstVisit: '2024-01-10',
    totalVisits: 10,
    totalSpent: 580000,
    favoriteService: 'Corte + Barba + Cejas',
    preferredBarber: 1,
    notes: 'Cliente fiel desde el primer mes. Siempre recomienda nuevos clientes.',
    tags: ['VIP', 'Referidor', 'Quincenal'],
    avatar: null,
    birthday: '1985-11-30',
    gender: 'M',
    source: 'Referido',
    haircutStyleNotes: 'Degradado alto skin fade con diseño lateral',
    beardStyleNotes: 'Barba cuadrada, bordes definidos con navaja',
    noShowCount: 0,
    cancellationCount: 0,
    loyaltyPoints: 580,
    acceptsWhatsApp: true,
  },
  {
    id: 4,
    name: 'Juan Pablo Pérez',
    phone: '+573004443322',
    email: 'juanp.perez@email.com',
    lastVisit: '2025-12-10',
    firstVisit: '2025-09-05',
    totalVisits: 4,
    totalSpent: 120000,
    favoriteService: 'Corte Hipster',
    preferredBarber: 3,
    notes: '',
    tags: ['Ocasional'],
    avatar: null,
    birthday: '1995-04-18',
    gender: 'M',
    source: 'Pasó por aquí',
    haircutStyleNotes: 'Corte básico, corto por los lados',
    beardStyleNotes: 'Sin barba',
    noShowCount: 1,
    cancellationCount: 0,
    loyaltyPoints: 120,
    acceptsWhatsApp: false,
  },
  {
    id: 5,
    name: 'David López Vargas',
    phone: '+573007778899',
    email: 'david.lopez@email.com',
    lastVisit: '2026-02-27',
    firstVisit: '2023-11-20',
    totalVisits: 10,
    totalSpent: 505000,
    favoriteService: 'Spa Manicure',
    preferredBarber: 10,
    notes: 'Siempre pide colorimetría con tonos rubios. Compra productos capilares.',
    tags: ['VIP', 'Semanal', 'Productos'],
    avatar: null,
    birthday: '1992-09-03',
    gender: 'M',
    source: 'Instagram',
    haircutStyleNotes: 'Degradado bajo con flequillo largo, textura con cera mate',
    beardStyleNotes: 'Candado bien definido',
    noShowCount: 0,
    cancellationCount: 1,
    loyaltyPoints: 505,
    acceptsWhatsApp: true,
  },
  {
    id: 6,
    name: 'Santiago Reyes Duarte',
    phone: '+573006112233',
    email: 'santiago.reyes@email.com',
    lastVisit: '2026-02-20',
    firstVisit: '2025-06-10',
    totalVisits: 8,
    totalSpent: 410000,
    favoriteService: 'Corte + Barba',
    preferredBarber: 4,
    notes: 'Estudiante universitario. Prefiere los sábados.',
    tags: ['Mensual'],
    avatar: null,
    birthday: '2001-01-25',
    gender: 'M',
    source: 'TikTok',
    haircutStyleNotes: 'Buzz cut #2, desvanecido en las patillas',
    beardStyleNotes: 'Barba incipiente, solo perfilado',
    noShowCount: 0,
    cancellationCount: 0,
    loyaltyPoints: 410,
    acceptsWhatsApp: true,
  },
  {
    id: 7,
    name: 'Camilo Hernández Ríos',
    phone: '+573003344556',
    email: 'camilo.hernandez@email.com',
    lastVisit: '2026-02-15',
    firstVisit: '2025-08-12',
    totalVisits: 9,
    totalSpent: 440000,
    favoriteService: 'Corte + Barba',
    preferredBarber: 1,
    notes: 'Trabaja en zona industrial. Viene en horas de almuerzo.',
    tags: ['Mensual'],
    avatar: null,
    birthday: '1993-06-08',
    gender: 'M',
    source: 'Pasó por aquí',
    haircutStyleNotes: 'Corte ejecutivo clásico, tijera arriba',
    beardStyleNotes: 'Barba completa natural, solo emparejar',
    noShowCount: 1,
    cancellationCount: 0,
    loyaltyPoints: 440,
    acceptsWhatsApp: true,
  },
  {
    id: 8,
    name: 'Felipe Ardila Mantilla',
    phone: '+573008899001',
    email: 'felipe.ardila@email.com',
    lastVisit: '2025-11-28',
    firstVisit: '2025-05-15',
    totalVisits: 5,
    totalSpent: 200000,
    favoriteService: 'Corte Hipster',
    preferredBarber: 2,
    notes: 'Se mudó de barrio. Posiblemente no regrese.',
    tags: ['Perdido'],
    avatar: null,
    birthday: '1987-12-14',
    gender: 'M',
    source: 'Google Maps',
    haircutStyleNotes: 'Corte clásico con raya lateral',
    beardStyleNotes: 'Sin barba',
    noShowCount: 0,
    cancellationCount: 0,
    loyaltyPoints: 200,
    acceptsWhatsApp: true,
  },
  {
    id: 9,
    name: 'Nicolás Pabón Serrano',
    phone: '+573002233445',
    email: 'nicolas.pabon@email.com',
    lastVisit: '2026-02-24',
    firstVisit: '2024-09-01',
    totalVisits: 9,
    totalSpent: 425000,
    favoriteService: 'Corte + Cejas',
    preferredBarber: 4,
    notes: 'Le encantan los diseños geométricos. Siempre trae referencias de Instagram.',
    tags: ['Quincenal', 'Diseños'],
    avatar: null,
    birthday: '1998-02-20',
    gender: 'M',
    source: 'Instagram',
    haircutStyleNotes: 'Degradado alto con diseño geométrico, textura arriba con pomada',
    beardStyleNotes: 'Línea de barba definida, sin bigote',
    noShowCount: 0,
    cancellationCount: 0,
    loyaltyPoints: 425,
    acceptsWhatsApp: true,
  },
  {
    id: 10,
    name: 'Sebastián Cárdenas Leal',
    phone: '+573005566778',
    email: 'sebastian.cardenas@email.com',
    lastVisit: '2026-02-22',
    firstVisit: '2025-01-18',
    totalVisits: 8,
    totalSpent: 410000,
    favoriteService: 'Corte + Barba',
    preferredBarber: 5,
    notes: 'Barbero amateur, siempre pregunta por técnicas.',
    tags: ['Mensual'],
    avatar: null,
    birthday: '1996-08-11',
    gender: 'M',
    source: 'Google Maps',
    haircutStyleNotes: 'Mid fade con pompadour, mucho volumen',
    beardStyleNotes: 'Barba corta, perfilada con máquina',
    noShowCount: 0,
    cancellationCount: 0,
    loyaltyPoints: 410,
    acceptsWhatsApp: true,
  },
  {
    id: 11,
    name: 'Diego Alejandro Suárez',
    phone: '+573007788990',
    email: 'diego.suarez@email.com',
    lastVisit: '2026-01-05',
    firstVisit: '2025-07-22',
    totalVisits: 6,
    totalSpent: 290000,
    favoriteService: 'Corte + Barba + Cejas',
    preferredBarber: 7,
    notes: 'Solo viene por la barba. No le gusta esperar.',
    tags: ['Ocasional'],
    avatar: null,
    birthday: '1991-10-05',
    gender: 'M',
    source: 'Referido',
    haircutStyleNotes: 'Corte corto parejo, sin degradado',
    beardStyleNotes: 'Barba delineada, mejillas limpias',
    noShowCount: 1,
    cancellationCount: 0,
    loyaltyPoints: 290,
    acceptsWhatsApp: true,
  },
  {
    id: 12,
    name: 'Julián Esteban Ortiz',
    phone: '+573001122334',
    email: 'julian.ortiz@email.com',
    lastVisit: '2026-02-18',
    firstVisit: '2024-11-30',
    totalVisits: 9,
    totalSpent: 355000,
    favoriteService: 'Manicure + Pedicure Tradicional',
    preferredBarber: 13,
    notes: 'Tratamiento para caída de cabello. Revisión mensual.',
    tags: ['Mensual', 'Tratamiento'],
    avatar: null,
    birthday: '1983-05-27',
    gender: 'M',
    source: 'Referido',
    haircutStyleNotes: 'Corte conservador, largo moderado arriba',
    beardStyleNotes: 'Barba completa natural, emparejar puntas',
    noShowCount: 0,
    cancellationCount: 0,
    loyaltyPoints: 355,
    acceptsWhatsApp: true,
  },
  {
    id: 13,
    name: 'Alejandro Villamizar',
    phone: '+573004455667',
    email: 'alejandro.villamizar@email.com',
    lastVisit: '2026-02-26',
    firstVisit: '2024-03-08',
    totalVisits: 10,
    totalSpent: 560000,
    favoriteService: 'Corte + Barba',
    preferredBarber: 1,
    notes: 'Empresario local. A veces trae a sus empleados. Paga por todos.',
    tags: ['VIP', 'Corporativo', 'Quincenal'],
    avatar: null,
    birthday: '1980-09-12',
    gender: 'M',
    source: 'Referido',
    haircutStyleNotes: 'Corte clásico ejecutivo, tijera, limpio',
    beardStyleNotes: 'Barba cuadrada corta, bordes definidos con navaja',
    noShowCount: 0,
    cancellationCount: 0,
    loyaltyPoints: 560,
    acceptsWhatsApp: true,
  },
  {
    id: 14,
    name: 'Mateo Gómez Plata',
    phone: '+573006677889',
    email: 'mateo.gomez@email.com',
    lastVisit: '2025-12-20',
    firstVisit: '2025-10-01',
    totalVisits: 3,
    totalSpent: 130000,
    favoriteService: 'Corte + Cejas',
    preferredBarber: 3,
    notes: 'Solo viene para cejas y barba ligera.',
    tags: ['Ocasional'],
    avatar: null,
    birthday: '2003-03-30',
    gender: 'M',
    source: 'TikTok',
    haircutStyleNotes: 'Degradado bajo, largo arriba con textura',
    beardStyleNotes: 'Sin barba, solo cejas',
    noShowCount: 0,
    cancellationCount: 1,
    loyaltyPoints: 130,
    acceptsWhatsApp: true,
  },
  {
    id: 15,
    name: 'Ricardo Uribe Navas',
    phone: '+573009900112',
    email: 'ricardo.uribe@email.com',
    lastVisit: '2026-02-23',
    firstVisit: '2024-08-14',
    totalVisits: 10,
    totalSpent: 560000,
    favoriteService: 'Corte + Barba',
    preferredBarber: 5,
    notes: 'Profesor universitario. Siempre pide el mismo estilo clásico moderno.',
    tags: ['VIP', 'Quincenal', 'Fiel'],
    avatar: null,
    birthday: '1978-11-19',
    gender: 'M',
    source: 'Pasó por aquí',
    haircutStyleNotes: 'Corte clásico moderno, degradado bajo, peinado hacia atrás',
    beardStyleNotes: 'Barba completa, recorte uniforme, bordes naturales',
    noShowCount: 0,
    cancellationCount: 0,
    loyaltyPoints: 560,
    acceptsWhatsApp: true,
  },
  {
    id: 16,
    name: 'Esteban Capacho León',
    phone: '+573003210987',
    email: 'esteban.capacho@email.com',
    lastVisit: '2026-02-10',
    firstVisit: '2025-04-22',
    totalVisits: 8,
    totalSpent: 350000,
    favoriteService: 'Lifting de Pestañas',
    preferredBarber: 10,
    notes: 'Le gusta experimentar con colores. Última vez: mechas cobrizas.',
    tags: ['Mensual', 'Color'],
    avatar: null,
    birthday: '1999-07-04',
    gender: 'M',
    source: 'Instagram',
    haircutStyleNotes: 'Texturizado con mechas, flequillo largo',
    beardStyleNotes: 'Sin barba',
    noShowCount: 0,
    cancellationCount: 0,
    loyaltyPoints: 350,
    acceptsWhatsApp: true,
  },
  // ==========================================
  // NEW CLIENTS (IDs 17-30)
  // ==========================================
  {
    // Nuevo - 1 visit, firstVisit 2026-02-20
    id: 17,
    name: 'Brayan Stiven Cáceres',
    phone: '+573014567890',
    email: 'brayan.caceres@gmail.com',
    lastVisit: '2026-02-20',
    firstVisit: '2026-02-20',
    totalVisits: 1,
    totalSpent: 40000,
    favoriteService: 'Corte Hipster',
    preferredBarber: 6,
    notes: 'Primera visita. Lo recomendó un amigo del barrio.',
    tags: ['Nuevo'],
    avatar: null,
    birthday: '2004-08-12',
    gender: 'M',
    source: 'Referido',
    haircutStyleNotes: 'Degradado medio, textura arriba con gel',
    beardStyleNotes: 'Sin barba',
    noShowCount: 0,
    cancellationCount: 0,
    loyaltyPoints: 40,
    acceptsWhatsApp: true,
  },
  {
    // Nuevo - 1 visit, firstVisit 2026-02-15
    id: 18,
    name: 'Laura Valentina Pico Rangel',
    phone: '+573025678901',
    email: 'laura.pico@gmail.com',
    lastVisit: '2026-02-15',
    firstVisit: '2026-02-15',
    totalVisits: 1,
    totalSpent: 75000,
    favoriteService: 'Lifting de Pestañas con Pigmento',
    preferredBarber: 10,
    notes: 'Vino por el lifting. Interesada en laminado de cejas también.',
    tags: ['Nueva'],
    avatar: null,
    birthday: '1997-04-22',
    gender: 'F',
    source: 'Instagram',
    haircutStyleNotes: '',
    beardStyleNotes: '',
    noShowCount: 0,
    cancellationCount: 0,
    loyaltyPoints: 75,
    acceptsWhatsApp: true,
  },
  {
    // En Riesgo - lastVisit ~50 days ago (2026-01-08)
    id: 19,
    name: 'Fabián Andrés Capacho Rincón',
    phone: '+573036789012',
    email: 'fabian.capacho@email.com',
    lastVisit: '2026-01-08',
    firstVisit: '2025-06-15',
    totalVisits: 10,
    totalSpent: 400000,
    favoriteService: 'Corte + Barba',
    preferredBarber: 7,
    notes: 'Trabaja en construcción, viene cuando tiene tiempo libre.',
    tags: ['Mensual'],
    avatar: null,
    birthday: '1989-02-14',
    gender: 'M',
    source: 'Pasó por aquí',
    haircutStyleNotes: 'Corte corto militar, máquina #1 lados',
    beardStyleNotes: 'Barba delineada, corta',
    noShowCount: 2,
    cancellationCount: 0,
    loyaltyPoints: 400,
    acceptsWhatsApp: true,
  },
  {
    // En Riesgo - lastVisit ~52 days ago (2026-01-06)
    id: 20,
    name: 'Jhon Fredy Blanco Duarte',
    phone: '+573047890123',
    email: 'jhon.blanco@gmail.com',
    lastVisit: '2026-01-06',
    firstVisit: '2025-04-10',
    totalVisits: 11,
    totalSpent: 505000,
    favoriteService: 'Corte + Barba',
    preferredBarber: 2,
    notes: 'Taxista. Horario irregular pero viene cada mes.',
    tags: ['Mensual'],
    avatar: null,
    birthday: '1982-11-03',
    gender: 'M',
    source: 'Google Maps',
    haircutStyleNotes: 'Corte clásico, corto parejo, sin diseño',
    beardStyleNotes: 'Bigote solo, recortado',
    noShowCount: 1,
    cancellationCount: 1,
    loyaltyPoints: 505,
    acceptsWhatsApp: true,
  },
  {
    // En Riesgo - lastVisit ~55 days ago (2026-01-03)
    id: 21,
    name: 'Edwin Gerardo Toloza',
    phone: '+573058901234',
    email: 'edwin.toloza@email.com',
    lastVisit: '2026-01-03',
    firstVisit: '2025-08-20',
    totalVisits: 7,
    totalSpent: 305000,
    favoriteService: 'Corte + Cejas',
    preferredBarber: 4,
    notes: 'Prefiere citas después de las 5pm.',
    tags: ['Mensual'],
    avatar: null,
    birthday: '1994-06-28',
    gender: 'M',
    source: 'TikTok',
    haircutStyleNotes: 'Low fade con línea, flequillo texturizado',
    beardStyleNotes: 'Sin barba, solo cejas perfiladas',
    noShowCount: 0,
    cancellationCount: 0,
    loyaltyPoints: 305,
    acceptsWhatsApp: false,
  },
  {
    // Inactivo - lastVisit 2025-12-15 (>60 days)
    id: 22,
    name: 'Oscar Mauricio Jaimes Carvajal',
    phone: '+573069012345',
    email: 'oscar.jaimes@gmail.com',
    lastVisit: '2025-12-15',
    firstVisit: '2025-03-10',
    totalVisits: 7,
    totalSpent: 240000,
    favoriteService: 'Corte Hipster',
    preferredBarber: 6,
    notes: 'Viene con su hijo. Los dos se cortan.',
    tags: ['Familiar'],
    avatar: null,
    birthday: '1979-01-20',
    gender: 'M',
    source: 'Referido',
    haircutStyleNotes: 'Corte conservador, tijera, sin degradado',
    beardStyleNotes: 'Barba completa natural, solo emparejar',
    noShowCount: 1,
    cancellationCount: 0,
    loyaltyPoints: 240,
    acceptsWhatsApp: true,
  },
  {
    // Inactivo - lastVisit 2025-12-01 (>60 days)
    id: 23,
    name: 'Karen Lizeth Amaya Soto',
    phone: '+573070123456',
    email: 'karen.amaya@gmail.com',
    lastVisit: '2025-12-01',
    firstVisit: '2025-07-05',
    totalVisits: 5,
    totalSpent: 275000,
    favoriteService: 'Semipermanente Manicure',
    preferredBarber: 14,
    notes: 'Prefiere tonos pastel. Siempre pide diseño en dos uñas.',
    tags: ['Mensual', 'Uñas'],
    avatar: null,
    birthday: '1993-12-09',
    gender: 'F',
    source: 'Instagram',
    haircutStyleNotes: '',
    beardStyleNotes: '',
    noShowCount: 0,
    cancellationCount: 1,
    loyaltyPoints: 275,
    acceptsWhatsApp: true,
  },
  {
    // Inactivo - lastVisit 2025-11-20 (>60 days)
    id: 24,
    name: 'Wilmer Arley Quintero Prada',
    phone: '+573081234567',
    email: 'wilmer.quintero@email.com',
    lastVisit: '2025-11-20',
    firstVisit: '2025-05-18',
    totalVisits: 5,
    totalSpent: 120000,
    favoriteService: 'Corte Hipster',
    preferredBarber: 3,
    notes: 'Estudiante de ingeniería. Presupuesto ajustado.',
    tags: ['Ocasional'],
    avatar: null,
    birthday: '2002-10-15',
    gender: 'M',
    source: 'TikTok',
    haircutStyleNotes: 'Buzz cut básico, sin diseño',
    beardStyleNotes: 'Sin barba',
    noShowCount: 2,
    cancellationCount: 0,
    loyaltyPoints: 120,
    acceptsWhatsApp: true,
  },
  {
    // Inactivo - lastVisit 2025-12-25 (>60 days)
    id: 25,
    name: 'Robinson Ferney Patiño',
    phone: '+573092345678',
    email: 'robinson.patino@gmail.com',
    lastVisit: '2025-12-25',
    firstVisit: '2025-09-01',
    totalVisits: 4,
    totalSpent: 150000,
    favoriteService: 'Corte + Barba',
    preferredBarber: 8,
    notes: 'Viaja mucho por trabajo. Inconsistente.',
    tags: ['Ocasional'],
    avatar: null,
    birthday: '1986-03-07',
    gender: 'M',
    source: 'Pasó por aquí',
    haircutStyleNotes: 'Corte largo arriba, degradado medio',
    beardStyleNotes: 'Barba corta, contorno definido',
    noShowCount: 1,
    cancellationCount: 1,
    loyaltyPoints: 150,
    acceptsWhatsApp: false,
  },
  {
    // Activo - lastVisit 2026-02-22
    id: 26,
    name: 'Yesid Orlando Mantilla Gómez',
    phone: '+573103456789',
    email: 'yesid.mantilla@email.com',
    lastVisit: '2026-02-22',
    firstVisit: '2025-07-01',
    totalVisits: 8,
    totalSpent: 380000,
    favoriteService: 'Corte + Cejas',
    preferredBarber: 4,
    notes: 'Mecánico automotriz. Viene los lunes que es su día libre.',
    tags: ['Mensual'],
    avatar: null,
    birthday: '1990-05-16',
    gender: 'M',
    source: 'Pasó por aquí',
    haircutStyleNotes: 'Degradado medio, corto arriba, sin producto',
    beardStyleNotes: 'Barba delineada, candado',
    noShowCount: 0,
    cancellationCount: 0,
    loyaltyPoints: 380,
    acceptsWhatsApp: true,
  },
  {
    // Activo - lastVisit 2026-02-18
    id: 27,
    name: 'Daniela Fernanda Rueda Parra',
    phone: '+573114567890',
    email: 'daniela.rueda@gmail.com',
    lastVisit: '2026-02-18',
    firstVisit: '2025-09-15',
    totalVisits: 7,
    totalSpent: 425000,
    favoriteService: 'Semi Mani + Pedi Tradicional',
    preferredBarber: 13,
    notes: 'Siempre agenda con Jazmín. Viene con una amiga.',
    tags: ['Mensual', 'Uñas'],
    avatar: null,
    birthday: '1995-08-30',
    gender: 'F',
    source: 'Instagram',
    haircutStyleNotes: '',
    beardStyleNotes: '',
    noShowCount: 0,
    cancellationCount: 0,
    loyaltyPoints: 425,
    acceptsWhatsApp: true,
  },
  {
    // Activo - lastVisit 2026-02-25
    id: 28,
    name: 'Harold Steven Pineda Solano',
    phone: '+573125678901',
    email: 'harold.pineda@email.com',
    lastVisit: '2026-02-25',
    firstVisit: '2025-10-10',
    totalVisits: 7,
    totalSpent: 370000,
    favoriteService: 'Corte + Barba',
    preferredBarber: 1,
    notes: 'Policía. Requiere corte reglamentario pero le gusta el degradado.',
    tags: ['Quincenal'],
    avatar: null,
    birthday: '1991-01-18',
    gender: 'M',
    source: 'Referido',
    haircutStyleNotes: 'High fade reglamentario, corto arriba, peinado lateral',
    beardStyleNotes: 'Barba rapada, solo bigote perfilado',
    noShowCount: 0,
    cancellationCount: 0,
    loyaltyPoints: 370,
    acceptsWhatsApp: true,
  },
  {
    // Activo - lastVisit 2026-02-12
    id: 29,
    name: 'Luis Fernando Guarín Acevedo',
    phone: '+573136789012',
    email: 'luis.guarin@gmail.com',
    lastVisit: '2026-02-12',
    firstVisit: '2025-05-20',
    totalVisits: 9,
    totalSpent: 500000,
    favoriteService: 'Corte + Barba',
    preferredBarber: 7,
    notes: 'Contador público. Siempre viene de corbata. Muy puntual.',
    tags: ['Quincenal'],
    avatar: null,
    birthday: '1984-09-25',
    gender: 'M',
    source: 'Google Maps',
    haircutStyleNotes: 'Corte ejecutivo con raya, degradado bajo sutil',
    beardStyleNotes: 'Barba corta ejecutiva, perfilada, mejillas limpias',
    noShowCount: 0,
    cancellationCount: 0,
    loyaltyPoints: 500,
    acceptsWhatsApp: true,
  },
  {
    // Activo - lastVisit 2026-02-19
    id: 30,
    name: 'Cristian Camilo Ordóñez Vega',
    phone: '+573147890123',
    email: 'cristian.ordonez@gmail.com',
    lastVisit: '2026-02-19',
    firstVisit: '2025-11-05',
    totalVisits: 6,
    totalSpent: 250000,
    favoriteService: 'Corte + Barba',
    preferredBarber: 6,
    notes: 'DJ los fines de semana. Le gustan los cortes llamativos.',
    tags: ['Mensual', 'Diseños'],
    avatar: null,
    birthday: '2000-12-01',
    gender: 'M',
    source: 'TikTok',
    haircutStyleNotes: 'Skin fade con diseño tribal, largo arriba con ondas',
    beardStyleNotes: 'Barba delineada, línea fina en mandíbula',
    noShowCount: 1,
    cancellationCount: 0,
    loyaltyPoints: 250,
    acceptsWhatsApp: true,
  },
];

export const mockBarbers = [
  // Barberos
  { id: 1, name: 'Victor Fernández', specialty: 'Barbero', available: true, rating: 4.9, totalClients: 120, phone: '+57 316 452 8901', email: 'victor.fernandez@alpelo.co', hireDate: '2022-03-15', bio: 'Barbero senior con más de 8 años de experiencia. Especialista en cortes clásicos y modernos con acabados impecables.' },
  { id: 2, name: 'Alexander Carballo', specialty: 'Barbero', available: true, rating: 4.9, totalClients: 95, phone: '+57 310 789 3456', email: 'alexander.carballo@alpelo.co', hireDate: '2022-06-01', bio: 'Apasionado por las tendencias urbanas y los degradados. Siempre buscando la perfección en cada detalle.' },
  { id: 3, name: 'Daniel Núñez', specialty: 'Barbero', available: false, rating: 4.7, totalClients: 78, phone: '+57 315 234 6789', email: 'daniel.nunez@alpelo.co', hireDate: '2023-01-10', bio: 'Creativo y detallista, experto en diseños personalizados y cortes de tendencia internacional.' },
  { id: 4, name: 'Ángel Pabón', specialty: 'Barbero', available: true, rating: 5.0, totalClients: 65, phone: '+57 318 567 1234', email: 'angel.pabon@alpelo.co', hireDate: '2023-04-20', bio: 'Conocido por su precisión y trato excepcional. Cada cliente sale con una experiencia premium.' },
  { id: 5, name: 'Anderson Bohórquez', specialty: 'Barbero', available: true, rating: 4.4, totalClients: 55, phone: '+57 312 890 4567', email: 'anderson.bohorquez@alpelo.co', hireDate: '2023-08-15', bio: 'Joven talento con gran habilidad en cortes modernos y técnicas de texturizado.' },
  { id: 6, name: 'Camilo Gutiérrez', specialty: 'Barbero', available: true, rating: 4.7, totalClients: 70, phone: '+57 317 123 7890', email: 'camilo.gutierrez@alpelo.co', hireDate: '2023-02-01', bio: 'Versátil y carismático. Domina tanto el estilo clásico como las tendencias más actuales.' },
  { id: 7, name: 'Yhon Estrada', specialty: 'Barbero', available: true, rating: 5.0, totalClients: 60, phone: '+57 314 456 2345', email: 'yhon.estrada@alpelo.co', hireDate: '2023-06-10', bio: 'Perfeccionista nato con un ojo artístico para los degradados y acabados limpios.' },
  { id: 8, name: 'Astrid Carolina León', specialty: 'Barbera', available: true, rating: 5.0, totalClients: 45, phone: '+57 311 678 5678', email: 'astrid.leon@alpelo.co', hireDate: '2024-01-15', bio: 'Pionera en barbería femenina en la región. Combina técnica y sensibilidad artística.' },
  { id: 9, name: 'Tatiana', specialty: 'Barbera', available: true, rating: 5.0, totalClients: 40, phone: '+57 319 901 8901', email: 'tatiana@alpelo.co', hireDate: '2024-03-01', bio: 'Especialista en cortes unisex con enfoque en la comodidad y estilo del cliente.' },
  // Estilistas
  { id: 10, name: 'Josemith', specialty: 'Estilista - Especialista en color y recuperación', available: true, rating: 5.0, totalClients: 110, phone: '+57 316 234 1234', email: 'josemith@alpelo.co', hireDate: '2022-01-10', bio: 'Maestra del color con formación internacional. Transforma el cabello con técnicas de vanguardia.' },
  { id: 11, name: 'Liliana Gisella Romero', specialty: 'Estilista', available: true, rating: 4.6, totalClients: 80, phone: '+57 313 567 4567', email: 'liliana.romero@alpelo.co', hireDate: '2022-09-01', bio: 'Estilista integral con pasión por los cambios de look y la asesoría de imagen.' },
  { id: 12, name: 'Marcela Leal', specialty: 'Estilista - Especialista en recuperación capilar', available: true, rating: 4.7, totalClients: 85, phone: '+57 310 890 7890', email: 'marcela.leal@alpelo.co', hireDate: '2022-07-15', bio: 'Experta en tratamientos capilares y recuperación. Devuelve la vida al cabello dañado.' },
  // Manicuristas
  { id: 13, name: 'Jazmín Aponte Montaño', specialty: 'Manicurista', available: true, rating: 4.9, totalClients: 90, phone: '+57 318 123 2345', email: 'jazmin.aponte@alpelo.co', hireDate: '2022-05-20', bio: 'Artista del nail art con técnicas avanzadas. Sus diseños son reconocidos en toda la ciudad.' },
  { id: 14, name: 'María José Bastos', specialty: 'Manicurista', available: true, rating: 5.0, totalClients: 75, phone: '+57 315 456 5678', email: 'mariajose.bastos@alpelo.co', hireDate: '2023-03-10', bio: 'Detallista y profesional. Especialista en técnicas de gel y acrílico de alta duración.' },
  { id: 15, name: 'Carolina Banderas', specialty: 'Manicurista', available: true, rating: 4.8, totalClients: 70, phone: '+57 312 789 8901', email: 'carolina.banderas@alpelo.co', hireDate: '2023-05-01', bio: 'Creativa y tendencia. Siempre actualizada con las últimas técnicas de manicure y pedicure.' },
  { id: 16, name: 'Nicole Serrano', specialty: 'Manicurista', available: false, rating: 4.7, totalClients: 50, phone: '+57 317 012 1234', email: 'nicole.serrano@alpelo.co', hireDate: '2023-09-15', bio: 'Profesional dedicada con excelente atención al cliente y acabados impecables.' },
  { id: 17, name: 'Zuleidy Yepes', specialty: 'Manicurista - 3 años exp', available: true, rating: 4.3, totalClients: 35, phone: '+57 314 345 4567', email: 'zuleidy.yepes@alpelo.co', hireDate: '2024-02-01', bio: 'Tres años de experiencia perfeccionando su técnica. En constante formación y crecimiento.' },
  { id: 18, name: 'Stefanía Bustamante', specialty: 'Manicurista', available: true, rating: 4.5, totalClients: 40, phone: '+57 311 678 7890', email: 'stefania.bustamante@alpelo.co', hireDate: '2024-04-15', bio: 'Joven profesional con gran talento natural y pasión por la belleza de las manos.' },
];

export const mockServices = [
  // Barbería
  { id: 1, name: 'Corte Hipster', duration: 40, price: 40000, category: 'Barbería' },
  { id: 2, name: 'Corte + Cejas', duration: 40, price: 45000, category: 'Barbería' },
  { id: 3, name: 'Corte Mujer', duration: 30, price: 45000, category: 'Barbería' },
  { id: 4, name: 'Corte + Barba', duration: 60, price: 55000, category: 'Barbería' },
  { id: 5, name: 'Corte + Barba + Cejas', duration: 60, price: 60000, category: 'Barbería' },
  // Uñas Tradicional
  { id: 6, name: 'Manicure Limpieza', duration: 15, price: 20000, category: 'Uñas' },
  { id: 7, name: 'Manicure Secado Rápido', duration: 30, price: 30000, category: 'Uñas' },
  { id: 8, name: 'Pedicure Tradicional', duration: 40, price: 30000, category: 'Uñas' },
  { id: 9, name: 'Manicure + Pedicure Tradicional', duration: 80, price: 55000, category: 'Uñas' },
  // Uñas Premium
  { id: 10, name: 'Spa Manicure', duration: 60, price: 50000, category: 'Uñas Premium' },
  { id: 11, name: 'Spa Pedicure', duration: 60, price: 65000, category: 'Uñas Premium' },
  { id: 12, name: 'Semipermanente Manicure', duration: 40, price: 50000, category: 'Uñas Premium' },
  { id: 13, name: 'Semipermanente Pedicure', duration: 40, price: 50000, category: 'Uñas Premium' },
  { id: 14, name: 'Semi Mani + Pedi Tradicional', duration: 90, price: 75000, category: 'Uñas Premium' },
  { id: 15, name: 'Semi Mani + Semi Pedi', duration: 90, price: 95000, category: 'Uñas Premium' },
  // Facial/Belleza
  { id: 16, name: 'Limpieza Facial', duration: 20, price: 15000, category: 'Facial' },
  { id: 17, name: 'Lifting de Pestañas con Pigmento', duration: 60, price: 75000, category: 'Facial' },
  { id: 18, name: 'Lifting de Pestañas', duration: 45, price: 60000, category: 'Facial' },
  { id: 19, name: 'Laminado de Cejas con Pigmento', duration: 45, price: 75000, category: 'Facial' },
  { id: 20, name: 'Crioterapia', duration: 60, price: 40000, category: 'Facial' },
];

export const mockAppointments = [
  { id: 1, clientId: 1, barberId: 1, service: 'Corte + Barba', date: '2026-02-27', time: '10:00', status: 'confirmed' },
  { id: 2, clientId: 3, barberId: 2, service: 'Corte + Barba + Cejas', date: '2026-02-27', time: '11:00', status: 'pending' },
  { id: 3, clientId: 5, barberId: 10, service: 'Spa Manicure', date: '2026-02-27', time: '14:00', status: 'confirmed' },
  { id: 4, clientId: 6, barberId: 4, service: 'Corte + Barba', date: '2026-02-27', time: '09:00', status: 'confirmed' },
  { id: 5, clientId: 9, barberId: 4, service: 'Corte + Cejas', date: '2026-02-27', time: '15:30', status: 'pending' },
  { id: 6, clientId: 10, barberId: 5, service: 'Corte + Barba', date: '2026-03-01', time: '10:00', status: 'confirmed' },
  { id: 7, clientId: 12, barberId: 13, service: 'Manicure + Pedicure Tradicional', date: '2026-03-01', time: '11:30', status: 'confirmed' },
  { id: 8, clientId: 13, barberId: 1, service: 'Corte + Barba', date: '2026-03-01', time: '09:00', status: 'pending' },
  { id: 9, clientId: 15, barberId: 5, service: 'Corte + Barba', date: '2026-03-01', time: '14:00', status: 'confirmed' },
  { id: 10, clientId: 7, barberId: 1, service: 'Corte + Barba', date: '2026-03-02', time: '12:00', status: 'pending' },
  { id: 11, clientId: 16, barberId: 10, service: 'Lifting de Pestañas', date: '2026-03-02', time: '10:00', status: 'confirmed' },
  { id: 12, clientId: 2, barberId: 2, service: 'Corte Hipster', date: '2026-03-03', time: '16:00', status: 'pending' },
];

export const mockVisitHistory = [
  // ==========================================
  // Carlos Mendoza (id: 1) - VIP
  // 10 completed + 0 no_show + 1 cancelled = 11 entries (10 count as visits)
  // Sum completed: 55+55+40+55+55+60+55+55+60+55 = 545,000
  // ==========================================
  { id: 1, clientId: 1, barberId: 1, service: 'Corte + Barba', date: '2026-02-25', amount: 55000, rating: 5, notes: 'Excelente como siempre', status: 'completed' },
  { id: 2, clientId: 1, barberId: 1, service: 'Corte + Barba', date: '2026-02-10', amount: 55000, rating: 5, notes: '', status: 'completed' },
  { id: 3, clientId: 1, barberId: 1, service: 'Corte Hipster', date: '2026-01-28', amount: 40000, rating: 4, notes: 'Quiso probar algo diferente', status: 'completed' },
  { id: 4, clientId: 1, barberId: 1, service: 'Corte + Barba', date: '2026-01-14', amount: 55000, rating: 5, notes: '', status: 'completed' },
  { id: 37, clientId: 1, barberId: 1, service: 'Corte + Barba', date: '2025-12-30', amount: 55000, rating: 5, notes: 'Corte de fin de año', status: 'completed' },
  { id: 38, clientId: 1, barberId: 1, service: 'Corte + Barba + Cejas', date: '2025-12-15', amount: 60000, rating: 5, notes: '', status: 'completed' },
  { id: 128, clientId: 1, barberId: 1, service: 'Corte + Barba', date: '2025-11-30', amount: 55000, rating: 5, notes: '', status: 'completed' },
  { id: 129, clientId: 1, barberId: 1, service: 'Corte + Barba', date: '2025-11-15', amount: 55000, rating: 5, notes: 'Mismo estilo de siempre', status: 'completed' },
  { id: 130, clientId: 1, barberId: 1, service: 'Corte + Barba + Cejas', date: '2025-10-30', amount: 60000, rating: 5, notes: '', status: 'completed' },
  { id: 131, clientId: 1, barberId: 1, service: 'Corte + Barba', date: '2025-10-15', amount: 55000, rating: 4, notes: '', status: 'completed' },
  { id: 218, clientId: 1, barberId: 1, service: 'Corte + Barba', date: '2025-09-28', amount: 55000, rating: null, notes: 'Canceló por compromiso familiar', status: 'cancelled' },

  // ==========================================
  // Andrés Ruiz Parra (id: 2) - En Riesgo
  // 7 completed + 1 no_show = 8 entries
  // Sum completed: 40+40+40+40+40+40+40 = 280,000
  // ==========================================
  { id: 33, clientId: 2, barberId: 2, service: 'Corte Hipster', date: '2026-01-08', amount: 40000, rating: 3, notes: 'Tuvo que esperar mucho', status: 'completed' },
  { id: 34, clientId: 2, barberId: 2, service: 'Corte Hipster', date: '2025-12-15', amount: 40000, rating: 4, notes: '', status: 'completed' },
  { id: 39, clientId: 2, barberId: 2, service: 'Corte Hipster', date: '2025-11-10', amount: 40000, rating: 4, notes: '', status: 'completed' },
  { id: 40, clientId: 2, barberId: 2, service: 'Corte Hipster', date: '2025-09-22', amount: 40000, rating: null, notes: '', status: 'no_show' },
  { id: 132, clientId: 2, barberId: 2, service: 'Corte Hipster', date: '2025-08-18', amount: 40000, rating: 4, notes: '', status: 'completed' },
  { id: 133, clientId: 2, barberId: 2, service: 'Corte Hipster', date: '2025-07-05', amount: 40000, rating: 4, notes: '', status: 'completed' },
  { id: 134, clientId: 2, barberId: 2, service: 'Corte Hipster', date: '2025-05-20', amount: 40000, rating: 5, notes: '', status: 'completed' },
  { id: 135, clientId: 2, barberId: 2, service: 'Corte Hipster', date: '2025-03-20', amount: 40000, rating: 4, notes: 'Primera visita', status: 'completed' },

  // ==========================================
  // Miguel Torres (id: 3) - VIP
  // 10 completed + 0 no_show = 10 entries
  // Sum completed: 60+60+55+60+60+55+60+55+60+55 = 580,000
  // ==========================================
  { id: 5, clientId: 3, barberId: 1, service: 'Corte + Barba + Cejas', date: '2026-02-26', amount: 60000, rating: 5, notes: '', status: 'completed' },
  { id: 6, clientId: 3, barberId: 2, service: 'Corte + Barba + Cejas', date: '2026-02-12', amount: 60000, rating: 4, notes: '', status: 'completed' },
  { id: 7, clientId: 3, barberId: 1, service: 'Corte + Barba', date: '2026-01-30', amount: 55000, rating: 5, notes: 'Corte especial para evento', status: 'completed' },
  { id: 8, clientId: 3, barberId: 1, service: 'Corte + Barba + Cejas', date: '2026-01-18', amount: 60000, rating: 5, notes: '', status: 'completed' },
  { id: 41, clientId: 3, barberId: 1, service: 'Corte + Barba + Cejas', date: '2026-01-04', amount: 60000, rating: 5, notes: '', status: 'completed' },
  { id: 42, clientId: 3, barberId: 1, service: 'Corte + Barba', date: '2025-12-20', amount: 55000, rating: 5, notes: 'Antes de vacaciones', status: 'completed' },
  { id: 136, clientId: 3, barberId: 1, service: 'Corte + Barba + Cejas', date: '2025-12-05', amount: 60000, rating: 5, notes: '', status: 'completed' },
  { id: 137, clientId: 3, barberId: 1, service: 'Corte + Barba', date: '2025-11-20', amount: 55000, rating: 5, notes: 'Trajo un amigo', status: 'completed' },
  { id: 138, clientId: 3, barberId: 1, service: 'Corte + Barba + Cejas', date: '2025-11-06', amount: 60000, rating: 4, notes: '', status: 'completed' },
  { id: 139, clientId: 3, barberId: 1, service: 'Corte + Barba', date: '2025-10-22', amount: 55000, rating: 5, notes: '', status: 'completed' },

  // ==========================================
  // Juan Pablo Pérez (id: 4) - Inactivo
  // 3 completed + 1 no_show = 4 entries (matches adjusted totalVisits)
  // Sum completed: 40+40+40 = 120,000
  // ==========================================
  { id: 43, clientId: 4, barberId: 3, service: 'Corte Hipster', date: '2025-12-10', amount: 40000, rating: 3, notes: '', status: 'completed' },
  { id: 44, clientId: 4, barberId: 3, service: 'Corte Hipster', date: '2025-10-25', amount: 40000, rating: 4, notes: '', status: 'completed' },
  { id: 45, clientId: 4, barberId: 3, service: 'Corte Hipster', date: '2025-09-05', amount: 40000, rating: 4, notes: 'Primera visita', status: 'completed' },
  { id: 46, clientId: 4, barberId: 3, service: 'Corte + Cejas', date: '2025-11-15', amount: 45000, rating: null, notes: '', status: 'no_show' },

  // ==========================================
  // David López (id: 5) - VIP
  // 10 completed + 0 no_show + 1 cancelled = 11 entries (10 count as visits)
  // Sum completed: 50+50+55+40+50+65+50+55+50+40 = 505,000
  // ==========================================
  { id: 9, clientId: 5, barberId: 10, service: 'Spa Manicure', date: '2026-02-27', amount: 50000, rating: 5, notes: 'Quedó perfecto', status: 'completed' },
  { id: 10, clientId: 5, barberId: 10, service: 'Spa Manicure', date: '2026-02-13', amount: 50000, rating: 5, notes: '', status: 'completed' },
  { id: 11, clientId: 5, barberId: 10, service: 'Corte + Barba', date: '2026-01-30', amount: 55000, rating: 4, notes: '', status: 'completed' },
  { id: 12, clientId: 5, barberId: 1, service: 'Corte Hipster', date: '2026-01-15', amount: 40000, rating: 5, notes: '', status: 'completed' },
  { id: 47, clientId: 5, barberId: 10, service: 'Spa Manicure', date: '2025-12-28', amount: 50000, rating: 5, notes: '', status: 'completed' },
  { id: 48, clientId: 5, barberId: 10, service: 'Spa Pedicure', date: '2025-12-15', amount: 65000, rating: 5, notes: 'Sesión relajante', status: 'completed' },
  { id: 140, clientId: 5, barberId: 10, service: 'Spa Manicure', date: '2025-11-28', amount: 50000, rating: 5, notes: '', status: 'completed' },
  { id: 141, clientId: 5, barberId: 1, service: 'Corte + Barba', date: '2025-11-10', amount: 55000, rating: 5, notes: '', status: 'completed' },
  { id: 142, clientId: 5, barberId: 10, service: 'Spa Manicure', date: '2025-10-25', amount: 50000, rating: 5, notes: '', status: 'completed' },
  { id: 143, clientId: 5, barberId: 1, service: 'Corte Hipster', date: '2025-10-10', amount: 40000, rating: 4, notes: '', status: 'completed' },
  { id: 219, clientId: 5, barberId: 10, service: 'Spa Manicure', date: '2025-09-20', amount: 50000, rating: null, notes: 'Canceló por viaje de negocios', status: 'cancelled' },

  // ==========================================
  // Santiago Reyes (id: 6) - Activo
  // 8 completed + 0 no_show = 8 entries
  // Sum completed: 55+55+55+40+55+55+40+55 = 410,000
  // ==========================================
  { id: 13, clientId: 6, barberId: 4, service: 'Corte + Barba', date: '2026-02-20', amount: 55000, rating: 4, notes: '', status: 'completed' },
  { id: 14, clientId: 6, barberId: 4, service: 'Corte + Barba', date: '2026-01-22', amount: 55000, rating: 5, notes: '', status: 'completed' },
  { id: 49, clientId: 6, barberId: 4, service: 'Corte + Barba', date: '2025-12-18', amount: 55000, rating: 4, notes: '', status: 'completed' },
  { id: 50, clientId: 6, barberId: 4, service: 'Corte Hipster', date: '2025-11-15', amount: 40000, rating: 5, notes: '', status: 'completed' },
  { id: 144, clientId: 6, barberId: 4, service: 'Corte + Barba', date: '2025-10-12', amount: 55000, rating: 4, notes: '', status: 'completed' },
  { id: 145, clientId: 6, barberId: 4, service: 'Corte + Barba', date: '2025-09-08', amount: 55000, rating: 5, notes: '', status: 'completed' },
  { id: 146, clientId: 6, barberId: 4, service: 'Corte Hipster', date: '2025-08-05', amount: 40000, rating: 4, notes: '', status: 'completed' },
  { id: 147, clientId: 6, barberId: 4, service: 'Corte + Barba', date: '2025-07-01', amount: 55000, rating: 4, notes: 'Primera visita', status: 'completed' },

  // ==========================================
  // Camilo Hernández (id: 7) - Activo
  // 8 completed + 1 no_show = 9 entries
  // Sum completed: 55+55+55+55+55+55+55+55 = 440,000
  // ==========================================
  { id: 15, clientId: 7, barberId: 1, service: 'Corte + Barba', date: '2026-02-15', amount: 55000, rating: 4, notes: '', status: 'completed' },
  { id: 16, clientId: 7, barberId: 1, service: 'Corte + Barba', date: '2026-01-18', amount: 55000, rating: 5, notes: '', status: 'completed' },
  { id: 51, clientId: 7, barberId: 1, service: 'Corte + Barba', date: '2025-12-20', amount: 55000, rating: 4, notes: '', status: 'completed' },
  { id: 52, clientId: 7, barberId: 1, service: 'Corte + Barba', date: '2025-11-22', amount: 55000, rating: 5, notes: '', status: 'completed' },
  { id: 53, clientId: 7, barberId: 1, service: 'Corte + Barba', date: '2025-12-05', amount: 55000, rating: null, notes: 'No vino, estaba lloviendo', status: 'no_show' },
  { id: 148, clientId: 7, barberId: 1, service: 'Corte + Barba', date: '2025-10-20', amount: 55000, rating: 5, notes: '', status: 'completed' },
  { id: 149, clientId: 7, barberId: 1, service: 'Corte + Barba', date: '2025-09-18', amount: 55000, rating: 4, notes: '', status: 'completed' },
  { id: 150, clientId: 7, barberId: 1, service: 'Corte + Barba', date: '2025-08-16', amount: 55000, rating: 5, notes: '', status: 'completed' },
  { id: 151, clientId: 7, barberId: 1, service: 'Corte + Barba', date: '2025-08-12', amount: 55000, rating: 4, notes: 'Primera visita', status: 'completed' },

  // ==========================================
  // Felipe Ardila (id: 8) - Inactivo
  // 5 completed + 0 no_show = 5 entries
  // Sum completed: 40+40+40+40+40 = 200,000
  // ==========================================
  { id: 54, clientId: 8, barberId: 2, service: 'Corte Hipster', date: '2025-11-28', amount: 40000, rating: 4, notes: '', status: 'completed' },
  { id: 55, clientId: 8, barberId: 2, service: 'Corte Hipster', date: '2025-10-15', amount: 40000, rating: 4, notes: '', status: 'completed' },
  { id: 56, clientId: 8, barberId: 2, service: 'Corte Hipster', date: '2025-08-30', amount: 40000, rating: 3, notes: 'Quería otro barbero pero no había', status: 'completed' },
  { id: 152, clientId: 8, barberId: 2, service: 'Corte Hipster', date: '2025-07-10', amount: 40000, rating: 4, notes: '', status: 'completed' },
  { id: 153, clientId: 8, barberId: 2, service: 'Corte Hipster', date: '2025-05-15', amount: 40000, rating: 4, notes: 'Primera visita', status: 'completed' },

  // ==========================================
  // Nicolás Pabón (id: 9) - Activo
  // 9 completed + 0 no_show = 9 entries
  // Sum completed: 45+45+55+45+45+45+55+45+45 = 425,000
  // ==========================================
  { id: 17, clientId: 9, barberId: 4, service: 'Corte + Cejas', date: '2026-02-24', amount: 45000, rating: 5, notes: 'Diseño geométrico lateral', status: 'completed' },
  { id: 18, clientId: 9, barberId: 4, service: 'Corte + Cejas', date: '2026-02-10', amount: 45000, rating: 5, notes: '', status: 'completed' },
  { id: 19, clientId: 9, barberId: 4, service: 'Corte + Barba', date: '2026-01-27', amount: 55000, rating: 4, notes: '', status: 'completed' },
  { id: 57, clientId: 9, barberId: 4, service: 'Corte + Cejas', date: '2026-01-12', amount: 45000, rating: 5, notes: '', status: 'completed' },
  { id: 58, clientId: 9, barberId: 4, service: 'Corte + Cejas', date: '2025-12-28', amount: 45000, rating: 5, notes: 'Diseño de estrella', status: 'completed' },
  { id: 154, clientId: 9, barberId: 4, service: 'Corte + Cejas', date: '2025-12-12', amount: 45000, rating: 5, notes: '', status: 'completed' },
  { id: 155, clientId: 9, barberId: 4, service: 'Corte + Barba', date: '2025-11-25', amount: 55000, rating: 4, notes: '', status: 'completed' },
  { id: 156, clientId: 9, barberId: 4, service: 'Corte + Cejas', date: '2025-11-08', amount: 45000, rating: 5, notes: '', status: 'completed' },
  { id: 157, clientId: 9, barberId: 4, service: 'Corte + Cejas', date: '2025-10-22', amount: 45000, rating: 4, notes: '', status: 'completed' },

  // ==========================================
  // Sebastián Cárdenas (id: 10) - Activo
  // 8 completed + 0 no_show = 8 entries
  // Sum completed: 55+55+55+40+55+55+40+55 = 410,000
  // ==========================================
  { id: 20, clientId: 10, barberId: 5, service: 'Corte + Barba', date: '2026-02-22', amount: 55000, rating: 5, notes: '', status: 'completed' },
  { id: 21, clientId: 10, barberId: 5, service: 'Corte + Barba', date: '2026-01-25', amount: 55000, rating: 4, notes: '', status: 'completed' },
  { id: 59, clientId: 10, barberId: 5, service: 'Corte + Barba', date: '2025-12-28', amount: 55000, rating: 5, notes: '', status: 'completed' },
  { id: 60, clientId: 10, barberId: 5, service: 'Corte Hipster', date: '2025-11-30', amount: 40000, rating: 4, notes: '', status: 'completed' },
  { id: 158, clientId: 10, barberId: 5, service: 'Corte + Barba', date: '2025-10-28', amount: 55000, rating: 5, notes: '', status: 'completed' },
  { id: 159, clientId: 10, barberId: 5, service: 'Corte + Barba', date: '2025-09-25', amount: 55000, rating: 4, notes: '', status: 'completed' },
  { id: 160, clientId: 10, barberId: 5, service: 'Corte Hipster', date: '2025-08-20', amount: 40000, rating: 4, notes: '', status: 'completed' },
  { id: 161, clientId: 10, barberId: 5, service: 'Corte + Barba', date: '2025-07-15', amount: 55000, rating: 5, notes: '', status: 'completed' },

  // ==========================================
  // Diego Suárez (id: 11) - En Riesgo
  // 5 completed + 1 no_show = 6 entries
  // Sum completed: 60+60+55+60+55 = 290,000
  // ==========================================
  { id: 35, clientId: 11, barberId: 7, service: 'Corte + Barba + Cejas', date: '2026-01-05', amount: 60000, rating: 4, notes: '', status: 'completed' },
  { id: 36, clientId: 11, barberId: 7, service: 'Corte + Barba + Cejas', date: '2025-12-10', amount: 60000, rating: 3, notes: 'Dijo que la espera fue larga', status: 'completed' },
  { id: 61, clientId: 11, barberId: 7, service: 'Corte + Barba', date: '2025-11-05', amount: 55000, rating: 4, notes: '', status: 'completed' },
  { id: 62, clientId: 11, barberId: 7, service: 'Corte + Barba + Cejas', date: '2025-10-10', amount: 60000, rating: null, notes: '', status: 'no_show' },
  { id: 162, clientId: 11, barberId: 7, service: 'Corte + Barba + Cejas', date: '2025-09-05', amount: 60000, rating: 4, notes: '', status: 'completed' },
  { id: 163, clientId: 11, barberId: 7, service: 'Corte + Barba', date: '2025-07-22', amount: 55000, rating: 5, notes: 'Primera visita', status: 'completed' },

  // ==========================================
  // Julián Ortiz (id: 12) - Activo
  // 9 completed + 0 no_show = 9 entries
  // Sum completed: 55+20+55+20+55+55+20+55+20 = 355,000
  // ==========================================
  { id: 22, clientId: 12, barberId: 13, service: 'Manicure + Pedicure Tradicional', date: '2026-02-18', amount: 55000, rating: 5, notes: 'Servicio completo', status: 'completed' },
  { id: 23, clientId: 12, barberId: 13, service: 'Manicure Limpieza', date: '2026-02-04', amount: 20000, rating: 4, notes: '', status: 'completed' },
  { id: 24, clientId: 12, barberId: 13, service: 'Manicure + Pedicure Tradicional', date: '2026-01-18', amount: 55000, rating: 5, notes: '', status: 'completed' },
  { id: 63, clientId: 12, barberId: 13, service: 'Manicure Limpieza', date: '2025-12-30', amount: 20000, rating: 4, notes: '', status: 'completed' },
  { id: 64, clientId: 12, barberId: 13, service: 'Manicure + Pedicure Tradicional', date: '2025-12-10', amount: 55000, rating: 5, notes: '', status: 'completed' },
  { id: 164, clientId: 12, barberId: 13, service: 'Manicure + Pedicure Tradicional', date: '2025-11-15', amount: 55000, rating: 5, notes: '', status: 'completed' },
  { id: 165, clientId: 12, barberId: 13, service: 'Manicure Limpieza', date: '2025-10-28', amount: 20000, rating: 4, notes: '', status: 'completed' },
  { id: 166, clientId: 12, barberId: 13, service: 'Manicure + Pedicure Tradicional', date: '2025-10-05', amount: 55000, rating: 5, notes: '', status: 'completed' },
  { id: 167, clientId: 12, barberId: 13, service: 'Manicure Limpieza', date: '2025-09-15', amount: 20000, rating: 4, notes: '', status: 'completed' },

  // ==========================================
  // Alejandro Villamizar (id: 13) - VIP
  // 10 completed + 0 no_show = 10 entries
  // Sum completed: 55+55+55+55+60+55+55+60+55+55 = 560,000
  // ==========================================
  { id: 25, clientId: 13, barberId: 1, service: 'Corte + Barba', date: '2026-02-26', amount: 55000, rating: 5, notes: 'Trajo 2 empleados también', status: 'completed' },
  { id: 26, clientId: 13, barberId: 1, service: 'Corte + Barba', date: '2026-02-12', amount: 55000, rating: 5, notes: '', status: 'completed' },
  { id: 27, clientId: 13, barberId: 1, service: 'Corte + Barba', date: '2026-01-28', amount: 55000, rating: 4, notes: '', status: 'completed' },
  { id: 65, clientId: 13, barberId: 1, service: 'Corte + Barba', date: '2026-01-14', amount: 55000, rating: 5, notes: '', status: 'completed' },
  { id: 66, clientId: 13, barberId: 1, service: 'Corte + Barba + Cejas', date: '2025-12-30', amount: 60000, rating: 5, notes: 'Fin de año', status: 'completed' },
  { id: 168, clientId: 13, barberId: 1, service: 'Corte + Barba', date: '2025-12-15', amount: 55000, rating: 5, notes: '', status: 'completed' },
  { id: 169, clientId: 13, barberId: 1, service: 'Corte + Barba', date: '2025-11-30', amount: 55000, rating: 5, notes: 'Empleados también', status: 'completed' },
  { id: 170, clientId: 13, barberId: 1, service: 'Corte + Barba + Cejas', date: '2025-11-15', amount: 60000, rating: 5, notes: '', status: 'completed' },
  { id: 171, clientId: 13, barberId: 1, service: 'Corte + Barba', date: '2025-10-30', amount: 55000, rating: 4, notes: '', status: 'completed' },
  { id: 172, clientId: 13, barberId: 1, service: 'Corte + Barba', date: '2025-10-15', amount: 55000, rating: 5, notes: '', status: 'completed' },

  // ==========================================
  // Mateo Gómez Plata (id: 14) - Inactivo
  // 3 completed + 0 no_show + 1 cancelled = 4 entries (only 3 count as visits)
  // Sum completed: 45+45+40 = 130,000
  // ==========================================
  { id: 67, clientId: 14, barberId: 3, service: 'Corte + Cejas', date: '2025-12-20', amount: 45000, rating: 4, notes: '', status: 'completed' },
  { id: 68, clientId: 14, barberId: 3, service: 'Corte + Cejas', date: '2025-11-18', amount: 45000, rating: 4, notes: '', status: 'completed' },
  { id: 69, clientId: 14, barberId: 3, service: 'Corte + Cejas', date: '2025-10-20', amount: 45000, rating: null, notes: '', status: 'cancelled' },
  { id: 70, clientId: 14, barberId: 3, service: 'Corte Hipster', date: '2025-10-01', amount: 40000, rating: 5, notes: 'Primera visita', status: 'completed' },

  // ==========================================
  // Ricardo Uribe (id: 15) - VIP
  // 10 completed + 0 no_show = 10 entries
  // Sum completed: 55+55+60+55+55+55+55+60+55+55 = 560,000
  // ==========================================
  { id: 28, clientId: 15, barberId: 5, service: 'Corte + Barba', date: '2026-02-23', amount: 55000, rating: 5, notes: 'Mismo estilo de siempre', status: 'completed' },
  { id: 29, clientId: 15, barberId: 5, service: 'Corte + Barba', date: '2026-02-09', amount: 55000, rating: 5, notes: '', status: 'completed' },
  { id: 30, clientId: 15, barberId: 5, service: 'Corte + Barba + Cejas', date: '2026-01-26', amount: 60000, rating: 4, notes: '', status: 'completed' },
  { id: 71, clientId: 15, barberId: 5, service: 'Corte + Barba', date: '2026-01-12', amount: 55000, rating: 5, notes: '', status: 'completed' },
  { id: 72, clientId: 15, barberId: 5, service: 'Corte + Barba', date: '2025-12-28', amount: 55000, rating: 5, notes: '', status: 'completed' },
  { id: 173, clientId: 15, barberId: 5, service: 'Corte + Barba', date: '2025-12-14', amount: 55000, rating: 5, notes: '', status: 'completed' },
  { id: 174, clientId: 15, barberId: 5, service: 'Corte + Barba', date: '2025-11-29', amount: 55000, rating: 5, notes: '', status: 'completed' },
  { id: 175, clientId: 15, barberId: 5, service: 'Corte + Barba + Cejas', date: '2025-11-14', amount: 60000, rating: 4, notes: '', status: 'completed' },
  { id: 176, clientId: 15, barberId: 5, service: 'Corte + Barba', date: '2025-10-30', amount: 55000, rating: 5, notes: '', status: 'completed' },
  { id: 177, clientId: 15, barberId: 5, service: 'Corte + Barba', date: '2025-10-15', amount: 55000, rating: 5, notes: '', status: 'completed' },

  // ==========================================
  // Esteban Capacho (id: 16) - Activo
  // 8 completed + 0 no_show = 8 entries
  // Sum completed: 60+15+60+40+60+15+60+40 = 350,000
  // ==========================================
  { id: 31, clientId: 16, barberId: 10, service: 'Lifting de Pestañas', date: '2026-02-10', amount: 60000, rating: 5, notes: 'Mechas cobrizas', status: 'completed' },
  { id: 32, clientId: 16, barberId: 10, service: 'Limpieza Facial', date: '2026-01-20', amount: 15000, rating: 4, notes: '', status: 'completed' },
  { id: 73, clientId: 16, barberId: 10, service: 'Lifting de Pestañas', date: '2025-12-15', amount: 60000, rating: 5, notes: '', status: 'completed' },
  { id: 74, clientId: 16, barberId: 10, service: 'Crioterapia', date: '2025-11-20', amount: 40000, rating: 4, notes: '', status: 'completed' },
  { id: 178, clientId: 16, barberId: 10, service: 'Lifting de Pestañas', date: '2025-10-18', amount: 60000, rating: 5, notes: '', status: 'completed' },
  { id: 179, clientId: 16, barberId: 10, service: 'Limpieza Facial', date: '2025-09-12', amount: 15000, rating: 4, notes: '', status: 'completed' },
  { id: 180, clientId: 16, barberId: 10, service: 'Lifting de Pestañas', date: '2025-08-05', amount: 60000, rating: 5, notes: '', status: 'completed' },
  { id: 181, clientId: 16, barberId: 10, service: 'Crioterapia', date: '2025-06-28', amount: 40000, rating: 4, notes: '', status: 'completed' },

  // ==========================================
  // Brayan Cáceres (id: 17) - Nuevo, 1 visit
  // 1 completed = 1 entry. Sum: 40,000
  // ==========================================
  { id: 75, clientId: 17, barberId: 6, service: 'Corte Hipster', date: '2026-02-20', amount: 40000, rating: 4, notes: 'Primera visita, lo trajo un amigo', status: 'completed' },

  // ==========================================
  // Laura Valentina Pico (id: 18) - Nuevo, 1 visit
  // 1 completed = 1 entry. Sum: 75,000
  // ==========================================
  { id: 76, clientId: 18, barberId: 10, service: 'Lifting de Pestañas con Pigmento', date: '2026-02-15', amount: 75000, rating: 5, notes: 'Encantada con el resultado', status: 'completed' },

  // ==========================================
  // Fabián Capacho (id: 19) - En Riesgo
  // 8 completed + 2 no_show = 10 entries
  // Sum completed: 55+55+55+40+55+40+45+55 = 400,000
  // ==========================================
  { id: 77, clientId: 19, barberId: 7, service: 'Corte + Barba', date: '2026-01-08', amount: 55000, rating: 4, notes: '', status: 'completed' },
  { id: 78, clientId: 19, barberId: 7, service: 'Corte + Barba', date: '2025-12-05', amount: 55000, rating: 4, notes: '', status: 'completed' },
  { id: 79, clientId: 19, barberId: 7, service: 'Corte + Barba', date: '2025-11-01', amount: 55000, rating: 3, notes: '', status: 'completed' },
  { id: 80, clientId: 19, barberId: 7, service: 'Corte + Barba', date: '2025-09-28', amount: 55000, rating: null, notes: 'No vino', status: 'no_show' },
  { id: 81, clientId: 19, barberId: 7, service: 'Corte Hipster', date: '2025-08-20', amount: 40000, rating: 4, notes: '', status: 'completed' },
  { id: 182, clientId: 19, barberId: 7, service: 'Corte + Barba', date: '2025-09-05', amount: 55000, rating: null, notes: 'No vino, estaba trabajando', status: 'no_show' },
  { id: 183, clientId: 19, barberId: 7, service: 'Corte + Barba', date: '2025-07-20', amount: 55000, rating: 4, notes: '', status: 'completed' },
  { id: 184, clientId: 19, barberId: 7, service: 'Corte Hipster', date: '2025-06-15', amount: 40000, rating: 4, notes: 'Primera visita', status: 'completed' },
  { id: 185, clientId: 19, barberId: 7, service: 'Corte + Cejas', date: '2025-10-15', amount: 45000, rating: 4, notes: '', status: 'completed' },
  { id: 220, clientId: 19, barberId: 7, service: 'Corte + Barba', date: '2025-07-01', amount: 55000, rating: 4, notes: 'Aprovechó día libre', status: 'completed' },

  // ==========================================
  // Jhon Fredy Blanco (id: 20) - En Riesgo
  // 10 completed + 1 no_show + 1 cancelled = 12 entries (11 count as visits)
  // Sum completed: 55+55+55+40+55+55+40+55+40+55 = 505,000
  // ==========================================
  { id: 82, clientId: 20, barberId: 2, service: 'Corte + Barba', date: '2026-01-06', amount: 55000, rating: 4, notes: '', status: 'completed' },
  { id: 83, clientId: 20, barberId: 2, service: 'Corte + Barba', date: '2025-12-02', amount: 55000, rating: 4, notes: '', status: 'completed' },
  { id: 84, clientId: 20, barberId: 2, service: 'Corte + Barba', date: '2025-10-28', amount: 55000, rating: 5, notes: '', status: 'completed' },
  { id: 85, clientId: 20, barberId: 2, service: 'Corte Hipster', date: '2025-09-15', amount: 40000, rating: 4, notes: '', status: 'completed' },
  { id: 86, clientId: 20, barberId: 2, service: 'Corte + Barba', date: '2025-08-10', amount: 55000, rating: null, notes: 'Canceló por turno de taxi', status: 'cancelled' },
  { id: 186, clientId: 20, barberId: 2, service: 'Corte + Barba', date: '2025-07-08', amount: 55000, rating: 4, notes: '', status: 'completed' },
  { id: 187, clientId: 20, barberId: 2, service: 'Corte Hipster', date: '2025-06-05', amount: 40000, rating: 5, notes: '', status: 'completed' },
  { id: 188, clientId: 20, barberId: 2, service: 'Corte + Barba', date: '2025-05-02', amount: 55000, rating: 4, notes: '', status: 'completed' },
  { id: 189, clientId: 20, barberId: 2, service: 'Corte Hipster', date: '2025-04-10', amount: 40000, rating: 4, notes: 'Primera visita', status: 'completed' },
  { id: 190, clientId: 20, barberId: 2, service: 'Corte + Barba', date: '2025-11-05', amount: 55000, rating: 4, notes: '', status: 'completed' },
  { id: 191, clientId: 20, barberId: 2, service: 'Corte + Barba', date: '2025-08-25', amount: 55000, rating: null, notes: 'No vino', status: 'no_show' },
  { id: 221, clientId: 20, barberId: 2, service: 'Corte + Barba', date: '2025-09-01', amount: 55000, rating: 4, notes: '', status: 'completed' },

  // ==========================================
  // Edwin Toloza (id: 21) - En Riesgo
  // 7 completed + 0 no_show = 7 entries
  // Sum completed: 45+45+45+40+45+45+40 = 305,000
  // ==========================================
  { id: 87, clientId: 21, barberId: 4, service: 'Corte + Cejas', date: '2026-01-03', amount: 45000, rating: 4, notes: '', status: 'completed' },
  { id: 88, clientId: 21, barberId: 4, service: 'Corte + Cejas', date: '2025-12-01', amount: 45000, rating: 5, notes: '', status: 'completed' },
  { id: 89, clientId: 21, barberId: 4, service: 'Corte + Cejas', date: '2025-10-25', amount: 45000, rating: 4, notes: '', status: 'completed' },
  { id: 90, clientId: 21, barberId: 4, service: 'Corte Hipster', date: '2025-09-18', amount: 40000, rating: 4, notes: '', status: 'completed' },
  { id: 192, clientId: 21, barberId: 4, service: 'Corte + Cejas', date: '2025-11-15', amount: 45000, rating: 5, notes: '', status: 'completed' },
  { id: 193, clientId: 21, barberId: 4, service: 'Corte + Cejas', date: '2025-10-08', amount: 45000, rating: 4, notes: '', status: 'completed' },
  { id: 194, clientId: 21, barberId: 4, service: 'Corte Hipster', date: '2025-08-20', amount: 40000, rating: 4, notes: 'Primera visita', status: 'completed' },

  // ==========================================
  // Oscar Jaimes (id: 22) - Inactivo
  // 6 completed + 1 no_show = 7 entries (reduced from 8)
  // Sum completed: 40+40+40+40+40+40 = 240,000
  // ==========================================
  { id: 91, clientId: 22, barberId: 6, service: 'Corte Hipster', date: '2025-12-15', amount: 40000, rating: 4, notes: 'Vino con el hijo', status: 'completed' },
  { id: 92, clientId: 22, barberId: 6, service: 'Corte Hipster', date: '2025-11-10', amount: 40000, rating: 4, notes: '', status: 'completed' },
  { id: 93, clientId: 22, barberId: 6, service: 'Corte Hipster', date: '2025-10-05', amount: 40000, rating: null, notes: '', status: 'no_show' },
  { id: 94, clientId: 22, barberId: 6, service: 'Corte Hipster', date: '2025-08-28', amount: 40000, rating: 5, notes: '', status: 'completed' },
  { id: 195, clientId: 22, barberId: 6, service: 'Corte Hipster', date: '2025-07-15', amount: 40000, rating: 4, notes: '', status: 'completed' },
  { id: 196, clientId: 22, barberId: 6, service: 'Corte Hipster', date: '2025-05-28', amount: 40000, rating: 4, notes: '', status: 'completed' },
  { id: 197, clientId: 22, barberId: 6, service: 'Corte Hipster', date: '2025-03-10', amount: 40000, rating: 5, notes: 'Primera visita', status: 'completed' },

  // ==========================================
  // Karen Amaya (id: 23) - Inactivo
  // 5 completed + 0 no_show + 1 cancelled = 6 entries (5 count as visits)
  // Sum completed: 50+50+75+50+50 = 275,000
  // ==========================================
  { id: 95, clientId: 23, barberId: 14, service: 'Semipermanente Manicure', date: '2025-12-01', amount: 50000, rating: 5, notes: 'Tonos pastel navideños', status: 'completed' },
  { id: 96, clientId: 23, barberId: 14, service: 'Semipermanente Manicure', date: '2025-10-28', amount: 50000, rating: 5, notes: '', status: 'completed' },
  { id: 97, clientId: 23, barberId: 14, service: 'Semi Mani + Pedi Tradicional', date: '2025-09-20', amount: 75000, rating: 4, notes: '', status: 'completed' },
  { id: 98, clientId: 23, barberId: 14, service: 'Semipermanente Manicure', date: '2025-08-15', amount: 50000, rating: null, notes: 'Canceló por lluvia', status: 'cancelled' },
  { id: 198, clientId: 23, barberId: 14, service: 'Semipermanente Manicure', date: '2025-08-10', amount: 50000, rating: 5, notes: '', status: 'completed' },
  { id: 199, clientId: 23, barberId: 14, service: 'Semipermanente Manicure', date: '2025-07-05', amount: 50000, rating: 4, notes: 'Primera visita', status: 'completed' },

  // ==========================================
  // Wilmer Quintero (id: 24) - Inactivo
  // 3 completed + 2 no_show = 5 entries
  // Sum completed: 40+40+40 = 120,000
  // ==========================================
  { id: 99, clientId: 24, barberId: 3, service: 'Corte Hipster', date: '2025-11-20', amount: 40000, rating: 3, notes: '', status: 'completed' },
  { id: 100, clientId: 24, barberId: 3, service: 'Corte Hipster', date: '2025-09-15', amount: 40000, rating: 4, notes: '', status: 'completed' },
  { id: 101, clientId: 24, barberId: 3, service: 'Corte Hipster', date: '2025-07-22', amount: 40000, rating: 4, notes: '', status: 'completed' },
  { id: 200, clientId: 24, barberId: 3, service: 'Corte Hipster', date: '2025-10-18', amount: 40000, rating: null, notes: 'No contestó confirmar', status: 'no_show' },
  { id: 201, clientId: 24, barberId: 3, service: 'Corte Hipster', date: '2025-06-10', amount: 40000, rating: null, notes: '', status: 'no_show' },

  // ==========================================
  // Robinson Patiño (id: 25) - Inactivo
  // 3 completed + 1 no_show + 1 cancelled = 5 entries (4 count as visits)
  // Sum completed: 55+55+40 = 150,000
  // ==========================================
  { id: 102, clientId: 25, barberId: 8, service: 'Corte + Barba', date: '2025-12-25', amount: 55000, rating: 4, notes: 'Aprovechó vacaciones', status: 'completed' },
  { id: 103, clientId: 25, barberId: 8, service: 'Corte + Barba', date: '2025-11-08', amount: 55000, rating: 4, notes: '', status: 'completed' },
  { id: 104, clientId: 25, barberId: 8, service: 'Corte + Barba', date: '2025-10-01', amount: 55000, rating: null, notes: 'Canceló por viaje de trabajo', status: 'cancelled' },
  { id: 105, clientId: 25, barberId: 8, service: 'Corte Hipster', date: '2025-09-01', amount: 40000, rating: 5, notes: 'Primera visita', status: 'completed' },
  { id: 202, clientId: 25, barberId: 8, service: 'Corte + Barba', date: '2025-10-20', amount: 55000, rating: null, notes: 'No vino', status: 'no_show' },

  // ==========================================
  // Yesid Mantilla (id: 26) - Activo
  // 8 completed + 0 no_show = 8 entries
  // Sum completed: 45+45+45+55+45+45+55+45 = 380,000
  // ==========================================
  { id: 106, clientId: 26, barberId: 4, service: 'Corte + Cejas', date: '2026-02-22', amount: 45000, rating: 5, notes: '', status: 'completed' },
  { id: 107, clientId: 26, barberId: 4, service: 'Corte + Cejas', date: '2026-01-19', amount: 45000, rating: 4, notes: '', status: 'completed' },
  { id: 108, clientId: 26, barberId: 4, service: 'Corte + Cejas', date: '2025-12-15', amount: 45000, rating: 5, notes: '', status: 'completed' },
  { id: 109, clientId: 26, barberId: 4, service: 'Corte + Barba', date: '2025-11-10', amount: 55000, rating: 4, notes: '', status: 'completed' },
  { id: 203, clientId: 26, barberId: 4, service: 'Corte + Cejas', date: '2025-10-05', amount: 45000, rating: 5, notes: '', status: 'completed' },
  { id: 204, clientId: 26, barberId: 4, service: 'Corte + Cejas', date: '2025-09-01', amount: 45000, rating: 4, notes: '', status: 'completed' },
  { id: 205, clientId: 26, barberId: 4, service: 'Corte + Barba', date: '2025-08-01', amount: 55000, rating: 4, notes: '', status: 'completed' },
  { id: 206, clientId: 26, barberId: 4, service: 'Corte + Cejas', date: '2025-07-01', amount: 45000, rating: 5, notes: 'Primera visita', status: 'completed' },

  // ==========================================
  // Daniela Rueda (id: 27) - Activo
  // 7 completed + 0 no_show = 7 entries
  // Sum completed: 75+50+75+50+75+50+50 = 425,000
  // ==========================================
  { id: 110, clientId: 27, barberId: 13, service: 'Semi Mani + Pedi Tradicional', date: '2026-02-18', amount: 75000, rating: 5, notes: 'Vino con la amiga', status: 'completed' },
  { id: 111, clientId: 27, barberId: 13, service: 'Semipermanente Manicure', date: '2026-01-22', amount: 50000, rating: 5, notes: '', status: 'completed' },
  { id: 112, clientId: 27, barberId: 13, service: 'Semi Mani + Pedi Tradicional', date: '2025-12-18', amount: 75000, rating: 4, notes: 'Diseño navideño', status: 'completed' },
  { id: 113, clientId: 27, barberId: 13, service: 'Semipermanente Manicure', date: '2025-11-15', amount: 50000, rating: 5, notes: '', status: 'completed' },
  { id: 207, clientId: 27, barberId: 13, service: 'Semi Mani + Pedi Tradicional', date: '2025-10-18', amount: 75000, rating: 5, notes: '', status: 'completed' },
  { id: 208, clientId: 27, barberId: 13, service: 'Semipermanente Manicure', date: '2025-10-01', amount: 50000, rating: 4, notes: '', status: 'completed' },
  { id: 209, clientId: 27, barberId: 13, service: 'Semipermanente Manicure', date: '2025-09-15', amount: 50000, rating: 5, notes: 'Primera visita', status: 'completed' },

  // ==========================================
  // Harold Pineda (id: 28) - Activo
  // 7 completed + 0 no_show = 7 entries
  // Sum completed: 55+55+55+40+55+55+55 = 370,000
  // ==========================================
  { id: 114, clientId: 28, barberId: 1, service: 'Corte + Barba', date: '2026-02-25', amount: 55000, rating: 5, notes: 'Corte reglamentario', status: 'completed' },
  { id: 115, clientId: 28, barberId: 1, service: 'Corte + Barba', date: '2026-02-10', amount: 55000, rating: 5, notes: '', status: 'completed' },
  { id: 116, clientId: 28, barberId: 1, service: 'Corte + Barba', date: '2026-01-25', amount: 55000, rating: 4, notes: '', status: 'completed' },
  { id: 117, clientId: 28, barberId: 1, service: 'Corte Hipster', date: '2025-12-20', amount: 40000, rating: 4, notes: '', status: 'completed' },
  { id: 210, clientId: 28, barberId: 1, service: 'Corte + Barba', date: '2025-12-05', amount: 55000, rating: 5, notes: '', status: 'completed' },
  { id: 211, clientId: 28, barberId: 1, service: 'Corte + Barba', date: '2025-11-18', amount: 55000, rating: 4, notes: '', status: 'completed' },
  { id: 212, clientId: 28, barberId: 1, service: 'Corte + Barba', date: '2025-10-10', amount: 55000, rating: 5, notes: 'Primera visita', status: 'completed' },

  // ==========================================
  // Luis Fernando Guarín (id: 29) - Activo
  // 9 completed + 0 no_show = 9 entries
  // Sum completed: 55+55+55+60+55+55+55+55+55 = 500,000
  // ==========================================
  { id: 118, clientId: 29, barberId: 7, service: 'Corte + Barba', date: '2026-02-12', amount: 55000, rating: 5, notes: 'Puntual como siempre', status: 'completed' },
  { id: 119, clientId: 29, barberId: 7, service: 'Corte + Barba', date: '2026-01-28', amount: 55000, rating: 5, notes: '', status: 'completed' },
  { id: 120, clientId: 29, barberId: 7, service: 'Corte + Barba', date: '2026-01-14', amount: 55000, rating: 4, notes: '', status: 'completed' },
  { id: 121, clientId: 29, barberId: 7, service: 'Corte + Barba + Cejas', date: '2025-12-28', amount: 60000, rating: 5, notes: '', status: 'completed' },
  { id: 122, clientId: 29, barberId: 7, service: 'Corte + Barba', date: '2025-12-12', amount: 55000, rating: 5, notes: '', status: 'completed' },
  { id: 213, clientId: 29, barberId: 7, service: 'Corte + Barba', date: '2025-11-25', amount: 55000, rating: 5, notes: '', status: 'completed' },
  { id: 214, clientId: 29, barberId: 7, service: 'Corte + Barba', date: '2025-11-08', amount: 55000, rating: 4, notes: '', status: 'completed' },
  { id: 215, clientId: 29, barberId: 7, service: 'Corte + Barba', date: '2025-10-22', amount: 55000, rating: 5, notes: '', status: 'completed' },
  { id: 216, clientId: 29, barberId: 7, service: 'Corte + Barba', date: '2025-10-05', amount: 55000, rating: 5, notes: '', status: 'completed' },

  // ==========================================
  // Cristian Ordóñez (id: 30) - Activo
  // 5 completed + 1 no_show = 6 entries
  // Sum completed: 55+55+55+40+45 = 250,000
  // ==========================================
  { id: 123, clientId: 30, barberId: 6, service: 'Corte + Barba', date: '2026-02-19', amount: 55000, rating: 5, notes: 'Diseño tribal nuevo', status: 'completed' },
  { id: 124, clientId: 30, barberId: 6, service: 'Corte + Barba', date: '2026-01-22', amount: 55000, rating: 4, notes: '', status: 'completed' },
  { id: 125, clientId: 30, barberId: 6, service: 'Corte + Barba', date: '2025-12-18', amount: 55000, rating: 5, notes: '', status: 'completed' },
  { id: 126, clientId: 30, barberId: 6, service: 'Corte Hipster', date: '2025-11-20', amount: 40000, rating: 4, notes: '', status: 'completed' },
  { id: 127, clientId: 30, barberId: 6, service: 'Corte + Cejas', date: '2025-11-05', amount: 45000, rating: 4, notes: 'Primera visita', status: 'completed' },
  { id: 217, clientId: 30, barberId: 6, service: 'Corte + Barba', date: '2026-01-02', amount: 55000, rating: null, notes: 'No vino, resaca de año nuevo', status: 'no_show' },
];

export const mockNotifications = [
  { id: 1, message: 'Carlos Mendoza confirmó su cita con Victor Fernández para mañana a las 10:00', type: 'success', time: 'Hace 5 min' },
  { id: 2, message: '3 clientes llevan más de 30 días sin visitar', type: 'warning', time: 'Hace 1 hora' },
  { id: 3, message: 'Campaña de WhatsApp enviada a 248 clientes', type: 'info', time: 'Hace 3 horas' },
  { id: 4, message: 'David López agendó Spa Manicure con Josemith para el viernes', type: 'success', time: 'Hace 4 horas' },
  { id: 5, message: 'Nuevo cliente registrado: Esteban Capacho León', type: 'info', time: 'Ayer' },
  { id: 6, message: 'Felipe Ardila no ha vuelto en 90 días', type: 'warning', time: 'Ayer' },
  { id: 7, message: 'Meta mensual alcanzada: $4.200.000 en ingresos', type: 'success', time: 'Hace 2 días' },
];
