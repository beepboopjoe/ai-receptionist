// ============================================================
// Generate voice × language sample MP3s using xAI Grok TTS.
//
// Run:    XAI_API_KEY=xai-... pnpm tsx scripts/generate-voice-language-samples.ts
//
// Generates one MP3 per (voice × language) combination:
//   apps/dashboard/public/audio/voices/<voice>_<lang>.mp3
//
// 5 voices × 7 languages = 35 files.
// Estimated cost at $4.20 / M characters: ~$0.06 total.
//
// Idempotent — skips files that already exist.
// Delete a file to force regeneration.
// Failures for individual files are logged but do not abort the run.
// ============================================================
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VOICE_IDS, LANG_CODES, LANGUAGES, VOICES, getVoiceSample } from '../apps/dashboard/src/lib/voice-samples.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUT_DIR = join(__dirname, '..', 'apps', 'dashboard', 'public', 'audio', 'voices');
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

/** Join AI-only lines with " ... " pause markers between them. */
function aiOnlyText(lines: Array<{ role: 'ai' | 'caller'; text: string }>): string {
  return lines
    .filter((l) => l.role === 'ai')
    .map((l) => l.text)
    .join(' ... ');
}

async function generateOne(voiceId: string, langCode: string): Promise<{ skipped: boolean; chars: number }> {
  const outPath = join(OUT_DIR, `${voiceId}_${langCode}.mp3`);
  if (existsSync(outPath)) return { skipped: true, chars: 0 };

  const sample = getVoiceSample(voiceId as Parameters<typeof getVoiceSample>[0], langCode as Parameters<typeof getVoiceSample>[1]);
  const text = aiOnlyText(sample.lines);
  const langMeta = LANGUAGES[langCode as keyof typeof LANGUAGES];

  const body: TtsRequest = {
    text,
    voice_id: voiceId,
    language: langMeta.xaiCode,
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
    throw new Error(`xAI TTS ${res.status}: ${errText}`);
  }

  const audio = Buffer.from(await res.arrayBuffer());
  writeFileSync(outPath, audio);
  return { skipped: false, chars: text.length };
}

async function main(): Promise<void> {
  // Pre-compute total characters for cost estimate.
  let totalChars = 0;
  for (const lang of LANG_CODES) {
    const sample = getVoiceSample('ara', lang); // All voices share the same script per lang.
    totalChars += aiOnlyText(sample.lines).length;
  }
  const totalCombinations = VOICE_IDS.length * LANG_CODES.length;
  const charsAllCombinations = totalChars * VOICE_IDS.length;
  const estCostUsd = (charsAllCombinations / 1_000_000) * 4.2;

  console.log(`📊 ${totalCombinations} combinations (${VOICE_IDS.length} voices × ${LANG_CODES.length} languages)`);
  console.log(`📝 ~${charsAllCombinations.toLocaleString()} AI characters total`);
  console.log(`💰 Estimated cost (if all regenerated): $${estCostUsd.toFixed(4)} USD`);
  console.log(`📂 Output: ${OUT_DIR}`);
  console.log();

  let generated = 0;
  let skipped = 0;
  let failed = 0;
  let actualChars = 0;

  for (const voice of VOICE_IDS) {
    const voiceMeta = VOICES[voice];
    console.log(`\n🎙️  Voice: ${voiceMeta.label} (${voice}) — ${voiceMeta.description}`);

    for (const lang of LANG_CODES) {
      const langMeta = LANGUAGES[lang];
      const label = `  ${voice}_${lang} (${langMeta.flag} ${langMeta.label})`;
      process.stdout.write(`${label}... `);

      try {
        const result = await generateOne(voice, lang);
        if (result.skipped) {
          console.log('⏭  already exists');
          skipped += 1;
        } else {
          console.log(`✓  generated (${result.chars} chars)`);
          generated += 1;
          actualChars += result.chars;
        }
      } catch (err) {
        console.log(`✗  ${err instanceof Error ? err.message : String(err)}`);
        failed += 1;
      }
    }
  }

  const actualCostUsd = (actualChars / 1_000_000) * 4.2;
  console.log();
  console.log(`✅ Done. Generated: ${generated}, Skipped: ${skipped}, Failed: ${failed}.`);
  if (generated > 0) {
    console.log(`💵 Actual cost: $${actualCostUsd.toFixed(4)} USD (${actualChars.toLocaleString()} chars)`);
  }
  if (failed > 0) {
    console.log(`⚠️  ${failed} file(s) failed — this usually means the language isn't supported for that voice.`);
    console.log('   The UI will show a graceful "audio coming soon" placeholder for missing files.');
  }
}

main().catch((err) => {
  console.error('❌ Generation failed:', err);
  process.exit(1);
});
