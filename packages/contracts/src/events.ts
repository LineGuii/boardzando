import type { GameId, GameOverResult, PlayerId, RoomId } from './types';
import type {
  QuizFinalPayload,
  QuizQuestionPublic,
  QuizRevealPayload,
  QuizSnapshot,
} from './musicquiz';

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
  /** Host expulsa um jogador (so antes da partida comecar). */
  'room:kick': (
    payload: { roomId: RoomId; playerId: PlayerId },
    ack: (res: AckResult) => void,
  ) => void;
  'room:start': (
    payload: { roomId: RoomId; gameOptions?: unknown },
    ack: (res: AckResult) => void,
  ) => void;
  /** Executa um move do jogo plugado. `type` e a chave em GameDefinition.moves. */
  'game:move': (
    payload: { roomId: RoomId; type: string; data: unknown },
    ack: (res: AckResult) => void,
  ) => void;
  /**
   * Stream EFEMERO de drag (jogos sandbox): posicao ao vivo de uma peca
   * enquanto arrastada. Nao muta estado nem persiste — o servidor apenas
   * rebroadcast para a sala. A posicao autoritativa vai via `game:move` no
   * fim do arraste.
   */
  'placeable:drag': (payload: {
    roomId: RoomId;
    id: string;
    x: number;
    y: number;
    z?: number;
    rotation?: number;
  }) => void;
  'chat:send': (payload: { roomId: RoomId; text: string }) => void;

  // ---------- Music Quiz ----------
  /** Cliente responde a pergunta corrente. `elapsedMs` e medido no servidor. */
  'quiz:answer': (
    payload: { roomId: RoomId; questionIndex: number; optionIndex: number },
    ack: (res: AckResult<{ acceptedAt: number }>) => void,
  ) => void;
  /** Host pula o intervalo de reveal para a proxima pergunta. */
  'quiz:next': (payload: { roomId: RoomId }, ack: (res: AckResult) => void) => void;
  /** Host pausa/retoma o auto-advance do reveal. */
  'quiz:pause': (
    payload: { roomId: RoomId; paused: boolean },
    ack: (res: AckResult) => void,
  ) => void;
  /** Cliente confirma que o audio da pergunta X esta pre-carregado (canplaythrough). */
  'quiz:ready': (payload: { roomId: RoomId; questionIndex: number }) => void;
  /** Sincronizacao de relogio: cliente manda seu t_now e recebe t_server. */
  'quiz:ping': (
    payload: { roomId: RoomId; clientT: number },
    ack: (res: { serverT: number; clientT: number }) => void,
  ) => void;
}

// ---------- server -> client ----------
export interface ServerToClientEvents {
  /** Estado da sala mudou (jogador entrou/saiu, jogo iniciou). */
  'room:update': (snapshot: RoomSnapshot) => void;
  /** Novo estado de jogo, JA filtrado por playerView para este cliente. */
  'game:state': (payload: {
    roomId: RoomId;
    view: unknown;
    turn: number;
    phase: string;
    /** Quem deve jogar agora. A casca usa para bloquear inputs fora da vez. */
    currentPlayer: PlayerId;
  }) => void;
  /** O jogo terminou. */
  'game:over': (payload: { roomId: RoomId; result: GameOverResult }) => void;
  /** Rebroadcast efemero do drag de uma peca (jogos sandbox). */
  'placeable:dragging': (payload: {
    id: string;
    x: number;
    y: number;
    z?: number;
    rotation?: number;
    by: PlayerId;
  }) => void;
  'chat:message': (msg: ChatMessage) => void;
  /** Erro nao-fatal (move invalido, rate limit etc.). */
  'error': (err: WsError) => void;

  // ---------- Music Quiz ----------
  /** Pre-carregue este audio (e a capa). `serverStartAt` = quando dar play. */
  'quiz:preload': (payload: {
    roomId: RoomId;
    question: QuizQuestionPublic;
  }) => void;
  /** Dispare o audio no `serverStartAt` — a pergunta esta ativa. */
  'quiz:question': (payload: { roomId: RoomId; question: QuizQuestionPublic }) => void;
  /** Fim da pergunta: mostre resposta correta e ranking animado. */
  'quiz:reveal': (payload: { roomId: RoomId; reveal: QuizRevealPayload }) => void;
  /** Fim da partida: ranking definitivo com animacao especial. */
  'quiz:final': (payload: { roomId: RoomId; final: QuizFinalPayload }) => void;
  /** Reconexao: estado completo da partida corrente. */
  'quiz:snapshot': (payload: { roomId: RoomId; snapshot: QuizSnapshot }) => void;
}

// ---------- payloads ----------
export interface PlayerSnapshot {
  id: PlayerId;
  name: string;
  connected: boolean;
  isHost: boolean;
  /** Cor de fundo do avatar escolhida pelo jogador (paleta AVATAR_COLORS). */
  color?: string;
}

export interface RoomSnapshot {
  roomId: RoomId;
  gameId: GameId;
  status: 'lobby' | 'playing' | 'finished';
  players: PlayerSnapshot[];
  hostId: PlayerId;
  /** Ultimas opcoes usadas para iniciar (pre-preenche o painel ao reiniciar). */
  lastGameOptions?: unknown;
}

/** Resumo publico de uma sala aberta (sem senha) para a tela de lobby. */
export interface RoomSummary {
  roomId: RoomId;
  gameId: GameId;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  createdAt: number;
}

/** Resumo de um jogo plugado, para o selector de criacao de sala. */
export interface GameSummary {
  id: GameId;
  name: string;
  minPlayers: number;
  maxPlayers: number;
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
    | 'KICKED'
    | 'INTERNAL';
  message: string;
}

/** Envelope de ack padrao para comandos com confirmacao. */
export type AckResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: WsError };
