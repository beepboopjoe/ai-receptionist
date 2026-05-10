// ============================================================
// Voice Demo Router — public WebSocket proxy for the landing page demo
// Browser → ws://.../ws/demo → xAI Realtime API (key never exposed to browser)
// No auth required — this is a rate-limited public demo endpoint
// ============================================================
import type { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { config } from '../../config.js';

// ── System prompts for all verticals — imported from central file ─────────────
import { VERTICAL_PROMPTS } from './vertical-prompts.js';

// Simple in-memory rate limiter: max 3 concurrent demo connections
let activeDemoConnections = 0;
const MAX_DEMO_CONNECTIONS = 10;
const DEMO_TIMEOUT_MS = 5 * 60 * 1000; // 5 minute max session

export async function demoPlugin(app: FastifyInstance) {
  // HTTP endpoint to get available use cases (for the frontend picker)
  app.get('/demo/use-cases', async (_request, reply) => {
    return reply.send({
      useCases: Object.keys(VERTICAL_PROMPTS).map((id) => ({ id })),
      voices: [
        { id: 'Ara', label: 'Ara', description: 'Warm & professional' },
        { id: 'Eve', label: 'Eve', description: 'Clear & confident' },
        { id: 'Leo', label: 'Leo', description: 'Friendly & approachable' },
        { id: 'Rex', label: 'Rex', description: 'Authoritative & calm' },
        { id: 'Sal', label: 'Sal', description: 'Neutral & efficient' },
      ],
    });
  });

  // WebSocket proxy: browser ↔ our server ↔ xAI Realtime
  // @fastify/websocket v10: handler receives (socket, request) — socket IS the WebSocket directly
  app.get('/ws/demo', { websocket: true }, async (socket, request) => {
    if (activeDemoConnections >= MAX_DEMO_CONNECTIONS) {
      socket.send(JSON.stringify({
        type: 'error',
        error: 'Demo is busy — please try again in a moment.',
      }));
      socket.close();
      return;
    }

    activeDemoConnections++;
    app.log.info(`[demo] New connection (${activeDemoConnections} active)`);

    const query = request.query as Record<string, string>;
    const useCase = query['useCase'] ?? 'dental_receptionist';
    const voice = query['voice'] ?? 'Ara';

    const systemPrompt = VERTICAL_PROMPTS[useCase] ?? VERTICAL_PROMPTS['dental_receptionist']!;

    // Session timeout
    const timeout = setTimeout(() => {
      if (socket.readyState === 1) {
        socket.send(JSON.stringify({ type: 'session_timeout', message: 'Demo session ended after 5 minutes.' }));
        socket.close();
      }
    }, DEMO_TIMEOUT_MS);

    // Open connection to xAI Realtime API
    const xaiWs = new WebSocket(
      `wss://api.x.ai/v1/realtime?model=grok-realtime-preview`,
      {
        headers: {
          Authorization: `Bearer ${config.XAI_API_KEY}`,
        },
      }
    );

    xaiWs.on('open', () => {
      app.log.info('[demo] xAI connection opened');

      // Configure the session
      xaiWs.send(JSON.stringify({
        type: 'session.update',
        session: {
          instructions: systemPrompt,
          voice,
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',
          input_audio_transcription: {
            model: 'whisper-1',
          },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 600,
          },
          tools: [],
          tool_choice: 'none',
          modalities: ['text', 'audio'],
        },
      }));

      // Notify client we're ready
      if (socket.readyState === 1) {
        socket.send(JSON.stringify({ type: 'ready', useCase, voice }));
      }
    });

    // xAI → browser (relay all events)
    xaiWs.on('message', (data) => {
      if (socket.readyState === 1) {
        socket.send(data as Buffer);
      }
    });

    // Browser → xAI (relay all events — audio chunks, etc.)
    socket.on('message', (data: Buffer) => {
      if (xaiWs.readyState === 1) {
        xaiWs.send(data);
      }
    });

    function cleanup(reason: string) {
      clearTimeout(timeout);
      activeDemoConnections = Math.max(0, activeDemoConnections - 1);
      app.log.info(`[demo] Connection closed: ${reason} (${activeDemoConnections} active)`);
    }

    socket.on('close', () => {
      cleanup('browser disconnected');
      if (xaiWs.readyState === 1) xaiWs.close();
    });

    xaiWs.on('close', () => {
      cleanup('xAI disconnected');
      if (socket.readyState === 1) socket.close();
    });

    xaiWs.on('error', (err) => {
      app.log.error(err, '[demo] xAI WebSocket error');
      cleanup('xAI error');
      if (socket.readyState === 1) {
        socket.send(JSON.stringify({ type: 'error', error: 'Voice connection failed. Check your API key.' }));
        socket.close();
      }
    });
  });
}
