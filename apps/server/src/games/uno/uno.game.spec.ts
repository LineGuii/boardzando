import type { PlayerId } from '@boardzando/contracts';
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

  it('comeca no primeiro jogador; comprar mantem a vez ate jogar/pular', () => {
    const match = newMatch();
    expect(match.snapshot.currentPlayer).toBe('alice');
    match.applyMove('alice', 'drawCard', {});
    // a regra nova: drawCard sem stack mantem o turno para o jogador decidir.
    expect(match.snapshot.currentPlayer).toBe('alice');
    expect(match.snapshot.state.hands['alice']).toHaveLength(8);
    expect(match.snapshot.state.mustDecideAfterDraw?.playerId).toBe('alice');

    match.applyMove('alice', 'passTurn', {});
    expect(match.snapshot.currentPlayer).toBe('bob');
    expect(match.snapshot.state.mustDecideAfterDraw).toBeUndefined();
  });

  it('passTurn fora do contexto de "mustDecideAfterDraw" e invalido', () => {
    const match = newMatch();
    expect(() => match.applyMove('alice', 'passTurn', {})).toThrow(InvalidMoveError);
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

  it('"draw2" abre um stack pendingDraw=2 e passa a vez para o proximo decidir', () => {
    const match = newMatch();
    const s = structuredClone(match.snapshot.state);
    const color = s.activeColor;
    const draw2 = { id: 'd2', color, kind: 'draw2' } as const;
    s.activeColor = color;
    s.hands['alice'] = [draw2, ...s.hands['alice']!.slice(0, 6)];
    const bobBefore = s.hands['bob']!.length;
    const seeded = GameInstance.restore(new UnoGame(), { ...match.snapshot, state: s });

    seeded.applyMove('alice', 'playCard', { cardId: 'd2' });
    // bob NAO compra na hora — agora ele decide (empilhar outro draw2 ou comprar 2).
    expect(seeded.snapshot.state.hands['bob']).toHaveLength(bobBefore);
    expect(seeded.snapshot.state.pendingDraw).toBe(2);
    expect(seeded.snapshot.currentPlayer).toBe('bob');
  });

  it('empilha draw2 sobre draw2; quem nao tem, compra o stack inteiro', () => {
    const match = newMatch();
    const s = structuredClone(match.snapshot.state);
    const color = s.activeColor;
    const aD2 = { id: 'a-d2', color, kind: 'draw2' } as const;
    const bD2 = { id: 'b-d2', color: 'blue', kind: 'draw2' } as const; // cor diferente: jogavel por kind
    s.hands['alice'] = [aD2, ...s.hands['alice']!.slice(0, 6)];
    s.hands['bob'] = [bD2, ...s.hands['bob']!.slice(0, 6)];
    const carolBefore = s.hands['carol']!.length;
    const seeded = GameInstance.restore(new UnoGame(), { ...match.snapshot, state: s });

    seeded.applyMove('alice', 'playCard', { cardId: 'a-d2' });
    expect(seeded.snapshot.state.pendingDraw).toBe(2);
    expect(seeded.snapshot.currentPlayer).toBe('bob');

    seeded.applyMove('bob', 'playCard', { cardId: 'b-d2' });
    expect(seeded.snapshot.state.pendingDraw).toBe(4);
    expect(seeded.snapshot.currentPlayer).toBe('carol');

    // carol nao tem draw2 -> compra 4 e perde a vez
    seeded.applyMove('carol', 'drawCard', {});
    expect(seeded.snapshot.state.hands['carol']).toHaveLength(carolBefore + 4);
    expect(seeded.snapshot.state.pendingDraw).toBe(0);
    expect(seeded.snapshot.currentPlayer).toBe('alice'); // volta para o proximo apos carol
  });

  it('com stack aberto, jogar carta nao-draw2 e invalido', () => {
    const match = newMatch();
    const s = structuredClone(match.snapshot.state);
    const color = s.activeColor;
    const aD2 = { id: 'a-d2', color, kind: 'draw2' } as const;
    const bNum = { id: 'b-num', color, kind: 'number', value: 5 } as const;
    s.hands['alice'] = [aD2, ...s.hands['alice']!.slice(0, 6)];
    s.hands['bob'] = [bNum, ...s.hands['bob']!.slice(0, 6)];
    const seeded = GameInstance.restore(new UnoGame(), { ...match.snapshot, state: s });

    seeded.applyMove('alice', 'playCard', { cardId: 'a-d2' });
    expect(() => seeded.applyMove('bob', 'playCard', { cardId: 'b-num' })).toThrow(
      InvalidMoveError,
    );
  });

  it('callUno marca o jogador como "ja cantou" e nao avanca o turno', () => {
    const match = newMatch();
    const s = structuredClone(match.snapshot.state);
    const color = s.activeColor;
    // alice fica com 1 carta apos jogar; precisa cantar UNO.
    const last1 = { id: 'L1', color, kind: 'number', value: 3 } as const;
    const last2 = { id: 'L2', color, kind: 'number', value: 3 } as const;
    s.discard = [{ id: 'top3', color, kind: 'number', value: 3 }];
    s.hands['alice'] = [last1, last2];
    const seeded = GameInstance.restore(new UnoGame(), { ...match.snapshot, state: s });

    seeded.applyMove('alice', 'playCard', { cardId: 'L1' });
    expect(seeded.snapshot.state.hands['alice']).toHaveLength(1);
    expect(seeded.snapshot.state.unoCalled['alice']).toBe(false);
    expect(seeded.snapshot.currentPlayer).toBe('bob');

    // off-turn: alice canta UNO mesmo sendo a vez do bob; turno NAO avanca.
    seeded.applyMove('alice', 'callUno', {});
    expect(seeded.snapshot.state.unoCalled['alice']).toBe(true);
    expect(seeded.snapshot.currentPlayer).toBe('bob');
  });

  it('contestUno: bob penaliza alice (+2) se ela esquecer de cantar', () => {
    const match = newMatch();
    const s = structuredClone(match.snapshot.state);
    const color = s.activeColor;
    const last1 = { id: 'L1', color, kind: 'number', value: 3 } as const;
    const last2 = { id: 'L2', color, kind: 'number', value: 3 } as const;
    s.discard = [{ id: 'top3', color, kind: 'number', value: 3 }];
    s.hands['alice'] = [last1, last2];
    const seeded = GameInstance.restore(new UnoGame(), { ...match.snapshot, state: s });

    seeded.applyMove('alice', 'playCard', { cardId: 'L1' });
    // alice nao cantou; bob contesta off-turn (vez segue dele)
    seeded.applyMove('bob', 'contestUno', { target: 'alice' });
    expect(seeded.snapshot.state.hands['alice']).toHaveLength(3); // 1 + 2 de penalidade
    expect(seeded.snapshot.state.unoCalled['alice']).toBe(true); // janela fechada
    expect(seeded.snapshot.currentPlayer).toBe('bob'); // off-turn nao avanca
  });

  it('contestUno e invalido se o alvo ja cantou UNO', () => {
    const match = newMatch();
    const s = structuredClone(match.snapshot.state);
    const color = s.activeColor;
    const last1 = { id: 'L1', color, kind: 'number', value: 3 } as const;
    const last2 = { id: 'L2', color, kind: 'number', value: 3 } as const;
    s.discard = [{ id: 'top3', color, kind: 'number', value: 3 }];
    s.hands['alice'] = [last1, last2];
    const seeded = GameInstance.restore(new UnoGame(), { ...match.snapshot, state: s });

    seeded.applyMove('alice', 'playCard', { cardId: 'L1' });
    seeded.applyMove('alice', 'callUno', {});
    expect(() => seeded.applyMove('bob', 'contestUno', { target: 'alice' })).toThrow(
      InvalidMoveError,
    );
  });

  it('zerar a mao encerra o jogo com vencedor', () => {
    const match = newMatch();
    const s = structuredClone(match.snapshot.state);
    const color = s.activeColor;
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
