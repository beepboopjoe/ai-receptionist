'use client';
// ============================================================
// Demo video player — plays per-vertical MP4s from /public/videos/.
// Missing files never render a dead video slot: we probe metadata
// first, then either show the player or a compact "Hear a sample"
// fallback that links to /demo audio.
// ============================================================
import { useRef, useState } from 'react';
import Link from 'next/link';
import { Play, Pause, RotateCcw } from 'lucide-react';
import type { DemoVideo } from '@/lib/demo-videos';
import { DEMO_VIDEOS, getVideosForVertical } from '@/lib/demo-videos';
import type { Vertical } from '@/lib/verticals';

function HearSampleFallback({ video, dark }: { video: DemoVideo; dark: boolean }) {
  return (
    <div
      className={`rounded-2xl border px-5 py-4 flex items-center justify-between gap-3 ${
        dark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-cream-200 text-cream-900'
      }`}
    >
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-cream-900'}`}>Hear a sample</p>
        <p className={`text-xs truncate ${dark ? 'text-white/40' : 'text-cream-500'}`}>
          {video.title} — audio demo, no video yet
        </p>
      </div>
      <Link
        href="/demo"
        className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:underline"
      >
        Play audio →
      </Link>
    </div>
  );
}

function VideoCard({ video, dark = false }: { video: DemoVideo; dark?: boolean }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [missing, setMissing] = useState(false);
  const [started, setStarted] = useState(false);

  const togglePlay = () => {
    const v = ref.current;
    if (!v || missing || !ready) return;
    if (v.paused) {
      v.play().then(
        () => {
          setPlaying(true);
          setStarted(true);
        },
        () => setMissing(true)
      );
    } else {
      v.pause();
      setPlaying(false);
    }
  };
  const reset = () => {
    const v = ref.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
    setPlaying(false);
    setStarted(false);
  };

  const bg = dark
    ? 'bg-white/5 border-white/10 text-white'
    : 'bg-white border-cream-200 text-cream-900';
  const headerBg = dark ? 'border-white/10' : 'border-cream-200';
  const mutedText = dark ? 'text-white/40' : 'text-cream-500';

  return (
    <>
      <video
        ref={ref}
        src={video.src}
        poster={video.poster}
        preload="metadata"
        className="hidden"
        onLoadedMetadata={() => setReady(true)}
        onError={() => setMissing(true)}
        playsInline
      />

      {missing || !ready ? (
        missing ? <HearSampleFallback video={video} dark={dark} /> : null
      ) : (
        <div className={`rounded-2xl border overflow-hidden ${bg}`}>
          <div className="relative aspect-video bg-black">
            <video
              src={video.src}
              poster={video.poster}
              preload="metadata"
              className="w-full h-full object-cover"
              onEnded={() => setPlaying(false)}
              onError={() => setMissing(true)}
              playsInline
              ref={(el) => {
                if (el) ref.current = el;
              }}
            />
            {!started && (
              <button
                onClick={togglePlay}
                className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors group"
                aria-label="Play demo video"
              >
                <div className="w-16 h-16 rounded-full bg-brand-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Play size={28} className="text-white translate-x-0.5" />
                </div>
              </button>
            )}
          </div>

          <div className={`px-5 py-4 border-t ${headerBg} flex items-center justify-between gap-3`}>
            <div className="min-w-0 flex items-center gap-3">
              <span className="text-lg shrink-0">{video.lang === 'en' ? '🇺🇸' : '🇪🇸'}</span>
              <div className="min-w-0">
                <p className={`text-sm font-semibold truncate ${dark ? 'text-white' : 'text-cream-900'}`}>{video.title}</p>
                <p className={`text-xs truncate ${mutedText}`}>{video.scenario}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {started && (
                <button
                  onClick={reset}
                  className={`p-2 rounded-lg transition-colors ${dark ? 'hover:bg-white/10 text-white/50 hover:text-white' : 'hover:bg-cream-100 text-cream-500 hover:text-cream-800'}`}
                  title="Reset"
                >
                  <RotateCcw size={14} />
                </button>
              )}
              <button
                onClick={togglePlay}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition-colors"
              >
                {playing ? <Pause size={13} /> : <Play size={13} />}
                {playing ? 'Pause' : started ? 'Resume' : 'Play'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function DemoVideoPlayer({
  dark = false,
  vertical,
  max = 2,
}: {
  dark?: boolean;
  vertical?: Vertical;
  max?: number;
}) {
  const videos = (vertical ? getVideosForVertical(vertical) : DEMO_VIDEOS).slice(0, max);
  return (
    <div className={`grid grid-cols-1 ${videos.length > 1 ? 'md:grid-cols-2' : ''} gap-4`}>
      {videos.map((v) => (
        <VideoCard key={v.id} video={v} dark={dark} />
      ))}
    </div>
  );
}
