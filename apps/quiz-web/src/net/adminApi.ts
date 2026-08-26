import type {
  QuizDefinition,
  QuizSummary,
  QuizTrack,
  RoomSnapshot,
} from '@boardzando/contracts';

export interface SpotifyTrackResult {
  trackId: string;
  name: string;
  artist: string;
  artistId?: string;
  albumCover?: string;
  durationMs: number;
}
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
    const msg = Array.isArray(body.message) ? body.message.join('; ') : (body.message ?? res.statusText);
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const adminApi = {
  login: (password: string) =>
    req<{ token: string }>('/quiz/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  // Salas
  createRoom: (playerName: string, color?: string, roomPassword?: string) =>
    req<CreateRoomResult>('/quiz/rooms', {
      method: 'POST',
      body: JSON.stringify({ playerName, color, roomPassword }),
    }),

  // Publico (usado pelo seletor de sala)
  listPublicQuizzes: () => req<QuizSummary[]>('/quiz/quizzes'),

  // Tracks
  listTracks: () => req<QuizTrack[]>('/quiz/admin/tracks'),
  createTrack: (input: Omit<QuizTrack, 'id'> & { id?: string }) =>
    req<QuizTrack>('/quiz/admin/tracks', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateTrack: (id: string, patch: Partial<Omit<QuizTrack, 'id'>>) =>
    req<QuizTrack>(`/quiz/admin/tracks/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),
  deleteTrack: (id: string) =>
    req<void>(`/quiz/admin/tracks/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // Quizzes
  listQuizzes: () => req<QuizDefinition[]>('/quiz/admin/quizzes'),
  createQuiz: (input: { name: string; description?: string; trackIds?: string[] }) =>
    req<QuizDefinition>('/quiz/admin/quizzes', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateQuiz: (id: string, patch: Partial<Pick<QuizDefinition, 'name' | 'description' | 'trackIds'>>) =>
    req<QuizDefinition>(`/quiz/admin/quizzes/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),
  deleteQuiz: (id: string) =>
    req<void>(`/quiz/admin/quizzes/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // Spotify
  spotifyStatus: () => req<{ configured: boolean }>('/quiz/admin/spotify/status'),
  spotifySearch: (q: string) =>
    req<SpotifyTrackResult[]>(`/quiz/admin/spotify/search?q=${encodeURIComponent(q)}`),
  spotifyDistractors: (input: {
    trackId: string;
    trackName: string;
    artistName: string;
    artistId?: string;
    field: 'title' | 'artist';
  }) =>
    req<{ options: string[] }>('/quiz/admin/spotify/distractors', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};
