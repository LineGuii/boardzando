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
  JoinRoomDto,
  isAvatarColor,
  randomAvatarColor,
  type RoomSummary,
} from '@boardzando/contracts';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { RoomService } from '../core/room/room.service';
import { AuthService } from './auth.service';

/**
 * DTO dedicado ao quiz: NAO aceita `gameId` do cliente. Toda sala criada por
 * este endpoint e forcada a `gameId = 'musicquiz'`. Reduz a superficie e
 * garante que ninguem consegue criar outros jogos por engano ou de proposito.
 */
class CreateQuizRoomDto {
  @IsString() @MinLength(2) @MaxLength(24)
  playerName!: string;

  @IsOptional() @IsString() @MaxLength(128)
  roomPassword?: string;

  @IsOptional() @IsString() @MaxLength(16)
  color?: string;
}

const QUIZ_GAME_ID = 'musicquiz';

/**
 * Rotas HTTP privadas do Music Quiz — separadas de `/rooms` para nao aparecer
 * na porta principal do Boardzando. As rotas em si nao sao autenticadas
 * (nao ha login global), so mais dificeis de descobrir: um bot que raspa
 * `/rooms` nao encontra nada de quiz.
 *
 * O /quiz/rooms (GET) lista SOMENTE salas de musicquiz; POST cria musicquiz
 * fixo; /quiz/rooms/join reusa o JoinRoomDto padrao mas valida que a sala e
 * de fato do quiz antes de aceitar.
 */
@Controller('quiz')
export class QuizController {
  constructor(
    private readonly rooms: RoomService,
    private readonly auth: AuthService,
  ) {}

  /** Lista salas publicas de MusicQuiz apenas. */
  @Get('rooms')
  listRooms(): RoomSummary[] {
    return this.rooms.listPublic().filter((r) => r.gameId === QUIZ_GAME_ID);
  }

  @Post('rooms')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
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
    // A sala existe, mas nao e de quiz — respondemos como se nao existisse
    // para nao vazar a presenca de salas de outros jogos.
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
}
