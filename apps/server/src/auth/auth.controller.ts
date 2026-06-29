import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  CreateRoomDto,
  JoinRoomDto,
  isAvatarColor,
  randomAvatarColor,
  type GameSummary,
  type RoomSummary,
} from '@boardzando/contracts';
import { RoomService } from '../core/room/room.service';
import { GameRegistryService } from '../core/registry/game-registry.service';
import { AuthService } from './auth.service';

/**
 * Endpoints HTTP de entrada. O fluxo: criar/entrar via HTTP (Argon2 + emissao de
 * JWT), depois conectar o WebSocket usando esse JWT. O throttle por IP no /join
 * e a defesa principal contra brute-force da senha de sala.
 */
@Controller()
export class AuthController {
  constructor(
    private readonly rooms: RoomService,
    private readonly registry: GameRegistryService,
    private readonly auth: AuthService,
  ) {}

  /** Lista jogos plugados disponiveis para escolha no lobby de criacao. */
  @Get('games')
  listGames(): GameSummary[] {
    return this.registry.list();
  }

  /** Lista salas publicas (sem senha) em lobby. */
  @Get('rooms')
  listRooms(): RoomSummary[] {
    return this.rooms.listPublic();
  }

  @Post('rooms')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async create(@Body() dto: CreateRoomDto) {
    if (!this.registry.get(dto.gameId)) {
      throw new BadRequestException('Jogo desconhecido.');
    }
    // Sala publica: dto.roomPassword vazio/ausente => passwordHash = '' (skip).
    const passwordHash = dto.roomPassword
      ? await this.auth.hashRoomPassword(dto.roomPassword)
      : '';
    const playerId = randomUUID();
    const color = isAvatarColor(dto.color) ? dto.color : randomAvatarColor();
    const room = this.rooms.createRoom({
      gameId: dto.gameId,
      passwordHash,
      host: { id: playerId, name: dto.playerName, connected: false, color },
    });
    const token = this.auth.signSession({ sub: playerId, roomId: room.id, name: dto.playerName });
    return { roomId: room.id, playerId, token, snapshot: room.toSnapshot() };
  }

  @Post('rooms/join')
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // anti brute-force
  async join(@Body() dto: JoinRoomDto) {
    const room = this.rooms.get(dto.roomId);
    if (!room) throw new NotFoundException('Sala nao encontrada.');

    // Se a sala tem senha, valida. Sala publica (hash vazio) pula a verificacao.
    if (room.passwordHash) {
      const ok = await this.auth.verifyRoomPassword(room.passwordHash, dto.roomPassword ?? '');
      if (!ok) throw new UnauthorizedException('Senha incorreta.');
    }

    const playerId = randomUUID();
    const color = isAvatarColor(dto.color) ? dto.color : randomAvatarColor();
    try {
      this.rooms.addPlayer(dto.roomId, {
        id: playerId,
        name: dto.playerName,
        connected: false,
        color,
      });
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    const token = this.auth.signSession({ sub: playerId, roomId: room.id, name: dto.playerName });
    return { roomId: room.id, playerId, token, snapshot: room.toSnapshot() };
  }
}
