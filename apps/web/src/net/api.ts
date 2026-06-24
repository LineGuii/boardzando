import type {
  GameSummary,
  RoomSnapshot,
  RoomSummary,
} from '@boardzando/contracts';

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

export const api = {
  /** `roomPassword` opcional: vazio/undefined cria sala publica. */
  createRoom: (gameId: string, playerName: string, roomPassword?: string) =>
    post<SessionResponse>('/rooms', { gameId, playerName, roomPassword }),
  /** `roomPassword` opcional: ignorado se a sala for publica. */
  joinRoom: (roomId: string, playerName: string, roomPassword?: string) =>
    post<SessionResponse>('/rooms/join', { roomId, playerName, roomPassword }),
  /** Lista jogos plugados disponiveis. */
  listGames: () => get<GameSummary[]>('/games'),
  /** Lista salas publicas em lobby. */
  listRooms: () => get<RoomSummary[]>('/rooms'),
};
