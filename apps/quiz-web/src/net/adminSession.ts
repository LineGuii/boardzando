/**
 * Sessao do painel admin — separada de `boardzando-quiz:session` (cujo shape
 * {roomId,playerId,token} nao serve pra token admin, que so tem o JWT).
 */
const KEY = 'boardzando-quiz:admin';

export interface AdminSession {
  token: string;
  savedAt: number;
}

export function saveAdmin(token: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ token, savedAt: Date.now() } satisfies AdminSession));
  } catch { /* ignore */ }
}

export function loadAdmin(): AdminSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<AdminSession>;
    if (!p.token) return null;
    return { token: p.token, savedAt: typeof p.savedAt === 'number' ? p.savedAt : 0 };
  } catch { return null; }
}

export function clearAdmin(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
