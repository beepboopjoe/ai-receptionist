// ============================================================
// useLiveCalls — derive in-progress calls + streaming transcripts
// from the activity-feed WebSocket. Pure derivation: any event
// that falls off the rolling buffer just stops contributing —
// the post-call /calls record remains the authoritative source.
// ============================================================
'use client';
import { useMemo } from 'react';
import { useActivityFeed } from './useActivityFeed';

export interface LiveTranscriptEntry {
  role: 'caller' | 'agent';
  text: string;
  timestamp: string;
}

export interface LiveCall {
  callId: string;
  callSid?: string;
  fromNumber: string;
  contactName?: string;
  vertical?: string;
  startedAt: string;
  transcript: LiveTranscriptEntry[];
}

export function useLiveCalls() {
  // Bump the ring buffer — a 5-minute call produces well over 50 events
  // (one per caller utterance + one per agent turn + greeting/end frames).
  const { events, connected } = useActivityFeed({ maxEvents: 300 });

  const activeCalls = useMemo<LiveCall[]>(() => {
    const map = new Map<string, LiveCall>();
    // events[0] is newest — walk oldest → newest so state evolves correctly.
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (!e || !e.data) continue;
      const data = e.data as Record<string, unknown>;
      const callId = data['callId'] as string | undefined;
      if (!callId) continue;

      switch (e.type) {
        case 'call_live_started': {
          // exactOptionalPropertyTypes: only spread keys whose values are defined.
          const callSid = data['callSid'] as string | undefined;
          const contactName = data['contactName'] as string | undefined;
          const vertical = data['vertical'] as string | undefined;
          const next: LiveCall = {
            callId,
            fromNumber: (data['fromNumber'] as string) ?? 'Unknown',
            startedAt: (data['startedAt'] as string) ?? e.timestamp,
            transcript: [],
            ...(callSid !== undefined && { callSid }),
            ...(contactName !== undefined && { contactName }),
            ...(vertical !== undefined && { vertical }),
          };
          map.set(callId, next);
          break;
        }
        case 'call_caller_said':
        case 'call_agent_said': {
          const existing = map.get(callId);
          if (!existing) break;
          const role = e.type === 'call_caller_said' ? 'caller' : 'agent';
          existing.transcript.push({
            role,
            text: (data['text'] as string) ?? '',
            timestamp: (data['timestamp'] as string) ?? e.timestamp,
          });
          break;
        }
        case 'call_live_ended':
        case 'call_taken_over':
          map.delete(callId);
          break;
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
    );
  }, [events]);

  return { activeCalls, connected };
}
