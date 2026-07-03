import type { GameContext, Move, PlayerId } from '@boardzando/contracts';
import { INVALID_MOVE } from '@boardzando/contracts';
import { PATO_QUESTIONS } from './pato.questions';
import type { PatoState } from './pato.state';

export interface SubmitGuessPayload {
  value: number;
}
export type NextRoundPayload = Record<string, never>;

function clone(state: PatoState): PatoState {
  return structuredClone(state);
}

function currentQuestionIndex(state: PatoState): number {
  return state.questionOrder[state.roundIndex]!;
}

/**
 * MOVE (off-turn): jogador envia seu palpite numerico secreto. Quando todos
 * os jogadores respondem, calcula pontos e transiciona para 'reveal'.
 */
export const submitGuess: Move<PatoState, SubmitGuessPayload> = (state, ctx, payload) => {
  if (state.step !== 'guess') return INVALID_MOVE;
  const v = payload.value;
  if (typeof v !== 'number' || !Number.isFinite(v)) return INVALID_MOVE;
  if (state.guesses[ctx.actor] !== undefined) return INVALID_MOVE;
  const next = clone(state);
  next.guesses[ctx.actor] = v;

  // Se todos ja responderam, resolve a rodada.
  const allAnswered = ctx.players.every((p) => next.guesses[p] !== undefined);
  if (allAnswered) {
    const q = PATO_QUESTIONS[currentQuestionIndex(next)]!;
    const dists = ctx.players.map((p) => ({
      p,
      d: Math.abs(next.guesses[p]! - q.answer),
    }));
    const minD = Math.min(...dists.map((x) => x.d));
    const winners = dists.filter((x) => x.d === minD).map((x) => x.p);
    const exact = minD === 0;
    const perWinner = exact ? 2 : 1;
    const gained: Record<PlayerId, number> = {};
    for (const p of ctx.players) gained[p] = 0;
    for (const w of winners) {
      next.scores[w] = (next.scores[w] ?? 0) + perWinner;
      gained[w] = perWinner;
    }
    next.lastRound = {
      question: q.question,
      answer: q.answer,
      unit: q.unit,
      explanation: q.explanation,
      guesses: { ...next.guesses },
      winners,
      exact,
      gained,
    };
    next.step = 'reveal';
  }
  return next;
};

/**
 * MOVE (off-turn): avanca para a proxima rodada (ou encerra o jogo). Pode ser
 * disparado por qualquer jogador (concordancia social).
 */
export const nextRound: Move<PatoState, NextRoundPayload> = (state, _ctx) => {
  if (state.step !== 'reveal') return INVALID_MOVE;
  const next = clone(state);
  if (next.roundIndex + 1 >= next.options.roundsTotal) {
    next.finished = true;
    return next;
  }
  next.roundIndex += 1;
  next.step = 'guess';
  next.guesses = {};
  next.lastRound = undefined;
  return next;
};
