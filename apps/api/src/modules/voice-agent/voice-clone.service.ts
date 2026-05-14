// ============================================================
// Voice Clone Service — ElevenLabs Instant Voice Cloning (IVC)
//
// Lets a tenant upload audio samples (mp3/wav/m4a) which are sent
// to ElevenLabs' IVC API. The resulting voice_id is stored in
// tenant_settings and used automatically when voiceProvider is
// 'elevenlabs' on that tenant's account.
//
// Lifecycle:
//   none       — no clone exists
//   uploading  — API call in flight (set before the EL request)
//   ready      — EL returned a voice_id; clone is usable
//   failed     — EL API returned an error
//
// Plan gate: growth or scale plan required. Enforced in the router.
// ============================================================
import { db } from '../../db/client.js';
import { tenantSettings } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { config } from '../../config.js';
import { IntegrationError, NotFoundError, ValidationError } from '../../lib/errors.js';

const EL_BASE = 'https://api.elevenlabs.io/v1';

// ---- Allowed MIME types for voice samples ----
const ALLOWED_MIME = new Set([
  'audio/mpeg',      // mp3
  'audio/mp3',
  'audio/wav',       // wav
  'audio/x-wav',
  'audio/wave',
  'audio/mp4',       // m4a
  'audio/x-m4a',
  'audio/ogg',
  'audio/webm',
  'audio/flac',
]);

export function assertElevenLabsKey(): string {
  const key = config.ELEVENLABS_API_KEY;
  if (!key) throw new IntegrationError('elevenlabs', 'ELEVENLABS_API_KEY is not set');
  return key;
}

// ---- Types ----
export interface VoiceCloneFile {
  buffer: Buffer;
  filename: string;
  mimetype: string;
}

export interface VoiceCloneStatus {
  status: 'none' | 'uploading' | 'ready' | 'failed';
  voiceCloneId: string | null;
  voiceCloneName: string | null;
}

// ---- Helpers ----

async function getSettingsRow(tenantId: string) {
  const [row] = await db
    .select({
      id: tenantSettings.id,
      voiceCloneId: tenantSettings.voiceCloneId,
      voiceCloneStatus: tenantSettings.voiceCloneStatus,
      voiceCloneName: tenantSettings.voiceCloneName,
    })
    .from(tenantSettings)
    .where(eq(tenantSettings.tenantId, tenantId))
    .limit(1);

  if (!row) throw new NotFoundError('Settings', tenantId);
  return row;
}

// ---- Public API ----

/**
 * Upload audio samples to ElevenLabs and create an Instant Voice Clone.
 * Returns the new voice_id on success.
 */
export async function uploadVoiceClone(
  tenantId: string,
  files: VoiceCloneFile[],
  name: string
): Promise<{ voiceCloneId: string; voiceCloneName: string }> {
  const apiKey = assertElevenLabsKey();

  if (!files.length) throw new ValidationError('At least one audio file is required');
  if (files.length > 5) throw new ValidationError('Maximum 5 audio files per clone');

  const trimmedName = name.trim().slice(0, 80) || 'My Custom Voice';

  for (const f of files) {
    if (!ALLOWED_MIME.has(f.mimetype)) {
      throw new ValidationError(
        `File "${f.filename}" has unsupported type "${f.mimetype}". Use mp3, wav, m4a, ogg, flac, or webm.`
      );
    }
  }

  // Mark status as 'uploading' before making the EL request
  await db
    .update(tenantSettings)
    .set({ voiceCloneStatus: 'uploading', voiceCloneName: trimmedName })
    .where(eq(tenantSettings.tenantId, tenantId));

  // Build multipart payload using Node 18+ native FormData + Blob
  // fetch() sets the Content-Type (with boundary) automatically when body is FormData.
  const form = new FormData();
  form.append('name', trimmedName);
  for (const f of files) {
    form.append('files', new Blob([f.buffer], { type: f.mimetype }), f.filename);
  }

  let voiceId: string;
  try {
    const res = await fetch(`${EL_BASE}/voices/add`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        // Do NOT set Content-Type here — fetch adds it automatically with the correct boundary.
      },
      body: form,
    });

    if (!res.ok) {
      const errText = await res.text();
      await db
        .update(tenantSettings)
        .set({ voiceCloneStatus: 'failed' })
        .where(eq(tenantSettings.tenantId, tenantId));
      throw new IntegrationError('elevenlabs', `Voice clone failed (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as { voice_id: string };
    voiceId = data.voice_id;
  } catch (err) {
    // Ensure status is 'failed' if an unexpected error occurred
    await db
      .update(tenantSettings)
      .set({ voiceCloneStatus: 'failed' })
      .where(eq(tenantSettings.tenantId, tenantId))
      .catch(() => void 0);
    throw err;
  }

  // Persist the voice_id and mark ready
  await db
    .update(tenantSettings)
    .set({
      voiceCloneId: voiceId,
      voiceCloneStatus: 'ready',
      voiceCloneName: trimmedName,
    })
    .where(eq(tenantSettings.tenantId, tenantId));

  return { voiceCloneId: voiceId, voiceCloneName: trimmedName };
}

/**
 * Delete the tenant's voice clone from ElevenLabs and clear the DB record.
 * Idempotent — safe to call when status is 'none'.
 */
export async function deleteVoiceClone(tenantId: string): Promise<void> {
  const apiKey = assertElevenLabsKey();
  const row = await getSettingsRow(tenantId);

  if (row.voiceCloneId) {
    // Best-effort delete from EL. If it's already gone, don't fail.
    const res = await fetch(`${EL_BASE}/voices/${row.voiceCloneId}`, {
      method: 'DELETE',
      headers: { 'xi-api-key': apiKey },
    });
    if (!res.ok && res.status !== 404) {
      const errText = await res.text();
      throw new IntegrationError('elevenlabs', `Failed to delete voice from ElevenLabs (${res.status}): ${errText}`);
    }
  }

  await db
    .update(tenantSettings)
    .set({ voiceCloneId: null, voiceCloneStatus: 'none', voiceCloneName: null })
    .where(eq(tenantSettings.tenantId, tenantId));
}

/**
 * Return the current voice clone status for a tenant.
 */
export async function getVoiceCloneStatus(tenantId: string): Promise<VoiceCloneStatus> {
  const row = await getSettingsRow(tenantId);
  return {
    status: (row.voiceCloneStatus ?? 'none') as VoiceCloneStatus['status'],
    voiceCloneId: row.voiceCloneId ?? null,
    voiceCloneName: row.voiceCloneName ?? null,
  };
}
