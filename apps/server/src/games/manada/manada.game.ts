import { Injectable } from '@nestjs/common';
import type { GameContext, GameDefinition, GameOverResult, PlayerId } from '@boardzando/contracts';
import { INVALID_MOVE } from '@boardzando/contracts';
import { GamePlugin } from '../../core/registry/game-plugin.decorator';
import { nextRound, submitAnswer } from './manada.moves';
import type { NextRoundPayload, SubmitAnswerPayload } from './manada.moves';
import { MANADA_THEMES } from './manada.themes';
import type { ManadaOptions, ManadaState } from './manada.state';

type ManadaMovePayload = SubmitAnswerPayload | NextRoundPayload;

const DEFAULTS: ManadaOptions = { targetCows: 8 };

function readOptions(raw: unknown): ManadaOptions {
  const o = (raw ?? {}) as Partial<ManadaOptions>;
  const t = o.targetCows;
  const targetCows = t === 5 || t === 8 || t === 11 ? t : DEFAULTS.targetCows;
  return { targetCows };
}

/**
 * "Efeito Manada" (Herd Mentality) — party game. A cada rodada o Vaqueiro le um
 * tema aberto e TODOS (inclusive o Vaqueiro) escrevem uma resposta em segredo.
 * Quem escreveu a resposta MAIS COMUM ganha 1 ficha de vaca (max 1/rodada). O
 * unico que ficou "sobrando" (resposta que ninguem repetiu) recebe a Vaca Rosa
 * e nao pode vencer enquanto a tiver. Vence quem juntar `targetCows` vacas sem
 * a Vaca Rosa; empate no alvo sobe o objetivo. O Vaqueiro gira a cada rodada.
 *
 * Jogo simultaneo: todos os moves sao off-turn; a rodada resolve sozinha quando
 * todos respondem.
 */
@Injectable()
@GamePlugin()
export class ManadaGame implements GameDefinition<ManadaState, ManadaMovePayload> {
  readonly id = 'manada';
  readonly name = 'Efeito Manada 🐄';
  readonly minPlayers = 3;
  readonly maxPlayers = 10;

  setup(ctx: GameContext, setupData?: unknown): ManadaState {
    const options = readOptions(setupData);
    const themeOrder = ctx.random.shuffle(MANADA_THEMES.map((_, i) => i));
    const cows: Record<PlayerId, number> = {};
    for (const p of ctx.players) cows[p] = 0;
    return {
      options,
      themeOrder,
      roundIndex: 0,
      step: 'answer',
      cowboyIdx: 0,
      answers: {},
      cows,
      target: options.targetCows,
    };
  }

  readonly moves = {
    submitAnswer,
    nextRound,
  } as Record<string, (state: ManadaState, ctx: GameContext, payload: ManadaMovePayload) => ManadaState | typeof INVALID_MOVE>;

  readonly offTurnMoves = ['submitAnswer', 'nextRound'] as const;

  endIf(state: ManadaState): GameOverResult | void {
    if (!state.finished) return;
    const ranking = [...Object.keys(state.cows)].sort(
      (a, b) => (state.cows[b] ?? 0) - (state.cows[a] ?? 0),
    );
    return {
      winner: state.winnerId,
      ranking,
      meta: { cows: state.cows, target: state.target, pinkCowHolder: state.pinkCowHolder },
    };
  }

  /**
   * Esconde as respostas alheias durante a fase `answer` (so manda a lista de
   * quem ja respondeu + a propria). No `reveal`, tudo e publico (lastRound).
   */
  playerView(state: ManadaState, ctx: GameContext, viewer: PlayerId): unknown {
    const isReveal = state.step === 'reveal';
    const myAnswer = state.answers[viewer];
    return {
      options: state.options,
      roundIndex: state.roundIndex,
      step: state.step,
      theme: MANADA_THEMES[state.themeOrder[state.roundIndex]!],
      cowboyId: ctx.players[state.cowboyIdx],
      answered: Object.keys(state.answers),
      myAnswer,
      cows: state.cows,
      pinkCowHolder: state.pinkCowHolder,
      target: state.target,
      lastRound: isReveal ? state.lastRound : undefined,
      winnerId: state.winnerId,
      finished: state.finished,
    };
  }
}
