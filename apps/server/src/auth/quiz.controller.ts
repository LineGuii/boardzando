import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  JoinRoomDto,
  isAvatarColor,
  randomAvatarColor,
  type RoomSummary,
} from '@boardzando/contracts';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { RoomService } from '../core/room/room.service';
import { AuthService } from './auth.service';
import { AdminGuard } from './admin.guard';

/**
 * DTO dedicado ao quiz: NAO aceita `gameId` do cliente. Toda sala criada por
 * este endpoint e forcada a `gameId = 'musicquiz'`.
 */
class CreateQuizRoomDto {
  @IsString() @MinLength(2) @MaxLength(24)
  playerName!: string;

  @IsOptional() @IsString() @MaxLength(128)
  roomPassword?: string;

  @IsOptional() @IsString() @MaxLength(16)
  color?: string;
}

class AdminLoginDto {
  @IsString() @MinLength(4) @MaxLength(128)
  password!: string;
}

const QUIZ_GAME_ID = 'musicquiz';

/**
 * Rotas HTTP privadas do Music Quiz. Modelo de acesso:
 *   - `GET /quiz/rooms`         — publico (lista salas em lobby)
 *   - `POST /quiz/rooms/join`   — publico (jogadores entram)
 *   - `POST /quiz/rooms`        — ADMIN (so quem tem o token de admin cria)
 *   - `POST /quiz/admin/login`  — verifica senha e emite JWT admin
 *
 * Convidados nao precisam de conta: entrar em sala continua sem login. Criar
 * sala virou operacao de admin (o host tipicamente e quem tambem monta os
 * quizzes).
 */
@Controller('quiz')
export class QuizController {
  constructor(
    private readonly rooms: RoomService,
    private readonly auth: AuthService,
  ) {}

  @Get('rooms')
  listRooms(): RoomSummary[] {
    return this.rooms.listPublic().filter((r) => r.gameId === QUIZ_GAME_ID);
  }

  @Post('rooms')
  @UseGuards(AdminGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async create(@Body() dto: CreateQuizRoomDto) {
    const passwordHash = dto.roomPassword
      ? await this.auth.hashRoomPassword(dto.roomPassword)
      : '';
    const playerId = randomUUID();
    const color = isAvatarColor(dto.color) ? dto.color : randomAvatarColor();
    const room = this.rooms.createRoom({
      gameId: QUIZ_GAME_ID,
      passwordHash,
      host: { id: playerId, name: dto.playerName, connected: false, color },
    });
    const token = this.auth.signSession({ sub: playerId, roomId: room.id, name: dto.playerName });
    return { roomId: room.id, playerId, token, snapshot: room.toSnapshot() };
  }

  @Post('rooms/join')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async join(@Body() dto: JoinRoomDto) {
    const room = this.rooms.get(dto.roomId);
    if (!room) throw new NotFoundException('Sala nao encontrada.');
    if (room.gameId !== QUIZ_GAME_ID) throw new NotFoundException('Sala nao encontrada.');

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

  /**
   * Login admin. Throttle agressivo — brute-force da senha unica e o ataque
   * obvio. Argon2id ja e slow-hash, mas 5/min por IP fecha a porta.
   */
  @Post('admin/login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async adminLogin(@Body() dto: AdminLoginDto): Promise<{ token: string }> {
    const ok = await this.auth.verifyAdminPassword(dto.password);
    if (!ok) throw new UnauthorizedException('Senha incorreta.');
    return { token: this.auth.signAdmin() };
  }
}
