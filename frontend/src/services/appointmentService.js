// Servicio de gestión de citas - simulado por ahora
const appointmentService = {
  getAll: async () => [],
  getByBarber: async (barberId) => [],
  getByClient: async (clientId) => [],
  create: async (data) => ({ id: Date.now(), ...data }),
  update: async (id, data) => ({ id, ...data }),
  cancel: async (id) => ({ success: true }),
  confirm: async (id) => ({ success: true }),
};

export default appointmentService;
