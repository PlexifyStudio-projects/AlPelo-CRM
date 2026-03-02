export const ROLES = {
  ADMIN: 'admin',
  BARBER: 'barber',
};

export const APPOINTMENT_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

export const MESSAGE_STATUS = {
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed',
};

export const SERVICES = [
  { id: 1, name: 'Corte Clásico', price: 25000, duration: 30 },
  { id: 2, name: 'Corte + Barba', price: 40000, duration: 45 },
  { id: 3, name: 'Barba', price: 20000, duration: 20 },
  { id: 4, name: 'Colorimetría', price: 80000, duration: 90 },
  { id: 5, name: 'Cejas', price: 10000, duration: 10 },
  { id: 6, name: 'Tratamiento Capilar', price: 50000, duration: 60 },
];
