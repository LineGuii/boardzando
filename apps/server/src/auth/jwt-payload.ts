import type { PlayerId, RoomId } from '@boardzando/contracts';

/** Claims do JWT de sessao de sala. Vida curta; reautentica reconexoes. */
export interface RoomSessionPayload {
  sub: PlayerId; // playerId
  roomId: RoomId;
  name: string;
}
