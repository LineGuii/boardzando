import {
  Allow,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * DTOs validados em runtime (class-validator). TypeScript some em runtime,
 * entao a validacao real do que chega pela rede acontece AQUI, via ValidationPipe.
 * Sao classes concretas (nao interfaces) de proposito: o ValidationPipe precisa
 * do metadata em runtime.
 */

// ---- HTTP: criar sala ----
export class CreateRoomDto {
  @IsString() @IsNotEmpty() @MaxLength(32)
  gameId!: string;

  @IsString() @MinLength(2) @MaxLength(24)
  playerName!: string;

  /** Opcional. String vazia / ausente = sala publica (sem senha). */
  @IsOptional() @IsString() @MaxLength(128)
  roomPassword?: string;
}

// ---- HTTP: entrar na sala ----
export class JoinRoomDto {
  @IsString() @IsNotEmpty() @MaxLength(64)
  roomId!: string;

  @IsString() @MinLength(2) @MaxLength(24)
  playerName!: string;

  /** Opcional. Se a sala foi criada sem senha, este campo e ignorado. */
  @IsOptional() @IsString() @MaxLength(128)
  roomPassword?: string;
}

// ---- WS: executar um move ----
export class GameMoveDto {
  @IsString() @IsNotEmpty() @MaxLength(64)
  roomId!: string;

  @IsString() @IsNotEmpty() @MaxLength(48)
  type!: string;

  // `data` e validado pelo proprio jogo (cada move conhece seu payload).
  // @Allow() libera o campo no ValidationPipe (que usa forbidNonWhitelisted).
  @Allow()
  data!: unknown;
}

// ---- WS: stream efemero de drag (jogos sandbox) ----
export class PlaceableDragDto {
  @IsString() @IsNotEmpty() @MaxLength(64)
  roomId!: string;

  @IsString() @IsNotEmpty() @MaxLength(64)
  id!: string;

  @IsNumber()
  x!: number;

  @IsNumber()
  y!: number;

  @IsOptional() @IsNumber()
  z?: number;

  @IsOptional() @IsNumber()
  rotation?: number;
}

// ---- WS: host inicia a partida (com opcoes opcionais do jogo) ----
export class StartGameDto {
  @IsString() @IsNotEmpty() @MaxLength(64)
  roomId!: string;

  /** Opcoes especificas do jogo (shape definido pelo plugin). */
  @IsOptional() @Allow()
  gameOptions?: unknown;
}

// ---- WS: host expulsa um jogador (so em lobby) ----
export class KickPlayerDto {
  @IsString() @IsNotEmpty() @MaxLength(64)
  roomId!: string;

  @IsString() @IsNotEmpty() @MaxLength(64)
  playerId!: string;
}

// ---- WS: chat ----
export class ChatSendDto {
  @IsString() @IsNotEmpty() @MaxLength(64)
  roomId!: string;

  @IsString() @IsNotEmpty() @MaxLength(500)
  text!: string;
}

// ---- WS: numero do dado (exemplo de DTO numerico) ----
export class DiceDto {
  @IsInt() @Min(1) @Max(6)
  value!: number;
}
