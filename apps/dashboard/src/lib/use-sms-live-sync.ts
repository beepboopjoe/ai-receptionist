'use client';
// Revalidate Messages / Contacts when inbound or outbound SMS lands.
import { useEffect, useRef } from 'react';
import { mutate } from 'swr';
import { useActivityFeed } from './useActivityFeed';

export function useSmsLiveSync(phone?: string): void {
  const { events } = useActivityFeed({ maxEvents: 8 });
  const lastTs = useRef<string | null>(null);

  useEffect(() => {
    const latest = events[0];
    if (!latest) return;
    if (latest.type !== 'sms_received' && latest.type !== 'sms_sent') return;
    if (latest.timestamp === lastTs.current) return;
    lastTs.current = latest.timestamp;
    void mutate('sms-conversations');
    if (phone) void mutate(['sms-thread', phone]);
    void mutate((key) => Array.isArray(key) && (key[0] === 'contacts' || key[0] === 'sms-thread'));
  }, [events, phone]);
}
