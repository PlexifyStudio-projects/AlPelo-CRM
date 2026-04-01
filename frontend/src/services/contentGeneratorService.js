const API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';

const headers = { 'Content-Type': 'application/json' };

const handleResponse = async (res) => {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Error de servidor' }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
};

const contentGeneratorService = {
  generateImage: async ({ prompt, style, dimensions, brandColors }) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);
    try {
      const res = await fetch(`${API}/content-studio/generate-image`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ prompt, style, dimensions, brand_colors: brandColors }),
        signal: controller.signal,
      });
      return handleResponse(res);
    } finally {
      clearTimeout(timeout);
    }
  },

  generateVideo: async ({ script, avatarStyle, language, duration, background }) => {
    try {
      const res = await fetch(`${API}/content-studio/generate-video`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ script, avatar_style: avatarStyle, language, duration, background }),
      });
      return handleResponse(res);
    } catch {
      return {
        id: `vid_${Date.now()}`,
        thumbnail_url: 'https://placehold.co/1080x1920/2D5A3D/FFFFFF?text=Video+IA',
        video_url: null,
        script,
        avatar_style: avatarStyle,
        language,
        duration,
        created_at: new Date().toISOString(),
        status: 'processing',
        estimated_time: '2-5 minutos',
      };
    }
  },

  generateCaption: async ({ topic, tone, platform, language }) => {
    try {
      const res = await fetch(`${API}/content-studio/generate-caption`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ topic, tone, platform, language }),
      });
      return handleResponse(res);
    } catch {
      const captions = {
        profesional: `Descubre nuestro servicio premium de ${topic || 'cuidado personal'}. Calidad que se nota, resultados que hablan por si solos. Agenda tu cita hoy.\n\n#PremiumService #CalidadProfesional`,
        amigable: `Hey! Sabias que tenemos lo mejor en ${topic || 'cuidado personal'}? Ven y compruebalo tu mismo. Te esperamos con los brazos abiertos.\n\n#VenAVernos #TeEsperamos`,
        divertido: `Alerta de estilo! Si tu look necesita un upgrade, nosotros tenemos la solucion. No esperes mas, tu mejor version te esta esperando.\n\n#NuevoLook #Estilo`,
        elegante: `La excelencia en ${topic || 'cuidado personal'} tiene nombre. Experimenta un servicio donde cada detalle cuenta y cada visita es una experiencia unica.\n\n#Elegancia #Exclusivo`,
      };
      return {
        id: `cap_${Date.now()}`,
        caption: captions[tone] || captions.profesional,
        topic,
        tone,
        platform,
        language: language || 'es',
        created_at: new Date().toISOString(),
      };
    }
  },

  publishToMeta: async ({ contentId, mediaUrl, caption, platforms, scheduledTime }) => {
    try {
      if (contentId && typeof contentId === 'number') {
        const res = await fetch(`${API}/content-studio/publish/${contentId}`, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({ caption, platforms, scheduled_time: scheduledTime }),
        });
        return handleResponse(res);
      }
      const createRes = await fetch(`${API}/content-studio/content`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          content_type: 'post',
          media_url: mediaUrl,
          caption,
          platform: platforms?.join(',') || 'instagram',
          status: scheduledTime ? 'scheduled' : 'published',
          scheduled_at: scheduledTime || null,
          published_at: scheduledTime ? null : new Date().toISOString(),
        }),
      });
      return handleResponse(createRes);
    } catch {
      return {
        id: `pub_${Date.now()}`,
        status: scheduledTime ? 'scheduled' : 'published',
        platforms,
        scheduled_time: scheduledTime || null,
        published_at: scheduledTime ? null : new Date().toISOString(),
        meta_post_ids: (platforms || []).map((p) => ({ platform: p, post_id: `mock_${p}_${Date.now()}` })),
      };
    }
  },

  getMetaStatus: async () => ({
    connected: false,
    facebook: { connected: false, page_name: null },
    instagram: { connected: false, account_name: null },
  }),

  getBrandKit: async () => {
    try {
      const res = await fetch(`${API}/content-studio/brand-kit`, {
        headers,
        credentials: 'include',
      });
      return handleResponse(res);
    } catch {
      try {
        const saved = localStorage.getItem('plexify_brand_kit');
        if (saved) return JSON.parse(saved);
      } catch { /* ignore */ }
      return {
        logo_url: null,
        primary_color: '#2D5A3D',
        secondary_color: '#1A1A1A',
        accent_color: '#C9A84C',
        font_heading: 'Montserrat',
        font_body: 'Inter',
        tagline: '',
        tone: 'profesional',
      };
    }
  },

  saveBrandKit: async (brandKit) => {
    try {
      const res = await fetch(`${API}/content-studio/brand-kit`, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify(brandKit),
      });
      const result = await handleResponse(res);
      localStorage.setItem('plexify_brand_kit', JSON.stringify(result));
      return result;
    } catch {
      localStorage.setItem('plexify_brand_kit', JSON.stringify(brandKit));
      return brandKit;
    }
  },

  getHistory: async (page = 1, limit = 20) => {
    try {
      const res = await fetch(`${API}/content-studio/content?page=${page}&limit=${limit}`, {
        headers,
        credentials: 'include',
      });
      return handleResponse(res);
    } catch {
      try {
        const saved = localStorage.getItem('plexify_content_history');
        if (saved) return { items: JSON.parse(saved), total: JSON.parse(saved).length };
      } catch { /* ignore */ }
      return { items: [], total: 0 };
    }
  },

  saveToHistory: async (item) => {
    try {
      const res = await fetch(`${API}/content-studio/content`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          content_type: item.content_type || item.type || 'post',
          title: item.title,
          prompt: item.prompt,
          caption: item.caption,
          media_url: item.media_url || item.url,
          thumbnail_url: item.thumbnail_url,
          style: item.style,
          dimensions: item.dimensions,
          platform: item.platform,
          status: item.status || 'draft',
        }),
      });
      return handleResponse(res);
    } catch {
      try {
        const saved = JSON.parse(localStorage.getItem('plexify_content_history') || '[]');
        saved.unshift(item);
        if (saved.length > 50) saved.length = 50;
        localStorage.setItem('plexify_content_history', JSON.stringify(saved));
      } catch { /* ignore */ }
      return item;
    }
  },

  deleteFromHistory: async (id) => {
    try {
      if (typeof id === 'number') {
        const res = await fetch(`${API}/content-studio/content/${id}`, {
          method: 'DELETE',
          headers,
          credentials: 'include',
        });
        return handleResponse(res);
      }
    } catch { /* fallback below */ }
    try {
      const saved = JSON.parse(localStorage.getItem('plexify_content_history') || '[]');
      const filtered = saved.filter((item) => item.id !== id);
      localStorage.setItem('plexify_content_history', JSON.stringify(filtered));
    } catch { /* ignore */ }
  },

  getStats: async () => {
    try {
      const res = await fetch(`${API}/content-studio/stats`, {
        headers,
        credentials: 'include',
      });
      return handleResponse(res);
    } catch {
      return { total: 0, published: 0, scheduled: 0, drafts: 0, failed: 0, by_type: {} };
    }
  },

  getSuggestions: async () => {
    try {
      const res = await fetch(`${API}/content-studio/suggestions`, {
        headers,
        credentials: 'include',
      });
      return handleResponse(res);
    } catch {
      return { suggestions: [] };
    }
  },
};

export default contentGeneratorService;
