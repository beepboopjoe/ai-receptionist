// ============================================================
// Generate sample-call MP3s using xAI Grok TTS.
//
// Run:    pnpm tsx scripts/generate-sample-voices.ts
// Needs:  XAI_API_KEY in env (get from https://console.x.ai)
//
// For each call in apps/dashboard/src/lib/sample-calls.ts, this
// stitches the AI lines together (the caller's lines are intentionally
// silent — the marketing demo only HEARS the AI agent, the caller's
// text is shown as a chat bubble) and POSTs to xAI TTS, saving the
// resulting MP3 to apps/dashboard/public/audio/samples/<id>.mp3.
//
// Idempotent: skips files that already exist. Delete a file to force
// regeneration (e.g. after editing a script line).
//
// Cost estimate at $4.20 / M characters: under $0.05 for the full set.
// ============================================================
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SAMPLE_CALLS } from '../apps/dashboard/src/lib/sample-calls.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUT_DIR = join(__dirname, '..', 'apps', 'dashboard', 'public', 'audio', 'samples');
const VOICE = 'eve'; // Default Grok voice — change here if you want a different default
const TTS_URL = 'https://api.x.ai/v1/tts';

interface TtsRequest {
  text: string;
  voice_id: string;
  language: string;
  output_format?: { type: 'mp3'; sample_rate?: number; bitrate_kbps?: number };
}

const apiKey = process.env['XAI_API_KEY'];
if (!apiKey) {
  console.error('❌ XAI_API_KEY is not set. Get a key from https://console.x.ai and run:');
  console.error('   $env:XAI_API_KEY = "xai-..."  # PowerShell');
  console.error('   export XAI_API_KEY=xai-...    # bash');
  process.exit(1);
}

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

/** Join AI lines with " ... " between them — gives natural prosody for caller-response pauses. */
function aiOnlyTranscript(call: typeof SAMPLE_CALLS[number]): string {
  return call.lines
    .filter((l) => l.role === 'ai')
    .map((l) => l.text)
    .join(' ... ');
}

async function generateOne(call: typeof SAMPLE_CALLS[number]): Promise<{ skipped: boolean; chars: number }> {
  const outPath = join(OUT_DIR, `${call.id}.mp3`);
  if (existsSync(outPath)) {
    return { skipped: true, chars: 0 };
  }
  const text = aiOnlyTranscript(call);
  const body: TtsRequest = {
    text,
    voice_id: VOICE,
    language: call.lang,
    output_format: { type: 'mp3' },
  };

  const res = await fetch(TTS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`xAI TTS ${res.status} for ${call.id}: ${errText}`);
  }

  const audio = Buffer.from(await res.arrayBuffer());
  writeFileSync(outPath, audio);
  return { skipped: false, chars: text.length };
}

async function main(): Promise<void> {
  // Estimate cost up front
  const totalChars = SAMPLE_CALLS.reduce((sum, c) => sum + aiOnlyTranscript(c).length, 0);
  const estCostUsd = (totalChars / 1_000_000) * 4.2;
  console.log(`📊 ${SAMPLE_CALLS.length} sample calls, ${totalChars.toLocaleString()} characters total`);
  console.log(`💰 Estimated cost (if all regenerated): $${estCostUsd.toFixed(4)} USD`);
  console.log(`🎙️  Voice: ${VOICE}`);
  console.log(`📂 Output: ${OUT_DIR}`);
  console.log();

  let generated = 0;
  let skipped = 0;
  let actualChars = 0;

  for (const call of SAMPLE_CALLS) {
    process.stdout.write(`  ${call.id} (${call.lang})... `);
    try {
      const result = await generateOne(call);
      if (result.skipped) {
        console.log('⏭  already exists');
        skipped += 1;
      } else {
        console.log(`✓ generated (${result.chars} chars)`);
        generated += 1;
        actualChars += result.chars;
      }
    } catch (err) {
      console.log(`✗ ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const actualCost = (actualChars / 1_000_000) * 4.2;
  console.log();
  console.log(`✅ Done. Generated ${generated}, skipped ${skipped}.`);
  if (generated > 0) console.log(`💵 Actual cost: $${actualCost.toFixed(4)} USD (${actualChars.toLocaleString()} chars)`);
}

main().catch((err) => {
  console.error('❌ Generation failed:', err);
  process.exit(1);
});
