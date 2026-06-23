import type { RoomSnapshot } from '@boardzando/contracts';

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

export const api = {
  createRoom: (gameId: string, playerName: string, roomPassword: string) =>
    post<SessionResponse>('/rooms', { gameId, playerName, roomPassword }),
  joinRoom: (roomId: string, playerName: string, roomPassword: string) =>
    post<SessionResponse>('/rooms/join', { roomId, playerName, roomPassword }),
};
