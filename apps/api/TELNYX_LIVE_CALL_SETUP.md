# Live Telnyx Call Setup

End state: someone calls **+1 (626) 517-0214** and the AI receptionist (Aria) picks up, powered by xAI Grok Realtime — all without Postgres or Redis.

## What's already done

- `apps/api/src/modules/telephony/telnyx-webhook.devmode.handler.ts` — DB-free Telnyx handler. Answers inbound calls, starts the media stream, and bridges audio to xAI Grok.
- Mounted on the dev server at:
  - `POST /api/v1/webhooks/telnyx` — call lifecycle events
  - `GET  /api/v1/webhooks/telnyx/stream` — bidirectional audio WebSocket
- `XAI_API_KEY`, `TELNYX_API_KEY`, `TELNYX_FROM_NUMBER=+16265170214` are already populated in `apps/api/.env`.

## What you need to do

### 1. Start the dev server

```bash
pnpm --filter @ai-receptionist/api run demo
```

You should see:

```
🚀 Dev server listening on http://localhost:3001
   Telnyx webhook:   http://localhost:3001/api/v1/webhooks/telnyx
```

### 2. Expose port 3001 to the public internet

Telnyx needs an HTTPS URL. Pick one:

**Option A — localtunnel (free, no signup)**

```bash
npx localtunnel --port 3001
```

→ outputs something like `https://lazy-puma-22.loca.lt`

**Option B — ngrok (more reliable, free tier requires signup)**

```bash
ngrok http 3001
```

→ outputs something like `https://abc-123-456.ngrok-free.app`

### 3. Point Telnyx at your tunnel

1. Open <https://portal.telnyx.com>
2. **Voice → Programmable Voice → Applications**
3. Click your application (or create one and assign +1 626 517 0214 to it)
4. Set **Webhook URL** to:
   ```
   https://<your-tunnel-host>/api/v1/webhooks/telnyx
   ```
5. **Webhook API Version**: `v2`
6. Click **Save**

### 4. Call the number

Dial **+1 (626) 517-0214**.

You should hear:

> "Thank you for calling Riverside Dental Group, this is Aria. How can I help you today?"

Try saying "I'd like to book a cleaning" — Aria will respond conversationally.

## Verifying it's working

Watch the dev server logs. A successful call shows:

```
[telnyx-devmode] Telnyx event eventType=call.initiated
[telnyx-devmode] Inbound call answered from=+1...
[telnyx-devmode] Telnyx event eventType=call.answered
[telnyx-devmode] Media stream requested streamUrl=wss://...
[telnyx-devmode] Telnyx stream started
[telnyx-devmode] Grok WS connected
[telnyx-devmode] Telnyx event eventType=call.hangup
```

If the call rings out without answering, the webhook URL is wrong or the tunnel is down.
If the call connects but you hear silence, `XAI_API_KEY` is missing or invalid — check the logs for `Grok WS error`.

## Promoting to production

The devmode handler is intentionally DB-free. For prod use the real handler at `modules/telephony/telnyx-webhook.handler.ts` which writes call records, escalations, and campaign progress to Postgres. Same Telnyx webhook URL, just point it at the production API.
