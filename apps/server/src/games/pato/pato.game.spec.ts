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

/** Partida de 1 rodada com a pergunta 0 (resposta conhecida) e vez do 'a'. */
function oneRoundMatch(): { m: GameInstance<PatoState>; answer: number } {
  const s = structuredClone(newMatch().snapshot.state);
  s.questionOrder = [0];
  s.options.roundsTotal = 1;
  s.roundIndex = 0;
  s.turnIdx = 0;
  s.bids = [];
  s.step = 'bid';
  return { m: seed(s), answer: PATO_QUESTIONS[0]!.answer };
}

describe('PatoGame (leilao em turnos)', () => {
  it('setup sorteia N perguntas sem repetição, zera pontos e começa no turno 0', () => {
    const s = newMatch(1, { roundsTotal: 8 }).snapshot.state;
    expect(s.options.roundsTotal).toBe(8);
    expect(s.questionOrder).toHaveLength(8);
    expect(new Set(s.questionOrder).size).toBe(8);
    expect(s.step).toBe('bid');
    expect(s.turnIdx).toBe(0);
    expect(s.bids).toEqual([]);
    for (const p of PLAYERS) expect(s.scores[p]).toBe(0);
  });

  it('placeBid: só o jogador da vez, inteiro, sempre maior que o anterior', () => {
    const { m } = oneRoundMatch();
    // não é a vez de b
    expect(() => m.applyMove('b', 'placeBid', { value: 10 })).toThrow(InvalidMoveError);
    // número quebrado é inválido
    expect(() => m.applyMove('a', 'placeBid', { value: 0.1 })).toThrow(InvalidMoveError);
    expect(() => m.applyMove('a', 'placeBid', { value: 1.321 })).toThrow(InvalidMoveError);
    // negativo/NaN inválidos
    expect(() => m.applyMove('a', 'placeBid', { value: -5 })).toThrow(InvalidMoveError);
    expect(() => m.applyMove('a', 'placeBid', { value: NaN })).toThrow(InvalidMoveError);

    m.applyMove('a', 'placeBid', { value: 10 });
    expect(m.snapshot.state.bids).toEqual([{ playerId: 'a', value: 10 }]);
    expect(m.snapshot.state.turnIdx).toBe(1); // passou a vez para b

    // b é obrigado a subir: igual ou menor é inválido
    expect(() => m.applyMove('b', 'placeBid', { value: 10 })).toThrow(InvalidMoveError);
    expect(() => m.applyMove('b', 'placeBid', { value: 9 })).toThrow(InvalidMoveError);
    m.applyMove('b', 'placeBid', { value: 11 });
    expect(m.snapshot.state.turnIdx).toBe(2);
  });

  it('callDuck: qualquer um MENOS quem deu o último lance, e só após o 1º lance', () => {
    const { m } = oneRoundMatch();
    // sem lance ainda: ninguém pode gritar
    expect(() => m.applyMove('b', 'callDuck', {})).toThrow(InvalidMoveError);
    m.applyMove('a', 'placeBid', { value: 1 });
    // a deu o último lance: não grita no próprio número
    expect(() => m.applyMove('a', 'callDuck', {})).toThrow(InvalidMoveError);
    // b (o da vez!) pode gritar em vez de subir — essencial com 2 jogadores
    m.applyMove('b', 'callDuck', {});
    expect(m.snapshot.state.step).toBe('reveal');
    expect(m.snapshot.state.lastRound?.callerId).toBe('b');
    expect(m.snapshot.state.lastRound?.lastBidderId).toBe('a');
  });

  it('reveal: vence o maior lance que não passou; quem passou não ganha nada', () => {
    const { m, answer } = oneRoundMatch();
    m.applyMove('a', 'placeBid', { value: Math.max(0, answer - 10) });
    m.applyMove('b', 'placeBid', { value: answer - 1 }); // mais perto, sem passar
    m.applyMove('c', 'placeBid', { value: answer + 1 }); // passou (pertinho, mas nada)
    m.applyMove('b', 'callDuck', {}); // vez é de a; b grita
    const lr = m.snapshot.state.lastRound!;
    expect(lr.overshot).toBe(true); // o último lance passou
    expect(lr.winnerId).toBe('b');
    expect(lr.winningValue).toBe(answer - 1);
    expect(m.snapshot.state.scores['b']).toBe(1);
    expect(m.snapshot.state.scores['c']).toBe(0); // passou: nada
  });

  it('reveal: se TODOS os lances passaram, ninguém pontua', () => {
    const { m, answer } = oneRoundMatch();
    m.applyMove('a', 'placeBid', { value: answer + 1 });
    m.applyMove('b', 'placeBid', { value: answer + 2 });
    m.applyMove('a', 'callDuck', {}); // vez é de c; a grita
    const lr = m.snapshot.state.lastRound!;
    expect(lr.winnerId).toBeUndefined();
    for (const p of PLAYERS) expect(m.snapshot.state.scores[p]).toBe(0);
  });

  it('nextRound: zera lances, rotaciona quem abre e finaliza após roundsTotal', () => {
    const s = structuredClone(newMatch().snapshot.state);
    s.questionOrder = [0, 1];
    s.options.roundsTotal = 2;
    const m = seed(s);
    m.applyMove('a', 'placeBid', { value: 5 });
    m.applyMove('c', 'callDuck', {});
    m.applyMove('a', 'nextRound', {});
    expect(m.snapshot.state.step).toBe('bid');
    expect(m.snapshot.state.roundIndex).toBe(1);
    expect(m.snapshot.state.bids).toEqual([]);
    expect(m.snapshot.state.turnIdx).toBe(1); // rodada 2 abre com b

    m.applyMove('b', 'placeBid', { value: 5 });
    m.applyMove('a', 'callDuck', {});
    m.applyMove('c', 'nextRound', {});
    expect(m.isOver).toBe(true);
    expect(m.snapshot.gameover).toBeDefined();
  });

  it('playerView: lances públicos, resposta escondida até o reveal', () => {
    const { m } = oneRoundMatch();
    m.applyMove('a', 'placeBid', { value: 7 });
    const vb = m.viewFor('b') as {
      currentQuestion: { answer?: number; explanation?: string };
      bids: Array<{ playerId: string; value: number }>;
      turnPlayerId: string;
    };
    expect(vb.currentQuestion.answer).toBeUndefined();
    expect(vb.currentQuestion.explanation).toBeUndefined();
    expect(vb.bids).toEqual([{ playerId: 'a', value: 7 }]); // público
    expect(vb.turnPlayerId).toBe('b');

    m.applyMove('c', 'callDuck', {});
    const vb2 = m.viewFor('b') as { currentQuestion: { answer?: number } };
    expect(vb2.currentQuestion.answer).toBe(PATO_QUESTIONS[0]!.answer);
  });
});
