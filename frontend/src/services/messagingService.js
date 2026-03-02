// Servicio de mensajería Meta/WhatsApp - simulado por ahora
const messagingService = {
  sendBulk: async (clientIds, message) => ({ sent: clientIds.length, failed: 0 }),
  sendSingle: async (clientId, message) => ({ success: true }),
  getTemplates: async () => [],
  getCampaigns: async () => [],
};

export default messagingService;
