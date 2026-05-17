// ============================================================
// Generate voice-showcase demo MP3s using xAI Grok TTS.
//
// Run:    pnpm tsx scripts/generate-voice-demos.ts
// Needs:  XAI_API_KEY in env
//
// Produces 10 files — 1 EN + 1 ES per voice — at:
//   apps/dashboard/public/audio/samples/{voice}_{lang}_demo.mp3
//
// Each script is written to show off that voice's personality.
// The caller's lines are omitted — the demo only plays the AI agent.
//
// Idempotent: skips files that already exist.
// Cost estimate: ~$0.02 for all 10 files.
// ============================================================
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUT_DIR = join(__dirname, '..', 'apps', 'dashboard', 'public', 'audio', 'samples');
const TTS_URL = 'https://api.x.ai/v1/tts';

const apiKey = process.env['XAI_API_KEY'];
if (!apiKey) {
  console.error('❌ XAI_API_KEY is not set. Get a key from https://console.x.ai and run:');
  console.error('   $env:XAI_API_KEY = "xai-..."  # PowerShell');
  console.error('   export XAI_API_KEY=xai-...    # bash');
  process.exit(1);
}

interface VoiceDemo {
  voice: string;
  lang: 'en' | 'es';
  filename: string;
  text: string;
}

// Each voice gets an EN + ES script tailored to its personality.
// Text = AI lines only, joined with " ... " for natural pause prosody.
const DEMOS: VoiceDemo[] = [
  // ── Eve — Warm & professional ────────────────────────────────
  {
    voice: 'eve', lang: 'en', filename: 'eve_en_demo',
    text: [
      "Hi, this is Eve calling from Riverside Dental.",
      "I'm reaching out because you're due for your six-month cleaning — it's been about eight months since your last visit, and we'd love to get you in.",
      "We have a couple of openings this week — Tuesday at 2 PM or Thursday at 10 AM. Would either of those work for you?",
      "... Wonderful! I've got you down for Thursday at 10 AM with Doctor Chen.",
      "You'll receive a text confirmation shortly. We really look forward to seeing you then — take care!",
    ].join(' ... '),
  },
  {
    voice: 'eve', lang: 'es', filename: 'eve_es_demo',
    text: [
      "Hola, habla Eve de la Clínica Dental Riverside.",
      "Le llamo porque tiene pendiente su limpieza dental semestral — ya han pasado casi ocho meses desde su última visita, y nos encantaría atenderle pronto.",
      "Tenemos disponibilidad este jueves a las diez de la mañana con el Doctor Chen. ¿Le funciona ese horario?",
      "... ¡Perfecto! Lo agendamos para el jueves a las diez.",
      "Le llegará un recordatorio por mensaje de texto. ¡Que tenga un excelente día y hasta el jueves!",
    ].join(' ... '),
  },

  // ── Ara — Bright & energetic ─────────────────────────────────
  {
    voice: 'ara', lang: 'en', filename: 'ara_en_demo',
    text: [
      "Hi there! This is Ara calling from Apex Insurance — you reached out about a home and auto bundle quote, and I'm so excited to help!",
      "On average our clients save 18 to 25 percent when they bundle home and auto together — it's a really great deal.",
      "I'd love to get you booked for a quick 15-minute call with one of our licensed agents. Does tomorrow at 3 PM work for you?",
      "... Amazing! You're all confirmed for tomorrow at 3 PM with Agent Rivera.",
      "Watch your inbox for a calendar invite — we are going to get you a great rate. Talk soon!",
    ].join(' ... '),
  },
  {
    voice: 'ara', lang: 'es', filename: 'ara_es_demo',
    text: [
      "¡Hola! Soy Ara de Apex Insurance. ¡Vi que solicitó una cotización para seguro de auto y me alegra muchísimo poder ayudarle!",
      "Nuestros clientes ahorran en promedio entre 18 y 25 por ciento cuando combinan seguro de casa y auto — ¡es una oferta fantástica!",
      "Me encantaría agendar una llamada rápida de 15 minutos con nuestro agente Martínez. ¿Tiene disponibilidad mañana a las tres de la tarde?",
      "... ¡Genial! ¡Quedó agendada para mañana a las tres con el agente Martínez!",
      "Le llegará la confirmación por mensaje. ¡Vamos a conseguirle el mejor precio — hasta mañana!",
    ].join(' ... '),
  },

  // ── Rex — Calm & authoritative ───────────────────────────────
  {
    voice: 'rex', lang: 'en', filename: 'rex_en_demo',
    text: [
      "Thank you for calling Smith and Associates Law. This is Rex, the intake specialist.",
      "I understand you've been involved in an accident and are seeking legal counsel. Our attorneys handle personal injury cases, and they offer a no-cost initial consultation to evaluate your situation.",
      "I'd like to secure a 30-minute appointment for you. Do you have availability tomorrow at 10 AM or 2 PM?",
      "... Thank you. I've reserved tomorrow at 10 AM with one of our senior attorneys.",
      "An attorney will review your case details before the call. You'll receive confirmation by text shortly.",
    ].join(' ... '),
  },
  {
    voice: 'rex', lang: 'es', filename: 'rex_es_demo',
    text: [
      "Gracias por llamar a Smith y Asociados. Soy Rex, el especialista de admisiones.",
      "Entiendo que estuvo involucrado en un accidente y necesita orientación legal. Nuestros abogados se especializan en casos de lesiones personales y ofrecen una consulta inicial sin ningún costo.",
      "Me gustaría reservarle una cita de 30 minutos. ¿Tiene disponibilidad mañana a las diez de la mañana o a las dos de la tarde?",
      "... Muy bien. Le he reservado mañana a las diez de la mañana con uno de nuestros abogados principales.",
      "Recibirá la confirmación por mensaje de texto en breve.",
    ].join(' ... '),
  },

  // ── Sal — Friendly & approachable ────────────────────────────
  {
    voice: 'sal', lang: 'en', filename: 'sal_en_demo',
    text: [
      "Hey! This is Sal from Horizon Realty! I saw you were checking out 42 Maple Street — great choice, by the way!",
      "It's a gorgeous 3-bedroom, 2-bath at $485,000 — still active and move-in ready. I can set you up with a showing this weekend.",
      "I have Saturday at 2 PM available with Agent Kim — does that work for you?",
      "... Awesome! You're all set for Saturday at 2 PM at 42 Maple Street.",
      "Agent Kim will be there to meet you — you are going to love this place. See you Saturday!",
    ].join(' ... '),
  },
  {
    voice: 'sal', lang: 'es', filename: 'sal_es_demo',
    text: [
      "¡Hola! Soy Sal de Horizon Realty. ¡Vi que le interesó la propiedad de la Calle Maple 42 — ¡excelente elección!",
      "Es una hermosa casa de tres recámaras con dos baños a $485,000 — sigue disponible y lista para mudarse. Puedo coordinarle una visita este fin de semana.",
      "Tengo el sábado a las dos de la tarde con la agente Kim. ¿Le funciona ese horario?",
      "... ¡Perfecto! Quedó agendado para el sábado a las dos en Calle Maple 42.",
      "La agente Kim le estará esperando — ¡le va a encantar! ¡Hasta el sábado!",
    ].join(' ... '),
  },

  // ── Leo — Sharp & efficient ───────────────────────────────────
  {
    voice: 'leo', lang: 'en', filename: 'leo_en_demo',
    text: [
      "ProFix Home Services, Leo speaking.",
      "Got your request for an AC repair. I have a technician available today between 3 and 5 PM.",
      "Can you confirm the service address and be available during that window?",
      "... Confirmed. Technician is booked for today 3 to 5 PM. You'll get a text message 30 minutes before arrival.",
      "Anything else I can help with?",
    ].join(' ... '),
  },
  {
    voice: 'leo', lang: 'es', filename: 'leo_es_demo',
    text: [
      "ProFix Servicios del Hogar, habla Leo.",
      "Recibí su solicitud para reparación de aire acondicionado. Tengo un técnico disponible hoy entre las tres y las cinco de la tarde.",
      "¿Puede confirmar la dirección del servicio y estar disponible en ese horario?",
      "... Confirmado. El técnico está agendado para hoy de tres a cinco. Recibirá un mensaje cuando esté en camino.",
      "¿Necesita algo más?",
    ].join(' ... '),
  },
];

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

interface TtsRequest {
  text: string;
  voice_id: string;
  language: string;
  output_format?: { type: 'mp3'; sample_rate?: number; bitrate_kbps?: number };
}

async function generateOne(demo: VoiceDemo): Promise<{ skipped: boolean; chars: number }> {
  const outPath = join(OUT_DIR, `${demo.filename}.mp3`);
  if (existsSync(outPath)) {
    return { skipped: true, chars: 0 };
  }

  const body: TtsRequest = {
    text: demo.text,
    voice_id: demo.voice,
    language: demo.lang,
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
    throw new Error(`xAI TTS ${res.status} for ${demo.filename}: ${errText}`);
  }

  const audio = Buffer.from(await res.arrayBuffer());
  writeFileSync(outPath, audio);
  return { skipped: false, chars: demo.text.length };
}

async function main(): Promise<void> {
  const totalChars = DEMOS.reduce((sum, d) => sum + d.text.length, 0);
  const estCost = (totalChars / 1_000_000) * 4.2;
  console.log(`📊 ${DEMOS.length} voice demos (5 voices × EN + ES)`);
  console.log(`💰 Estimated cost: $${estCost.toFixed(4)} USD`);
  console.log(`📂 Output: ${OUT_DIR}`);
  console.log();

  let generated = 0, skipped = 0, actualChars = 0;

  for (const demo of DEMOS) {
    const voiceLabel = `${demo.voice} (${demo.lang.toUpperCase()})`;
    process.stdout.write(`  ${voiceLabel.padEnd(12)} ${demo.filename}... `);
    try {
      const result = await generateOne(demo);
      if (result.skipped) {
        console.log('⏭  already exists');
        skipped++;
      } else {
        console.log(`✓ generated (${result.chars} chars)`);
        generated++;
        actualChars += result.chars;
      }
    } catch (err) {
      console.log(`✗ ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const actualCost = (actualChars / 1_000_000) * 4.2;
  console.log();
  console.log(`✅ Done. Generated ${generated}, skipped ${skipped}.`);
  if (generated > 0) {
    console.log(`💵 Actual cost: $${actualCost.toFixed(4)} USD`);
    console.log();
    console.log('Files written to apps/dashboard/public/audio/samples/:');
    DEMOS.filter((_, i) => i < generated * 2).forEach(d => console.log(`  ${d.filename}.mp3`));
  }
}

main().catch((err) => {
  console.error('❌ Generation failed:', err);
  process.exit(1);
});
