import type { PlayerId } from '@boardzando/contracts';
import { GameInstance, InvalidMoveError } from '../../core/engine/game-instance';
import { PatoGame } from './pato.game';
import { PATO_QUESTIONS } from './pato.questions';
import type { PatoState } from './pato.state';

const PLAYERS: PlayerId[] = ['a', 'b', 'c'];

function newMatch(seed = 42, opts?: Partial<{ roundsTotal: 5 | 8 | 12 }>): GameInstance<PatoState> {
  return GameInstance.create(new PatoGame(), PLAYERS, seed, opts);
}

function seed(state: PatoState): GameInstance<PatoState> {
  const base = GameInstance.create(new PatoGame(), PLAYERS, 1);
  return GameInstance.restore(new PatoGame(), { ...base.snapshot, state });
}

describe('PatoGame', () => {
  it('setup sorteia N perguntas sem repetição e zera pontos', () => {
    const s = newMatch(1, { roundsTotal: 8 }).snapshot.state;
    expect(s.options.roundsTotal).toBe(8);
    expect(s.questionOrder).toHaveLength(8);
    expect(new Set(s.questionOrder).size).toBe(8);
    expect(s.step).toBe('guess');
    for (const p of PLAYERS) expect(s.scores[p]).toBe(0);
  });

  it('submitGuess: 1 por rodada, rejeita valor não-numérico', () => {
    const m = newMatch();
    m.applyMove('a', 'submitGuess', { value: 42 });
    expect(m.snapshot.state.guesses['a']).toBe(42);
    // segundo envio na mesma rodada é inválido
    expect(() => m.applyMove('a', 'submitGuess', { value: 99 })).toThrow(InvalidMoveError);
    // NaN inválido
    expect(() => m.applyMove('b', 'submitGuess', { value: NaN })).toThrow(InvalidMoveError);
  });

  it('quando todos respondem, transiciona para reveal e pontua mais próximo', () => {
    // força questionOrder controlado (índice 0 → resposta conhecida)
    const base = newMatch();
    const s = structuredClone(base.snapshot.state);
    s.questionOrder = [0]; // primeira pergunta do banco
    s.options.roundsTotal = 1;
    const m = seed(s);
    const correct = PATO_QUESTIONS[0]!.answer;
    m.applyMove('a', 'submitGuess', { value: correct - 5 });
    m.applyMove('b', 'submitGuess', { value: correct + 10 });
    m.applyMove('c', 'submitGuess', { value: correct + 100 });
    expect(m.snapshot.state.step).toBe('reveal');
    expect(m.snapshot.state.lastRound?.winners).toEqual(['a']); // mais perto
    expect(m.snapshot.state.scores['a']).toBe(1);
    expect(m.snapshot.state.scores['b']).toBe(0);
    expect(m.snapshot.state.lastRound?.exact).toBe(false);
  });

  it('acerto exato dá +2 e mais de um vencedor divide (todos +N)', () => {
    // exato
    const base1 = newMatch();
    const s1 = structuredClone(base1.snapshot.state);
    s1.questionOrder = [0];
    s1.options.roundsTotal = 1;
    const m1 = seed(s1);
    const correct = PATO_QUESTIONS[0]!.answer;
    m1.applyMove('a', 'submitGuess', { value: correct });
    m1.applyMove('b', 'submitGuess', { value: correct + 20 });
    m1.applyMove('c', 'submitGuess', { value: correct + 40 });
    expect(m1.snapshot.state.lastRound?.exact).toBe(true);
    expect(m1.snapshot.state.scores['a']).toBe(2);

    // empate: dois igual perto
    const base2 = newMatch();
    const s2 = structuredClone(base2.snapshot.state);
    s2.questionOrder = [0];
    s2.options.roundsTotal = 1;
    const m2 = seed(s2);
    m2.applyMove('a', 'submitGuess', { value: correct - 3 });
    m2.applyMove('b', 'submitGuess', { value: correct + 3 });
    m2.applyMove('c', 'submitGuess', { value: correct + 30 });
    expect(new Set(m2.snapshot.state.lastRound!.winners)).toEqual(new Set(['a', 'b']));
    expect(m2.snapshot.state.scores['a']).toBe(1);
    expect(m2.snapshot.state.scores['b']).toBe(1);
  });

  it('nextRound avança e finaliza após roundsTotal', () => {
    const base = newMatch();
    const s = structuredClone(base.snapshot.state);
    s.questionOrder = [0, 1];
    s.options.roundsTotal = 2;
    const m = seed(s);
    m.applyMove('a', 'submitGuess', { value: 1 });
    m.applyMove('b', 'submitGuess', { value: 2 });
    m.applyMove('c', 'submitGuess', { value: 3 });
    m.applyMove('a', 'nextRound', {});
    expect(m.snapshot.state.step).toBe('guess');
    expect(m.snapshot.state.roundIndex).toBe(1);
    expect(m.snapshot.state.guesses).toEqual({});

    m.applyMove('a', 'submitGuess', { value: 1 });
    m.applyMove('b', 'submitGuess', { value: 2 });
    m.applyMove('c', 'submitGuess', { value: 3 });
    m.applyMove('c', 'nextRound', {});
    expect(m.isOver).toBe(true);
    expect(m.snapshot.gameover).toBeDefined();
  });

  it('playerView esconde resposta antes do reveal e palpites alheios', () => {
    const m = newMatch();
    m.applyMove('a', 'submitGuess', { value: 50 });
    const va = m.viewFor('a') as {
      currentQuestion: { answer?: number };
      guesses: Record<string, number>;
    };
    expect(va.currentQuestion.answer).toBeUndefined(); // ainda escondido
    expect(va.guesses['a']).toBe(50); // vejo o meu
    const vb = m.viewFor('b') as { guesses: Record<string, number>; answered: string[] };
    expect(vb.guesses['a']).toBeUndefined(); // não vejo o do outro
    expect(vb.answered).toContain('a');
  });
});
