// ============================================================
// Call recording persistence.
//
// Telnyx posts call.recording.saved with an MP3 URL after record_start.
// We store that URL on calls.recording_url. The dashboard never talks
// to Telnyx directly — it plays via GET /calls/:id/recording (JWT).
// ============================================================
import { db } from '../../db/client.js';
import { calls } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { config } from '../../config.js';
import { telnyxAuthorizationHeader } from '../../lib/telnyx-auth.js';

/**
 * Pull an MP3 URL out of a Telnyx recording webhook / recordings API body.
 * Telnyx has shipped a few field names; we accept all of them.
 */
export function extractTelnyxRecordingMp3Url(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;

  const fromMap = (value: unknown): string | null => {
    if (!value || typeof value !== 'object') return null;
    const mp3 = (value as { mp3?: unknown }).mp3;
    return typeof mp3 === 'string' && mp3.startsWith('http') ? mp3 : null;
  };

  return (
    fromMap(p['recording_urls']) ??
    fromMap(p['public_recording_urls']) ??
    fromMap(p['download_urls']) ??
    (typeof p['recording_url'] === 'string' && p['recording_url'].startsWith('http')
      ? p['recording_url']
      : null)
  );
}

export async function persistRecordingUrl(params: {
  url: string;
  callId?: string;
  callControlId?: string;
}): Promise<boolean> {
  if (!params.url) return false;
  try {
    if (params.callId) {
      await db
        .update(calls)
        .set({ recordingUrl: params.url, updatedAt: new Date() })
        .where(eq(calls.id, params.callId));
      return true;
    }
    if (params.callControlId) {
      await db
        .update(calls)
        .set({ recordingUrl: params.url, updatedAt: new Date() })
        .where(eq(calls.rcCallId, params.callControlId));
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/** Fetch the stored recording bytes. Returns null when Telnyx/S3 is unreachable. */
export async function fetchRecordingBytes(
  url: string
): Promise<{ body: Buffer; contentType: string } | null> {
  const headers: Record<string, string> = { Accept: 'audio/mpeg, audio/*, */*' };
  if (url.includes('api.telnyx.com')) {
    const auth = telnyxAuthorizationHeader(config.TELNYX_API_KEY);
    if (auth) headers['Authorization'] = auth;
  }
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? 'audio/mpeg';
    const body = Buffer.from(await res.arrayBuffer());
    if (body.length === 0) return null;
    return { body, contentType };
  } catch {
    return null;
  }
}
