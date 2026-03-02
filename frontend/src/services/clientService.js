// Servicio de gestión de clientes - simulado por ahora
const clientService = {
  getAll: async () => [],
  getById: async (id) => null,
  create: async (data) => ({ id: Date.now(), ...data }),
  update: async (id, data) => ({ id, ...data }),
  delete: async (id) => ({ success: true }),
  search: async (query) => [],
};

export default clientService;
