/**
 * Session manager — one Baileys socket per tenant, kept alive in-memory.
 * Auth state persists to disk so we survive restarts without re-pairing.
 */
import {
  default as makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import path from 'node:path';
import fs from 'node:fs/promises';
import qrcode from 'qrcode';
import pino from 'pino';

import { forwardEvent } from './webhook.js';

const SESSIONS_DIR = process.env.SESSIONS_DIR || path.resolve('./sessions');

const logger = pino({ level: process.env.LOG_LEVEL || 'warn' });

/**
 * In-memory registry. Each session entry:
 *   { sock, state: 'connecting'|'qr'|'connected'|'disconnected'|'banned',
 *     qr: string|null, qrDataUrl: string|null, phone: string|null,
 *     lastError: string|null, connectedAt: Date|null }
 */
const sessions = new Map();

async function ensureSessionsDir() {
  await fs.mkdir(SESSIONS_DIR, { recursive: true });
}

function sessionAuthDir(sessionId) {
  return path.join(SESSIONS_DIR, sessionId);
}

function getOrCreate(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      sock: null,
      state: 'disconnected',
      qr: null,
      qrDataUrl: null,
      phone: null,
      lastError: null,
      connectedAt: null,
      starting: false,
    });
  }
  return sessions.get(sessionId);
}

export function getSessionStatus(sessionId) {
  const s = sessions.get(sessionId);
  if (!s) return { state: 'disconnected', qr: null, phone: null };
  return {
    state: s.state,
    qr: s.qrDataUrl,
    phone: s.phone,
    lastError: s.lastError,
    connectedAt: s.connectedAt,
  };
}

export async function startSession(sessionId, { tenantId, webhookUrl }) {
  await ensureSessionsDir();
  const entry = getOrCreate(sessionId);

  if (entry.starting) {
    return { state: entry.state, qr: entry.qrDataUrl };
  }
  if (entry.state === 'connected' && entry.sock) {
    return { state: 'connected', qr: null, phone: entry.phone };
  }

  entry.starting = true;
  entry.state = 'connecting';
  entry.lastError = null;
  entry.tenantId = tenantId;
  entry.webhookUrl = webhookUrl;

  try {
    const authDir = sessionAuthDir(sessionId);
    await fs.mkdir(authDir, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      logger,
      printQRInTerminal: false,
      browser: ['Plexify Studio', 'Chrome', '1.0'],
      syncFullHistory: false,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
    });

    entry.sock = sock;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          entry.qr = qr;
          entry.qrDataUrl = await qrcode.toDataURL(qr, { margin: 1, width: 320 });
          entry.state = 'qr';
          forwardEvent(webhookUrl, {
            type: 'qr',
            sessionId,
            tenantId,
            qrDataUrl: entry.qrDataUrl,
          });
        } catch (err) {
          logger.error({ err }, 'QR encoding failed');
        }
      }

      if (connection === 'open') {
        entry.state = 'connected';
        entry.qr = null;
        entry.qrDataUrl = null;
        entry.connectedAt = new Date();
        try {
          entry.phone = sock.user?.id?.split(':')?.[0]?.split('@')?.[0] || null;
        } catch {}
        forwardEvent(webhookUrl, {
          type: 'connected',
          sessionId,
          tenantId,
          phone: entry.phone,
        });
      }

      if (connection === 'close') {
        const code = (lastDisconnect?.error instanceof Boom)
          ? lastDisconnect.error.output?.statusCode
          : null;
        const wasLogout = code === DisconnectReason.loggedOut;
        const banned = code === 401 || code === 403;
        entry.state = banned ? 'banned' : 'disconnected';
        entry.lastError = lastDisconnect?.error?.message || `code:${code}`;
        forwardEvent(webhookUrl, {
          type: banned ? 'banned' : 'disconnected',
          sessionId,
          tenantId,
          code,
          error: entry.lastError,
        });

        // Auto-reconnect unless explicit logout/ban
        if (!wasLogout && !banned) {
          setTimeout(() => {
            entry.starting = false;
            startSession(sessionId, { tenantId, webhookUrl }).catch((e) =>
              logger.error({ e }, 'Reconnect failed'),
            );
          }, 3000);
        }
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        if (msg.key?.fromMe) continue;
        const remoteJid = msg.key?.remoteJid || '';
        // Skip groups and broadcasts
        if (remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast') continue;
        const phone = remoteJid.split('@')[0];

        let body = '';
        let messageType = 'text';
        let mediaInfo = null;
        const m = msg.message || {};

        if (m.conversation) {
          body = m.conversation;
        } else if (m.extendedTextMessage?.text) {
          body = m.extendedTextMessage.text;
        } else if (m.imageMessage) {
          messageType = 'image';
          body = m.imageMessage.caption || '';
          mediaInfo = { mime: m.imageMessage.mimetype };
        } else if (m.videoMessage) {
          messageType = 'video';
          body = m.videoMessage.caption || '';
        } else if (m.audioMessage) {
          messageType = 'audio';
        } else if (m.documentMessage) {
          messageType = 'document';
          body = m.documentMessage.caption || '';
          mediaInfo = { filename: m.documentMessage.fileName, mime: m.documentMessage.mimetype };
        } else if (m.stickerMessage) {
          messageType = 'sticker';
        } else if (m.reactionMessage) {
          messageType = 'reaction';
          body = m.reactionMessage.text || '';
        } else {
          messageType = 'unknown';
        }

        forwardEvent(webhookUrl, {
          type: 'message',
          sessionId,
          tenantId,
          message: {
            wa_message_id: msg.key.id,
            from: phone,
            contact_name: msg.pushName || null,
            timestamp: msg.messageTimestamp ? Number(msg.messageTimestamp) : null,
            message_type: messageType,
            content: body,
            media: mediaInfo,
          },
        });
      }
    });

    return { state: entry.state, qr: entry.qrDataUrl };
  } catch (err) {
    entry.state = 'disconnected';
    entry.lastError = err.message;
    throw err;
  } finally {
    entry.starting = false;
  }
}

export async function stopSession(sessionId, { logout = false } = {}) {
  const entry = sessions.get(sessionId);
  if (!entry) return { stopped: false };

  try {
    if (entry.sock) {
      if (logout) {
        await entry.sock.logout().catch(() => {});
      } else {
        entry.sock.end(undefined);
      }
    }
  } finally {
    entry.sock = null;
    entry.state = logout ? 'disconnected' : 'disconnected';
    entry.qr = null;
    entry.qrDataUrl = null;
  }

  if (logout) {
    try {
      await fs.rm(sessionAuthDir(sessionId), { recursive: true, force: true });
    } catch {}
    sessions.delete(sessionId);
  }
  return { stopped: true };
}

export async function sendMessage(sessionId, payload) {
  const entry = sessions.get(sessionId);
  if (!entry || entry.state !== 'connected' || !entry.sock) {
    const err = new Error(`Session ${sessionId} not connected (state=${entry?.state || 'missing'})`);
    err.code = 'NOT_CONNECTED';
    throw err;
  }

  const sock = entry.sock;
  const to = payload.to.replace(/\D/g, '');
  const jid = to.endsWith('@s.whatsapp.net') ? to : `${to}@s.whatsapp.net`;

  // Best-effort presence + typing simulation (looks human)
  try {
    await sock.sendPresenceUpdate('available', jid);
    await sock.sendPresenceUpdate('composing', jid);
    const typingMs = 800 + Math.floor(Math.random() * 1600);
    await new Promise((r) => setTimeout(r, typingMs));
    await sock.sendPresenceUpdate('paused', jid);
  } catch {}

  let result;
  if (payload.type === 'text') {
    result = await sock.sendMessage(jid, { text: payload.text || '' });
  } else if (payload.type === 'image') {
    const buffer = Buffer.from(payload.media_base64, 'base64');
    result = await sock.sendMessage(jid, {
      image: buffer,
      caption: payload.caption || '',
      mimetype: payload.mime || 'image/jpeg',
    });
  } else if (payload.type === 'document') {
    const buffer = Buffer.from(payload.media_base64, 'base64');
    result = await sock.sendMessage(jid, {
      document: buffer,
      mimetype: payload.mime || 'application/pdf',
      fileName: payload.filename || 'document.pdf',
      caption: payload.caption || '',
    });
  } else if (payload.type === 'audio') {
    const buffer = Buffer.from(payload.media_base64, 'base64');
    result = await sock.sendMessage(jid, {
      audio: buffer,
      mimetype: payload.mime || 'audio/mp4',
      ptt: !!payload.ptt,
    });
  } else {
    const err = new Error(`Unsupported type: ${payload.type}`);
    err.code = 'UNSUPPORTED_TYPE';
    throw err;
  }

  return {
    messageId: result?.key?.id || null,
    timestamp: result?.messageTimestamp ? Number(result.messageTimestamp) : null,
  };
}

export async function listSessions() {
  return Array.from(sessions.entries()).map(([id, s]) => ({
    sessionId: id,
    state: s.state,
    phone: s.phone,
    connectedAt: s.connectedAt,
  }));
}
