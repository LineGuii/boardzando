import type { PlayerId } from '@boardzando/contracts';
import { GameInstance, InvalidMoveError } from '../../core/engine/game-instance';
import { ItoGame } from './ito.game';
import { ITO_THEMES } from './ito.themes';
import type { ItoCard, ItoState } from './ito.state';

const PLAYERS: PlayerId[] = ['a', 'b', 'c'];

function card(value: number, owner: PlayerId, extra: Partial<ItoCard> = {}): ItoCard {
  return { id: `ito-${value}`, value, ownerId: owner, played: false, ...extra };
}
function cardsOf(list: ItoCard[]): Record<string, ItoCard> {
  const m: Record<string, ItoCard> = {};
  for (const c of list) m[c.id] = c;
  return m;
}
function baseState(over: Partial<ItoState>): ItoState {
  return {
    // uniqueThemes desligado: os testes seeded usam o sorteio livre antigo.
    options: {
      lives: 3,
      maxLevel: 3,
      startLevel: 1,
      uniqueThemes: false,
      anonymousCards: false,
    },
    level: 1,
    maxLevel: 3,
    lives: 3,
    theme: { topic: 't', low: 'l', high: 'h' },
    step: 'play',
    cards: {},
    votes: {},
    playedPile: [],
    lastPlayedValue: 0,
    ...over,
  };
}
/** Instancia uma partida com um estado controlado. */
function seed(state: ItoState): GameInstance<ItoState> {
  const base = GameInstance.create(new ItoGame(), PLAYERS, 1);
  return GameInstance.restore(new ItoGame(), { ...base.snapshot, state });
}

describe('ItoGame (cooperativo)', () => {
  it('setup distribui `level` cartas (1..100) por jogador e comeca em "clue"', () => {
    const s = GameInstance.create(new ItoGame(), PLAYERS, 42).snapshot.state;
    expect(s.step).toBe('clue');
    expect(s.lives).toBe(3);
    expect(s.theme.topic).toBeTruthy();
    const all = Object.values(s.cards);
    expect(all).toHaveLength(PLAYERS.length * s.level); // nivel 1 -> 1 carta cada
    for (const p of PLAYERS) {
      expect(all.filter((c) => c.ownerId === p)).toHaveLength(s.level);
    }
    // valores unicos em 1..100
    const values = all.map((c) => c.value);
    expect(new Set(values).size).toBe(values.length);
    expect(values.every((v) => v >= 1 && v <= 100)).toBe(true);
  });

  it('setClue: dono define dica; estranho e rejeitado', () => {
    const m = seed(baseState({ step: 'clue', cards: cardsOf([card(50, 'a'), card(30, 'b')]) }));
    expect(() => m.applyMove('b', 'setClue', { cardId: 'ito-50', text: 'forte' })).toThrow(
      InvalidMoveError,
    );
    m.applyMove('a', 'setClue', { cardId: 'ito-50', text: 'leão' });
    expect(m.snapshot.state.cards['ito-50']!.clue).toBe('leão');
  });

  it('startPlay leva de clue para play (e nao repete)', () => {
    const m = seed(baseState({ step: 'clue', cards: cardsOf([card(10, 'a'), card(90, 'b')]) }));
    m.applyMove('a', 'startPlay', {});
    expect(m.snapshot.state.step).toBe('play');
    expect(() => m.applyMove('a', 'startPlay', {})).toThrow(InvalidMoveError);
  });

  it('ordem crescente nao perde vida', () => {
    const m = seed(baseState({ cards: cardsOf([card(10, 'a'), card(50, 'a'), card(30, 'b')]) }));
    m.applyMove('a', 'playLowest', { cardId: 'ito-10' });
    m.applyMove('b', 'playLowest', { cardId: 'ito-30' });
    expect(m.snapshot.state.lives).toBe(3);
    expect(m.snapshot.state.lastMistake).toBeUndefined();
    expect(m.snapshot.state.playedPile).toEqual(['ito-10', 'ito-30']);
    expect(m.isOver).toBe(false); // a ainda tem o 50
  });

  it('jogar carta maior deixando menor para tras: perde vida e descarta a menor', () => {
    const m = seed(baseState({ cards: cardsOf([card(50, 'a'), card(30, 'b'), card(70, 'b')]) }));
    m.applyMove('a', 'playLowest', { cardId: 'ito-50' });
    const s = m.snapshot.state;
    expect(s.lives).toBe(2); // perdeu 1
    expect(s.cards['ito-30']!.discarded).toBe(true);
    expect(s.lastMistake).toEqual({ count: 1, byValue: 50 });
    expect(m.isOver).toBe(false); // b ainda tem o 70
  });

  it('zerar vidas encerra com derrota da equipe', () => {
    const m = seed(baseState({ lives: 1, cards: cardsOf([card(50, 'a'), card(30, 'b')]) }));
    m.applyMove('a', 'playLowest', { cardId: 'ito-50' });
    expect(m.isOver).toBe(true);
    expect(m.snapshot.gameover?.coop).toEqual({
      outcome: 'lose',
      detail: expect.stringContaining('sem vidas'),
    });
  });

  it('concluir o ultimo nivel encerra com vitoria da equipe', () => {
    const m = seed(
      baseState({ maxLevel: 1, cards: cardsOf([card(10, 'a'), card(30, 'b')]) }),
    );
    m.applyMove('a', 'playLowest', { cardId: 'ito-10' });
    m.applyMove('b', 'playLowest', { cardId: 'ito-30' });
    expect(m.isOver).toBe(true);
    expect(m.snapshot.gameover?.coop?.outcome).toBe('win');
  });

  it('concluir um nivel intermediario avanca para o proximo (mais cartas)', () => {
    const m = seed(
      baseState({ level: 1, maxLevel: 2, cards: cardsOf([card(10, 'a'), card(30, 'b')]) }),
    );
    m.applyMove('a', 'playLowest', { cardId: 'ito-10' });
    m.applyMove('b', 'playLowest', { cardId: 'ito-30' });
    const s = m.snapshot.state;
    expect(m.isOver).toBe(false);
    expect(s.level).toBe(2);
    expect(s.step).toBe('clue');
    // nivel 2 -> 2 cartas por jogador (3 jogadores na partida base)
    expect(Object.values(s.cards)).toHaveLength(PLAYERS.length * 2);
  });

  it('voteCard: vota numa carta (inclusive alheia), faz toggle e zera ao jogar', () => {
    const m = seed(baseState({ cards: cardsOf([card(10, 'a'), card(50, 'a'), card(30, 'b')]) }));
    // b vota na carta de a (sugestao) -> visivel a todos
    m.applyMove('b', 'voteCard', { cardId: 'ito-10' });
    expect(m.snapshot.state.votes['b']).toBe('ito-10');
    // votar de novo na mesma carta remove (toggle)
    m.applyMove('b', 'voteCard', { cardId: 'ito-10' });
    expect(m.snapshot.state.votes['b']).toBeUndefined();
    // votos sao zerados quando uma carta e jogada
    m.applyMove('b', 'voteCard', { cardId: 'ito-50' });
    m.applyMove('a', 'playLowest', { cardId: 'ito-10' });
    expect(m.snapshot.state.votes).toEqual({});
    // votar fora da fase de play e invalido
    const clueM = seed(baseState({ step: 'clue', cards: cardsOf([card(10, 'a'), card(30, 'b')]) }));
    expect(() => clueM.applyMove('b', 'voteCard', { cardId: 'ito-10' })).toThrow(InvalidMoveError);
  });

  it('playerView esconde o numero alheio e revela as dicas', () => {
    // 'a' tem o menor (30) + um 50; 'b' tem 70 -> jogar o 30 nao encerra o nivel.
    const m = seed(
      baseState({ step: 'clue', cards: cardsOf([card(30, 'a'), card(50, 'a'), card(70, 'b')]) }),
    );
    m.applyMove('a', 'setClue', { cardId: 'ito-30', text: 'leão' });

    const viewB = m.viewFor('b') as {
      cards: Record<string, { value?: number; clue?: string }>;
    };
    expect(viewB.cards['ito-30']!.value).toBeUndefined(); // numero escondido
    expect(viewB.cards['ito-30']!.clue).toBe('leão'); // dica publica

    const viewA = m.viewFor('a') as { cards: Record<string, { value?: number }> };
    expect(viewA.cards['ito-30']!.value).toBe(30); // ve a propria

    // depois de jogar (em ordem, sem erro), o numero fica publico
    m.applyMove('a', 'startPlay', {});
    m.applyMove('a', 'playLowest', { cardId: 'ito-30' });
    expect(m.isOver).toBe(false);
    const viewB2 = m.viewFor('b') as { cards: Record<string, { value?: number }> };
    expect(viewB2.cards['ito-30']!.value).toBe(30);
  });

  it('uniqueThemes (default ligado): pre-sorteia um tema por nivel, sem repeticao', () => {
    // sem setupData: default uniqueThemes = true
    const s = GameInstance.create(new ItoGame(), PLAYERS, 42).snapshot.state;
    expect(s.options.uniqueThemes).toBe(true);
    expect(s.themeOrder).toHaveLength(3); // maxLevel 3, startLevel 1
    expect(new Set(s.themeOrder).size).toBe(3); // indices unicos
    expect(s.theme).toEqual(ITO_THEMES[s.themeOrder![0]!]);

    // desligado explicitamente: sem themeOrder (sorteio livre antigo)
    const s2 = GameInstance.create(new ItoGame(), PLAYERS, 42, {
      uniqueThemes: false,
    }).snapshot.state;
    expect(s2.options.uniqueThemes).toBe(false);
    expect(s2.themeOrder).toBeUndefined();
  });

  describe('modo anonimo (anonymousCards)', () => {
    const ANON_OPTIONS = {
      lives: 3,
      maxLevel: 3,
      startLevel: 1,
      uniqueThemes: false,
      anonymousCards: true,
    };

    it('default desligado; ligado via setupData', () => {
      const s = GameInstance.create(new ItoGame(), PLAYERS, 42).snapshot.state;
      expect(s.options.anonymousCards).toBe(false);
      const s2 = GameInstance.create(new ItoGame(), PLAYERS, 42, { anonymousCards: true })
        .snapshot.state;
      expect(s2.options.anonymousCards).toBe(true);
    });

    it('startPlay exige todas as dicas e sorteia a ordem da mesa', () => {
      const m = seed(
        baseState({
          options: ANON_OPTIONS,
          step: 'clue',
          cards: cardsOf([card(10, 'a'), card(30, 'b')]),
        }),
      );
      // falta dica -> invalido
      expect(() => m.applyMove('a', 'startPlay', {})).toThrow(InvalidMoveError);
      m.applyMove('a', 'setClue', { cardId: 'ito-10', text: 'gelo' });
      m.applyMove('b', 'setClue', { cardId: 'ito-30', text: 'morno' });
      m.applyMove('a', 'startPlay', {});
      const s = m.snapshot.state;
      expect(s.step).toBe('play');
      // permutacao exata dos ids em jogo
      expect([...(s.tableOrder ?? [])].sort()).toEqual(['ito-10', 'ito-30']);
    });

    it('fase de dicas: viewer nao recebe cartas alheias, so o progresso', () => {
      const m = seed(
        baseState({
          options: ANON_OPTIONS,
          step: 'clue',
          cards: cardsOf([card(10, 'a', { clue: 'gelo' }), card(30, 'b')]),
        }),
      );
      const viewA = m.viewFor('a') as {
        cards: Record<string, unknown>;
        clueProgress: Record<string, { done: number; total: number }>;
      };
      expect(Object.keys(viewA.cards)).toEqual(['ito-10']); // so as proprias
      expect(viewA.clueProgress['a']).toEqual({ done: 1, total: 1 });
      expect(viewA.clueProgress['b']).toEqual({ done: 0, total: 1 });
    });

    it('fase de jogo: dono oculto (mesmo apos jogar) e votos anonimos', () => {
      const m = seed(
        baseState({
          options: ANON_OPTIONS,
          cards: cardsOf([
            card(10, 'a', { clue: 'gelo' }),
            card(30, 'b', { clue: 'morno' }),
            card(70, 'b', { clue: 'quente' }),
          ]),
          tableOrder: ['ito-30', 'ito-10', 'ito-70'],
        }),
      );
      m.applyMove('a', 'voteCard', { cardId: 'ito-10' });
      m.applyMove('b', 'voteCard', { cardId: 'ito-10' });

      const viewB = m.viewFor('b') as {
        cards: Record<string, { ownerId?: string; clue?: string }>;
        votes: Record<string, string>;
        voteCounts: Record<string, number>;
        tableOrder: string[];
      };
      expect(viewB.cards['ito-10']!.ownerId).toBeUndefined(); // dono da carta de a oculto
      expect(viewB.cards['ito-10']!.clue).toBe('gelo'); // dica publica, sem autor
      expect(viewB.cards['ito-30']!.ownerId).toBe('b'); // a propria mantem o dono
      expect(viewB.votes).toEqual({ b: 'ito-10' }); // so o proprio voto
      expect(viewB.voteCounts['ito-10']).toBe(2); // contagem anonima
      expect(viewB.tableOrder).toEqual(['ito-30', 'ito-10', 'ito-70']);

      // jogada nao revela o dono (anonimato permanente), mas revela o valor
      m.applyMove('a', 'playLowest', { cardId: 'ito-10' });
      const viewB2 = m.viewFor('b') as {
        cards: Record<string, { ownerId?: string; value?: number }>;
      };
      expect(viewB2.cards['ito-10']!.ownerId).toBeUndefined();
      expect(viewB2.cards['ito-10']!.value).toBe(10);
    });
  });

  it('uniqueThemes: ao concluir um nivel, o tema segue a sequencia pre-sorteada', () => {
    const m = seed(
      baseState({
        options: {
          lives: 3,
          maxLevel: 2,
          startLevel: 1,
          uniqueThemes: true,
          anonymousCards: false,
        },
        level: 1,
        maxLevel: 2,
        themeOrder: [5, 9], // controlado: nivel 1 -> tema 5, nivel 2 -> tema 9
        theme: ITO_THEMES[5]!,
        cards: cardsOf([card(10, 'a'), card(30, 'b')]),
      }),
    );
    m.applyMove('a', 'playLowest', { cardId: 'ito-10' });
    m.applyMove('b', 'playLowest', { cardId: 'ito-30' });
    const s = m.snapshot.state;
    expect(s.level).toBe(2);
    expect(s.theme).toEqual(ITO_THEMES[9]); // seguiu a ordem, sem repetir
  });
});
