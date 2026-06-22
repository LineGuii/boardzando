import type { GameId, GameOverResult, PlayerId, RoomId } from './types';

/**
 * Contrato UNICO de eventos WebSocket usado por cliente E servidor.
 * Versionar este arquivo como API (SemVer): mudanca quebrada = major bump.
 *
 * Convencao de nomes: "<dominio>:<acao>". client->server sao comandos;
 * server->client sao fatos/notificacoes.
 */

// ---------- client -> server ----------
export interface ClientToServerEvents {
  'room:join': (
    payload: { roomId: RoomId },
    ack: (res: AckResult<RoomSnapshot>) => void,
  ) => void;
  'room:leave': (payload: { roomId: RoomId }) => void;
  'room:start': (payload: { roomId: RoomId }, ack: (res: AckResult) => void) => void;
  /** Executa um move do jogo plugado. `type` e a chave em GameDefinition.moves. */
  'game:move': (
    payload: { roomId: RoomId; type: string; data: unknown },
    ack: (res: AckResult) => void,
  ) => void;
  'chat:send': (payload: { roomId: RoomId; text: string }) => void;
}

// ---------- server -> client ----------
export interface ServerToClientEvents {
  /** Estado da sala mudou (jogador entrou/saiu, jogo iniciou). */
  'room:update': (snapshot: RoomSnapshot) => void;
  /** Novo estado de jogo, JA filtrado por playerView para este cliente. */
  'game:state': (payload: { roomId: RoomId; view: unknown; turn: number; phase: string }) => void;
  /** O jogo terminou. */
  'game:over': (payload: { roomId: RoomId; result: GameOverResult }) => void;
  'chat:message': (msg: ChatMessage) => void;
  /** Erro nao-fatal (move invalido, rate limit etc.). */
  'error': (err: WsError) => void;
}

// ---------- payloads ----------
export interface PlayerSnapshot {
  id: PlayerId;
  name: string;
  connected: boolean;
  isHost: boolean;
}

export interface RoomSnapshot {
  roomId: RoomId;
  gameId: GameId;
  status: 'lobby' | 'playing' | 'finished';
  players: PlayerSnapshot[];
  hostId: PlayerId;
}

export interface ChatMessage {
  roomId: RoomId;
  from: PlayerId;
  fromName: string;
  text: string;
  at: number;
}

export interface WsError {
  code:
    | 'UNAUTHORIZED'
    | 'INVALID_MOVE'
    | 'NOT_YOUR_TURN'
    | 'ROOM_FULL'
    | 'ROOM_NOT_FOUND'
    | 'VALIDATION'
    | 'RATE_LIMITED'
    | 'INTERNAL';
  message: string;
}

/** Envelope de ack padrao para comandos com confirmacao. */
export type AckResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: WsError };
