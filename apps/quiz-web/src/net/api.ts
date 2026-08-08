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

/** Todas as salas criadas por este app sao musicquiz — o gameId e forcado no
 *  servidor por /quiz/rooms; o cliente nem precisa manda-lo. */
export const QUIZ_GAME_ID = 'musicquiz';

export const api = {
  createRoom: (playerName: string, roomPassword?: string, color?: string) =>
    post<SessionResponse>('/quiz/rooms', { playerName, roomPassword, color }),
  joinRoom: (roomId: string, playerName: string, roomPassword?: string, color?: string) =>
    post<SessionResponse>('/quiz/rooms/join', { roomId, playerName, roomPassword, color }),
  listRooms: () => get<RoomSummary[]>('/quiz/rooms'),
  listGames: () => get<GameSummary[]>('/games'),
};
