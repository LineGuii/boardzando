import type { RoomSnapshot } from '@boardzando/contracts';
import { clearAdmin, loadAdmin } from './adminSession';

export interface CreateRoomResult {
  roomId: string;
  playerId: string;
  token: string;
  snapshot: RoomSnapshot;
}

export class AdminUnauthorizedError extends Error {
  constructor(msg = 'Sessao admin expirada.') { super(msg); }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const admin = loadAdmin();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (admin) headers['Authorization'] = `Bearer ${admin.token}`;
  const res = await fetch(path, { ...init, headers });
  if (res.status === 401) {
    clearAdmin();
    throw new AdminUnauthorizedError();
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? res.statusText);
  }
  // Alguns endpoints podem responder 204 no futuro
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const adminApi = {
  login: (password: string) =>
    req<{ token: string }>('/quiz/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  createRoom: (playerName: string, color?: string, roomPassword?: string) =>
    req<CreateRoomResult>('/quiz/rooms', {
      method: 'POST',
      body: JSON.stringify({ playerName, color, roomPassword }),
    }),
};
