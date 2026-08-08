/** Chave dedicada — nao colide com a sessao do apps/web. */
const KEY = 'boardzando-quiz:session';

export interface SavedSession {
  roomId: string;
  playerId: string;
  token: string;
  savedAt: number;
}

export function saveSession(s: Omit<SavedSession, 'savedAt'>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...s, savedAt: Date.now() }));
  } catch { /* ignore */ }
}

export function loadSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<SavedSession>;
    if (!p.roomId || !p.playerId || !p.token) return null;
    return {
      roomId: p.roomId,
      playerId: p.playerId,
      token: p.token,
      savedAt: typeof p.savedAt === 'number' ? p.savedAt : 0,
    };
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
