import { redirect } from 'next/navigation';

/** Legacy "Try your AI" browser-mic demo — replaced by /test-call. */
export default function VoiceDemoRedirect() {
  redirect('/test-call');
}
