import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  NotFoundException,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CreateRoomDto, JoinRoomDto } from '@board-games/contracts';
import { RoomService } from '../core/room/room.service';
import { GameRegistryService } from '../core/registry/game-registry.service';
import { AuthService } from './auth.service';

/**
 * Endpoints HTTP de entrada. O fluxo: criar/entrar via HTTP (Argon2 + emissao de
 * JWT), depois conectar o WebSocket usando esse JWT. O throttle por IP no /join
 * e a defesa principal contra brute-force da senha de sala.
 */
@Controller('rooms')
export class AuthController {
  constructor(
    private readonly rooms: RoomService,
    private readonly registry: GameRegistryService,
    private readonly auth: AuthService,
  ) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async create(@Body() dto: CreateRoomDto) {
    if (!this.registry.get(dto.gameId)) {
      throw new BadRequestException('Jogo desconhecido.');
    }
    const passwordHash = await this.auth.hashRoomPassword(dto.roomPassword);
    const playerId = randomUUID();
    const room = this.rooms.createRoom({
      gameId: dto.gameId,
      passwordHash,
      host: { id: playerId, name: dto.playerName, connected: false },
    });
    const token = this.auth.signSession({ sub: playerId, roomId: room.id, name: dto.playerName });
    return { roomId: room.id, playerId, token, snapshot: room.toSnapshot() };
  }

  @Post('join')
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // anti brute-force
  async join(@Body() dto: JoinRoomDto) {
    const room = this.rooms.get(dto.roomId);
    if (!room) throw new NotFoundException('Sala nao encontrada.');

    const ok = await this.auth.verifyRoomPassword(room.passwordHash, dto.roomPassword);
    if (!ok) throw new UnauthorizedException('Senha incorreta.');

    const playerId = randomUUID();
    try {
      this.rooms.addPlayer(dto.roomId, {
        id: playerId,
        name: dto.playerName,
        connected: false,
      });
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    const token = this.auth.signSession({ sub: playerId, roomId: room.id, name: dto.playerName });
    return { roomId: room.id, playerId, token, snapshot: room.toSnapshot() };
  }
}
