import type { GameContext, GameDefinition, GameOverResult, PlayerId } from '@boardzando/contracts';
import { INVALID_MOVE } from '@boardzando/contracts';
import { SeededRandom } from './seeded-random';

/** Tudo que descreve uma partida em andamento (serializavel, exceto o RNG vivo). */
export interface MatchState<TState = unknown> {
  state: TState;
  players: PlayerId[];
  currentPlayer: PlayerId;
  phase: string;
  turn: number;
  rngState: number;
  gameover?: GameOverResult;
}

export class InvalidMoveError extends Error {
  constructor(public readonly moveType: string) {
    super(`Move invalido: ${moveType}`);
  }
}

export class NotYourTurnError extends Error {
  constructor() {
    super('Nao e a vez deste jogador.');
  }
}

/**
 * GameInstance encapsula uma partida de UM jogo plugado. O core a usa sem
 * conhecer as regras: tudo flui pela GameDefinition. Mantem o estado, o jogador
 * atual, a fase, o turno e o RNG.
 */
export class GameInstance<TState = unknown> {
  private constructor(
    private readonly def: GameDefinition<TState>,
    private match: MatchState<TState>,
  ) {}

  /** Cria e inicializa uma nova partida. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static create<TState>(
    def: GameDefinition<TState, any>,
    players: PlayerId[],
    seed: number,
    setupData?: unknown,
  ): GameInstance<TState> {
    const startPhase =
      Object.entries(def.phases ?? {}).find(([, p]) => p.start)?.[0] ?? 'main';

    const rng = new SeededRandom(seed);
    const match: MatchState<TState> = {
      state: undefined as unknown as TState,
      players: [...players],
      currentPlayer: players[0]!,
      phase: startPhase,
      turn: 1,
      rngState: rng.getState(),
    };

    const instance = new GameInstance(def, match);
    const ctx = instance.buildContext(rng);
    let state = def.setup(ctx, setupData);

    // hook onBegin da fase inicial
    const phaseCfg = def.phases?.[startPhase];
    if (phaseCfg?.onBegin) state = phaseCfg.onBegin(state, ctx);
    if (def.turn?.onBegin) state = def.turn.onBegin(state, ctx);

    match.state = state;
    match.rngState = rng.getState();
    instance.checkGameOver(ctx);
    return instance;
  }

  /** Restaura uma partida persistida. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static restore<TState>(
    def: GameDefinition<TState, any>,
    match: MatchState<TState>,
  ): GameInstance<TState> {
    return new GameInstance(def, { ...match, players: [...match.players] });
  }

  get snapshot(): Readonly<MatchState<TState>> {
    return this.match;
  }

  get isOver(): boolean {
    return this.match.gameover !== undefined;
  }

  /**
   * Aplica um move em nome de `playerId`. Valida vez, resolve o move (global ou
   * da fase), roda o reducer puro e avanca turno/fase conforme os hooks.
   * Lanca InvalidMoveError / NotYourTurnError em caso de violacao.
   */
  applyMove(playerId: PlayerId, moveType: string, payload: unknown): void {
    if (this.isOver) throw new InvalidMoveError(moveType);

    const isOffTurn = this.def.offTurnMoves?.includes(moveType) ?? false;
    if (!isOffTurn && playerId !== this.match.currentPlayer) throw new NotYourTurnError();

    const phaseCfg = this.def.phases?.[this.match.phase];
    const move = phaseCfg?.moves?.[moveType] ?? this.def.moves[moveType];
    if (!move) throw new InvalidMoveError(moveType);

    const rng = SeededRandom.fromState(this.match.rngState);
    const ctx = this.buildContext(rng, playerId);

    const next = move(this.match.state, ctx, payload);
    if (next === INVALID_MOVE) throw new InvalidMoveError(moveType);

    // O reducer pode sinalizar "mantenha o turno comigo" setando __keepTurn
    // no estado retornado (ex.: UNO drawCard quando ainda nao houve stack).
    // O campo e interno: removido antes de persistir/expor.
    const keepTurn = (next as unknown as Record<string, unknown>).__keepTurn === true;
    if (keepTurn) delete (next as unknown as Record<string, unknown>).__keepTurn;

    this.match.state = next;
    this.match.rngState = rng.getState();

    if (this.checkGameOver(ctx)) return;
    this.maybeAdvancePhase(ctx);
    if (this.isOver) return;
    // Moves off-turn nao consomem o turno do jogador da vez.
    // Moves que setaram __keepTurn tambem nao avancam (jogador continua decidindo).
    if (!isOffTurn && !keepTurn) this.advanceTurn();
  }

  /** Estado filtrado para um jogador (esconde info secreta). */
  viewFor(playerId: PlayerId): unknown {
    if (!this.def.playerView) return this.match.state;
    const ctx = this.buildContext(SeededRandom.fromState(this.match.rngState));
    return this.def.playerView(this.match.state, ctx, playerId);
  }

  // ---------- internals ----------

  private buildContext(rng: SeededRandom, actor?: PlayerId): GameContext {
    return {
      players: this.match.players,
      currentPlayer: this.match.currentPlayer,
      actor: actor ?? this.match.currentPlayer,
      phase: this.match.phase,
      turn: this.match.turn,
      random: rng,
    };
  }

  private checkGameOver(ctx: GameContext): boolean {
    const result = this.def.endIf?.(this.match.state, ctx);
    if (result) {
      this.match.gameover = result;
      return true;
    }
    return false;
  }

  private maybeAdvancePhase(ctx: GameContext): void {
    const cfg = this.def.phases?.[this.match.phase];
    if (!cfg?.endIf?.(this.match.state, ctx)) return;

    if (cfg.onEnd) this.match.state = cfg.onEnd(this.match.state, ctx);
    const nextPhase = cfg.next;
    if (nextPhase && this.def.phases?.[nextPhase]) {
      this.match.phase = nextPhase;
      const nextCfg = this.def.phases[nextPhase]!;
      const ctx2 = this.buildContext(SeededRandom.fromState(this.match.rngState));
      if (nextCfg.onBegin) this.match.state = nextCfg.onBegin(this.match.state, ctx2);
    }
  }

  private advanceTurn(): void {
    const rng = SeededRandom.fromState(this.match.rngState);
    const ctx = this.buildContext(rng);

    if (this.def.turn?.onEnd) this.match.state = this.def.turn.onEnd(this.match.state, ctx);

    const next =
      this.def.turn?.nextPlayer?.(this.match.state, ctx) ?? this.defaultNextPlayer();
    this.match.currentPlayer = next;
    this.match.turn += 1;
    this.match.rngState = rng.getState();

    if (this.def.turn?.onBegin) {
      const ctx2 = this.buildContext(SeededRandom.fromState(this.match.rngState));
      this.match.state = this.def.turn.onBegin(this.match.state, ctx2);
    }
  }

  private defaultNextPlayer(): PlayerId {
    const idx = this.match.players.indexOf(this.match.currentPlayer);
    return this.match.players[(idx + 1) % this.match.players.length]!;
  }
}
