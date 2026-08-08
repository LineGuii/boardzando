import { Logger, UseFilters, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
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
  KickPlayerDto,
  PlaceableDragDto,
  QuizAnswerDto,
  QuizNextDto,
  QuizPingDto,
  QuizReadyDto,
  StartGameDto,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '@boardzando/contracts';
import { RoomService } from '../room/room.service';
import { InvalidMoveError, NotYourTurnError } from '../engine/game-instance';
import { MusicQuizService } from '../../games/musicquiz/musicquiz.service';
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
export class GameGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(GameGateway.name);

  @WebSocketServer()
  server!: GameServer;

  constructor(
    private readonly rooms: RoomService,
    private readonly quiz: MusicQuizService,
  ) {}

  afterInit(server: GameServer): void {
    // Passa o servidor Socket.IO para o MusicQuizService (que emite fora de
    // handlers, dentro de setTimeout callbacks).
    this.quiz.setServer(server);
  }

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
    // Reconexao: se ha partida em andamento (ou terminada), envia o estado
    // atual SO para este socket — senao quem volta fica sem tabuleiro ate
    // alguem jogar de novo.
    if (room.instance) {
      const { turn, phase, currentPlayer, gameover } = room.instance.snapshot;
      client.emit('game:state', {
        roomId,
        view: room.instance.viewFor(player.id),
        turn,
        phase,
        currentPlayer,
      });
      if (gameover) client.emit('game:over', { roomId, result: gameover });
    } else if (this.quiz.hasMatch(roomId)) {
      // Music Quiz: nao usa GameInstance — snapshot proprio.
      const snapshot = this.quiz.snapshotFor(roomId, player.id);
      if (snapshot) client.emit('quiz:snapshot', { roomId, snapshot });
    }
    this.logger.log(`${player.name} conectou na sala ${roomId}`);
  }

  handleDisconnect(client: GameSocket): void {
    const { roomId, player } = client.data;
    this.rooms.markDisconnected(roomId, player.id);
    this.broadcastRoom(roomId);
  }

  @SubscribeMessage('room:kick')
  onKick(@ConnectedSocket() client: GameSocket, @MessageBody() dto: KickPlayerDto): { ok: true } {
    const { roomId, player } = client.data;
    if (dto.roomId !== roomId) {
      throw new WsException({ code: 'VALIDATION', message: 'roomId divergente da sessao.' });
    }
    let socketId: string | undefined;
    try {
      ({ socketId } = this.rooms.kickPlayer(roomId, player.id, dto.playerId));
    } catch (e) {
      const msg = (e as Error).message;
      throw new WsException({ code: 'VALIDATION', message: msg });
    }
    // notifica o expulso e fecha o socket dele
    if (socketId) {
      this.server
        .to(socketId)
        .emit('error', { code: 'KICKED', message: 'Voce foi removido da sala pelo host.' });
      this.server.in(socketId).disconnectSockets(true);
    }
    this.broadcastRoom(roomId);
    return { ok: true };
  }

  @SubscribeMessage('room:start')
  onStart(
    @ConnectedSocket() client: GameSocket,
    @MessageBody() dto: StartGameDto,
  ): { ok: true } {
    const { roomId, player } = client.data;
    if (dto.roomId !== roomId) {
      throw new WsException({ code: 'VALIDATION', message: 'roomId divergente da sessao.' });
    }
    const room = this.rooms.getOrThrow(roomId);
    if (this.quiz.isQuiz(room.gameId)) {
      try {
        this.quiz.startMatch(roomId, player.id, dto.gameOptions);
      } catch (e) {
        throw new WsException({ code: 'INVALID_MOVE', message: (e as Error).message });
      }
      this.broadcastRoom(roomId);
      return { ok: true };
    }
    this.rooms.startGame(roomId, player.id, dto.gameOptions);
    this.broadcastRoom(roomId);
    this.broadcastState(roomId);
    return { ok: true };
  }

  // ---------- Music Quiz ----------

  @SubscribeMessage('quiz:answer')
  @Throttle({ default: { limit: 10, ttl: 1000 } })
  @UseGuards(WsThrottlerGuard)
  onQuizAnswer(
    @ConnectedSocket() client: GameSocket,
    @MessageBody() dto: QuizAnswerDto,
  ): { ok: true; data: { acceptedAt: number } } {
    const { roomId, player } = client.data;
    if (dto.roomId !== roomId) {
      throw new WsException({ code: 'VALIDATION', message: 'roomId divergente da sessao.' });
    }
    try {
      const data = this.quiz.submitAnswer(roomId, player.id, dto.questionIndex, dto.optionIndex);
      return { ok: true, data };
    } catch (e) {
      throw new WsException({ code: 'INVALID_MOVE', message: (e as Error).message });
    }
  }

  @SubscribeMessage('quiz:next')
  onQuizNext(
    @ConnectedSocket() client: GameSocket,
    @MessageBody() dto: QuizNextDto,
  ): { ok: true } {
    const { roomId, player } = client.data;
    if (dto.roomId !== roomId) {
      throw new WsException({ code: 'VALIDATION', message: 'roomId divergente da sessao.' });
    }
    try {
      this.quiz.requestNext(roomId, player.id);
      return { ok: true };
    } catch (e) {
      throw new WsException({ code: 'INVALID_MOVE', message: (e as Error).message });
    }
  }

  @SubscribeMessage('quiz:ready')
  onQuizReady(
    @ConnectedSocket() client: GameSocket,
    @MessageBody() dto: QuizReadyDto,
  ): void {
    const { roomId, player } = client.data;
    if (dto.roomId !== roomId) return;
    this.quiz.markReady(roomId, player.id, dto.questionIndex);
  }

  @SubscribeMessage('quiz:ping')
  onQuizPing(
    @ConnectedSocket() _client: GameSocket,
    @MessageBody() dto: QuizPingDto,
  ): { serverT: number; clientT: number } {
    return { serverT: Date.now(), clientT: dto.clientT };
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

  /**
   * Stream EFEMERO de drag (jogos sandbox): apenas rebroadcast da posicao ao
   * vivo para os OUTROS na sala. Nao toca no estado nem persiste — a posicao
   * autoritativa chega via `game:move` no fim do arraste. Throttle generoso
   * (relay barato; o cliente ja limita a ~30/s).
   */
  @SubscribeMessage('placeable:drag')
  @Throttle({ default: { limit: 60, ttl: 1000 } })
  @UseGuards(WsThrottlerGuard)
  onPlaceableDrag(
    @ConnectedSocket() client: GameSocket,
    @MessageBody() dto: PlaceableDragDto,
  ): void {
    const { roomId, player } = client.data;
    if (dto.roomId !== roomId) return;
    client.to(this.roomChannel(roomId)).emit('placeable:dragging', {
      id: dto.id,
      x: dto.x,
      y: dto.y,
      z: dto.z,
      rotation: dto.rotation,
      by: player.id,
    });
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
    const { turn, phase, currentPlayer } = room.instance.snapshot;

    for (const player of room.players.values()) {
      if (!player.connected || !player.socketId) continue;
      this.server.to(player.socketId).emit('game:state', {
        roomId,
        view: room.instance.viewFor(player.id),
        turn,
        phase,
        currentPlayer,
      });
    }
  }
}
