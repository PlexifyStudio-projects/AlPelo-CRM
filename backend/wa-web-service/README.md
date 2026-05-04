# Plexify Studio — WhatsApp Web Service

Microservicio Node.js (Baileys) para el modo "WhatsApp Web" no oficial. Vive en paralelo al backend Python y se comunica con él vía HTTP + webhooks.

## Stack
- Node.js 20+
- Express 4
- @whiskeysockets/baileys 6.7+
- Pino logger, qrcode

## Variables de entorno

| Variable | Descripción | Default |
|---|---|---|
| `PORT` | Puerto HTTP | `3100` |
| `SESSIONS_DIR` | Carpeta para credenciales por sesión | `./sessions` |
| `WA_WEB_SERVICE_TOKEN` | Token compartido con backend Python (`Authorization: Bearer`) | vacío (dev) |
| `WEBHOOK_URL` | URL de fallback si la sesión no manda una | vacío |
| `LOG_LEVEL` | `error` / `warn` / `info` / `debug` | `warn` |

## Endpoints

```
POST   /sessions/:sessionId/start    { tenantId, webhookUrl }
GET    /sessions/:sessionId/status
POST   /sessions/:sessionId/send     { to, type, text|media_base64, ... }
DELETE /sessions/:sessionId          ?logout=1 borra credenciales
GET    /sessions                     lista todas
GET    /health
```

## Eventos hacia el webhook (Python)

```jsonc
// QR generado para emparejar
{ "type": "qr", "sessionId": "tenant_6", "tenantId": 6, "qrDataUrl": "data:image/png;base64,..." }

// Sesión emparejada y conectada
{ "type": "connected", "sessionId": "tenant_6", "tenantId": 6, "phone": "573145552020" }

// Desconectado (auto-reconnect en curso)
{ "type": "disconnected", "sessionId": "tenant_6", "tenantId": 6, "code": 408 }

// Baneado por WhatsApp
{ "type": "banned", "sessionId": "tenant_6", "tenantId": 6, "code": 401 }

// Mensaje entrante
{
  "type": "message",
  "sessionId": "tenant_6",
  "tenantId": 6,
  "message": {
    "wa_message_id": "ABCD",
    "from": "573145552020",
    "contact_name": "Luis",
    "timestamp": 1735000000,
    "message_type": "text",
    "content": "Hola",
    "media": null
  }
}
```

## Deploy en Railway
1. Crea un nuevo servicio Railway apuntando a este folder (`backend/wa-web-service`).
2. Agrega un volumen persistente montado en `/app/sessions`.
3. Variables: `WA_WEB_SERVICE_TOKEN`, `WEBHOOK_URL` apuntando a `https://<backend>/api/webhook/wa-web`.
4. En el backend Python: `WA_WEB_SERVICE_URL=https://<este-servicio>` y el mismo `WA_WEB_SERVICE_TOKEN`.

## Riesgos conocidos
- **WhatsApp puede banear el número.** Mitigaciones: warm-up gradual + pacing aleatorio (lo controla el backend Python).
- Si Baileys se desactualiza con cambios de WA Web, hay que bumpear la versión y re-deployar.
- Cada sesión usa ~50 MB de RAM. Para 100 tenants conectados: ~5 GB.
