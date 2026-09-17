// ============================================================
// Dashboard chat shortcut — open the floating Ask Telfin panel.
// ============================================================
export const DASHBOARD_CHAT_OPEN_EVENT = 'telfin:open-dashboard-chat';

export function openDashboardChat(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(DASHBOARD_CHAT_OPEN_EVENT));
}
