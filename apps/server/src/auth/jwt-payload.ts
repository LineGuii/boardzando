import type { PlayerId, RoomId } from '@boardzando/contracts';

/**
 * Todos os JWTs emitidos por este servidor carregam `typ` para distinguir o
 * proposito do token. Reusar o mesmo segredo sem esse discriminante permitiria
 * que um token de admin fosse aceito pelo handshake WebSocket (que so quer
 * tokens de sala) — e vice-versa.
 */
export type JwtType = 'room' | 'admin';

/** Claims do JWT de sessao de sala. Vida curta; reautentica reconexoes. */
export interface RoomSessionPayload {
  typ: 'room';
  sub: PlayerId; // playerId
  roomId: RoomId;
  name: string;
}

/** Claims do JWT admin. Ganho pelo /quiz/admin/login com senha. */
export interface AdminSessionPayload {
  typ: 'admin';
  sub: 'admin';
}

export type AnySessionPayload = RoomSessionPayload | AdminSessionPayload;
