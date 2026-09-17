// ============================================================
// In-dashboard Ask Telfin chat shortcut — source scans.
// Reuses /calls/ai-task + outbound pool. No MCP place_call.
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const srcRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const dashboardRoot = join(srcRoot, '../../dashboard/src');

describe('dashboard chat shortcut', () => {
  it('mounts a floating chat in the authenticated app layout', () => {
    const layout = readFileSync(join(dashboardRoot, 'app/(app)/layout.tsx'), 'utf8');
    expect(layout).toContain('DashboardChatWidget');
    const widget = readFileSync(
      join(dashboardRoot, 'components/dashboard/dashboard-chat-widget.tsx'),
      'utf8',
    );
    expect(widget).toContain('parseCallIntent');
    expect(widget).toContain('callsApi.aiTask');
    expect(widget).toContain('DemoUpgradeCard');
    expect(widget).toContain('isDemoAccount');
    expect(widget).toContain('useSpeechDictation');
    expect(widget).toContain('/calls/');
    expect(widget).toContain('/contacts/');
    expect(widget).not.toMatch(/\b(Grok|Telnyx|xAI)\b/);
  });

  it('dictation uses the Web Speech API and degrades when missing', () => {
    const hook = readFileSync(join(dashboardRoot, 'lib/use-speech-dictation.ts'), 'utf8');
    expect(hook).toContain('webkitSpeechRecognition');
    expect(hook).toContain('SpeechRecognition');
    expect(hook).toContain('Voice input isn’t available in this browser');
    expect(hook).toContain('supported');
  });

  it('sidebar and command palette open the same panel', () => {
    const sidebar = readFileSync(join(dashboardRoot, 'components/layout/sidebar.tsx'), 'utf8');
    expect(sidebar).toContain('openDashboardChat');
    expect(sidebar).toContain('Ask {BRAND_NAME}');

    const palette = readFileSync(join(dashboardRoot, 'components/ui/command-palette.tsx'), 'utf8');
    expect(palette).toContain('ask-telfin');
    expect(palette).toContain('openDashboardChat');
  });

  it('ai-task places via the rotating outbound pool and upserts a contact', () => {
    const svc = readFileSync(join(srcRoot, 'modules/assistant/place-ai-task.ts'), 'utf8');
    expect(svc).toContain('selectPoolNumberForDial');
    expect(svc).toContain('recordPoolDialOutcome');
    expect(svc).toContain('ensureContactForNumber');
    expect(svc).toContain('identifyCaller');
    expect(svc).toContain('createContact');
    expect(svc).toContain("mode: 'ai_task'");
    expect(svc).toContain('adHocTask');
    expect(svc).toContain('contactId: contact.id');
    expect(svc).not.toContain('DEMO_FROM_NUMBER');
    expect(svc).not.toContain('DEMO_SKIP_COOLDOWN');
    expect(svc).not.toMatch(/Telnyx/);
  });

  it('does not add MCP place_call or skip demo cooldown', () => {
    const tools = readFileSync(join(srcRoot, 'modules/mcp/mcp.tools.ts'), 'utf8');
    expect(tools).not.toMatch(/telfin_place_call/);
    const demo = readFileSync(join(srcRoot, 'modules/public-api/public-demo.helpers.ts'), 'utf8');
    expect(demo).not.toMatch(/DEMO_SKIP_COOLDOWN\s*=\s*true/);
  });
});
