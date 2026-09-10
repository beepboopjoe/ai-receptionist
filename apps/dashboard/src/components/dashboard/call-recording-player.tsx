'use client';
// Plays a tenant-scoped call recording fetched through the authenticated
// API proxy. Empty state when Telnyx never wrote a URL.
import { useEffect, useState } from 'react';
import { callsApi } from '@/lib/api';
import { Volume2 } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

export function CallRecordingPlayer({
  callId,
  hasRecording,
}: {
  callId: string;
  hasRecording: boolean;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasRecording) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    void callsApi
      .recordingObjectUrl(callId)
      .then((url) => {
        if (cancelled) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setSrc(url);
        if (!url) setError('Recording file is missing');
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load recording');
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [callId, hasRecording]);

  if (!hasRecording) {
    return (
      <EmptyState
        icon={Volume2}
        label="No recording"
        hint="Recordings appear here after Telnyx saves the MP3. If this call just ended, refresh in a few seconds."
      />
    );
  }

  return (
    <div className="card p-6 space-y-3">
      <h2 className="font-semibold text-gray-900">Recording</h2>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {src ? (
        <audio controls src={src} className="w-full" preload="metadata">
          Your browser does not support audio playback.
        </audio>
      ) : (
        !error && <p className="text-sm text-gray-500">Loading recording…</p>
      )}
    </div>
  );
}
