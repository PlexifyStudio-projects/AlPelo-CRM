// ============================================
// AlPelo CRM - Mock Data v5.0
// Comprehensive dataset synced from Weibook
// Real data from AlPelo Peluquería, Bucaramanga
// 30 clients, 20 staff, 45+ services, ~217 visit history entries
// Services/staff/ratings synced from book.weibook.co/alpelo-peluqueria
// totalSpent = sum of completed visit amounts
// totalVisits = count of completed + no_show entries
// loyaltyPoints = Math.round(totalSpent / 1000)
// ============================================

// ============================================
// Business info — synced from Weibook (book.weibook.co/alpelo-peluqueria)
// ============================================
export const mockBusinessInfo = {
  name: 'ALPELO PELUQUERÍA',
  address: 'Carrera 31 N 50-21, Bucaramanga, Colombia',
  phone: '3176608487',
  rating: 5.0,
  description: 'Descubre la excelencia en AlPelo! Nuestra peluquería en Bucaramanga cuenta con expertos en peluquería, manicure y barbería.',
  bookingUrl: 'https://book.weibook.co/alpelo-peluqueria',
  hours: {
    weekdays: { open: '8:15 AM', close: '8:00 PM' },
    saturday: { open: '8:15 AM', close: '8:00 PM' },
    sunday: { open: '9:30 AM', close: '2:00 PM' },
  },
  categories: ['Barbería', 'Salón de Belleza', 'Uñas', 'Spa'],
  payment: {
    nequi: '3163249763',
    breve: '13741241',
    bancolombia: '912-289228-17',
    davivienda: '0478-7003-0302',
  },
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
    clientId: 'M20201',
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
    clientId: 'M20202',
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
    clientId: 'M20203',
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
    clientId: 'M20204',
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
    clientId: 'M20205',
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
    clientId: 'M20206',
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
    clientId: 'M20207',
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
    clientId: 'M20208',
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
    clientId: 'M20209',
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
    clientId: 'M20210',
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
    clientId: 'M20211',
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
    clientId: 'M20212',
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
    clientId: 'M20213',
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
    clientId: 'M20214',
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
    clientId: 'M20215',
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
    clientId: 'M20216',
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
    clientId: 'M20217',
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
    clientId: 'M20218',
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
    clientId: 'M20219',
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
    clientId: 'M20220',
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
    clientId: 'M20221',
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
    clientId: 'M20222',
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
    clientId: 'M20223',
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
    clientId: 'M20224',
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
    clientId: 'M20225',
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
    clientId: 'M20226',
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
    clientId: 'M20227',
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
    clientId: 'M20228',
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
    clientId: 'M20229',
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
    clientId: 'M20230',
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

// ============================================
// Staff — ratings synced from Weibook (book.weibook.co/alpelo-peluqueria)
// ============================================
export const mockBarbers = [
  // Barberos
  { id: 1, name: 'Victor Fernández', specialty: 'Barbero', available: true, rating: 4.85, totalClients: 120, phone: '+57 316 452 8901', email: 'victor.fernandez@alpelo.co', hireDate: '2022-03-15', bio: 'Barbero senior con más de 8 años de experiencia. Especialista en cortes clásicos y modernos con acabados impecables.' },
  { id: 2, name: 'Alexander Carballo', specialty: 'Barbero', available: true, rating: 4.9, totalClients: 95, phone: '+57 310 789 3456', email: 'alexander.carballo@alpelo.co', hireDate: '2022-06-01', bio: 'Apasionado por las tendencias urbanas y los degradados. Siempre buscando la perfección en cada detalle.' },
  { id: 3, name: 'Daniel Núñez', specialty: 'Barbero', available: false, rating: 4.71, totalClients: 78, phone: '+57 315 234 6789', email: 'daniel.nunez@alpelo.co', hireDate: '2023-01-10', bio: 'Creativo y detallista, experto en diseños personalizados y cortes de tendencia internacional.' },
  { id: 4, name: 'Ángel Pabón', specialty: 'Barbero', available: true, rating: 5.0, totalClients: 65, phone: '+57 318 567 1234', email: 'angel.pabon@alpelo.co', hireDate: '2023-04-20', bio: 'Conocido por su precisión y trato excepcional. Cada cliente sale con una experiencia premium.' },
  { id: 5, name: 'Anderson Bohórquez', specialty: 'Barbero', available: true, rating: 4.5, totalClients: 55, phone: '+57 312 890 4567', email: 'anderson.bohorquez@alpelo.co', hireDate: '2023-08-15', bio: 'Joven talento con gran habilidad en cortes modernos y técnicas de texturizado.' },
  { id: 6, name: 'Camilo Gutiérrez', specialty: 'Barbero', available: true, rating: 4.7, totalClients: 70, phone: '+57 317 123 7890', email: 'camilo.gutierrez@alpelo.co', hireDate: '2023-02-01', bio: 'Versátil y carismático. Domina tanto el estilo clásico como las tendencias más actuales.' },
  { id: 7, name: 'Yhon Estrada', specialty: 'Barbero', available: true, rating: 5.0, totalClients: 60, phone: '+57 314 456 2345', email: 'yhon.estrada@alpelo.co', hireDate: '2023-06-10', bio: 'Perfeccionista nato con un ojo artístico para los degradados y acabados limpios.' },
  { id: 8, name: 'Astrid Carolina León', specialty: 'Barbera', available: true, rating: null, totalClients: 45, phone: '+57 311 678 5678', email: 'astrid.leon@alpelo.co', hireDate: '2024-01-15', bio: 'Pionera en barbería femenina en la región. Combina técnica y sensibilidad artística.' },
  { id: 9, name: 'Tatiana', specialty: 'Barbera', available: true, rating: null, totalClients: 40, phone: '+57 319 901 8901', email: 'tatiana@alpelo.co', hireDate: '2024-03-01', bio: 'Especialista en cortes unisex con enfoque en la comodidad y estilo del cliente.' },
  // Estilistas
  { id: 10, name: 'Josemith', specialty: 'Estilista - Especialista en color', available: true, rating: 5.0, totalClients: 110, phone: '+57 316 234 1234', email: 'josemith@alpelo.co', hireDate: '2022-01-10', bio: 'Más de 10 años de experiencia en técnicas innovadoras de color. Transforma el cabello con técnicas de vanguardia.' },
  { id: 11, name: 'Liliana Gisella Romero', specialty: 'Estilista', available: true, rating: 4.57, totalClients: 80, phone: '+57 313 567 4567', email: 'liliana.romero@alpelo.co', hireDate: '2022-09-01', bio: 'Estilista integral con pasión por los cambios de look y la asesoría de imagen.' },
  { id: 12, name: 'Marcela Leal', specialty: 'Estilista - Tricoterapeuta', available: true, rating: 4.66, totalClients: 85, phone: '+57 310 890 7890', email: 'marcela.leal@alpelo.co', hireDate: '2022-07-15', bio: 'Tricoterapeuta especialista en recuperación capilar. Devuelve la vida al cabello dañado.' },
  { id: 19, name: 'Dulce Araque', specialty: 'Estilista', available: true, rating: 4.66, totalClients: 50, phone: '+57 315 901 3456', email: 'dulce.araque@alpelo.co', hireDate: '2023-10-01', bio: 'Estilista versátil con excelente ojo para el detalle y la armonía del look.' },
  { id: 20, name: 'Fanny Lizarazo', specialty: 'Estilista', available: true, rating: null, totalClients: 30, phone: '+57 318 234 6789', email: 'fanny.lizarazo@alpelo.co', hireDate: '2024-06-01', bio: 'Nueva integrante del equipo con formación en las últimas tendencias de estilismo.' },
  // Manicuristas
  { id: 13, name: 'Jazmín Aponte Montaño', specialty: 'Manicurista', available: true, rating: 4.92, totalClients: 90, phone: '+57 318 123 2345', email: 'jazmin.aponte@alpelo.co', hireDate: '2022-05-20', bio: 'Artista del nail art con técnicas avanzadas. Sus diseños son reconocidos en toda la ciudad.' },
  { id: 14, name: 'María José Bastos', specialty: 'Manicurista', available: true, rating: 5.0, totalClients: 75, phone: '+57 315 456 5678', email: 'mariajose.bastos@alpelo.co', hireDate: '2023-03-10', bio: 'Detallista y profesional. Especialista en técnicas de gel y acrílico de alta duración.' },
  { id: 15, name: 'Carolina Banderas', specialty: 'Manicurista', available: true, rating: 4.8, totalClients: 70, phone: '+57 312 789 8901', email: 'carolina.banderas@alpelo.co', hireDate: '2023-05-01', bio: 'Creativa y tendencia. Siempre actualizada con las últimas técnicas de manicure y pedicure.' },
  { id: 16, name: 'Nicole Serrano', specialty: 'Manicurista', available: false, rating: 4.66, totalClients: 50, phone: '+57 317 012 1234', email: 'nicole.serrano@alpelo.co', hireDate: '2023-09-15', bio: 'Profesional dedicada con excelente atención al cliente y acabados impecables.' },
  { id: 17, name: 'Zuleidy Yepes', specialty: 'Manicurista', available: true, rating: 4.33, totalClients: 35, phone: '+57 314 345 4567', email: 'zuleidy.yepes@alpelo.co', hireDate: '2024-02-01', bio: '3 años de experiencia en todas las técnicas. En constante formación y crecimiento.' },
  { id: 18, name: 'Stefanía Bustamante', specialty: 'Manicurista', available: true, rating: 4.5, totalClients: 40, phone: '+57 311 678 7890', email: 'stefania.bustamante@alpelo.co', hireDate: '2024-04-15', bio: 'Joven profesional con gran talento natural y pasión por la belleza de las manos.' },
];

// ============================================
// Services — synced from Weibook (book.weibook.co/alpelo-peluqueria)
// ============================================
export const mockServices = [
  // Barbería
  { id: 1, name: 'Corte Hipster', duration: 40, price: 40000, category: 'Barbería' },
  { id: 2, name: 'Corte y Cejas', duration: 40, price: 45000, category: 'Barbería' },
  { id: 3, name: 'Corte Dama', duration: 30, price: 45000, category: 'Barbería' },
  { id: 4, name: 'Corte y Barba', duration: 60, price: 55000, category: 'Barbería' },
  { id: 5, name: 'Corte Barba y Cejas', duration: 60, price: 60000, category: 'Barbería' },
  { id: 6, name: 'Barba Premium', duration: 35, price: 25000, category: 'Barbería' },
  { id: 7, name: 'Corte y Blower Combo', duration: 60, price: 90000, category: 'Barbería' },
  // Uñas - Tradicional
  { id: 10, name: 'Limpieza Manicure', duration: 15, price: 20000, category: 'Uñas' },
  { id: 11, name: 'Manicure Secado Rápido', duration: 30, price: 30000, category: 'Uñas' },
  { id: 12, name: 'Pedicure Trad. Secado Rápido', duration: 40, price: 30000, category: 'Uñas' },
  { id: 13, name: 'Manicure o Pedicure con Polichada', duration: 45, price: 30000, category: 'Uñas' },
  { id: 14, name: 'Combo Manicure + Pedicure Tradicional', duration: 80, price: 55000, category: 'Uñas' },
  // Uñas - Semipermanente
  { id: 20, name: 'Manicure Semipermanente', duration: 40, price: 50000, category: 'Uñas Semipermanente' },
  { id: 21, name: 'Pedicure Semipermanente', duration: 40, price: 50000, category: 'Uñas Semipermanente' },
  { id: 22, name: 'Manicure Semipermanente con Base Rubber', duration: 50, price: 60000, category: 'Uñas Semipermanente' },
  { id: 23, name: 'Combo Mani Semi + Pedi Tradicional', duration: 90, price: 75000, category: 'Uñas Semipermanente' },
  { id: 24, name: 'Combo Mani y Pedi Semipermanente', duration: 90, price: 95000, category: 'Uñas Semipermanente' },
  // Uñas - Spa
  { id: 30, name: 'Spa Manicure Tradicional', duration: 60, price: 50000, category: 'Uñas Spa' },
  { id: 31, name: 'Pedi Spa Tradicional', duration: 60, price: 65000, category: 'Uñas Spa' },
  { id: 32, name: 'Spa Manicure Semi Permanente', duration: 70, price: 70000, category: 'Uñas Spa' },
  { id: 33, name: 'Pedi Spa Semi Permanente', duration: 60, price: 85000, category: 'Uñas Spa' },
  // Uñas - Otros
  { id: 35, name: 'Reparación de Uña Press On', duration: 10, price: 12000, category: 'Uñas' },
  { id: 36, name: 'Retiro Higiene de Press On Insumos', duration: 15, price: 15000, category: 'Uñas' },
  // Tratamientos Capilares
  { id: 40, name: 'Cepillado Básico', duration: 15, price: 20000, category: 'Tratamientos' },
  { id: 41, name: 'Tratamiento Alta Frecuencia', duration: 20, price: 25000, category: 'Tratamientos' },
  { id: 42, name: 'Aplicación Matizante (Cliente Trae Producto)', duration: 20, price: 25000, category: 'Tratamientos' },
  { id: 43, name: 'Crioterapia Solo Plancha', duration: 60, price: 40000, category: 'Tratamientos' },
  { id: 44, name: 'Blower Medio', duration: 50, price: 55000, category: 'Tratamientos' },
  { id: 45, name: 'Tratamiento Express', duration: 30, price: 60000, category: 'Tratamientos' },
  { id: 46, name: 'Tratamiento Masocapiloterapia', duration: 30, price: 60000, category: 'Tratamientos' },
  { id: 47, name: 'Tratamiento de Nutrición o Reconstrucción', duration: 30, price: 70000, category: 'Tratamientos' },
  { id: 48, name: 'Tratamiento Scalp Protector', duration: 25, price: 70000, category: 'Tratamientos' },
  { id: 49, name: 'Crioterapia con Tratamiento', duration: 25, price: 100000, category: 'Tratamientos' },
  { id: 50, name: 'Tratamiento Capilar Fango Detox con Cepillado', duration: 60, price: 120000, category: 'Tratamientos' },
  { id: 51, name: 'Tratamiento Spa Coreano Revitalizante', duration: 40, price: 120000, category: 'Tratamientos' },
  { id: 52, name: 'Tratamiento Post Color', duration: 15, price: 0, category: 'Tratamientos' },
  // Facial / Belleza
  { id: 60, name: 'Limpieza Facial', duration: 20, price: 15000, category: 'Facial' },
  { id: 61, name: 'Pestañas de Punto', duration: 20, price: 40000, category: 'Facial' },
  { id: 62, name: 'Lifting de Pestañas', duration: 45, price: 60000, category: 'Facial' },
  { id: 63, name: 'Lifting de Pestañas con Pigmento', duration: 60, price: 75000, category: 'Facial' },
  { id: 64, name: 'Laminado de Cejas con Pigmento', duration: 45, price: 75000, category: 'Facial' },
  // Otro
  { id: 70, name: 'Abono Servicio', duration: 0, price: 50000, category: 'Otro' },
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
  { id: 13, clientId: 6, barberId: 4, service: 'Corte + Barba', date: '2026-03-02', time: '09:00', status: 'confirmed' },
  { id: 14, clientId: 9, barberId: 2, service: 'Corte + Cejas', date: '2026-03-02', time: '11:00', status: 'confirmed' },
  { id: 15, clientId: 15, barberId: 13, service: 'Semipermanente Manicure', date: '2026-03-02', time: '10:30', status: 'pending' },
  { id: 16, clientId: 3, barberId: 1, service: 'Corte + Barba + Cejas', date: '2026-03-02', time: '14:00', status: 'confirmed' },
  { id: 17, clientId: 12, barberId: 6, service: 'Corte Hipster', date: '2026-03-02', time: '15:00', status: 'pending' },
  { id: 18, clientId: 5, barberId: 14, service: 'Spa Manicure', date: '2026-03-02', time: '16:00', status: 'confirmed' },
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
  // ==========================================
  // Marzo 2026 — Servicios completados
  // ==========================================
  { id: 219, clientId: 10, barberId: 5, service: 'Corte + Barba', date: '2026-03-01', amount: 55000, rating: 5, notes: '', status: 'completed' },
  { id: 220, clientId: 12, barberId: 13, service: 'Manicure + Pedicure Tradicional', date: '2026-03-01', amount: 55000, rating: 4, notes: '', status: 'completed' },
  { id: 221, clientId: 13, barberId: 1, service: 'Corte + Barba', date: '2026-03-01', amount: 55000, rating: 5, notes: 'Gran servicio', status: 'completed' },
  { id: 222, clientId: 15, barberId: 5, service: 'Corte + Barba', date: '2026-03-01', amount: 55000, rating: 5, notes: '', status: 'completed' },
  { id: 223, clientId: 6, barberId: 4, service: 'Corte + Barba', date: '2026-03-01', amount: 55000, rating: 4, notes: '', status: 'completed' },
  { id: 224, clientId: 16, barberId: 10, service: 'Lifting de Pestañas', date: '2026-03-01', amount: 60000, rating: 5, notes: 'Quedó encantada', status: 'completed' },
  { id: 225, clientId: 9, barberId: 2, service: 'Corte + Cejas', date: '2026-03-01', amount: 45000, rating: 5, notes: '', status: 'completed' },
  { id: 226, clientId: 7, barberId: 6, service: 'Corte Hipster', date: '2026-03-01', amount: 40000, rating: 4, notes: '', status: 'completed' },
  { id: 227, clientId: 1, barberId: 1, service: 'Corte + Barba', date: '2026-03-02', amount: 55000, rating: 5, notes: 'Como siempre, perfecto', status: 'completed' },
  { id: 228, clientId: 29, barberId: 7, service: 'Corte + Barba', date: '2026-03-01', amount: 55000, rating: 5, notes: '', status: 'completed' },
  { id: 229, clientId: 26, barberId: 8, service: 'Corte Hipster', date: '2026-03-01', amount: 40000, rating: 4, notes: '', status: 'completed' },
  { id: 230, clientId: 28, barberId: 14, service: 'Spa Manicure', date: '2026-03-01', amount: 50000, rating: 5, notes: 'Excelente atención', status: 'completed' },
  { id: 231, clientId: 27, barberId: 15, service: 'Semipermanente Manicure', date: '2026-03-01', amount: 50000, rating: 5, notes: '', status: 'completed' },
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

// ============================================
// WhatsApp Conversations
// ============================================
export const mockWhatsAppConversations = [
  // 1. ESTRELLA — Miguel Ángel (VIP): conversación completa mostrando a Lina en acción
  { id: 'conv-1', clientId: 3, clientName: 'Miguel Ángel Torres', phone: '+573005551234', lastMessage: 'Eres la mejor Lina, muchas gracias! 🙌', lastMessageTime: '2026-03-04T10:18:00', unreadCount: 0, status: 'active', lastMessageFrom: 'client' },
  // 2. Carlos Mendoza — Recordatorio + confirmación de cita
  { id: 'conv-2', clientId: 1, clientName: 'Carlos Mendoza', phone: '+573001234567', lastMessage: 'Listo, nos vemos mañana a las 10!', lastMessageTime: '2026-03-04T09:15:00', unreadCount: 0, status: 'active', lastMessageFrom: 'client' },
  // 3. Andrés Ruiz — Quiere reagendar, aún sin responder
  { id: 'conv-3', clientId: 2, clientName: 'Andrés Ruiz Parra', phone: '+573009876543', lastMessage: 'Ay, se me cruzó algo del trabajo. ¿Puedo pasar mejor el viernes?', lastMessageTime: '2026-03-04T08:50:00', unreadCount: 1, status: 'active', lastMessageFrom: 'client' },
  // 4. Emmanuel Rojas — Cliente nuevo preguntando precios
  { id: 'conv-4', clientId: 12, clientName: 'Emmanuel Rojas Díaz', phone: '+573009988776', lastMessage: 'Buenísimo, entonces agendo para el sábado!', lastMessageTime: '2026-03-04T08:30:00', unreadCount: 1, status: 'active', lastMessageFrom: 'client' },
  // 5. Nicolás Pabón — Feedback post-visita
  { id: 'conv-5', clientId: 9, clientName: 'Nicolás Pabón Serrano', phone: '+573002233445', lastMessage: 'Quedó brutal hermano, 10/10 🔥', lastMessageTime: '2026-03-03T16:20:00', unreadCount: 0, status: 'active', lastMessageFrom: 'client' },
  // 6. David López — Confirmó cita
  { id: 'conv-6', clientId: 5, clientName: 'David López Vargas', phone: '+573007778899', lastMessage: 'Listo, ahí estaré sin falta!', lastMessageTime: '2026-03-03T14:30:00', unreadCount: 0, status: 'active', lastMessageFrom: 'client' },
  // 7. Valentina Morales — Post lifting de pestañas
  { id: 'conv-7', clientId: 16, clientName: 'Valentina Morales Cruz', phone: '+573005566778', lastMessage: 'Me encantó! Quedaron divinas 😍', lastMessageTime: '2026-03-02T19:20:00', unreadCount: 0, status: 'active', lastMessageFrom: 'client' },
  // 8. Esteban Capacho — Cliente nuevo recomendado
  { id: 'conv-8', clientId: 17, clientName: 'Esteban Capacho León', phone: '+573007788990', lastMessage: 'Dale, perfecto. Nos vemos el jueves entonces!', lastMessageTime: '2026-03-02T15:10:00', unreadCount: 0, status: 'active', lastMessageFrom: 'client' },
  // 9. Juan Pablo Pérez — Recordatorio + confirmación
  {
    id: 'conv-9',
    clientId: 4,
    clientName: 'Juan Pablo Pérez',
    phone: '+573004443322',
    lastMessage: 'Listo, muchas gracias!',
    lastMessageTime: '2026-03-04T07:45:00',
    unreadCount: 0,
    status: 'active',
    lastMessageFrom: 'client',
  },
  // 10. Santiago Reyes — Seguimiento
  {
    id: 'conv-10',
    clientId: 6,
    clientName: 'Santiago Reyes Duarte',
    phone: '+573006112233',
    lastMessage: 'Bueno, ahí miro entonces',
    lastMessageTime: '2026-03-04T07:20:00',
    unreadCount: 0,
    status: 'active',
    lastMessageFrom: 'client',
  },
  // 11. Camilo Hernández — No-show seguimiento
  {
    id: 'conv-11',
    clientId: 7,
    clientName: 'Camilo Hernández Ríos',
    phone: '+573003344556',
    lastMessage: 'Hola Camilo! Vimos que no pudiste asistir a tu cita del martes...',
    lastMessageTime: '2026-03-04T06:50:00',
    unreadCount: 0,
    status: 'active',
    lastMessageFrom: 'business',
  },
  // 12. Sebastián Cárdenas — Agendar cita
  {
    id: 'conv-12',
    clientId: 10,
    clientName: 'Sebastián Cárdenas Leal',
    phone: '+573005566778',
    lastMessage: 'Gracias Lina, nos vemos!',
    lastMessageTime: '2026-03-03T18:40:00',
    unreadCount: 0,
    status: 'active',
    lastMessageFrom: 'client',
  },
  // 13. Mateo Gómez — Recordatorio de cita
  {
    id: 'conv-13',
    clientId: 14,
    clientName: 'Mateo Gómez Plata',
    phone: '+573006677889',
    lastMessage: 'Hola Mateo! Te recuerdo que mañana tienes cita a las 11:00 AM',
    lastMessageTime: '2026-03-03T17:00:00',
    unreadCount: 0,
    status: 'active',
    lastMessageFrom: 'business',
  },
  // 14. Fabián Andrés Capacho — Cita urgente
  {
    id: 'conv-14',
    clientId: 19,
    clientName: 'Fabián Andrés Capacho Rincón',
    phone: '+573036789012',
    lastMessage: 'Nos vemos hermano!',
    lastMessageTime: '2026-03-03T15:30:00',
    unreadCount: 1,
    status: 'active',
    lastMessageFrom: 'client',
  },
  // 15. Karen Lizeth Amaya — Semipermanente
  {
    id: 'conv-15',
    clientId: 23,
    clientName: 'Karen Lizeth Amaya Soto',
    phone: '+573070123456',
    lastMessage: 'Perfecto Karen! Te esperamos el sábado.',
    lastMessageTime: '2026-03-03T14:10:00',
    unreadCount: 0,
    status: 'active',
    lastMessageFrom: 'business',
  },
  // 16. Robinson Ferney Patiño — Reactivación
  {
    id: 'conv-16',
    clientId: 25,
    clientName: 'Robinson Ferney Patiño',
    phone: '+573092345678',
    lastMessage: 'Hola Robinson! Hace 45 días que no te vemos por Al Pelo...',
    lastMessageTime: '2026-03-03T12:00:00',
    unreadCount: 0,
    status: 'active',
    lastMessageFrom: 'business',
  },
  // 17. Harold Steven Pineda — Promo
  {
    id: 'conv-17',
    clientId: 28,
    clientName: 'Harold Steven Pineda Solano',
    phone: '+573125678901',
    lastMessage: 'Sí claro, cuánto sale?',
    lastMessageTime: '2026-03-02T20:30:00',
    unreadCount: 1,
    status: 'active',
    lastMessageFrom: 'client',
  },
  // 18. Cristian Camilo Ordóñez — Cambio de look
  {
    id: 'conv-18',
    clientId: 30,
    clientName: 'Cristian Camilo Ordóñez Vega',
    phone: '+573147890123',
    lastMessage: 'Buenas, es que quiero un cambio de look total',
    lastMessageTime: '2026-03-02T19:00:00',
    unreadCount: 1,
    status: 'active',
    lastMessageFrom: 'client',
  },
  // 19. Jhon Fredy Blanco — Cita para hoy (inbound)
  {
    id: 'conv-19',
    clientId: 20,
    clientName: 'Jhon Fredy Blanco Duarte',
    phone: '+573047890123',
    lastMessage: 'Buenas tardes, necesito una cita para hoy si hay',
    lastMessageTime: '2026-03-04T11:30:00',
    unreadCount: 1,
    status: 'active',
    lastMessageFrom: 'client',
  },
  // 20. Oscar Mauricio Jaimes — Precio corte hipster (inbound)
  {
    id: 'conv-20',
    clientId: 22,
    clientName: 'Oscar Mauricio Jaimes Carvajal',
    phone: '+573069012345',
    lastMessage: 'Hola, cuánto sale el corte hipster?',
    lastMessageTime: '2026-03-04T11:00:00',
    unreadCount: 1,
    status: 'active',
    lastMessageFrom: 'client',
  },
  // 21. Daniela Fernanda Rueda — Disponibilidad mañana (inbound)
  {
    id: 'conv-21',
    clientId: 27,
    clientName: 'Daniela Fernanda Rueda Parra',
    phone: '+573114567890',
    lastMessage: 'Hola! Quiero saber si tienen disponibilidad para mañana',
    lastMessageTime: '2026-03-04T10:45:00',
    unreadCount: 1,
    status: 'active',
    lastMessageFrom: 'client',
  },
  // 22. Yesid Orlando Mantilla — Reagendar cita (inbound)
  {
    id: 'conv-22',
    clientId: 26,
    clientName: 'Yesid Orlando Mantilla Gómez',
    phone: '+573103456789',
    lastMessage: 'Necesito reagendar mi cita del jueves',
    lastMessageTime: '2026-03-04T10:20:00',
    unreadCount: 1,
    status: 'active',
    lastMessageFrom: 'client',
  },
  // 23. Luis García — Nuevo cliente potencial (inbound)
  {
    id: 'conv-23',
    clientId: null,
    clientName: 'Luis García',
    phone: '+573159876543',
    lastMessage: 'Hola buenas, me recomendaron esta barbería. Cómo hago para agendar?',
    lastMessageTime: '2026-03-04T10:00:00',
    unreadCount: 1,
    status: 'active',
    lastMessageFrom: 'client',
  },
];

// ============================================
// WhatsApp Messages
// ============================================
export const mockWhatsAppMessages = {
  // ★ CONVERSACIÓN ESTRELLA — Miguel Ángel (VIP): muestra a Lina gestionando todo
  'conv-1': [
    { id: 'ms-1', from: 'business', text: 'Hola Miguel Ángel! Soy Lina de Al Pelo. Como eres de nuestros clientes más especiales, te quería avisar que ya abrimos agenda para esta semana. ¿Te gustaría reservar tu horario favorito antes de que se llene?', time: '2026-03-03T09:00:00', status: 'read' },
    { id: 'ms-2', from: 'client', text: 'Hola Lina! Sí, necesito un corte urgente jaja. ¿Qué tienen para el sábado?', time: '2026-03-03T09:22:00', status: 'read' },
    { id: 'ms-3', from: 'business', text: 'Jaja tranquilo que te dejamos como nuevo. Para el sábado con Victor tenemos disponible a las 9:00 AM, 11:00 AM y 3:00 PM. ¿Cuál te queda mejor?', time: '2026-03-03T09:25:00', status: 'read' },
    { id: 'ms-4', from: 'client', text: 'La de las 11 está perfecta', time: '2026-03-03T09:28:00', status: 'read' },
    { id: 'ms-5', from: 'business', text: 'Listo! Te agendé el sábado 8 de marzo a las 11:00 AM con Victor.\n\nCorte + barba como siempre, ¿verdad? O quieres agregar algo más esta vez?', time: '2026-03-03T09:30:00', status: 'read' },
    { id: 'ms-6', from: 'client', text: 'Sí, lo de siempre. Pero sabes qué? Agrégame también la ceja, que la tengo un desastre', time: '2026-03-03T09:33:00', status: 'read' },
    { id: 'ms-7', from: 'business', text: 'Jaja ya te la agrego, quedan $45.000 en total (corte $25.000 + barba $12.000 + ceja $8.000). Como cliente VIP ya sabes que tienes prioridad, así que Victor te atiende puntualito.', time: '2026-03-03T09:35:00', status: 'read' },
    { id: 'ms-8', from: 'client', text: 'Perfecto, gracias Lina!', time: '2026-03-03T09:37:00', status: 'read' },
    { id: 'ms-9', from: 'business', text: 'A ti Miguel Ángel! Nos vemos el sábado.', time: '2026-03-03T09:38:00', status: 'read' },
    // Día siguiente - recordatorio
    { id: 'ms-10', from: 'business', text: 'Hola Miguel Ángel! Te recuerdo que mañana sábado tienes cita a las 11:00 AM con Victor. Te esperamos con todo listo. ¿Nos confirmas que vas?', time: '2026-03-04T09:00:00', status: 'read' },
    { id: 'ms-11', from: 'client', text: 'Confirmado! Ahí estaré sin falta', time: '2026-03-04T09:15:00', status: 'read' },
    { id: 'ms-12', from: 'business', text: 'Perfecto, te esperamos! Recuerda llegar unos 5 minuticos antes para que Victor arranque puntual contigo.', time: '2026-03-04T09:17:00', status: 'read' },
    { id: 'ms-13', from: 'client', text: 'Dale, siempre tan atenta. Oye una pregunta, ¿tienen algún producto para el cabello? Es que el mío está un poco reseco', time: '2026-03-04T10:05:00', status: 'read' },
    { id: 'ms-14', from: 'business', text: 'Claro que sí! Tenemos una cera mate y un aceite para barba que son muy buenos. Le digo a Victor que te los muestre mañana y te asesore según tu tipo de cabello. Él es el que más sabe de eso.', time: '2026-03-04T10:10:00', status: 'read' },
    { id: 'ms-15', from: 'client', text: 'Eres la mejor Lina, muchas gracias! 🙌', time: '2026-03-04T10:18:00', status: 'read' },
  ],

  // Conv 2 — Carlos Mendoza: Recordatorio + confirmación
  'conv-2': [
    { id: 'mc-1', from: 'business', text: 'Hola Carlos! Soy Lina de Al Pelo. Te cuento que tienes cita mañana miércoles con Victor a las 10:00 AM. ¿Todo bien para esa hora?', time: '2026-03-03T15:00:00', status: 'read' },
    { id: 'mc-2', from: 'client', text: 'Hola Lina! Sí claro, ahí voy sin falta', time: '2026-03-03T15:12:00', status: 'read' },
    { id: 'mc-3', from: 'business', text: 'Genial Carlos! Te esperamos mañana. Intenta llegar unos minuticos antes para que Victor te atienda puntual.', time: '2026-03-03T15:15:00', status: 'read' },
    { id: 'mc-4', from: 'client', text: 'Listo, nos vemos mañana a las 10!', time: '2026-03-04T09:15:00', status: 'read' },
  ],

  // Conv 3 — Andrés Ruiz: Reagendar cita (último mensaje sin responder)
  'conv-3': [
    { id: 'ma-1', from: 'business', text: 'Hola Andrés! Soy Lina de Al Pelo. Te extrañamos por acá, ya van varias semanas sin verte. ¿Qué tal si agendamos un corte esta semana?', time: '2026-03-02T10:00:00', status: 'read' },
    { id: 'ma-2', from: 'client', text: 'Hola! Sí, he andado a mil. Pero quiero ir esta semana sin falta', time: '2026-03-02T14:20:00', status: 'read' },
    { id: 'ma-3', from: 'business', text: 'Qué bien que te animas! Mira, tenemos espacio el miércoles a las 10 AM o el jueves a las 4 PM. ¿Cuál te acomoda mejor?', time: '2026-03-02T14:25:00', status: 'read' },
    { id: 'ma-4', from: 'client', text: 'El jueves a las 4 me queda perfecto', time: '2026-03-02T16:00:00', status: 'read' },
    { id: 'ma-5', from: 'business', text: 'Listo, quedaste agendado! Jueves 6 de marzo a las 4:00 PM con Julián. Te va a encantar, es muy bueno. Te esperamos!', time: '2026-03-02T16:05:00', status: 'read' },
    { id: 'ma-6', from: 'client', text: 'Gracias Lina!', time: '2026-03-02T16:08:00', status: 'read' },
    { id: 'ma-7', from: 'client', text: 'Ay, se me cruzó algo del trabajo. ¿Puedo pasar mejor el viernes?', time: '2026-03-04T08:50:00', status: 'delivered' },
  ],

  // Conv 4 — Emmanuel Rojas: Cliente nuevo preguntando precios
  'conv-4': [
    { id: 'me-1', from: 'client', text: 'Hola, buenas tardes!', time: '2026-03-03T17:00:00', status: 'read' },
    { id: 'me-2', from: 'business', text: 'Hola Emmanuel! Bienvenido, soy Lina de Al Pelo. ¿En qué te puedo ayudar?', time: '2026-03-03T17:03:00', status: 'read' },
    { id: 'me-3', from: 'client', text: '¿Cuánto cuesta el corte + barba?', time: '2026-03-03T17:05:00', status: 'read' },
    { id: 'me-4', from: 'business', text: 'El corte de cabello está en $25.000 y la barba en $12.000, o sea que el combo te sale en $37.000. Tenemos muy buenos barberos, te van a dejar espectacular!', time: '2026-03-03T17:08:00', status: 'read' },
    { id: 'me-5', from: 'client', text: 'Ah buenísimo, no está caro. ¿Tienen para este sábado?', time: '2026-03-03T17:12:00', status: 'read' },
    { id: 'me-6', from: 'business', text: 'Sí señor! El sábado tenemos espacio a las 10:00 AM y a las 2:00 PM. ¿Cuál te queda mejor? También puedes agendar directo por acá si quieres: https://book.weibook.co/alpelo-peluqueria', time: '2026-03-03T17:15:00', status: 'read' },
    { id: 'me-7', from: 'client', text: 'Buenísimo, entonces agendo para el sábado!', time: '2026-03-04T08:30:00', status: 'delivered' },
  ],

  // Conv 5 — Nicolás Pabón: Feedback post-visita
  'conv-5': [
    { id: 'mn-1', from: 'business', text: 'Hola Nicolás! Soy Lina de Al Pelo. ¿Cómo te fue con el corte de hoy? Cuéntanos, queremos saber si quedaste contento!', time: '2026-03-03T14:00:00', status: 'read' },
    { id: 'mn-2', from: 'client', text: 'Quedó brutal hermano, 10/10 🔥', time: '2026-03-03T16:20:00', status: 'read' },
    { id: 'mn-3', from: 'business', text: 'Me alegra mucho saber eso! Le paso la buena vibra a Victor, seguro se pone feliz. Te esperamos para la próxima!', time: '2026-03-03T16:25:00', status: 'read' },
  ],

  // Conv 6 — David López: Recordatorio + confirmación rápida
  'conv-6': [
    { id: 'md-1', from: 'business', text: 'Hola David! Soy Lina de Al Pelo. Te recuerdo que tienes cita de Spa Manicure mañana a las 3:00 PM con Josemith. ¿Confirmas?', time: '2026-03-03T12:00:00', status: 'read' },
    { id: 'md-2', from: 'client', text: 'Sí! Gracias por avisar, casi se me olvida jaja', time: '2026-03-03T14:15:00', status: 'read' },
    { id: 'md-3', from: 'business', text: 'Jaja para eso estoy, para que no se te pase. Josemith te tiene todo listo. Nos vemos mañana!', time: '2026-03-03T14:20:00', status: 'read' },
    { id: 'md-4', from: 'client', text: 'Listo, ahí estaré sin falta!', time: '2026-03-03T14:30:00', status: 'read' },
  ],

  // Conv 7 — Valentina Morales: Post lifting de pestañas
  'conv-7': [
    { id: 'mv-1', from: 'business', text: 'Hola Valentina! Soy Lina de Al Pelo. ¿Cómo te quedó el lifting de pestañas? Josemith estaba muy contenta con el resultado!', time: '2026-03-02T18:00:00', status: 'read' },
    { id: 'mv-2', from: 'client', text: 'Me encantó! Quedaron divinas 😍 Todas mis amigas me preguntaron dónde me las hice', time: '2026-03-02T19:15:00', status: 'read' },
    { id: 'mv-3', from: 'business', text: 'Qué bueno saberlo! Si alguna amiga quiere venir, le damos un 10% de descuento por ser referida tuya. Y para ti hay un descuento especial en tu próximo servicio. Gracias por la confianza!', time: '2026-03-02T19:20:00', status: 'read' },
  ],

  // Conv 8 — Esteban Capacho: Cliente nuevo recomendado
  'conv-8': [
    { id: 'mec-1', from: 'client', text: 'Hola! Me recomendó mi amigo Carlos Mendoza. ¿Cómo hago para agendar?', time: '2026-03-02T14:30:00', status: 'read' },
    { id: 'mec-2', from: 'business', text: 'Hola Esteban! Qué bueno que llegas de parte de Carlos, es de nuestros mejores clientes 😊 Bienvenido a Al Pelo!\n\nPuedes agendar por nuestra página: https://book.weibook.co/alpelo-peluqueria\n\nO si prefieres, dime qué servicio te interesa y te busco disponibilidad ahorita mismo 💈', time: '2026-03-02T14:35:00', status: 'read' },
    { id: 'mec-3', from: 'client', text: 'Quiero un corte de cabello, ¿tienen para el jueves?', time: '2026-03-02T14:42:00', status: 'read' },
    { id: 'mec-4', from: 'business', text: 'Claro! El jueves tenemos disponible a las 10:00 AM con Daniel o a las 3:00 PM con Victor. Los dos son espectaculares, vas a quedar buenísimo 💪', time: '2026-03-02T14:48:00', status: 'read' },
    { id: 'mec-5', from: 'client', text: 'A las 3 con Victor suena bien', time: '2026-03-02T14:55:00', status: 'read' },
    { id: 'mec-6', from: 'business', text: 'Listo, te agendé! Jueves 6 de marzo a las 3:00 PM con Victor ✂️ Es tu primera vez así que te voy a dar un tip: llega unos 5 minuticos antes para que Victor pueda conocer qué estilo te gusta. ¡Va a quedar genial!', time: '2026-03-02T15:00:00', status: 'read' },
    { id: 'mec-7', from: 'client', text: 'Dale, perfecto. Nos vemos el jueves entonces!', time: '2026-03-02T15:10:00', status: 'read' },
  ],

  // Conv 9 — Juan Pablo Pérez: Recordatorio + confirmación
  'conv-9': [
    { id: 'c9-1', from: 'business', text: 'Hola Juan Pablo! Te recuerdo que mañana tienes cita a las 3:00 PM con Memo. Corte hipster como siempre.', time: '2026-03-04T07:30:00', status: 'read' },
    { id: 'c9-2', from: 'client', text: 'Listo, muchas gracias!', time: '2026-03-04T07:45:00', status: 'read' },
  ],

  // Conv 10 — Santiago Reyes: Seguimiento
  'conv-10': [
    { id: 'c10-1', from: 'business', text: 'Hola Santiago! Hace un tiempito que no vienes. ¿Todo bien?', time: '2026-03-04T07:00:00', status: 'read' },
    { id: 'c10-2', from: 'client', text: 'Bueno, ahí miro entonces', time: '2026-03-04T07:20:00', status: 'read' },
  ],

  // Conv 11 — Camilo Hernández: No-show seguimiento
  'conv-11': [
    { id: 'c11-1', from: 'business', text: 'Hola Camilo! Vimos que no pudiste asistir a tu cita del martes. ¿Quieres reagendar? Te esperamos!', time: '2026-03-04T06:50:00', status: 'delivered' },
  ],

  // Conv 12 — Sebastián Cárdenas: Agendar cita
  'conv-12': [
    { id: 'c12-1', from: 'client', text: 'Hola, necesito una cita para esta semana', time: '2026-03-03T18:00:00', status: 'read' },
    { id: 'c12-2', from: 'business', text: 'Hola Sebastián! Claro, ¿qué servicio necesitas y qué día te queda bien?', time: '2026-03-03T18:15:00', status: 'read' },
    { id: 'c12-3', from: 'client', text: 'Corte + barba, el jueves o viernes', time: '2026-03-03T18:25:00', status: 'read' },
    { id: 'c12-4', from: 'business', text: 'El jueves a las 11:00 AM con Samuel hay espacio. ¿Te sirve?', time: '2026-03-03T18:30:00', status: 'read' },
    { id: 'c12-5', from: 'client', text: 'Gracias Lina, nos vemos!', time: '2026-03-03T18:40:00', status: 'read' },
  ],

  // Conv 13 — Mateo Gómez: Recordatorio de cita
  'conv-13': [
    { id: 'c13-1', from: 'business', text: 'Hola Mateo! Te recuerdo que mañana tienes cita a las 11:00 AM con Memo. Corte + cejas.', time: '2026-03-03T17:00:00', status: 'delivered' },
  ],

  // Conv 14 — Fabián Andrés Capacho: Cita urgente
  'conv-14': [
    { id: 'c14-1', from: 'client', text: 'Parce necesito cita urgente esta semana', time: '2026-03-03T15:00:00', status: 'read' },
    { id: 'c14-2', from: 'business', text: 'Hola Fabián! Déjame revisar... ¿Qué servicio necesitas?', time: '2026-03-03T15:10:00', status: 'read' },
    { id: 'c14-3', from: 'client', text: 'Corte + barba, lo de siempre', time: '2026-03-03T15:15:00', status: 'read' },
    { id: 'c14-4', from: 'business', text: 'Mañana a las 4:00 PM hay con Andrés. ¿Te sirve?', time: '2026-03-03T15:20:00', status: 'read' },
    { id: 'c14-5', from: 'client', text: 'Nos vemos hermano!', time: '2026-03-03T15:30:00', status: 'read' },
  ],

  // Conv 15 — Karen Lizeth Amaya: Semipermanente
  'conv-15': [
    { id: 'c15-1', from: 'client', text: 'Hola, quiero agendar semipermanente para el sábado', time: '2026-03-03T13:45:00', status: 'read' },
    { id: 'c15-2', from: 'business', text: 'Hola Karen! Claro, el sábado a las 10:00 AM con Josemith hay espacio. ¿Te sirve?', time: '2026-03-03T14:00:00', status: 'read' },
    { id: 'c15-3', from: 'client', text: 'Sí, perfecto!', time: '2026-03-03T14:05:00', status: 'read' },
    { id: 'c15-4', from: 'business', text: 'Perfecto Karen! Te esperamos el sábado a las 10:00 AM.', time: '2026-03-03T14:10:00', status: 'read' },
  ],

  // Conv 16 — Robinson Ferney Patiño: Reactivación
  'conv-16': [
    { id: 'c16-1', from: 'business', text: 'Hola Robinson! Hace 45 días que no te vemos por Al Pelo. Te extrañamos! Agenda tu cita: https://book.weibook.co/alpelo-peluqueria', time: '2026-03-03T12:00:00', status: 'delivered' },
  ],

  // Conv 17 — Harold Steven Pineda: Promo
  'conv-17': [
    { id: 'c17-1', from: 'business', text: 'Hola Harold! Tenemos una promo especial esta semana: Corte + Barba + Cejas por $40.000.', time: '2026-03-02T20:00:00', status: 'read' },
    { id: 'c17-2', from: 'client', text: 'Sí claro, cuánto sale?', time: '2026-03-02T20:30:00', status: 'read' },
  ],

  // Conv 18 — Cristian Camilo Ordóñez: Cambio de look
  'conv-18': [
    { id: 'c18-1', from: 'client', text: 'Buenas, es que quiero un cambio de look total', time: '2026-03-02T19:00:00', status: 'read' },
  ],

  // Conv 19 — Jhon Fredy Blanco: Cita para hoy (inbound)
  'conv-19': [
    { id: 'c19-1', from: 'client', text: 'Buenas tardes, necesito una cita para hoy si hay', time: '2026-03-04T11:30:00', status: 'read' },
  ],

  // Conv 20 — Oscar Mauricio Jaimes: Precio corte hipster (inbound)
  'conv-20': [
    { id: 'c20-1', from: 'client', text: 'Hola, cuánto sale el corte hipster?', time: '2026-03-04T11:00:00', status: 'read' },
  ],

  // Conv 21 — Daniela Fernanda Rueda: Disponibilidad mañana (inbound)
  'conv-21': [
    { id: 'c21-1', from: 'client', text: 'Hola! Quiero saber si tienen disponibilidad para mañana', time: '2026-03-04T10:45:00', status: 'read' },
  ],

  // Conv 22 — Yesid Orlando Mantilla: Reagendar cita (inbound)
  'conv-22': [
    { id: 'c22-1', from: 'client', text: 'Necesito reagendar mi cita del jueves', time: '2026-03-04T10:20:00', status: 'read' },
  ],

  // Conv 23 — Luis García: Nuevo cliente potencial (inbound)
  'conv-23': [
    { id: 'c23-1', from: 'client', text: 'Hola buenas, me recomendaron esta barbería. Cómo hago para agendar?', time: '2026-03-04T10:00:00', status: 'read' },
  ],
};

// ============================================
// WhatsApp Templates — 43 plantillas, 12 categorías
// Todas empiezan con "Hola {{nombre}}, soy Lina de Al Pelo..."
// ============================================
export const mockWhatsAppTemplates = [
  // --- BIENVENIDA (4) ---
  { id: 'tpl-1', name: 'Bienvenida Primera Visita', category: 'bienvenida', body: 'Hola {{nombre}}, soy Lina de Al Pelo. Fue un placer tenerte hoy con nosotros! Esperamos que hayas disfrutado tu {{servicio}}. Como nuevo cliente, en tu próxima visita tienes un 10% de descuento. Reserva: https://book.weibook.co/alpelo-peluqueria', variables: ['nombre', 'servicio'], timesSent: 45, responseRate: 72, lastSent: '2026-03-02' },
  { id: 'tpl-2', name: 'Resumen de Servicio', category: 'bienvenida', body: 'Hola {{nombre}}, soy Lina de Al Pelo. Gracias por visitarnos! Te hicimos {{servicio}} con {{barbero}}. Para mantener tu look perfecto, te recomendamos volver en {{dias}} días. Reserva aquí: https://book.weibook.co/alpelo-peluqueria', variables: ['nombre', 'servicio', 'barbero', 'dias'], timesSent: 38, responseRate: 65, lastSent: '2026-03-01' },
  { id: 'tpl-3', name: 'Bono Referido', category: 'bienvenida', body: 'Hola {{nombre}}, soy Lina de Al Pelo. Tienes un bono de referido! Si traes a un amigo, ambos reciben 15% de descuento. Solo muestra este mensaje al llegar.', variables: ['nombre'], timesSent: 25, responseRate: 48, lastSent: '2026-02-28' },
  { id: 'tpl-4', name: 'Potencial VIP', category: 'bienvenida', body: 'Hola {{nombre}}, soy Lina de Al Pelo. Vemos que te gusta cuidar tu imagen! Con unas visitas más podrías ser parte de nuestro programa VIP con beneficios exclusivos. Te cuento más en tu próxima visita!', variables: ['nombre'], timesSent: 15, responseRate: 55, lastSent: '2026-02-25' },

  // --- RECORDATORIO (4) ---
  { id: 'tpl-5', name: 'Recordatorio 24h', category: 'recordatorio', body: 'Hola {{nombre}}, soy Lina de Al Pelo. Te recordamos que mañana tienes cita de {{servicio}} a las {{hora}} con {{barbero}}. Te esperamos! ¿Confirmas?', variables: ['nombre', 'servicio', 'hora', 'barbero'], timesSent: 120, responseRate: 85, lastSent: '2026-03-03' },
  { id: 'tpl-6', name: 'Recordatorio 2h', category: 'recordatorio', body: 'Hola {{nombre}}, soy Lina de Al Pelo. Tu cita es en 2 horas! {{servicio}} a las {{hora}}. Recuerda llegar 5 minutos antes para que {{barbero}} te atienda puntual.', variables: ['nombre', 'servicio', 'hora', 'barbero'], timesSent: 95, responseRate: 78, lastSent: '2026-03-04' },
  { id: 'tpl-7', name: 'Recordatorio Mañana', category: 'recordatorio', body: 'Hola {{nombre}}, soy Lina de Al Pelo. Buenos días! Hoy es tu día de Al Pelo. Tu cita de {{servicio}} es a las {{hora}}. Estamos listos para dejarte como nuevo!', variables: ['nombre', 'servicio', 'hora'], timesSent: 88, responseRate: 82, lastSent: '2026-03-04' },
  { id: 'tpl-8', name: 'Recordatorio Semanal', category: 'recordatorio', body: 'Hola {{nombre}}, soy Lina de Al Pelo. Esta semana tienes cita el {{dia}} a las {{hora}} para {{servicio}}. Si necesitas cambiar la hora, escríbenos con tiempo!', variables: ['nombre', 'dia', 'hora', 'servicio'], timesSent: 60, responseRate: 70, lastSent: '2026-03-02' },

  // --- CONFIRMACION (3) ---
  { id: 'tpl-9', name: 'Cita Confirmada', category: 'confirmacion', body: 'Hola {{nombre}}, soy Lina de Al Pelo. Tu cita está confirmada! {{servicio}} el {{fecha}} a las {{hora}} con {{barbero}}. Te esperamos en Carrera 31 n 50-21, Cabecera.', variables: ['nombre', 'servicio', 'fecha', 'hora', 'barbero'], timesSent: 150, responseRate: 45, lastSent: '2026-03-04' },
  { id: 'tpl-10', name: 'Cita Reprogramada', category: 'confirmacion', body: 'Hola {{nombre}}, soy Lina de Al Pelo. Tu cita ha sido reprogramada para el {{fecha}} a las {{hora}} con {{barbero}}. Si tienes algún inconveniente, escríbenos!', variables: ['nombre', 'fecha', 'hora', 'barbero'], timesSent: 30, responseRate: 60, lastSent: '2026-03-01' },
  { id: 'tpl-11', name: 'Cita Cancelada', category: 'confirmacion', body: 'Hola {{nombre}}, soy Lina de Al Pelo. Tu cita del {{fecha}} ha sido cancelada. Si deseas reagendar, estamos a tu disposición. Reserva: https://book.weibook.co/alpelo-peluqueria', variables: ['nombre', 'fecha'], timesSent: 12, responseRate: 35, lastSent: '2026-02-28' },

  // --- POST-VISITA (4) ---
  { id: 'tpl-12', name: 'Agradecimiento Post-Visita', category: 'post-visita', body: 'Hola {{nombre}}, soy Lina de Al Pelo. Gracias por visitarnos hoy! Esperamos que hayas salido como te gusta. ¿Nos regalas tu opinión del 1 al 5? Tu feedback nos ayuda a mejorar.', variables: ['nombre'], timesSent: 85, responseRate: 62, lastSent: '2026-03-03' },
  { id: 'tpl-13', name: 'Feedback Servicio', category: 'post-visita', body: 'Hola {{nombre}}, soy Lina de Al Pelo. ¿Cómo te fue con tu {{servicio}} de ayer? Queremos asegurarnos de que todo haya quedado perfecto. Si algo no te gustó, cuéntanos para mejorar!', variables: ['nombre', 'servicio'], timesSent: 50, responseRate: 55, lastSent: '2026-03-02' },
  { id: 'tpl-14', name: 'Tips de Mantenimiento', category: 'post-visita', body: 'Hola {{nombre}}, soy Lina de Al Pelo. Tips para mantener tu {{servicio}} perfecto: lava con agua tibia, usa productos sin sulfato, y programa tu próxima visita en {{dias}} días. Reserva: https://book.weibook.co/alpelo-peluqueria', variables: ['nombre', 'servicio', 'dias'], timesSent: 35, responseRate: 42, lastSent: '2026-03-01' },
  { id: 'tpl-15', name: 'Recomendación Producto', category: 'post-visita', body: 'Hola {{nombre}}, soy Lina de Al Pelo. Basado en tu {{servicio}}, te recomendamos usar {{producto}} para mantener tu look por más tiempo. Pregunta por él en tu próxima visita!', variables: ['nombre', 'servicio', 'producto'], timesSent: 20, responseRate: 38, lastSent: '2026-02-25' },

  // --- REACTIVACION (4) ---
  { id: 'tpl-16', name: 'Reactivación 30 Días', category: 'reactivacion', body: 'Hola {{nombre}}, soy Lina de Al Pelo. Ya pasaron 30 días desde tu última visita! Tu {{servicio}} debe estar necesitando un retoque. ¿Agendamos? https://book.weibook.co/alpelo-peluqueria', variables: ['nombre', 'servicio'], timesSent: 65, responseRate: 45, lastSent: '2026-03-03' },
  { id: 'tpl-17', name: 'Reactivación 45 Días', category: 'reactivacion', body: 'Hola {{nombre}}, soy Lina de Al Pelo. Te extrañamos en la barbería! Hace más de un mes que no nos visitas. ¿Todo bien? Te guardamos tu horario favorito si quieres volver.', variables: ['nombre'], timesSent: 40, responseRate: 35, lastSent: '2026-03-01' },
  { id: 'tpl-18', name: 'Reactivación 60 Días + Oferta', category: 'reactivacion', body: 'Hola {{nombre}}, soy Lina de Al Pelo. Ya pasaron 2 meses sin verte! Como gesto especial, te ofrecemos 15% de descuento en tu próximo {{servicio}}. Solo muestra este mensaje al llegar. Válido esta semana.', variables: ['nombre', 'servicio'], timesSent: 30, responseRate: 28, lastSent: '2026-02-28' },
  { id: 'tpl-19', name: 'Reactivación 90+ Días', category: 'reactivacion', body: 'Hola {{nombre}}, soy Lina de Al Pelo. Hace mucho que no te vemos y la verdad te extrañamos! Te ofrecemos 20% en cualquier servicio. No importa cuánto tiempo haya pasado, siempre eres bienvenido en Al Pelo.', variables: ['nombre'], timesSent: 18, responseRate: 22, lastSent: '2026-02-20' },

  // --- VIP (4) ---
  { id: 'tpl-20', name: 'Bienvenida VIP', category: 'vip', body: 'Hola {{nombre}}, soy Lina de Al Pelo. Felicitaciones! Has sido seleccionado como cliente VIP de Al Pelo. Esto significa reserva prioritaria, descuentos exclusivos y un servicio de primera. Gracias por tu fidelidad!', variables: ['nombre'], timesSent: 8, responseRate: 90, lastSent: '2026-02-15' },
  { id: 'tpl-21', name: 'Promo Exclusiva VIP', category: 'vip', body: 'Hola {{nombre}}, soy Lina de Al Pelo. Como cliente VIP, tienes acceso exclusivo a nuestro nuevo servicio de {{servicio}} con 20% de descuento antes que nadie. ¿Quieres ser de los primeros en probarlo?', variables: ['nombre', 'servicio'], timesSent: 12, responseRate: 75, lastSent: '2026-02-20' },
  { id: 'tpl-22', name: 'Reserva Prioritaria VIP', category: 'vip', body: 'Hola {{nombre}}, soy Lina de Al Pelo. Esta semana tenemos alta demanda, pero como VIP te hemos reservado tu horario habitual. ¿Confirmamos tu cita del {{dia}} a las {{hora}}?', variables: ['nombre', 'dia', 'hora'], timesSent: 10, responseRate: 88, lastSent: '2026-03-02' },
  { id: 'tpl-23', name: 'Aniversario VIP', category: 'vip', body: 'Hola {{nombre}}, soy Lina de Al Pelo. Hoy cumples {{meses}} meses como cliente VIP! Para celebrar, tu próximo servicio tiene 25% de descuento. Gracias por ser parte de la familia Al Pelo.', variables: ['nombre', 'meses'], timesSent: 5, responseRate: 85, lastSent: '2026-02-10' },

  // --- CUMPLEAÑOS (3) ---
  { id: 'tpl-24', name: 'Feliz Cumpleaños', category: 'cumpleanos', body: 'Hola {{nombre}}, soy Lina de Al Pelo. Feliz cumpleaños! En tu día especial te regalamos 25% de descuento en cualquier servicio. Válido toda esta semana. Ven a celebrar con nosotros!', variables: ['nombre'], timesSent: 28, responseRate: 70, lastSent: '2026-03-01' },
  { id: 'tpl-25', name: 'Semana del Cumpleaños', category: 'cumpleanos', body: 'Hola {{nombre}}, soy Lina de Al Pelo. Tu semana de cumpleaños merece un look especial! Agenda tu servicio favorito con descuento de cumpleañero. Reserva: https://book.weibook.co/alpelo-peluqueria', variables: ['nombre'], timesSent: 22, responseRate: 60, lastSent: '2026-02-28' },
  { id: 'tpl-26', name: 'Mes del Cumpleaños', category: 'cumpleanos', body: 'Hola {{nombre}}, soy Lina de Al Pelo. Este mes es tu cumpleaños y queremos celebrarlo! Tienes 15% en todos los servicios durante todo el mes. No dejes pasar la oportunidad.', variables: ['nombre'], timesSent: 18, responseRate: 50, lastSent: '2026-02-25' },

  // --- PROMOCIONES (4) ---
  { id: 'tpl-27', name: 'Flash Sale', category: 'promociones', body: 'Hola {{nombre}}, soy Lina de Al Pelo. OFERTA RELÁMPAGO! Solo hoy y mañana: {{servicio}} con 20% de descuento. Cupos limitados. Reserva ya: https://book.weibook.co/alpelo-peluqueria', variables: ['nombre', 'servicio'], timesSent: 55, responseRate: 40, lastSent: '2026-03-01' },
  { id: 'tpl-28', name: 'Combo Especial', category: 'promociones', body: 'Hola {{nombre}}, soy Lina de Al Pelo. Nuevo combo Al Pelo: {{servicio1}} + {{servicio2}} por solo {{precio}}. Ahorra más cuando te consientes más! Reserva: https://book.weibook.co/alpelo-peluqueria', variables: ['nombre', 'servicio1', 'servicio2', 'precio'], timesSent: 42, responseRate: 38, lastSent: '2026-02-28' },
  { id: 'tpl-29', name: 'Programa Referidos', category: 'promociones', body: 'Hola {{nombre}}, soy Lina de Al Pelo. Refiere a un amigo y ambos ganan! Tú recibes 15% de descuento y tu amigo 10% en su primera visita. Solo comparte este mensaje con él.', variables: ['nombre'], timesSent: 35, responseRate: 32, lastSent: '2026-02-20' },
  { id: 'tpl-30', name: 'Nuevo Servicio', category: 'promociones', body: 'Hola {{nombre}}, soy Lina de Al Pelo. Tenemos un nuevo servicio que te va a encantar: {{servicio}}. Precio de lanzamiento: {{precio}}. ¿Te animas a probarlo?', variables: ['nombre', 'servicio', 'precio'], timesSent: 25, responseRate: 45, lastSent: '2026-02-15' },

  // --- TEMPORADA (4) ---
  { id: 'tpl-31', name: 'Navidad', category: 'temporada', body: 'Hola {{nombre}}, soy Lina de Al Pelo. Feliz Navidad! Empieza el año con el mejor look. Tenemos promos especiales de temporada. Agenda antes de que se llenen los cupos!', variables: ['nombre'], timesSent: 80, responseRate: 35, lastSent: '2025-12-20' },
  { id: 'tpl-32', name: 'San Valentín', category: 'temporada', body: 'Hola {{nombre}}, soy Lina de Al Pelo. Este San Valentín, regálate (o regala) un servicio Al Pelo. Tenemos paquetes especiales para parejas y amigos. Pregúntanos!', variables: ['nombre'], timesSent: 45, responseRate: 30, lastSent: '2026-02-12' },
  { id: 'tpl-33', name: 'Día del Padre', category: 'temporada', body: 'Hola {{nombre}}, soy Lina de Al Pelo. Este Día del Padre, regala el mejor look! Tenemos bonos de regalo disponibles para cualquier servicio. El mejor regalo es tiempo de calidad.', variables: ['nombre'], timesSent: 0, responseRate: 0, lastSent: null },
  { id: 'tpl-34', name: 'Regreso a Clases', category: 'temporada', body: 'Hola {{nombre}}, soy Lina de Al Pelo. Empieza el semestre con todo! Corte estudiantil con 10% de descuento presentando tu carné. Solo esta semana. Reserva: https://book.weibook.co/alpelo-peluqueria', variables: ['nombre'], timesSent: 30, responseRate: 42, lastSent: '2026-01-20' },

  // --- FIDELIZACION (3) ---
  { id: 'tpl-35', name: 'Milestone Puntos', category: 'fidelizacion', body: 'Hola {{nombre}}, soy Lina de Al Pelo. Felicitaciones! Has acumulado {{puntos}} puntos de lealtad. Ya puedes canjearlos por descuentos o servicios gratis. Pregunta en tu próxima visita!', variables: ['nombre', 'puntos'], timesSent: 15, responseRate: 65, lastSent: '2026-02-28' },
  { id: 'tpl-36', name: 'Milestone Visitas', category: 'fidelizacion', body: 'Hola {{nombre}}, soy Lina de Al Pelo. Wow, ya llevas {{visitas}} visitas con nosotros! Para celebrar, tu próximo servicio tiene 20% de descuento. Gracias por confiar en Al Pelo.', variables: ['nombre', 'visitas'], timesSent: 10, responseRate: 72, lastSent: '2026-02-20' },
  { id: 'tpl-37', name: 'Agradecimiento Lealtad', category: 'fidelizacion', body: 'Hola {{nombre}}, soy Lina de Al Pelo. Queremos agradecerte por ser un cliente fiel desde {{fecha}}. Tu confianza nos motiva a dar lo mejor cada día. Eres parte de la familia Al Pelo!', variables: ['nombre', 'fecha'], timesSent: 8, responseRate: 80, lastSent: '2026-02-15' },

  // --- SERVICIOS (3) ---
  { id: 'tpl-38', name: 'Nuevo Servicio Disponible', category: 'servicios', body: 'Hola {{nombre}}, soy Lina de Al Pelo. Tenemos novedades! Ahora ofrecemos {{servicio}} en nuestra carta. Precio: {{precio}}. ¿Te gustaría probarlo en tu próxima visita?', variables: ['nombre', 'servicio', 'precio'], timesSent: 20, responseRate: 40, lastSent: '2026-02-10' },
  { id: 'tpl-39', name: 'Recomendación por Historial', category: 'servicios', body: 'Hola {{nombre}}, soy Lina de Al Pelo. Como te gusta {{servicio_favorito}}, creemos que te encantará {{servicio_nuevo}}. Es el complemento perfecto para tu estilo. ¿Qué dices?', variables: ['nombre', 'servicio_favorito', 'servicio_nuevo'], timesSent: 12, responseRate: 52, lastSent: '2026-02-20' },
  { id: 'tpl-40', name: 'Servicio Trending', category: 'servicios', body: 'Hola {{nombre}}, soy Lina de Al Pelo. El servicio más pedido este mes es {{servicio}}! Ya lo probaron {{cantidad}} clientes y todos salieron encantados. ¿Te animas?', variables: ['nombre', 'servicio', 'cantidad'], timesSent: 18, responseRate: 35, lastSent: '2026-02-28' },

  // --- FEEDBACK (3) ---
  { id: 'tpl-41', name: 'Rating Rápido', category: 'feedback', body: 'Hola {{nombre}}, soy Lina de Al Pelo. ¿Cómo calificas tu última visita del 1 al 5? Tu opinión nos ayuda a mejorar cada día. Solo responde con un número!', variables: ['nombre'], timesSent: 70, responseRate: 58, lastSent: '2026-03-03' },
  { id: 'tpl-42', name: 'Feedback Detallado', category: 'feedback', body: 'Hola {{nombre}}, soy Lina de Al Pelo. Queremos conocer tu opinión sobre tu experiencia con {{barbero}}. ¿Qué te gustó más? ¿Hay algo que podamos mejorar? Tu feedback es muy valioso para nosotros.', variables: ['nombre', 'barbero'], timesSent: 25, responseRate: 45, lastSent: '2026-03-01' },
  { id: 'tpl-43', name: 'Review Google', category: 'feedback', body: 'Hola {{nombre}}, soy Lina de Al Pelo. Si te gustó tu experiencia en Al Pelo, nos ayudaría mucho que dejes una reseña en Google. Es rápido y nos ayuda a que más personas nos conozcan. Gracias!', variables: ['nombre'], timesSent: 40, responseRate: 25, lastSent: '2026-02-25' },
];

// Template category metadata
export const templateCategories = [
  { id: 'bienvenida', name: 'Bienvenida', icon: 'heart', color: '#34D399', count: 4 },
  { id: 'recordatorio', name: 'Recordatorio', icon: 'clock', color: '#60A5FA', count: 4 },
  { id: 'confirmacion', name: 'Confirmación', icon: 'check', color: '#2D5A3D', count: 3 },
  { id: 'post-visita', name: 'Post-visita', icon: 'star', color: '#C9A84C', count: 4 },
  { id: 'reactivacion', name: 'Reactivación', icon: 'refresh', color: '#FBBF24', count: 4 },
  { id: 'vip', name: 'VIP', icon: 'crown', color: '#A8873A', count: 4 },
  { id: 'cumpleanos', name: 'Cumpleaños', icon: 'gift', color: '#F87171', count: 3 },
  { id: 'promociones', name: 'Promociones', icon: 'tag', color: '#8B5CF6', count: 4 },
  { id: 'temporada', name: 'Temporada', icon: 'calendar', color: '#EC4899', count: 4 },
  { id: 'fidelizacion', name: 'Fidelización', icon: 'trophy', color: '#14B8A6', count: 3 },
  { id: 'servicios', name: 'Servicios', icon: 'scissors', color: '#3D7A52', count: 3 },
  { id: 'feedback', name: 'Feedback', icon: 'message', color: '#6366F1', count: 3 },
];

// ============================================
// WhatsApp Stats
// ============================================
export const mockWhatsAppStats = {
  messagesToday: 24,
  messagesThisWeek: 156,
  messagesThisMonth: 487,
  conversationsActive: 12,
  responseRate: 78,
  avgResponseTime: '12 min',
  templatesSentToday: 8,
  templatesSentWeek: 45,
  topTemplates: [
    { id: 'tpl-9', name: 'Cita Confirmada', sent: 150, responses: 67 },
    { id: 'tpl-5', name: 'Recordatorio 24h', sent: 120, responses: 102 },
    { id: 'tpl-6', name: 'Recordatorio 2h', sent: 95, responses: 74 },
    { id: 'tpl-7', name: 'Recordatorio Mañana', sent: 88, responses: 72 },
    { id: 'tpl-12', name: 'Agradecimiento Post-Visita', sent: 85, responses: 53 },
  ],
  clientsWithoutContact7Days: 8,
  clientsWithoutContact30Days: 5,
};

// ============================================
// Lina IA — Mock response patterns
// ============================================
export const mockLinaResponses = {
  greetings: [
    'Quiubo parce! Soy Lina, la asistente de AlPelo. ¿En qué te puedo ayudar hoy?',
    'Ey, ¿qué más? Aquí Lina lista pa\' lo que necesites.',
    'Hola! Lina al servicio. Pregúntame lo que quieras sobre el negocio.',
  ],
  unknownQuery: [
    'Hmm, no estoy seguro de entender esa pregunta, parce. ¿Puedes reformularla?',
    'Uy, esa se me escapa. Intenta preguntarme sobre clientes, mensajes, plantillas o el equipo.',
    'No pillé bien la pregunta. Puedo ayudarte con info de clientes, WhatsApp, plantillas y más.',
  ],
  thinkingPhrases: [
    'Déjame revisar los datos...',
    'Un momento, consultando la info...',
    'Buscando en la base de datos...',
    'Analizando los números...',
    'Procesando tu solicitud...',
  ],
};
