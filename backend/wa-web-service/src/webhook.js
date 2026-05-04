/**
 * Webhook forwarder — POSTs Baileys events to the Python backend.
 * Failures are logged but never throw, so a misconfigured webhook can't
 * crash the WA session.
 */
const SHARED_TOKEN = process.env.WA_WEB_SERVICE_TOKEN || '';
const FALLBACK_WEBHOOK = process.env.WEBHOOK_URL || '';

export function forwardEvent(webhookUrl, payload) {
  const url = webhookUrl || FALLBACK_WEBHOOK;
  if (!url) return;
  // Fire-and-forget. Don't block the WA event loop.
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-WA-Web-Token': SHARED_TOKEN,
    },
    body: JSON.stringify(payload),
  }).catch((err) => {
    console.error('[webhook] forward failed:', err.message);
  });
}
