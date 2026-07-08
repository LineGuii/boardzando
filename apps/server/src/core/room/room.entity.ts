import { randomUUID } from 'node:crypto';
import type { GameId, PlayerId, RoomId, RoomSnapshot } from '@boardzando/contracts';
import type { Player } from '../player/player.types';
import type { GameInstance } from '../engine/game-instance';

export type RoomStatus = 'lobby' | 'playing' | 'finished';

/**
 * Sala = uma sessao isolada (equivalente a "Room" do Colyseus). Conhece seus
 * jogadores, o id do jogo e (quando iniciada) a GameInstance. NAO conhece as
 * regras do jogo — isso vive na GameDefinition operada pela GameInstance.
 */
export class Room {
  readonly id: RoomId;
  readonly gameId: GameId;
  /** hash Argon2id da senha da sala. */
  readonly passwordHash: string;
  status: RoomStatus = 'lobby';
  hostId: PlayerId;
  readonly players = new Map<PlayerId, Player>();
  instance?: GameInstance;
  /**
   * Ultimas opcoes usadas para iniciar a partida (painel do host). Guardadas
   * para que "Reiniciar jogo" reuse as mesmas configuracoes sem o cliente
   * precisar reenvia-las.
   */
  lastGameOptions?: unknown;
  readonly createdAt = Date.now();

  constructor(params: { gameId: GameId; passwordHash: string; host: Player; id?: RoomId }) {
    this.id = params.id ?? randomUUID();
    this.gameId = params.gameId;
    this.passwordHash = params.passwordHash;
    this.hostId = params.host.id;
    this.players.set(params.host.id, params.host);
  }

  get playerIds(): PlayerId[] {
    return [...this.players.keys()];
  }

  toSnapshot(): RoomSnapshot {
    return {
      roomId: this.id,
      gameId: this.gameId,
      status: this.status,
      hostId: this.hostId,
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        connected: p.connected,
        isHost: p.id === this.hostId,
        color: p.color,
      })),
    };
  }
}
