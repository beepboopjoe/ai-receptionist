// ============================================================
// useActivityFeed — WebSocket hook for real-time dashboard events
// Connects to ws://localhost:3001/ws/activity?token=JWT
// ============================================================
'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

export type ActivityEventType =
  | 'call_started'
  | 'call_completed'
  | 'appointment_booked'
  | 'appointment_cancelled'
  | 'escalation_created'
  | 'campaign_lead_connected';

export interface ActivityEvent {
  type: ActivityEventType;
  data: Record<string, unknown>;
  timestamp: string;
}

interface UseActivityFeedOptions {
  /** Max events to keep in state (oldest dropped first) */
  maxEvents?: number;
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
}

const API_HOST =
  (process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1')
    .replace('http://', 'ws://')
    .replace('https://', 'wss://')
    .replace('/api/v1', '');

export function useActivityFeed({
  maxEvents = 50,
  autoReconnect = true,
}: UseActivityFeedOptions = {}) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(false);

  const connect = useCallback(() => {
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) return;

    const url = `${API_HOST}/ws/activity?token=${encodeURIComponent(token)}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (isMounted.current) setConnected(true);
    };

    ws.onmessage = (evt) => {
      try {
        const event = JSON.parse(evt.data as string) as ActivityEvent;
        if (isMounted.current) {
          setEvents((prev) => {
            const next = [event, ...prev];
            return next.length > maxEvents ? next.slice(0, maxEvents) : next;
          });
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (isMounted.current) {
        setConnected(false);
        if (autoReconnect) {
          reconnectTimer.current = setTimeout(connect, 3000);
        }
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [maxEvents, autoReconnect]);

  useEffect(() => {
    isMounted.current = true;
    connect();

    return () => {
      isMounted.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const clearEvents = useCallback(() => setEvents([]), []);

  return { events, connected, clearEvents };
}
