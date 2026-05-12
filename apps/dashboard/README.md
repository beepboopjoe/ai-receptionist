# @ai-receptionist/dashboard

Next.js 14 (App Router) dashboard + marketing site.

## Run

```bash
pnpm dev   # http://localhost:3000
pnpm build
```

## Sample-call audio (marketing demo)

The `<SampleCallPlayer>` component on `/outbound`, `/inbound`, and `/pricing` plays pre-generated MP3s from `public/audio/samples/`. The audio is the AI agent's voice (xAI Grok TTS, voice = `eve`); the caller's lines render as text-only.

If you've never run the generation script, the audio files won't exist yet and the player will show a "Sample audio not available" fallback that links to `/demo` (live AI). To create them once:

```bash
$env:XAI_API_KEY = "xai-..."          # PowerShell — get key from console.x.ai
pnpm tsx scripts/generate-sample-voices.ts
```

The script is idempotent: it skips files that already exist. Edit `apps/dashboard/src/lib/sample-calls.ts` to change a script line, **delete the corresponding `.mp3`**, then re-run the script. Cost is negligible — under $0.05 to regenerate the entire set at $4.20 per million characters.

The MP3s are committed to git so deploys serve them from `public/`. Do not put them in `.gitignore`.
