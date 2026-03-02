// Servicio de autenticación - simulado por ahora
const authService = {
  login: async (credentials) => {
    // Simular delay de red
    await new Promise((resolve) => setTimeout(resolve, 800));
    if (credentials.email && credentials.password) {
      return {
        user: { id: 1, name: 'Admin AlPelo', email: credentials.email, role: 'admin' },
        token: 'mock-jwt-token',
      };
    }
    throw new Error('Credenciales inválidas');
  },

  logout: async () => {
    localStorage.removeItem('alpelo_token');
  },
};

export default authService;
