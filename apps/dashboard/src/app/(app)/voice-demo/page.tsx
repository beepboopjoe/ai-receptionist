'use client';
// ============================================================
// Try Your AI Receptionist — authenticated voice demo.
//
// Talks to the AI straight from the browser mic over
// /api/v1/ws/demo (mic -> API -> xAI Grok), with no telephony
// involved. Useful for validating the voice pipeline, prompts,
// and voices without owning a phone number.
//
// Deliberately mounted INSIDE the (app) authenticated group, not
// on a public marketing page: the public "call me now" widget was
// removed in 693b66f to avoid unauthenticated abuse/cost, and
// that decision stands. Behind login there is no public surface.
// ============================================================
import { EmbeddedVoiceDemo } from '@/components/ui/embedded-voice-demo';
import { useVertical } from '@/lib/useVertical';
import { Mic } from 'lucide-react';

export default function VoiceDemoPage() {
  const vertical = useVertical();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl text-cream-900 tracking-tight">Try your AI receptionist</h1>
        <p className="text-gray-500 mt-1">
          Speak to your AI from the browser — no phone call required.
        </p>
      </div>

      <div className="rounded-xl border border-cream-200 bg-cream-50 px-4 py-3 flex items-start gap-3">
        <Mic size={16} className="text-brand-600 shrink-0 mt-0.5" />
        <p className="text-sm text-cream-700 leading-relaxed">
          Your browser will ask for microphone access. Audio streams to the AI in real time and
          the transcript appears live below — the same voice pipeline that answers real calls,
          minus the phone carrier. Nothing here places or receives a phone call.
        </p>
      </div>

      <EmbeddedVoiceDemo vertical={vertical.id} />
    </div>
  );
}
