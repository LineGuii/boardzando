/**
 * Persiste a sessão da sala em localStorage para permitir reconexão em F5,
 * fechar/abrir aba ou voltar pelo link `?room=<id>`. O JWT curto embutido no
 * `token` continua sendo a autenticação — só o transporte muda.
 */

const KEY = 'boardzando:session';

export interface SavedSession {
  roomId: string;
  playerId: string;
  token: string;
  /** ms desde epoch. Útil se um dia precisarmos expirar por idade. */
  savedAt: number;
}

export function saveSession(s: Omit<SavedSession, 'savedAt'>): void {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ ...s, savedAt: Date.now() } satisfies SavedSession),
    );
  } catch {
    /* sem localStorage: modo anônimo restrito etc. — ignora */
  }
}

export function loadSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedSession>;
    if (!parsed.roomId || !parsed.playerId || !parsed.token) return null;
    return {
      roomId: parsed.roomId,
      playerId: parsed.playerId,
      token: parsed.token,
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : 0,
    };
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignora */
  }
}
