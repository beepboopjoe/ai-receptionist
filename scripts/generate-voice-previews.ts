// ============================================================
// Generate per-voice preview MP3s used by the Voice Agent settings page.
//
// Run:    pnpm tsx scripts/generate-voice-previews.ts
// Needs:  XAI_API_KEY in env (get from https://console.x.ai)
//
// Produces one short preview clip per xAI voice (~5 seconds each):
//   apps/dashboard/public/audio/voices/{voice}-preview.mp3
//
// The settings page plays these when a user clicks ▶ on a voice card
// so they can hear the voice before saving their choice.
//
// Idempotent: skips files that already exist. Delete a file to force
// regeneration.
//
// Cost estimate at $4.20 / M chars: under $0.01 for the full set.
// ============================================================
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUT_DIR = join(__dirname, '..', 'apps', 'dashboard', 'public', 'audio', 'voices');
const TTS_URL = 'https://api.x.ai/v1/tts';

const VOICES = [
  { id: 'eve', text: "Hi! I'm Eve, your AI receptionist. I'll answer every call 24/7, book appointments, and make sure no caller ever goes to voicemail again." },
  { id: 'ara', text: "Hello, this is Ara. I'm your AI receptionist — always available, always professional. Let me handle your calls while you focus on your patients." },
  { id: 'rex', text: "Good afternoon. Rex here, your AI receptionist. I'll manage your inbound calls, schedule appointments, and escalate anything urgent to your team." },
  { id: 'sal', text: "Hi there, this is Sal. As your AI receptionist I'm here around the clock — booking appointments, answering questions, and keeping your calendar full." },
  { id: 'leo', text: "This is Leo, your AI receptionist. Every call answered, every appointment booked, every lead captured — I'll make sure nothing slips through." },
];

const apiKey = process.env['XAI_API_KEY'];
if (!apiKey) {
  console.error('❌ XAI_API_KEY is not set. Get a key from https://console.x.ai and run:');
  console.error('   $env:XAI_API_KEY = "xai-..."  # PowerShell');
  console.error('   export XAI_API_KEY=xai-...    # bash');
  process.exit(1);
}

if (!existsSync(OUT_DIR)) {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`📁 Created ${OUT_DIR}`);
}

async function generatePreview(voice: typeof VOICES[0]) {
  const outPath = join(OUT_DIR, `${voice.id}-preview.mp3`);

  if (existsSync(outPath)) {
    console.log(`⏭  ${voice.id}-preview.mp3 already exists — skipping`);
    return;
  }

  console.log(`🎙  Generating ${voice.id}-preview.mp3 …`);

  const body = {
    text: voice.text,
    voice_id: voice.id,
    language: 'en',
    output_format: { type: 'mp3', sample_rate: 24000, bitrate_kbps: 128 },
  };

  const res = await fetch(TTS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TTS API error for ${voice.id}: ${res.status} ${text}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  writeFileSync(outPath, Buffer.from(arrayBuffer));
  console.log(`✅ Saved ${voice.id}-preview.mp3 (${(arrayBuffer.byteLength / 1024).toFixed(0)} KB)`);
}

(async () => {
  console.log(`\n🔊 Generating voice preview clips → ${OUT_DIR}\n`);
  for (const voice of VOICES) {
    await generatePreview(voice);
  }
  console.log('\n✨ Done! All voice preview clips are ready.');
  console.log('   Users can now click ▶ on any voice card in Settings → Voice Agent to preview.\n');
})();
