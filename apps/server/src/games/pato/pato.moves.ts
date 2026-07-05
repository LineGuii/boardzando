import type { Move } from '@boardzando/contracts';
import { INVALID_MOVE } from '@boardzando/contracts';
import { PATO_QUESTIONS } from './pato.questions';
import type { PatoState } from './pato.state';

export interface PlaceBidPayload {
  value: number;
}
export type CallDuckPayload = Record<string, never>;
export type NextRoundPayload = Record<string, never>;

function clone(state: PatoState): PatoState {
  return structuredClone(state);
}

function currentQuestionIndex(state: PatoState): number {
  return state.questionOrder[state.roundIndex]!;
}

/**
 * MOVE: o jogador DA VEZ diz um numero em voz alta. Regras do lance:
 * inteiro (nada de 0.1 ou 1,321) e estritamente MAIOR que o lance anterior.
 * A vez passa para o proximo jogador.
 */
export const placeBid: Move<PatoState, PlaceBidPayload> = (state, ctx, payload) => {
  if (state.step !== 'bid') return INVALID_MOVE;
  if (ctx.players[state.turnIdx] !== ctx.actor) return INVALID_MOVE; // nao e sua vez
  const v = payload.value;
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) return INVALID_MOVE;
  const last = state.bids[state.bids.length - 1];
  if (last && v <= last.value) return INVALID_MOVE; // tem que subir
  const next = clone(state);
  next.bids.push({ playerId: ctx.actor, value: v });
  next.turnIdx = (next.turnIdx + 1) % ctx.players.length;
  return next;
};

/**
 * MOVE (off-turn): "NEM A PATO!" — qualquer jogador, MENOS o da vez, desafia
 * o ultimo lance dizendo que ele passou da resposta. Revela o resultado:
 * vence a rodada (+1) o dono do maior lance que NAO passou da resposta;
 * quem passou nao ganha nada, mesmo pertinho.
 */
export const callDuck: Move<PatoState, CallDuckPayload> = (state, ctx) => {
  if (state.step !== 'bid') return INVALID_MOVE;
  if (state.bids.length === 0) return INVALID_MOVE; // ninguem falou numero ainda
  if (ctx.players[state.turnIdx] === ctx.actor) return INVALID_MOVE; // o da vez nao pode

  const q = PATO_QUESTIONS[currentQuestionIndex(state)]!;
  const next = clone(state);
  const lastBid = next.bids[next.bids.length - 1]!;

  // Lances sao estritamente crescentes: o maior <= resposta e o ultimo valido.
  const under = next.bids.filter((b) => b.value <= q.answer);
  const winning = under[under.length - 1];
  if (winning) {
    next.scores[winning.playerId] = (next.scores[winning.playerId] ?? 0) + 1;
  }

  next.lastRound = {
    question: q.question,
    answer: q.answer,
    unit: q.unit,
    explanation: q.explanation,
    bids: [...next.bids],
    callerId: ctx.actor,
    lastBidderId: lastBid.playerId,
    overshot: lastBid.value > q.answer,
    winnerId: winning?.playerId,
    winningValue: winning?.value,
  };
  next.step = 'reveal';
  return next;
};

/**
 * MOVE (off-turn): avanca para a proxima rodada (ou encerra o jogo). Pode ser
 * disparado por qualquer jogador (concordancia social). Quem abre a rodada
 * rotaciona a cada rodada.
 */
export const nextRound: Move<PatoState, NextRoundPayload> = (state, ctx) => {
  if (state.step !== 'reveal') return INVALID_MOVE;
  const next = clone(state);
  if (next.roundIndex + 1 >= next.options.roundsTotal) {
    next.finished = true;
    return next;
  }
  next.roundIndex += 1;
  next.step = 'bid';
  next.bids = [];
  next.turnIdx = next.roundIndex % ctx.players.length;
  next.lastRound = undefined;
  return next;
};
