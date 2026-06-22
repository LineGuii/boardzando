import type { PlayerId, RoomId } from '@board-games/contracts';

/** Claims do JWT de sessao de sala. Vida curta; reautentica reconexoes. */
export interface RoomSessionPayload {
  sub: PlayerId; // playerId
  roomId: RoomId;
  name: string;
}
