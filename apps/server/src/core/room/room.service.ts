import { Injectable, Logger } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import type { GameId, PlayerId, RoomId } from '@boardzando/contracts';
import { GameRegistryService } from '../registry/game-registry.service';
import { GameInstance } from '../engine/game-instance';
import type { Player } from '../player/player.types';
import { Room } from './room.entity';

/** Janela de carencia (ms) para reconexao antes de remover um jogador. */
const RECONNECT_GRACE_MS = 30_000;

/**
 * Gerencia o ciclo de vida das salas em memoria. Para multiplas instancias do
 * servidor, troque o Map por um store distribuido (Redis) — a interface publica
 * pode permanecer a mesma.
 */
@Injectable()
export class RoomService {
  private readonly logger = new Logger(RoomService.name);
  private readonly rooms = new Map<RoomId, Room>();

  constructor(private readonly registry: GameRegistryService) {}

  createRoom(params: {
    gameId: GameId;
    passwordHash: string;
    host: Player;
  }): Room {
    const def = this.registry.getOrThrow(params.gameId);
    const room = new Room(params);
    this.rooms.set(room.id, room);
    this.logger.log(`Sala criada: ${room.id} (${def.name})`);
    return room;
  }

  get(roomId: RoomId): Room | undefined {
    return this.rooms.get(roomId);
  }

  getOrThrow(roomId: RoomId): Room {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('ROOM_NOT_FOUND');
    return room;
  }

  addPlayer(roomId: RoomId, player: Player): Room {
    const room = this.getOrThrow(roomId);
    const def = this.registry.getOrThrow(room.gameId);
    if (room.status !== 'lobby') throw new Error('ROOM_IN_PROGRESS');
    if (room.players.size >= def.maxPlayers && !room.players.has(player.id)) {
      throw new Error('ROOM_FULL');
    }
    room.players.set(player.id, player);
    return room;
  }

  markConnected(roomId: RoomId, playerId: PlayerId, socketId: string): void {
    const player = this.get(roomId)?.players.get(playerId);
    if (player) {
      player.connected = true;
      player.socketId = socketId;
      player.disconnectedAt = undefined;
    }
  }

  markDisconnected(roomId: RoomId, playerId: PlayerId): void {
    const room = this.get(roomId);
    const player = room?.players.get(playerId);
    if (!player || !room) return;
    player.connected = false;
    player.disconnectedAt = Date.now();

    // remove apos a carencia se nao reconectar (lobby) — partidas em curso
    // preservam o assento ate o fim para permitir replays/retomada.
    setTimeout(() => {
      if (room.status === 'lobby' && !player.connected) {
        room.players.delete(playerId);
        if (room.players.size === 0) this.dispose(room.id);
        else if (room.hostId === playerId) room.hostId = room.playerIds[0]!;
      }
    }, RECONNECT_GRACE_MS);
  }

  /** Inicia a partida: instancia a GameInstance com a GameDefinition do jogo. */
  startGame(roomId: RoomId, requesterId: PlayerId): Room {
    const room = this.getOrThrow(roomId);
    const def = this.registry.getOrThrow(room.gameId);
    if (requesterId !== room.hostId) throw new Error('ONLY_HOST_CAN_START');
    if (room.status !== 'lobby') throw new Error('ALREADY_STARTED');
    if (room.players.size < def.minPlayers) throw new Error('NOT_ENOUGH_PLAYERS');

    const seed = randomInt(0, 2 ** 31 - 1);
    room.instance = GameInstance.create(def, room.playerIds, seed);
    room.status = 'playing';
    this.logger.log(`Partida iniciada na sala ${roomId} (seed ${seed})`);
    return room;
  }

  dispose(roomId: RoomId): void {
    if (this.rooms.delete(roomId)) {
      this.logger.log(`Sala destruida: ${roomId}`);
    }
  }
}
