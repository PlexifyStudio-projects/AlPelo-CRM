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

function sessionMetaPath(sessionId) {
  return path.join(SESSIONS_DIR, sessionId, '_plexify_meta.json');
}

async function readMetadata(sessionId) {
  try {
    const txt = await fs.readFile(sessionMetaPath(sessionId), 'utf-8');
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

async function writeMetadata(sessionId, meta) {
  try {
    await fs.mkdir(sessionAuthDir(sessionId), { recursive: true });
    await fs.writeFile(sessionMetaPath(sessionId), JSON.stringify(meta, null, 2), 'utf-8');
  } catch (e) {
    console.error('[wa-web] writeMetadata failed:', e.message);
  }
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

  // Persist metadata so the Node service can auto-resume after a Railway
  // redeploy without the dueño re-scanning the QR.
  await writeMetadata(sessionId, { tenantId, webhookUrl, savedAt: Date.now() });

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
      // Pull recent history so the dueño's existing chats appear in the app.
      // Baileys then emits 'messaging-history.set' which we forward as
      // a 'history_sync' event to the Python webhook.
      syncFullHistory: true,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
    });

    entry.sock = sock;

    sock.ev.on('creds.update', saveCreds);

    // History sync — fired after pairing with the existing chats from the phone.
    // We forward chats + recent messages so the dueño sees his current
    // conversations immediately in the app inbox.
    sock.ev.on('messaging-history.set', ({ chats, messages, isLatest }) => {
      try {
        const cutoff = Math.floor(Date.now() / 1000) - 60 * 24 * 3600; // 60 days
        const safeChats = (chats || [])
          .filter((c) => {
            const remoteJid = c.id || '';
            // skip groups, status broadcasts, newsletters
            if (!remoteJid.endsWith('@s.whatsapp.net')) return false;
            const ts = Number(c.conversationTimestamp || c.lastMessageRecvTimestamp || 0);
            return !ts || ts >= cutoff;
          })
          .map((c) => ({
            jid: c.id,
            phone: (c.id || '').split('@')[0],
            name: c.name || c.notify || null,
            unread: c.unreadCount || 0,
            timestamp: Number(c.conversationTimestamp || 0),
          }));

        // Per-chat last 50 messages (cap total payload)
        const messagesByJid = new Map();
        for (const m of messages || []) {
          const jid = m.key?.remoteJid || '';
          if (!jid.endsWith('@s.whatsapp.net')) continue;
          if (!messagesByJid.has(jid)) messagesByJid.set(jid, []);
          const arr = messagesByJid.get(jid);
          if (arr.length < 50) {
            const m_ = m.message || {};
            let body = '';
            let messageType = 'text';
            if (m_.conversation) body = m_.conversation;
            else if (m_.extendedTextMessage?.text) body = m_.extendedTextMessage.text;
            else if (m_.imageMessage) { messageType = 'image'; body = m_.imageMessage.caption || ''; }
            else if (m_.videoMessage) { messageType = 'video'; body = m_.videoMessage.caption || ''; }
            else if (m_.audioMessage) messageType = 'audio';
            else if (m_.documentMessage) { messageType = 'document'; body = m_.documentMessage.caption || ''; }
            else if (m_.stickerMessage) messageType = 'sticker';
            else messageType = 'unknown';
            arr.push({
              wa_message_id: m.key.id,
              from_me: !!m.key.fromMe,
              timestamp: Number(m.messageTimestamp || 0),
              message_type: messageType,
              content: body,
            });
          }
        }

        const safeChatsWithMsgs = safeChats.map((c) => ({
          ...c,
          messages: messagesByJid.get(c.jid) || [],
        }));

        if (safeChatsWithMsgs.length === 0) return;

        forwardEvent(webhookUrl, {
          type: 'history_sync',
          sessionId,
          tenantId,
          isLatest: !!isLatest,
          chats: safeChatsWithMsgs,
        });

        // Background: enrich each chat with profile picture + display name.
        // WhatsApp doesn't include those in messaging-history.set so we have to
        // call them per-jid. Throttle to ~5 req/sec to avoid rate-limits.
        enrichContacts(sock, safeChats, sessionId, tenantId, webhookUrl).catch((e) =>
          logger.warn({ err: e }, 'contact enrichment failed'),
        );
      } catch (err) {
        logger.error({ err }, 'history sync forward failed');
      }
    });

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
        // WHITELIST: only process individual chats. Skip groups (@g.us),
        // broadcasts (status@broadcast), channels (@newsletter), linked
        // devices (@lid), calls (@call), system bots, and any non-individual
        // JID. These produced fake "phone numbers" like 281015549427797
        // (truncated channel IDs).
        if (!remoteJid.endsWith('@s.whatsapp.net')) {
          continue;
        }
        const phone = remoteJid.split('@')[0];
        // Plausibility check: real phone numbers are 8–15 digits, all numeric.
        // Anything outside that range is almost certainly a malformed JID
        // we should not create a contact for.
        if (!/^\d{8,15}$/.test(phone)) {
          continue;
        }

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


/**
 * Scan SESSIONS_DIR at startup, find folders with both Baileys creds and our
 * Plexify metadata, and resume each session. Lets the dueño survive container
 * redeploys without re-scanning the QR.
 */
export async function resumeSavedSessions() {
  await ensureSessionsDir();
  let entries;
  try {
    entries = await fs.readdir(SESSIONS_DIR, { withFileTypes: true });
  } catch (e) {
    console.error('[wa-web] could not read sessions dir:', e.message);
    return;
  }
  const folders = entries.filter((d) => d.isDirectory()).map((d) => d.name);
  for (const sessionId of folders) {
    try {
      const credsPath = path.join(SESSIONS_DIR, sessionId, 'creds.json');
      try {
        await fs.access(credsPath);
      } catch {
        continue; // no creds — skip
      }
      const meta = await readMetadata(sessionId);
      if (!meta || !meta.tenantId) {
        console.warn(`[wa-web] session ${sessionId} has creds but no metadata — skipping resume`);
        continue;
      }
      console.log(`[wa-web] resuming session ${sessionId} (tenant ${meta.tenantId})`);
      // fire-and-forget; sock connection.update events will update state
      startSession(sessionId, { tenantId: meta.tenantId, webhookUrl: meta.webhookUrl }).catch((e) =>
        console.error(`[wa-web] resume ${sessionId} failed:`, e.message),
      );
    } catch (e) {
      console.error(`[wa-web] resume error for ${sessionId}:`, e.message);
    }
  }
}


/**
 * Public helper for on-demand enrichment of an arbitrary phone list. Used by
 * the Python /enrich-contacts endpoint when the dueño hits the "Sincronizar
 * contactos" button in Settings — gives a way to re-pull names/photos
 * without rescanning the QR.
 */
export async function lookupContacts(sessionId, phones, webhookUrl) {
  const entry = sessions.get(sessionId);
  if (!entry || entry.state !== 'connected' || !entry.sock) {
    const err = new Error(`Session ${sessionId} not connected`);
    err.code = 'NOT_CONNECTED';
    throw err;
  }
  const sock = entry.sock;
  const tenantId = entry.tenantId;
  const fakeChats = (phones || []).map((p) => ({
    jid: `${p.replace(/\D/g, '')}@s.whatsapp.net`,
    phone: p.replace(/\D/g, ''),
    name: null,
  }));
  // Reuse the same per-jid loop
  await enrichContacts(sock, fakeChats, sessionId, tenantId, webhookUrl || entry.webhookUrl);
  return { processed: fakeChats.length };
}


/**
 * Fetch profile picture + display name per chat and forward as 'contact_update'
 * events to the Python webhook. WhatsApp doesn't include those in the initial
 * messaging-history.set, so we have to ask per-jid.
 *
 * Throttled (200ms between calls) so WhatsApp doesn't rate-limit. Top 100
 * most recent chats only — older ones get enriched lazily on first incoming
 * message instead.
 */
async function enrichContacts(sock, chats, sessionId, tenantId, webhookUrl) {
  // Most-recent-first
  const ordered = [...chats]
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, 100);

  for (const chat of ordered) {
    const jid = chat.jid;
    if (!jid) continue;

    let photoUrl = null;
    let displayName = chat.name || null;

    // Profile picture (high quality). May 404 if the contact has none.
    try {
      photoUrl = await sock.profilePictureUrl(jid, 'image').catch(() => null);
    } catch {
      photoUrl = null;
    }

    // Display name lookup — onWhatsApp returns the registered handle
    if (!displayName) {
      try {
        const lookup = await sock.onWhatsApp(jid.split('@')[0]).catch(() => null);
        if (Array.isArray(lookup) && lookup[0]) {
          displayName = lookup[0].notify || lookup[0].verifiedName || null;
        }
      } catch {}
    }

    if (photoUrl || displayName) {
      forwardEvent(webhookUrl, {
        type: 'contact_update',
        sessionId,
        tenantId,
        phone: chat.phone,
        name: displayName || null,
        profile_pic_url: photoUrl || null,
      });
    }

    // Throttle: ~5 lookups/sec
    await new Promise((r) => setTimeout(r, 200));
  }
}
