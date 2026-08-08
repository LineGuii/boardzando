import type { GameSummary, RoomSnapshot, RoomSummary } from '@boardzando/contracts';

export interface SessionResponse {
  roomId: string;
  playerId: string;
  token: string;
  snapshot: RoomSnapshot;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? res.statusText);
  return res.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? res.statusText);
  return res.json() as Promise<T>;
}

/** gameId forcado pelo servidor em /quiz/rooms — cliente nunca envia. */
export const QUIZ_GAME_ID = 'musicquiz';

/**
 * API publica do quiz-web — SO join e listagem. Criar sala e operacao de
 * admin: use `adminApi.createRoom` de ./adminApi (envia `Authorization: Bearer`).
 */
export const api = {
  joinRoom: (roomId: string, playerName: string, roomPassword?: string, color?: string) =>
    post<SessionResponse>('/quiz/rooms/join', { roomId, playerName, roomPassword, color }),
  listRooms: () => get<RoomSummary[]>('/quiz/rooms'),
  listGames: () => get<GameSummary[]>('/games'),
};
