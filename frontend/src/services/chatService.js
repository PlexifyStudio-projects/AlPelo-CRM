const chatService = {
  sendMessage: async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { response: 'Respuesta simulada del asistente IA de AlPelo.' };
  },
  getHistory: async () => [],
};

export default chatService;
