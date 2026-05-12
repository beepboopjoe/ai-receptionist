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

## Demo videos (marketing pages)

The `<DemoVideoPlayer>` component on `/demo`, `/inbound`, `/outbound`, and `/pricing` plays per-vertical MP4s from `public/videos/`. The video catalog lives in [`src/lib/demo-videos.ts`](src/lib/demo-videos.ts) — each entry maps a use-case id to a file path.

To add a new video:
1. Record a 30–90s screen-and-voice capture of the AI handling the scenario (QuickTime, Loom, or OBS works). 1080p H.264/AAC, under 8 MB ideally.
2. Drop it at the path listed in `demo-videos.ts` (e.g. `public/videos/dental-recall.mp4`).
3. Commit. The player auto-detects missing files and shows a "Coming soon" fallback in their place, so partial coverage is fine while you fill out the set.

Same brand-consistency rule as audio: use the `eve` voice across all videos.
