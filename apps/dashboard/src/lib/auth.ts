// ============================================================
// Auth utilities — token storage, user session management
// ============================================================
import { authApi } from './api';

const TOKEN_KEY = 'auth_token';
const REFRESH_KEY = 'auth_refresh_token';
const USER_KEY = 'auth_user';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setSession(token: string, refreshToken: string, user: AuthUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(REFRESH_KEY, refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await authApi.login(email, password);
  setSession(res.token, res.refreshToken, res.user);
  return res.user;
}

export async function logout(): Promise<void> {
  try {
    await authApi.logout();
  } finally {
    clearSession();
  }
}

export function isAuthenticated(): boolean {
  return !!getStoredToken();
}
