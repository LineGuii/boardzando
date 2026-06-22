import type { PlayerId } from '@board-games/contracts';
import { GameInstance, InvalidMoveError } from '../../core/engine/game-instance';
import { UnoGame } from './uno.game';
import type { UnoState } from './uno.state';

const PLAYERS: PlayerId[] = ['alice', 'bob', 'carol'];

function newMatch(seed = 42): GameInstance<UnoState> {
  return GameInstance.create(new UnoGame(), PLAYERS, seed);
}

describe('UnoGame', () => {
  it('distribui 7 cartas por jogador e vira a carta inicial', () => {
    const match = newMatch();
    const s = match.snapshot.state;
    for (const p of PLAYERS) expect(s.hands[p]).toHaveLength(7);
    expect(s.discard).toHaveLength(1);
    expect(s.discard[0]!.color).not.toBe('wild'); // primeira carta nunca e curinga
  });

  it('comeca no primeiro jogador e passa a vez ao comprar', () => {
    const match = newMatch();
    expect(match.snapshot.currentPlayer).toBe('alice');
    match.applyMove('alice', 'drawCard', {});
    expect(match.snapshot.currentPlayer).toBe('bob');
    expect(match.snapshot.state.hands['alice']).toHaveLength(8); // comprou 1
  });

  it('rejeita jogada fora da vez', () => {
    const match = newMatch();
    expect(() => match.applyMove('bob', 'drawCard', {})).toThrow(/Nao e a vez/);
  });

  it('rejeita carta que o jogador nao possui', () => {
    const match = newMatch();
    expect(() => match.applyMove('alice', 'playCard', { cardId: 'inexistente' })).toThrow(
      InvalidMoveError,
    );
  });

  it('"skip" pula o proximo jogador', () => {
    const match = newMatch();
    const s = structuredClone(match.snapshot.state);
    // injeta uma mao controlada para alice com um skip jogavel
    const top = s.discard[s.discard.length - 1]!;
    const skip = { id: 'skipX', color: top.color === 'wild' ? 'red' : top.color, kind: 'skip' } as const;
    s.activeColor = skip.color as UnoState['activeColor'];
    s.hands['alice'] = [skip, ...s.hands['alice']!.slice(0, 6)];
    const seeded = GameInstance.restore(new UnoGame(), { ...match.snapshot, state: s });

    seeded.applyMove('alice', 'playCard', { cardId: 'skipX' });
    expect(seeded.snapshot.currentPlayer).toBe('carol'); // bob foi pulado
  });

  it('curinga sem cor escolhida e invalido; com cor, troca a cor ativa', () => {
    const match = newMatch();
    const s = structuredClone(match.snapshot.state);
    const wild = { id: 'wX', color: 'wild', kind: 'wild' } as const;
    s.hands['alice'] = [wild, ...s.hands['alice']!.slice(0, 6)];
    const seeded = GameInstance.restore(new UnoGame(), { ...match.snapshot, state: s });

    expect(() => seeded.applyMove('alice', 'playCard', { cardId: 'wX' })).toThrow(InvalidMoveError);

    const seeded2 = GameInstance.restore(new UnoGame(), { ...match.snapshot, state: structuredClone(s) });
    seeded2.applyMove('alice', 'playCard', { cardId: 'wX', chosenColor: 'green' });
    expect(seeded2.snapshot.state.activeColor).toBe('green');
  });

  it('"draw2" faz o proximo jogador comprar 2 e perder a vez', () => {
    const match = newMatch();
    const s = structuredClone(match.snapshot.state);
    const color = (s.activeColor === 'wild' ? 'red' : s.activeColor) as UnoState['activeColor'];
    const draw2 = { id: 'd2', color, kind: 'draw2' } as const;
    s.activeColor = color;
    s.hands['alice'] = [draw2, ...s.hands['alice']!.slice(0, 6)];
    const bobBefore = s.hands['bob']!.length;
    const seeded = GameInstance.restore(new UnoGame(), { ...match.snapshot, state: s });

    seeded.applyMove('alice', 'playCard', { cardId: 'd2' });
    expect(seeded.snapshot.state.hands['bob']).toHaveLength(bobBefore + 2);
    expect(seeded.snapshot.currentPlayer).toBe('carol'); // bob pulado
  });

  it('zerar a mao encerra o jogo com vencedor', () => {
    const match = newMatch();
    const s = structuredClone(match.snapshot.state);
    const color = (s.activeColor === 'wild' ? 'red' : s.activeColor) as UnoState['activeColor'];
    const last = { id: 'last', color, kind: 'number', value: 7 } as const;
    s.activeColor = color;
    s.discard = [{ id: 'topN', color, kind: 'number', value: 7 }];
    s.hands['alice'] = [last]; // unica carta
    const seeded = GameInstance.restore(new UnoGame(), { ...match.snapshot, state: s });

    seeded.applyMove('alice', 'playCard', { cardId: 'last' });
    expect(seeded.isOver).toBe(true);
    expect(seeded.snapshot.gameover).toEqual({ winner: 'alice' });
  });

  it('playerView esconde a mao dos oponentes', () => {
    const match = newMatch();
    const view = match.viewFor('alice') as {
      myHand: unknown[];
      opponents: Record<string, number>;
    };
    expect(view.myHand).toHaveLength(7);
    expect(view.opponents['bob']).toBe(7); // apenas a contagem, nao as cartas
    expect(view.opponents).not.toHaveProperty('alice');
  });

  it('e deterministico para a mesma seed', () => {
    const a = newMatch(123).snapshot.state;
    const b = newMatch(123).snapshot.state;
    expect(a.hands['alice']).toEqual(b.hands['alice']);
  });
});
