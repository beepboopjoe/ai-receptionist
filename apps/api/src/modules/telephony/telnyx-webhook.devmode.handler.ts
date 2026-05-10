// ============================================================
// Telnyx Webhook Handler — DEV MODE (no DB, no Redis, no BullMQ)
//
// Self-contained handler for live Telnyx calls bridged to xAI Grok.
// Uses only env vars — never imports config.ts (which requires DB).
//
// Flow:
//   POST /webhooks/telnyx       → call.initiated → answer
//                                call.answered  → start media stream
//                                call.hangup    → log & forget
//   GET  /webhooks/telnyx/stream (WS) → bridge audio ↔ wss://api.x.ai/v1/realtime
//
// Setup:
//   1. Run dev server: pnpm --filter @ai-receptionist/api run demo
//   2. Expose port via localtunnel: lt --port 3001
//   3. In Telnyx dashboard, set webhook URL to:
//        https://<tunnel-host>/api/v1/webhooks/telnyx
//   4. Call +1 626-517-0214 — AI answers as "Aria"
// ============================================================
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import type { WebSocket as WsWebSocket } from 'ws';
import { WebSocket as WsClient } from 'ws';
import pino from 'pino';

const logger = pino({ name: 'telnyx-devmode' });

const TELNYX_API = 'https://api.telnyx.com/v2';
const SYSTEM_PROMPT = `You are Aria, an AI receptionist. Greet callers warmly and
help them book, reschedule, or cancel appointments. Answer questions about services
offered. If a caller has an urgent situation, let them know you'll get someone on the
line right away. Keep replies short and natural — this is a phone call. Start with:
"Thank you for calling, this is Aria. How can I help you today?"`;

interface TelnyxEventPayload {
  call_control_id: string;
  client_state?: string;
  direction?: 'incoming' | 'outgoing';
  from?: string;
  to?: string;
  hangup_cause?: string;
}

interface TelnyxEvent {
  data: { event_type: string; payload: TelnyxEventPayload };
}

function encodeState(obj: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64');
}

function decodeState(s?: string): Record<string, unknown> {
  if (!s) return {};
  try {
    return JSON.parse(Buffer.from(s, 'base64').toString());
  } catch {
    return {};
  }
}

async function telnyxPost(path: string, body: object): Promise<void> {
  const apiKey = process.env['TELNYX_API_KEY'];
  if (!apiKey) {
    logger.warn('TELNYX_API_KEY missing — cannot call Telnyx API');
    return;
  }
  const res = await fetch(`${TELNYX_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    logger.error({ path, status: res.status, text }, 'Telnyx API error');
  }
}

async function answerCall(callControlId: string, clientState: string): Promise<void> {
  await telnyxPost(`/calls/${callControlId}/actions/answer`, {
    client_state: clientState,
  });
}

async function startMediaStream(
  callControlId: string,
  streamUrl: string,
  clientState: string
): Promise<void> {
  await telnyxPost(`/calls/${callControlId}/actions/streaming_start`, {
    stream_url: streamUrl,
    stream_track: 'both_tracks',
    enable_dialogflow: false,
    client_state: clientState,
  });
}

// ── Webhook HTTP handler ──────────────────────────────────────
async function handleWebhook(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const event = req.body as TelnyxEvent;
  const eventType = event?.data?.event_type;
  const payload = event?.data?.payload;

  if (!eventType || !payload) {
    return reply.code(400).send({ error: 'Invalid event' });
  }

  // Acknowledge instantly
  reply.code(200).send({ ok: true });

  void dispatch(eventType, payload, req).catch((err) => {
    logger.error({ err, eventType }, 'devmode dispatch failed');
  });
}

async function dispatch(
  eventType: string,
  payload: TelnyxEventPayload,
  req: FastifyRequest
): Promise<void> {
  const { call_control_id, client_state } = payload;
  const state = decodeState(client_state);

  logger.info({ eventType, callControlId: call_control_id }, 'Telnyx event');

  switch (eventType) {
    case 'call.initiated': {
      if (payload.direction !== 'incoming') return;
      const newState = encodeState({
        callId: `dev_${Date.now()}`,
        fromNumber: payload.from,
        toNumber: payload.to,
        callSid: call_control_id,
      });
      await answerCall(call_control_id, newState);
      logger.info({ from: payload.from, to: payload.to }, 'Inbound call answered');
      break;
    }

    case 'call.answered': {
      // Build the WS URL from the incoming request — works through localtunnel/ngrok
      const proto = (req.headers['x-forwarded-proto'] as string) === 'https' ? 'wss' : 'ws';
      const host = req.headers['x-forwarded-host'] ?? req.headers.host;
      const streamUrl = `${proto}://${host}/api/v1/webhooks/telnyx/stream`;
      await startMediaStream(call_control_id, streamUrl, encodeState({ ...state, callSid: call_control_id }));
      logger.info({ streamUrl }, 'Media stream requested');
      break;
    }

    case 'call.hangup':
      logger.info({ cause: payload.hangup_cause, callControlId: call_control_id }, 'Call ended');
      break;

    default:
      logger.debug({ eventType }, 'Unhandled event');
  }
}

// ── WebSocket bridge: Telnyx ↔ xAI Grok ───────────────────────
function bridgeMediaStream(telnyxSocket: WsWebSocket): void {
  const xaiKey = process.env['XAI_API_KEY'];
  if (!xaiKey) {
    logger.error('XAI_API_KEY missing — cannot connect to Grok');
    telnyxSocket.close();
    return;
  }

  let grokSocket: WsClient | null = null;
  let grokReady = false;
  const queuedAudio: string[] = [];

  function connectGrok() {
    grokSocket = new WsClient('wss://api.x.ai/v1/realtime?model=grok-realtime-preview', {
      headers: { Authorization: `Bearer ${xaiKey}` },
    });

    grokSocket.on('open', () => {
      logger.info('Grok WS connected');
      grokSocket!.send(
        JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['audio', 'text'],
            instructions: SYSTEM_PROMPT,
            voice: 'alloy',
            input_audio_format: 'g711_ulaw',
            output_audio_format: 'g711_ulaw',
            turn_detection: { type: 'server_vad' },
          },
        })
      );
      // Trigger initial greeting
      grokSocket!.send(JSON.stringify({ type: 'response.create' }));
      grokReady = true;
      // Flush queue
      for (const chunk of queuedAudio) {
        grokSocket!.send(
          JSON.stringify({ type: 'input_audio_buffer.append', audio: chunk })
        );
      }
      queuedAudio.length = 0;
    });

    grokSocket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'response.audio.delta' && msg.delta) {
          telnyxSocket.send(
            JSON.stringify({ event: 'media', media: { payload: msg.delta } })
          );
        } else if (msg.type === 'error') {
          logger.error({ msg }, 'Grok error');
        }
      } catch (err) {
        logger.warn({ err }, 'Bad Grok message');
      }
    });

    grokSocket.on('error', (err) => logger.error({ err }, 'Grok WS error'));
    grokSocket.on('close', () => {
      logger.info('Grok WS closed');
      grokReady = false;
    });
  }

  telnyxSocket.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.event === 'start') {
        logger.info({ streamId: msg.stream_id }, 'Telnyx stream started');
        connectGrok();
      } else if (msg.event === 'media' && msg.media?.payload) {
        if (grokReady && grokSocket?.readyState === WsClient.OPEN) {
          grokSocket.send(
            JSON.stringify({
              type: 'input_audio_buffer.append',
              audio: msg.media.payload,
            })
          );
        } else {
          queuedAudio.push(msg.media.payload);
        }
      } else if (msg.event === 'stop') {
        logger.info('Telnyx stream stopped');
        grokSocket?.close();
      }
    } catch (err) {
      logger.warn({ err }, 'Bad Telnyx message');
    }
  });

  telnyxSocket.on('close', () => {
    logger.info('Telnyx WS closed');
    grokSocket?.close();
  });

  telnyxSocket.on('error', (err) => {
    logger.error({ err }, 'Telnyx WS error');
    grokSocket?.close();
  });
}

// ── Fastify plugin ────────────────────────────────────────────
export const telnyxDevmodePlugin: FastifyPluginAsync = async (app) => {
  app.post('/webhooks/telnyx', handleWebhook);

  app.get('/webhooks/telnyx/stream', { websocket: true }, (socket /*, req */) => {
    bridgeMediaStream(socket as unknown as WsWebSocket);
  });
};
