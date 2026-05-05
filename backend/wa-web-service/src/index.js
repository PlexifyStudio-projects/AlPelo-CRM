/**
 * HTTP API for the Plexify Studio WhatsApp Web service.
 *
 * Endpoints:
 *   POST   /sessions/:sessionId/start       { tenantId, webhookUrl }
 *   GET    /sessions/:sessionId/status
 *   POST   /sessions/:sessionId/send        { to, type, text|media_base64, ... }
 *   DELETE /sessions/:sessionId             ?logout=1 to wipe credentials
 *   GET    /sessions                        list all in-memory sessions
 *   GET    /health
 *
 * Auth: every protected request must carry `Authorization: Bearer <WA_WEB_SERVICE_TOKEN>`.
 */
import express from 'express';
import morgan from 'morgan';
import { startSession, stopSession, sendMessage, getSessionStatus, listSessions, lookupContacts, resumeSavedSessions } from './sessionManager.js';

const PORT = parseInt(process.env.PORT || '3100', 10);
const HOST = process.env.BIND_HOST || '0.0.0.0'; // entrypoint sets 127.0.0.1 when embedded
const TOKEN = process.env.WA_WEB_SERVICE_TOKEN || '';

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use(morgan('tiny'));

function requireAuth(req, res, next) {
  if (!TOKEN) return next(); // dev mode
  const header = req.get('Authorization') || '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (provided !== TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

app.get('/health', (req, res) => res.json({ ok: true, service: 'wa-web', uptime: process.uptime() }));

app.use(requireAuth);

app.get('/sessions', async (req, res) => {
  res.json({ sessions: await listSessions() });
});

app.post('/sessions/:sessionId/start', async (req, res) => {
  const { sessionId } = req.params;
  const { tenantId, webhookUrl } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
  try {
    const result = await startSession(sessionId, { tenantId, webhookUrl });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/sessions/:sessionId/status', async (req, res) => {
  const { sessionId } = req.params;
  res.json({ ok: true, sessionId, ...getSessionStatus(sessionId) });
});

app.post('/sessions/:sessionId/send', async (req, res) => {
  const { sessionId } = req.params;
  try {
    const result = await sendMessage(sessionId, req.body || {});
    res.json({ ok: true, ...result });
  } catch (err) {
    const status = err.code === 'NOT_CONNECTED' ? 409 : 500;
    res.status(status).json({ ok: false, error: err.message, code: err.code });
  }
});

// On-demand contact enrichment — Python calls this with a list of phones
// when the dueño hits "Sincronizar contactos". Each phone gets looked up via
// profilePictureUrl + onWhatsApp and a 'contact_update' event is forwarded
// back to the configured webhookUrl.
app.post('/sessions/:sessionId/lookup-contacts', async (req, res) => {
  const { sessionId } = req.params;
  const { phones, webhookUrl } = req.body || {};
  if (!Array.isArray(phones) || phones.length === 0) {
    return res.status(400).json({ ok: false, error: 'phones[] required' });
  }
  try {
    // Fire-and-forget — enrichment is throttled and slow (~5/sec).
    lookupContacts(sessionId, phones, webhookUrl).catch((e) =>
      console.error('[wa-web] lookupContacts error:', e.message),
    );
    res.json({ ok: true, queued: phones.length });
  } catch (err) {
    const status = err.code === 'NOT_CONNECTED' ? 409 : 500;
    res.status(status).json({ ok: false, error: err.message, code: err.code });
  }
});

app.delete('/sessions/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const logout = req.query.logout === '1' || req.query.logout === 'true';
  try {
    const result = await stopSession(sessionId, { logout });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.use((err, req, res, next) => {
  console.error('[wa-web] unhandled', err);
  res.status(500).json({ ok: false, error: err.message });
});

app.listen(PORT, HOST, () => {
  console.log(`[wa-web] listening on ${HOST}:${PORT} (token=${TOKEN ? 'set' : 'dev-mode'})`);
  // Resume any sessions that were paired before this container restarted.
  // Without this, every Railway redeploy leaves the dueño disconnected
  // until they manually re-scan the QR.
  resumeSavedSessions().catch((e) => console.error('[wa-web] resumeSavedSessions failed:', e.message));
});
