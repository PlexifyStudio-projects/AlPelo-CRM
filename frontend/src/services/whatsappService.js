import {
  mockWhatsAppConversations,
  mockWhatsAppMessages,
  mockWhatsAppTemplates,
  mockWhatsAppStats,
} from '../data/mockData';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const whatsappService = {
  getConversations: async () => {
    await delay(300);
    return [...mockWhatsAppConversations].sort(
      (a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime)
    );
  },

  getMessages: async (conversationId) => {
    await delay(200);
    return mockWhatsAppMessages[conversationId] || [];
  },

  sendMessage: async (conversationId, text) => {
    await delay(500);
    const newMsg = {
      id: `msg-${Date.now()}`,
      from: 'business',
      text,
      time: new Date().toISOString(),
      status: 'sent',
    };
    return newMsg;
  },

  sendTemplate: async (templateId, clientIds) => {
    await delay(800);
    return {
      success: true,
      sent: clientIds.length,
      templateId,
      timestamp: new Date().toISOString(),
    };
  },

  getTemplates: async () => {
    await delay(300);
    return mockWhatsAppTemplates;
  },

  getStats: async () => {
    await delay(200);
    return mockWhatsAppStats;
  },
};

export default whatsappService;
