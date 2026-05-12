'use client';
// ============================================================
// Demo video player — plays the per-vertical MP4 from /public/videos/.
//
// Used on /demo, /inbound, /outbound, /pricing in place of (or
// alongside) the audio-only SampleCallPlayer. If the MP4 file
// doesn't exist yet (404), gracefully falls back to a "Coming
// soon — try the live AI demo" link.
// ============================================================
import { useRef, useState } from 'react';
import Link from 'next/link';
import { Play, Pause, RotateCcw } from 'lucide-react';
import type { DemoVideo } from '@/lib/demo-videos';
import { DEMO_VIDEOS, getVideosForVertical } from '@/lib/demo-videos';
import type { Vertical } from '@/lib/verticals';

function VideoCard({ video, dark = false }: { video: DemoVideo; dark?: boolean }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [missing, setMissing] = useState(false);
  const [started, setStarted] = useState(false);

  const togglePlay = () => {
    const v = ref.current;
    if (!v || missing) return;
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
    <div className={`rounded-2xl border overflow-hidden ${bg}`}>
      {/* Video frame */}
      <div className="relative aspect-video bg-black">
        {!missing && (
          <video
            ref={ref}
            src={video.src}
            poster={video.poster}
            preload="metadata"
            className="w-full h-full object-cover"
            onEnded={() => setPlaying(false)}
            onError={() => setMissing(true)}
            playsInline
          />
        )}

        {/* Overlay — covers idle state with a custom play button */}
        {!started && !missing && (
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

        {missing && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-cream-900 to-cream-700 text-white text-center px-6">
            <div>
              <p className="text-sm font-semibold mb-2">🎬 Video coming soon</p>
              <p className="text-xs opacity-80 mb-4">We're recording this scenario right now.</p>
              <Link
                href="/demo"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-300 hover:text-brand-200"
              >
                Try the live AI demo →
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Footer with title + controls */}
      <div className={`px-5 py-4 border-t ${headerBg} flex items-center justify-between gap-3`}>
        <div className="min-w-0 flex items-center gap-3">
          <span className="text-lg shrink-0">{video.lang === 'en' ? '🇺🇸' : '🇪🇸'}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`text-[10px] font-bold uppercase tracking-[0.15em] ${dark ? 'text-brand-400' : 'text-brand-600'}`}>
                Demo Video
              </p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${dark ? 'bg-white/10 text-white/50' : 'bg-cream-100 text-cream-500'}`}>
                {video.duration}
              </span>
            </div>
            <p className={`text-sm font-semibold mt-0.5 truncate ${dark ? 'text-white' : 'text-cream-900'}`}>{video.title}</p>
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
            disabled={missing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {playing ? <Pause size={13} /> : <Play size={13} />}
            {playing ? 'Pause' : started ? 'Resume' : 'Play'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DemoVideoPlayer({
  dark = false,
  vertical,
  max = 2,
}: {
  dark?: boolean;
  vertical?: Vertical;
  /** Cap how many cards render. Default 2 (fits well in a 2-col grid). */
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
