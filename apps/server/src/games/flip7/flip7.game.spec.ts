import type { PlayerId } from '@boardzando/contracts';
import { GameInstance, InvalidMoveError, NotYourTurnError } from '../../core/engine/game-instance';
import { Flip7Game } from './flip7.game';
import { buildDeck } from './flip7.cards';
import { scorePlayer, summarizeDiscard } from './flip7.moves';
import type { Flip7PlayerState, Flip7State } from './flip7.state';

const P: PlayerId[] = ['a', 'b', 'c'];

function newMatch(seed = 42, opts?: { targetScore: 100 | 200 | 300 }): GameInstance<Flip7State> {
  return GameInstance.create(new Flip7Game(), P, seed, opts);
}
function seed(state: Flip7State): GameInstance<Flip7State> {
  const base = GameInstance.create(new Flip7Game(), P, 1);
  return GameInstance.restore(new Flip7Game(), {
    ...base.snapshot,
    players: [...P],
    currentPlayer: state.order[state.turnPtr]!,
    state,
  });
}
function ps(over: Partial<Flip7PlayerState> = {}): Flip7PlayerState {
  return { numbers: [], modifiers: [], secondChance: false, status: 'active', ...over };
}
function baseState(over: Partial<Flip7State> = {}): Flip7State {
  return {
    options: { targetScore: 200 },
    deck: [],
    discard: [],
    order: [...P],
    turnPtr: 0,
    dealerIdx: 0,
    round: 1,
    players: { a: ps(), b: ps(), c: ps() },
    totals: { a: 0, b: 0, c: 0 },
    roundEndSeq: 0,
    ...over,
  };
}

describe('Flip 7 — baralho e pontuação', () => {
  it('baralho tem 94 cartas com a composição correta', () => {
    const deck = buildDeck();
    expect(deck).toHaveLength(94);
    const nums = deck.filter((c) => c.kind === 'number');
    expect(nums).toHaveLength(79); // 1 + (1..12)
    // a carta N tem N cópias (0 e 1 têm 1)
    const countOf = (v: number) => nums.filter((c) => c.kind === 'number' && c.value === v).length;
    expect(countOf(0)).toBe(1);
    expect(countOf(1)).toBe(1);
    expect(countOf(12)).toBe(12);
    expect(deck.filter((c) => c.kind === 'modifier')).toHaveLength(6);
    const actions = deck.filter((c) => c.kind === 'action');
    expect(actions).toHaveLength(9);
    expect(actions.filter((c) => c.kind === 'action' && c.action === 'freeze')).toHaveLength(3);
  });

  it('pontuação: x2 multiplica antes dos "+"; Flip 7 dá +15; bust = 0', () => {
    expect(scorePlayer(ps({ numbers: [11, 5, 12], modifiers: ['+4'] }))).toBe(32); // 28+4
    expect(scorePlayer(ps({ numbers: [11, 5, 12], modifiers: ['x2'] }))).toBe(56); // 28*2
    expect(scorePlayer(ps({ numbers: [11, 5, 12], modifiers: ['x2', '+10'] }))).toBe(66); // 28*2+10
    expect(scorePlayer(ps({ numbers: [1, 2, 3, 4, 5, 6, 7] }))).toBe(28 + 15); // Flip 7
    expect(scorePlayer(ps({ numbers: [10, 10], status: 'busted' }))).toBe(0);
  });
});

describe('Flip 7 — hit / stay / bust / flip7', () => {
  it('hit com número novo continua; duplicata sem Segunda Chance estoura', () => {
    // baralho controlado: topo = 5 (novo p/ a), depois 5 de novo
    const m = seed(
      baseState({ deck: [{ kind: 'number', value: 5 }, { kind: 'number', value: 5 }] }),
    );
    m.applyMove('a', 'hit', {}); // a vira 5 -> vez passa para b
    expect(m.snapshot.state.players['a']!.numbers).toEqual([5]);
    expect(m.snapshot.currentPlayer).toBe('b');
    // devolve a vez para a artificialmente para testar a duplicata
    const s2 = baseState({
      deck: [{ kind: 'number', value: 5 }],
      players: { a: ps({ numbers: [5] }), b: ps(), c: ps() },
    });
    const m2 = seed(s2);
    m2.applyMove('a', 'hit', {}); // 5 duplicado -> bust
    expect(m2.snapshot.state.players['a']!.status).toBe('busted');
  });

  it('Segunda Chance salva de uma duplicata', () => {
    const m = seed(
      baseState({
        deck: [{ kind: 'number', value: 7 }],
        players: { a: ps({ numbers: [7], secondChance: true }), b: ps(), c: ps() },
      }),
    );
    m.applyMove('a', 'hit', {});
    const a = m.snapshot.state.players['a']!;
    expect(a.status).toBe('active'); // não estourou
    expect(a.secondChance).toBe(false); // consumiu
  });

  it('7 números únicos = Flip 7: encerra a rodada e dá +15', () => {
    const m = seed(
      baseState({
        deck: [{ kind: 'number', value: 6 }],
        players: {
          a: ps({ numbers: [1, 2, 3, 4, 5, 7] }), // 6 números; falta 1 p/ Flip 7
          b: ps({ numbers: [10] }),
          c: ps({ numbers: [8], status: 'stayed' }),
        },
        totals: { a: 0, b: 0, c: 0 },
      }),
    );
    m.applyMove('a', 'hit', {}); // vira o 6 -> 7 únicos -> Flip 7, fim da rodada
    const st = m.snapshot.state;
    // rodada nova começou (round 2); pontuações acumuladas
    expect(st.round).toBe(2);
    expect(st.totals['a']).toBe(1 + 2 + 3 + 4 + 5 + 7 + 6 + 15); // 43
    expect(st.totals['b']).toBe(10); // b não estourou -> pontua a linha
    expect(st.lastRound?.flip7By).toBe('a');
  });

  it('stay bane a linha; rodada acaba quando não há mais ativos', () => {
    const m = seed(
      baseState({
        players: {
          a: ps({ numbers: [9] }),
          b: ps({ numbers: [4], status: 'stayed' }),
          c: ps({ numbers: [3], status: 'busted' }),
        },
      }),
    );
    m.applyMove('a', 'stay', {}); // último ativo para -> fim de rodada
    const st = m.snapshot.state;
    expect(st.round).toBe(2);
    expect(st.totals['a']).toBe(9);
    expect(st.totals['b']).toBe(4);
    expect(st.totals['c']).toBe(0); // bustou
  });
});

describe('Flip 7 — cartas de ação', () => {
  it('Freeze: escolher alvo congela e o tira da rodada', () => {
    const m = seed(
      baseState({
        deck: [{ kind: 'action', action: 'freeze' }],
        players: { a: ps({ numbers: [2] }), b: ps({ numbers: [8] }), c: ps({ numbers: [3] }) },
      }),
    );
    m.applyMove('a', 'hit', {}); // a compra Freeze -> pendente de alvo, mantém a vez
    expect(m.snapshot.currentPlayer).toBe('a');
    expect(m.snapshot.state.pending?.kind).toBe('action');
    m.applyMove('a', 'resolveAction', { targetId: 'b' });
    expect(m.snapshot.state.players['b']!.status).toBe('frozen');
    expect(m.snapshot.currentPlayer).toBe('c'); // vez avança (b saiu)
  });

  it('Segunda Chance extra é passada para outro jogador ativo', () => {
    const m = seed(
      baseState({
        deck: [{ kind: 'action', action: 'second' }],
        players: { a: ps({ secondChance: true }), b: ps(), c: ps() },
      }),
    );
    m.applyMove('a', 'hit', {}); // a já tem uma -> pendente de repasse
    expect(m.snapshot.state.pending?.kind).toBe('giveSecond');
    m.applyMove('a', 'giveSecond', { targetId: 'b' });
    expect(m.snapshot.state.players['b']!.secondChance).toBe(true);
    expect(m.snapshot.currentPlayer).toBe('b');
  });

  it('não é a sua vez / mover com pendência aberta são inválidos', () => {
    const m = seed(
      baseState({ deck: [{ kind: 'action', action: 'freeze' }] }),
    );
    expect(() => m.applyMove('b', 'hit', {})).toThrow(NotYourTurnError); // vez de a
    m.applyMove('a', 'hit', {}); // a compra freeze -> pendente
    expect(() => m.applyMove('a', 'hit', {})).toThrow(InvalidMoveError); // pendência aberta
  });
});

describe('Flip 7 — fim de jogo', () => {
  it('termina ao fim da rodada em que alguém atinge o alvo', () => {
    const m = seed(
      baseState({
        options: { targetScore: 100 },
        deck: [],
        turnPtr: 2, // vez do c (único ativo)
        players: {
          a: ps({ numbers: [12, 11], status: 'stayed' }),
          b: ps({ numbers: [1], status: 'stayed' }),
          c: ps({ numbers: [2] }),
        },
        totals: { a: 90, b: 10, c: 5 }, // a chegará a 90+23=113 >= 100
      }),
    );
    m.applyMove('c', 'stay', {}); // último ativo para -> fim de rodada
    expect(m.isOver).toBe(true);
    expect(m.snapshot.gameover?.winner).toBe('a');
    expect(m.snapshot.state.totals['a']).toBe(90 + 23);
  });
});

describe('Flip 7 — monte de descarte', () => {
  it('summarizeDiscard agrupa por número, modificador e ação', () => {
    const s = summarizeDiscard([
      { kind: 'number', value: 7 },
      { kind: 'number', value: 7 },
      { kind: 'number', value: 12 },
      { kind: 'modifier', mod: 'x2' },
      { kind: 'action', action: 'freeze' },
      { kind: 'action', action: 'freeze' },
    ]);
    expect(s.numbers[7]).toBe(2);
    expect(s.numbers[12]).toBe(1);
    expect(s.numbers[3]).toBe(0);
    expect(s.modifiers['x2']).toBe(1);
    expect(s.actions['freeze']).toBe(2);
    expect(s.total).toBe(6);
  });

  it('ao fim da rodada, as cartas das linhas vão para o descarte (conserva as 94)', () => {
    const m = seed(
      baseState({
        deck: [],
        players: {
          a: ps({ numbers: [9, 4], modifiers: ['x2'] }),
          b: ps({ numbers: [4], status: 'stayed' }), // 4 é duplicado só entre jogadores (ok)
          c: ps({ numbers: [3], status: 'busted', secondChance: true }),
        },
      }),
    );
    m.applyMove('a', 'stay', {}); // último ativo para → fim de rodada
    const disc = m.snapshot.state.discard;
    const sum = summarizeDiscard(disc);
    // a: 9,4,x2 ; b: 4 ; c: 3 + segunda chance
    expect(sum.numbers[9]).toBe(1);
    expect(sum.numbers[4]).toBe(2);
    expect(sum.numbers[3]).toBe(1);
    expect(sum.modifiers['x2']).toBe(1);
    expect(sum.actions['second']).toBe(1);
    // a view do plugin também expõe o resumo
    const view = m.viewFor('a') as { discard: { total: number } };
    expect(view.discard.total).toBe(disc.length);
  });
});
