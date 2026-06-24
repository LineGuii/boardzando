import { Injectable } from '@nestjs/common';
import type { GameContext, GameDefinition, GameOverResult, PlayerId } from '@boardzando/contracts';
import { HUES_DEFAULT_OPTIONS, INVALID_MOVE, type HuesOptions } from '@boardzando/contracts';
import { GamePlugin } from '../../core/registry/game-plugin.decorator';
import { finalizeRound, placeCone, rollCardOptions, selectColor, submitCue } from './hues.moves';
import type {
  FinalizeRoundPayload,
  PlaceConePayload,
  SelectColorPayload,
  SubmitCuePayload,
} from './hues.moves';
import type { HuesState } from './hues.state';

type HuesMovePayload =
  | SelectColorPayload
  | SubmitCuePayload
  | PlaceConePayload
  | FinalizeRoundPayload;

/** Sanitiza `setupData` recebido do gateway em um HuesOptions valido. */
function readOptions(raw: unknown): HuesOptions {
  const o = (raw ?? {}) as Partial<HuesOptions>;
  const roundsPerPlayer: HuesOptions['roundsPerPlayer'] =
    o.roundsPerPlayer === 1 || o.roundsPerPlayer === 2 || o.roundsPerPlayer === 3
      ? o.roundsPerPlayer
      : HUES_DEFAULT_OPTIONS.roundsPerPlayer;
  const liveGuesses =
    typeof o.liveGuesses === 'boolean' ? o.liveGuesses : HUES_DEFAULT_OPTIONS.liveGuesses;
  return { roundsPerPlayer, liveGuesses };
}

/**
 * Plugin Hues & Cues. Cada rodada o jogador da vez vira "cue-giver":
 * escolhe uma cor secreta no tabuleiro 30x16, da uma dica de 1 palavra
 * (palpitadores cravam 1 cone), depois 2 palavras (palpitadores cravam o
 * 2o cone). Pontua proximidade ao alvo. Acaba apos `numPlayers * roundsPerPlayer`
 * turnos de cue-giver.
 */
@Injectable()
@GamePlugin()
export class HuesGame implements GameDefinition<HuesState, HuesMovePayload> {
  readonly id = 'hues';
  readonly name = 'Hues & Cues';
  readonly minPlayers = 2;
  readonly maxPlayers = 10;

  setup(ctx: GameContext, setupData?: unknown): HuesState {
    const options = readOptions(setupData);
    const cardOptions = rollCardOptions(ctx.random);
    const guesses: Record<PlayerId, never[]> = {};
    const scores: Record<PlayerId, number> = {};
    const cueGiverCount: Record<PlayerId, number> = {};
    for (const p of ctx.players) {
      guesses[p] = [];
      scores[p] = 0;
      cueGiverCount[p] = 0;
    }
    return {
      options,
      step: 'pick',
      cardOptions,
      guesses,
      scores,
      cueGiverCount,
      targetRounds: ctx.players.length * options.roundsPerPlayer,
    };
  }

  readonly moves = {
    selectColor,
    submitCue,
    placeCone,
    finalizeRound,
  } as Record<string, (state: HuesState, ctx: GameContext, payload: HuesMovePayload) => HuesState | typeof INVALID_MOVE>;

  readonly offTurnMoves = ['placeCone'] as const;

  endIf(state: HuesState, _ctx: GameContext): GameOverResult | void {
    const total = Object.values(state.cueGiverCount).reduce((a, b) => a + b, 0);
    if (total < state.targetRounds) return;
    // ordena por pontuacao desc; mantem empates
    const ranked = Object.entries(state.scores)
      .map(([pid, score]) => ({ pid, score }))
      .sort((a, b) => b.score - a.score);
    const topScore = ranked[0]?.score ?? 0;
    const winners = ranked.filter((r) => r.score === topScore).map((r) => r.pid);
    if (winners.length > 1) {
      return {
        draw: true,
        ranking: ranked.map((r) => r.pid),
        meta: { scores: state.scores, winners },
      };
    }
    return {
      winner: winners[0],
      ranking: ranked.map((r) => r.pid),
      meta: { scores: state.scores },
    };
  }

  /**
   * Esconde:
   *  - `target` ate o reveal;
   *  - `cardOptions` para quem nao e o cue-giver;
   *  - palpites de outros jogadores se `options.liveGuesses === false` e ainda
   *    estamos numa fase de palpite.
   */
  playerView(state: HuesState, ctx: GameContext, playerId: PlayerId): unknown {
    const isCueGiver = playerId === ctx.currentPlayer;
    const isRevealOrLater = state.step === 'reveal';
    const inGuessPhase = state.step === 'guess1' || state.step === 'guess2';
    const hideOthersGuesses = !state.options.liveGuesses && inGuessPhase;

    const visibleGuesses: Record<PlayerId, typeof state.guesses[string]> = {};
    if (hideOthersGuesses) {
      visibleGuesses[playerId] = state.guesses[playerId] ?? [];
    } else {
      for (const [pid, cones] of Object.entries(state.guesses)) {
        visibleGuesses[pid] = cones;
      }
    }

    // O cue-giver sempre ve o proprio alvo (precisa lembrar enquanto digita as
    // dicas); demais jogadores so veem no reveal.
    const showTarget = isRevealOrLater || isCueGiver;
    return {
      options: state.options,
      step: state.step,
      cardOptions: isCueGiver ? state.cardOptions : undefined,
      target: showTarget ? state.target : undefined,
      cue1: state.cue1,
      cue2: state.cue2,
      guesses: visibleGuesses,
      scores: state.scores,
      cueGiverCount: state.cueGiverCount,
      targetRounds: state.targetRounds,
      lastRound: state.lastRound,
    };
  }
}
