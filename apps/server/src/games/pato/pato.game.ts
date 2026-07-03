import { Injectable } from '@nestjs/common';
import type { GameContext, GameDefinition, GameOverResult, PlayerId } from '@boardzando/contracts';
import { INVALID_MOVE } from '@boardzando/contracts';
import { GamePlugin } from '../../core/registry/game-plugin.decorator';
import { nextRound, submitGuess } from './pato.moves';
import type { NextRoundPayload, SubmitGuessPayload } from './pato.moves';
import { PATO_QUESTIONS } from './pato.questions';
import type { PatoOptions, PatoState } from './pato.state';

type PatoMovePayload = SubmitGuessPayload | NextRoundPayload;

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
 * "Nem a Pato" — quiz cooperativo/competitivo de fatos curiosos com respostas
 * numericas quase impossiveis de acertar. Ganha quem chegar mais perto (empate
 * divide). Cravar o valor exato vale +2 ("na mosca 🦆"). Sem turnos: todos os
 * moves sao off-turn.
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
      step: 'guess',
      guesses: {},
      scores,
    };
  }

  readonly moves = {
    submitGuess,
    nextRound,
  } as Record<string, (state: PatoState, ctx: GameContext, payload: PatoMovePayload) => PatoState | typeof INVALID_MOVE>;

  readonly offTurnMoves = ['submitGuess', 'nextRound'] as const;

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
   * Esconde a pergunta futura (ok — nem precisa), a RESPOSTA da rodada atual
   * ate o reveal, e os palpites alheios durante 'guess' (mostra so `answered`
   * como lista de PlayerId).
   */
  playerView(state: PatoState, _ctx: GameContext, viewer: PlayerId): unknown {
    const q = PATO_QUESTIONS[state.questionOrder[state.roundIndex]!]!;
    const isReveal = state.step === 'reveal';
    // Palpites: no `guess`, so o seu; no `reveal`, todos.
    const guesses: Record<PlayerId, number> = {};
    if (isReveal) {
      Object.assign(guesses, state.guesses);
    } else if (state.guesses[viewer] !== undefined) {
      guesses[viewer] = state.guesses[viewer]!;
    }
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
      guesses,
      answered: Object.keys(state.guesses),
      scores: state.scores,
      lastRound: state.lastRound,
      finished: state.finished,
    };
  }
}
