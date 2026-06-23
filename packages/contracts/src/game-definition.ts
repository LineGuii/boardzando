import type { GameId, GameOverResult, InvalidMove, PlayerId } from './types';
import type { RandomAPI } from './random';

/**
 * Contexto entregue a setup/moves/hooks. Imutavel do ponto de vista do jogo:
 * o engine do core e quem o atualiza (turno, fase, jogador atual).
 */
export interface GameContext {
  readonly players: readonly PlayerId[];
  readonly currentPlayer: PlayerId;
  /**
   * Jogador que originou o move atual. Em moves normais, igual a
   * `currentPlayer`. Para moves listados em `GameDefinition.offTurnMoves`
   * (ex.: "callUno"/"contestUno"), pode ser QUALQUER jogador — use `actor`
   * para identificar quem invocou.
   */
  readonly actor: PlayerId;
  readonly phase: string;
  /** Numero do turno atual (comeca em 1). */
  readonly turn: number;
  /** RNG seeded e server-side. */
  readonly random: RandomAPI;
}

/**
 * Um move e um REDUCER PURO: recebe estado + contexto + payload e retorna o
 * proximo estado, ou INVALID_MOVE se a jogada for ilegal. Sem efeitos
 * colaterais, sem rede, sem Math.random -> trivialmente testavel com Jest.
 *
 * Importante: NAO mute `state`; produza um novo objeto (use spread / structuredClone
 * / immer no jogo, se preferir). O engine assume imutabilidade para snapshots.
 */
export type Move<TState, TPayload = unknown> = (
  state: TState,
  ctx: GameContext,
  payload: TPayload,
) => TState | InvalidMove;

/** Configuracao de uma fase do jogo (ex.: "play", "challengeWildDraw4"). */
export interface PhaseConfig<TState> {
  /** Se true, e a fase inicial. Exatamente uma fase deve ter start=true. */
  start?: boolean;
  /** Proxima fase quando esta termina (se nao definido, o jogo decide via endIf/hooks). */
  next?: string;
  /** Hook chamado ao entrar na fase. */
  onBegin?: (state: TState, ctx: GameContext) => TState;
  /** Hook chamado ao sair da fase. */
  onEnd?: (state: TState, ctx: GameContext) => TState;
  /** Se retornar truthy, a fase termina. */
  endIf?: (state: TState, ctx: GameContext) => boolean;
  /** Moves disponiveis SOMENTE nesta fase (sobrescreve os globais). */
  moves?: Record<string, Move<TState>>;
}

/** Como a ordem de turnos progride. */
export interface TurnConfig<TState> {
  /** Hook ao iniciar um turno. */
  onBegin?: (state: TState, ctx: GameContext) => TState;
  /** Hook ao encerrar um turno. */
  onEnd?: (state: TState, ctx: GameContext) => TState;
  /**
   * Calcula o proximo jogador. Se omitido, o engine usa ordem circular simples
   * (indice + 1 mod N). Jogos com inversao de sentido (ex.: UNO "reverse")
   * sobrescrevem aqui lendo o estado.
   */
  nextPlayer?: (state: TState, ctx: GameContext) => PlayerId;
}

/**
 * O CONTRATO que todo jogo plugavel implementa. Inspirado no objeto `Game` do
 * boardgame.io, porem totalmente tipado e desacoplado do transporte (WebSocket).
 *
 * O core nao conhece NENHUM jogo concreto: ele apenas opera sobre esta interface.
 * Adicionar um jogo = criar uma pasta em `apps/server/src/games/<id>` que exporta
 * um objeto que satisfaz `GameDefinition`, e registra-lo (decorator @GamePlugin).
 */
export interface GameDefinition<TState = unknown, TMovePayload = unknown> {
  /** Id estavel e unico (ex.: "uno"). Usado em URLs, registro e contratos WS. */
  readonly id: GameId;
  /** Nome amigavel exibido no lobby. */
  readonly name: string;
  readonly minPlayers: number;
  readonly maxPlayers: number;

  /** Cria o estado inicial. `setupData` e opcional (opcoes de sala/variantes). */
  setup(ctx: GameContext, setupData?: unknown): TState;

  /** Moves globais (validos em qualquer fase, salvo override por fase). */
  moves: Record<string, Move<TState, TMovePayload>>;

  /**
   * Nomes de moves que podem ser executados POR QUALQUER jogador a qualquer
   * momento, NAO so na vez. O engine pula a checagem de turno e NAO avanca o
   * turno apos esses moves. Use `ctx.actor` (e nao `ctx.currentPlayer`) para
   * identificar quem invocou. Ex.: chamar "UNO!" e contestar.
   */
  offTurnMoves?: readonly string[];

  /** Fases opcionais. Se omitido, o jogo roda numa unica fase implicita "main". */
  phases?: Record<string, PhaseConfig<TState>>;

  /** Configuracao de turnos. */
  turn?: TurnConfig<TState>;

  /** Se retornar um resultado, o jogo termina. */
  endIf?(state: TState, ctx: GameContext): GameOverResult | void;

  /**
   * Filtra o estado para a perspectiva de um jogador, escondendo informacao
   * secreta (ex.: a mao dos oponentes). O retorno e o que sera enviado para
   * AQUELE cliente. Por padrao envia o estado inteiro (jogos de info perfeita).
   */
  playerView?(state: TState, ctx: GameContext, playerId: PlayerId): unknown;
}
