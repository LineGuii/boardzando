import { Injectable } from '@nestjs/common';
import type { GameContext, GameDefinition, GameOverResult, PlayerId } from '@boardzando/contracts';
import { INVALID_MOVE } from '@boardzando/contracts';
import { GamePlugin } from '../../core/registry/game-plugin.decorator';
import { callDuck, nextRound, placeBid } from './pato.moves';
import type { CallDuckPayload, NextRoundPayload, PlaceBidPayload } from './pato.moves';
import { PATO_QUESTIONS } from './pato.questions';
import type { PatoOptions, PatoState } from './pato.state';

type PatoMovePayload = PlaceBidPayload | CallDuckPayload | NextRoundPayload;

const DEFAULTS: PatoOptions = { roundsTotal: 8 };

function readOptions(raw: unknown): PatoOptions {
  const o = (raw ?? {}) as Partial<PatoOptions>;
  const r = o.roundsTotal;
  const roundsTotal =
    r === 5 || r === 8 || r === 12
      ? r
      : DEFAULTS.roundsTotal;
  return { roundsTotal };
}

/**
 * "Nem a Pato" — leilao de fatos curiosos com respostas numericas quase
 * impossiveis. Em TURNOS: o jogador da vez diz um numero inteiro MAIOR que o
 * anterior OU grita "Nem a Pato!"; qualquer um pode gritar a qualquer
 * momento, MENOS quem deu o ultimo lance (nao se desafia o proprio numero).
 * O grito acusa o ultimo lance de ter passado da resposta. No reveal, vence
 * a rodada (+1) o maior lance que nao passou — quem passou nao ganha nada,
 * mesmo pertinho.
 *
 * A vez e controlada no ESTADO (turnIdx), nao no motor de turnos: o
 * "Nem a Pato!" e off-turn por natureza, entao todos os moves sao off-turn e
 * o placeBid valida o ator contra ctx.players[turnIdx].
 */
@Injectable()
@GamePlugin()
export class PatoGame implements GameDefinition<PatoState, PatoMovePayload> {
  readonly id = 'pato';
  readonly name = 'Nem a Pato';
  readonly minPlayers = 2;
  readonly maxPlayers = 10;

  setup(ctx: GameContext, setupData?: unknown): PatoState {
    const options = readOptions(setupData);
    // Sorteia indices de PATO_QUESTIONS SEM REPETICAO. Se o banco for menor
    // que roundsTotal, ainda usamos todos disponiveis (nunca deve acontecer
    // com o banco atual, mas evita crash).
    const pool = PATO_QUESTIONS.map((_, i) => i);
    const shuffled = ctx.random.shuffle(pool);
    const roundsTotal = Math.min(options.roundsTotal, shuffled.length);
    const questionOrder = shuffled.slice(0, roundsTotal);
    const scores: Record<PlayerId, number> = {};
    for (const p of ctx.players) scores[p] = 0;
    return {
      options: { roundsTotal },
      questionOrder,
      roundIndex: 0,
      step: 'bid',
      bids: [],
      turnIdx: 0,
      scores,
    };
  }

  readonly moves = {
    placeBid,
    callDuck,
    nextRound,
  } as Record<string, (state: PatoState, ctx: GameContext, payload: PatoMovePayload) => PatoState | typeof INVALID_MOVE>;

  readonly offTurnMoves = ['placeBid', 'callDuck', 'nextRound'] as const;

  endIf(state: PatoState): GameOverResult | void {
    if (!state.finished) return;
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
   * Os lances sao PUBLICOS (ditos em voz alta) — so a resposta e a explicacao
   * ficam escondidas ate o reveal.
   */
  playerView(state: PatoState, ctx: GameContext, _viewer: PlayerId): unknown {
    const q = PATO_QUESTIONS[state.questionOrder[state.roundIndex]!]!;
    const isReveal = state.step === 'reveal';
    return {
      options: state.options,
      roundIndex: state.roundIndex,
      roundsTotal: state.options.roundsTotal,
      step: state.step,
      currentQuestion: {
        question: q.question,
        unit: q.unit,
        // resposta e explicacao so no reveal
        answer: isReveal ? q.answer : undefined,
        explanation: isReveal ? q.explanation : undefined,
      },
      bids: state.bids,
      turnPlayerId: ctx.players[state.turnIdx],
      scores: state.scores,
      lastRound: state.lastRound,
      finished: state.finished,
    };
  }
}
