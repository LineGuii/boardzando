import { Logger, UseFilters, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Throttle } from '@nestjs/throttler';
import type { Server, Socket } from 'socket.io';
import {
  ChatSendDto,
  GameMoveDto,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '@board-games/contracts';
import { RoomService } from '../room/room.service';
import { InvalidMoveError, NotYourTurnError } from '../engine/game-instance';
import { WsAllExceptionsFilter } from './ws-exception.filter';
import { WsThrottlerGuard } from './ws-throttler.guard';

interface SocketData {
  player: { id: string; name: string };
  roomId: string;
}
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, never, SocketData>;
type GameServer = Server<ClientToServerEvents, ServerToClientEvents, never, SocketData>;

/**
 * Unico ponto de entrada em tempo real. O handshake ja foi autenticado pelo
 * AuthIoAdapter (socket.data.player/roomId disponiveis). Aqui validamos os
 * payloads, despachamos ao RoomService/engine e fazemos broadcast do estado
 * filtrado por playerView.
 *
 * Numa evolucao para CQRS, cada handler despacha um Command e os broadcasts
 * sao feitos por EventHandlers reagindo aos domain events (ver skill de
 * arquitetura). Mantido direto aqui para clareza do esqueleto.
 */
@WebSocketGateway({ namespace: 'games' })
@UseFilters(new WsAllExceptionsFilter())
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    // converte erro de validacao em WsException (em vez de HTTP 400 -> "Internal error")
    exceptionFactory: (errors) =>
      new WsException({ code: 'VALIDATION', message: JSON.stringify(errors) }),
  }),
)
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(GameGateway.name);

  @WebSocketServer()
  server!: GameServer;

  constructor(private readonly rooms: RoomService) {}

  handleConnection(client: GameSocket): void {
    const { roomId, player } = client.data;
    const room = this.rooms.get(roomId);
    if (!room || !room.players.has(player.id)) {
      client.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Sala inexistente.' });
      client.disconnect(true);
      return;
    }
    client.join(this.roomChannel(roomId));
    this.rooms.markConnected(roomId, player.id, client.id);
    this.broadcastRoom(roomId);
    this.logger.log(`${player.name} conectou na sala ${roomId}`);
  }

  handleDisconnect(client: GameSocket): void {
    const { roomId, player } = client.data;
    this.rooms.markDisconnected(roomId, player.id);
    this.broadcastRoom(roomId);
  }

  @SubscribeMessage('room:start')
  onStart(@ConnectedSocket() client: GameSocket): { ok: true } {
    const { roomId, player } = client.data;
    this.rooms.startGame(roomId, player.id);
    this.broadcastRoom(roomId);
    this.broadcastState(roomId);
    return { ok: true };
  }

  @SubscribeMessage('game:move')
  @Throttle({ default: { limit: 15, ttl: 1000 } })
  @UseGuards(WsThrottlerGuard)
  onMove(@ConnectedSocket() client: GameSocket, @MessageBody() dto: GameMoveDto): { ok: true } {
    const { player } = client.data;
    const room = this.rooms.getOrThrow(dto.roomId);
    if (!room.instance) throw new WsException({ code: 'INVALID_MOVE', message: 'Partida nao iniciada.' });

    try {
      room.instance.applyMove(player.id, dto.type, dto.data);
    } catch (e) {
      if (e instanceof NotYourTurnError)
        throw new WsException({ code: 'NOT_YOUR_TURN', message: e.message });
      if (e instanceof InvalidMoveError)
        throw new WsException({ code: 'INVALID_MOVE', message: e.message });
      throw e;
    }

    this.broadcastState(dto.roomId);
    if (room.instance.isOver) {
      room.status = 'finished';
      this.server
        .to(this.roomChannel(dto.roomId))
        .emit('game:over', { roomId: dto.roomId, result: room.instance.snapshot.gameover! });
    }
    return { ok: true };
  }

  @SubscribeMessage('chat:send')
  @Throttle({ default: { limit: 5, ttl: 2000 } })
  @UseGuards(WsThrottlerGuard)
  onChat(@ConnectedSocket() client: GameSocket, @MessageBody() dto: ChatSendDto): void {
    const { player } = client.data;
    this.server.to(this.roomChannel(dto.roomId)).emit('chat:message', {
      roomId: dto.roomId,
      from: player.id,
      fromName: player.name,
      text: dto.text,
      at: Date.now(),
    });
  }

  // ---------- helpers ----------
  private roomChannel(roomId: string): string {
    return `room:${roomId}`;
  }

  private broadcastRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) this.server.to(this.roomChannel(roomId)).emit('room:update', room.toSnapshot());
  }

  /** Envia a CADA jogador o estado filtrado pela sua perspectiva (playerView). */
  private broadcastState(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room?.instance) return;
    const { turn, phase } = room.instance.snapshot;

    for (const player of room.players.values()) {
      if (!player.connected || !player.socketId) continue;
      this.server.to(player.socketId).emit('game:state', {
        roomId,
        view: room.instance.viewFor(player.id),
        turn,
        phase,
      });
    }
  }
}
