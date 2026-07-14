import type { PlayerId } from '@boardzando/contracts';
import { GameInstance, InvalidMoveError, NotYourTurnError } from '../../core/engine/game-instance';
import { StopConnectGame } from './stopconnect.game';
import { canPlace, connectedOpposite, placeableCells, scorePlacement } from './stopconnect.board';
import type { BoardTile, StopConnectPending, StopConnectState } from './stopconnect.state';

const P: PlayerId[] = ['a', 'b', 'c'];

function makeState(over: Partial<StopConnectState> = {}): StopConnectState {
  return {
    options: { targetScore: 50 },
    order: [...P],
    tiles: {},
    cells: {},
    nextTileId: 100,
    letterBag: [],
    themeBag: [],
    hands: {
      a: { letter: { letter: 'C', value: 2 }, theme: 'Fruta' },
      b: { letter: { letter: 'B', value: 3 }, theme: 'País' },
      c: { letter: { letter: 'A', value: 1 }, theme: 'Animal' },
    },
    scores: { a: 0, b: 0, c: 0 },
    step: 'place',
    ...over,
  };
}

function withTiles(state: StopConnectState, tiles: BoardTile[]): StopConnectState {
  for (const t of tiles) {
    state.tiles[t.id] = t;
    state.cells[`${t.col},${t.row}`] = t.id;
  }
  return state;
}

function letterTile(id: string, col: number, row: number, letter: string, value: number): BoardTile {
  return { id, kind: 'letter', col, row, letter, value };
}
function themeTile(id: string, col: number, row: number, theme: string): BoardTile {
  return { id, kind: 'theme', col, row, theme };
}

function seed(state: StopConnectState, current: PlayerId): GameInstance<StopConnectState> {
  const base = GameInstance.create(new StopConnectGame(), P, 1);
  return GameInstance.restore(new StopConnectGame(), {
    ...base.snapshot,
    players: [...P],
    currentPlayer: current,
    state,
  });
}

describe('StopConnect — regras espaciais (grade ortogonal)', () => {
  it('canPlace: exige vizinho oposto e proíbe tocar o mesmo tipo', () => {
    const s = withTiles(makeState(), [letterTile('L1', 0, 0, 'C', 2)]);
    // ao lado da Letra: Tema pode; Letra não (tocaria Letra)
    expect(canPlace(s, 'theme', 1, 0)).toBe(true);
    expect(canPlace(s, 'letter', 1, 0)).toBe(false);
    // célula ocupada e célula solta são inválidas
    expect(canPlace(s, 'theme', 0, 0)).toBe(false);
    expect(canPlace(s, 'theme', 5, 5)).toBe(false);
  });

  it('connectedOpposite lista as peças vizinhas do tipo oposto', () => {
    const s = withTiles(makeState(), [
      letterTile('L1', 0, 0, 'C', 2),
      letterTile('L2', 0, 2, 'B', 3),
    ]);
    const conn = connectedOpposite(s, 0, 1, 'theme');
    expect(conn.map((t) => t.id).sort()).toEqual(['L1', 'L2']);
  });

  it('placeableCells só marca células vazias válidas', () => {
    const s = withTiles(makeState(), [letterTile('L1', 0, 0, 'C', 2)]);
    const cells = placeableCells(s, 'theme').map((c) => `${c.col},${c.row}`).sort();
    expect(cells).toEqual(['-1,0', '0,-1', '0,1', '1,0']);
    // não há onde encaixar uma Letra (só há uma Letra na mesa)
    expect(placeableCells(s, 'letter')).toHaveLength(0);
  });

  it('pontuação: Tema = soma das Letras; Letra = valor × nº de Temas', () => {
    const letters = [letterTile('L1', 0, 0, 'C', 2), letterTile('L2', 0, 2, 'B', 3)];
    const themes = [themeTile('T1', 0, 0, 'Fruta'), themeTile('T2', 0, 2, 'País')];
    expect(scorePlacement('theme', 0, letters)).toBe(5); // 2 + 3
    expect(scorePlacement('letter', 2, themes)).toBe(4); // valor 2 × 2 temas
  });
});

describe('StopConnect — fluxo colocar → responder → julgar → encerrar', () => {
  function setupThemePlacement(current: PlayerId = 'a') {
    const s = withTiles(makeState(), [
      letterTile('L1', 0, 0, 'C', 2),
      letterTile('L2', 0, 2, 'B', 3),
    ]);
    return seed(s, current);
  }

  it('coloca Tema, responde e é aprovado por unanimidade → pontua a soma', () => {
    const m = setupThemePlacement('a');
    m.applyMove('a', 'place', { tileType: 'theme', col: 0, row: 1 });
    expect(m.snapshot.state.step).toBe('answer');
    expect(m.snapshot.state.pending!.connectedTileIds).toHaveLength(2);
    expect(m.snapshot.currentPlayer).toBe('a'); // mantém a vez

    m.applyMove('a', 'submitAnswers', { answers: ['Abacaxi', 'Banana'] });
    expect(m.snapshot.state.step).toBe('judging');

    m.applyMove('b', 'judge', { verdict: 'approve' });
    expect(m.snapshot.state.step).toBe('judging'); // falta um juiz
    m.applyMove('c', 'judge', { verdict: 'approve' });
    expect(m.snapshot.state.step).toBe('reveal');
    expect(m.snapshot.state.pending!.approved).toBe(true);
    expect(m.snapshot.state.pending!.points).toBe(5);
    expect(m.snapshot.state.scores['a']).toBe(5);

    m.applyMove('a', 'endTurn', {});
    expect(m.snapshot.state.step).toBe('place');
    expect(m.snapshot.currentPlayer).toBe('b'); // vez passa (horário)
    // reabastece só o Tema jogado; a Letra na mão continua a mesma
    expect(m.snapshot.state.hands['a']!.letter.letter).toBe('C');
    expect(typeof m.snapshot.state.hands['a']!.theme).toBe('string');
  });

  it('rejeição por maioria → 0 pontos, mas a peça fica na mesa', () => {
    const m = setupThemePlacement('a');
    m.applyMove('a', 'place', { tileType: 'theme', col: 0, row: 1 });
    m.applyMove('a', 'submitAnswers', { answers: ['xxx', 'yyy'] });
    m.applyMove('b', 'judge', { verdict: 'reject' });
    m.applyMove('c', 'judge', { verdict: 'reject' });
    expect(m.snapshot.state.pending!.approved).toBe(false);
    expect(m.snapshot.state.scores['a']).toBe(0);
    // a peça permanece
    expect(Object.values(m.snapshot.state.tiles).some((t) => t.kind === 'theme' && t.col === 0 && t.row === 1)).toBe(true);
  });

  it('empate no julgamento favorece quem jogou (aprova)', () => {
    const m = setupThemePlacement('a');
    m.applyMove('a', 'place', { tileType: 'theme', col: 0, row: 1 });
    m.applyMove('a', 'submitAnswers', { answers: ['Uva', 'Peru'] });
    m.applyMove('b', 'judge', { verdict: 'approve' });
    m.applyMove('c', 'judge', { verdict: 'reject' });
    expect(m.snapshot.state.step).toBe('reveal');
    expect(m.snapshot.state.pending!.approved).toBe(true);
    expect(m.snapshot.state.scores['a']).toBe(5);
  });

  it('coloca Letra conectando 2 Temas → pontua valor × 2', () => {
    const s = withTiles(makeState(), [
      themeTile('T1', 0, 0, 'Fruta'),
      themeTile('T2', 0, 2, 'País'),
    ]);
    const m = seed(s, 'a'); // a tem Letra C (valor 2)
    m.applyMove('a', 'place', { tileType: 'letter', col: 0, row: 1 });
    expect(m.snapshot.state.pending!.connectedTileIds).toHaveLength(2);
    m.applyMove('a', 'submitAnswers', { answers: ['Caqui', 'Chile'] });
    m.applyMove('b', 'judge', { verdict: 'approve' });
    m.applyMove('c', 'judge', { verdict: 'approve' });
    expect(m.snapshot.state.scores['a']).toBe(4); // 2 × 2
  });
});

describe('StopConnect — validações de move', () => {
  it('fora da vez é rejeitado; quem jogou não pode se autojulgar', () => {
    const s = withTiles(makeState(), [letterTile('L1', 0, 0, 'C', 2)]);
    const m = seed(s, 'a');
    expect(() => m.applyMove('b', 'place', { tileType: 'theme', col: 0, row: 1 })).toThrow(
      NotYourTurnError,
    );
    m.applyMove('a', 'place', { tileType: 'theme', col: 0, row: 1 });
    m.applyMove('a', 'submitAnswers', { answers: ['Abacaxi'] });
    // o próprio jogador não julga a própria jogada
    expect(() => m.applyMove('a', 'judge', { verdict: 'approve' })).toThrow(InvalidMoveError);
  });

  it('número de respostas deve bater com as peças conectadas', () => {
    const s = withTiles(makeState(), [
      letterTile('L1', 0, 0, 'C', 2),
      letterTile('L2', 0, 2, 'B', 3),
    ]);
    const m = seed(s, 'a');
    m.applyMove('a', 'place', { tileType: 'theme', col: 0, row: 1 }); // conecta 2
    expect(() => m.applyMove('a', 'submitAnswers', { answers: ['só uma'] })).toThrow(
      InvalidMoveError,
    );
  });
});

describe('StopConnect — último turno e fim de jogo', () => {
  it('atingir o alvo dispara o último turno; a contagem encerra o jogo', () => {
    // 'a' está prestes a cruzar 50 nesta jogada
    const s = withTiles(
      makeState({ scores: { a: 48, b: 10, c: 20 } }),
      [letterTile('L1', 0, 0, 'C', 2), letterTile('L2', 0, 2, 'B', 3)],
    );
    const m = seed(s, 'a');
    m.applyMove('a', 'place', { tileType: 'theme', col: 0, row: 1 });
    m.applyMove('a', 'submitAnswers', { answers: ['Abacaxi', 'Banana'] });
    m.applyMove('b', 'judge', { verdict: 'approve' });
    m.applyMove('c', 'judge', { verdict: 'approve' });
    expect(m.snapshot.state.scores['a']).toBe(53);
    m.applyMove('a', 'endTurn', {});
    expect(m.snapshot.state.lastTurnBy).toBe('a');
    expect(m.snapshot.state.finalTurnsRemaining).toBe(2); // demais jogam 1× cada
    expect(m.isOver).toBe(false);
  });

  it('o último endTurn da contagem encerra e define o vencedor', () => {
    const pending: StopConnectPending = {
      placedTileId: 'X',
      placedKind: 'letter',
      col: 9,
      row: 9,
      connectedTileIds: [],
      answers: [],
      votes: {},
      approved: true,
      points: 0,
    };
    const s = makeState({
      step: 'reveal',
      pending,
      scores: { a: 53, b: 10, c: 20 },
      lastTurnBy: 'a',
      finalTurnsRemaining: 1,
    });
    const m = seed(s, 'c');
    m.applyMove('c', 'endTurn', {});
    expect(m.isOver).toBe(true);
    expect(m.snapshot.gameover?.winner).toBe('a');
  });
});

describe('StopConnect — playerView', () => {
  it('esconde as pilhas e as mãos alheias; sugere células ao jogador da vez', () => {
    const m = GameInstance.create(new StopConnectGame(), P, 7);
    const view = m.viewFor(m.snapshot.currentPlayer) as Record<string, unknown>;
    expect(view.letterBag).toBeUndefined();
    expect(view.themeBag).toBeUndefined();
    expect(view.hands).toBeUndefined();
    expect(view.myHand).toBeDefined();
    expect(typeof view.letterCount).toBe('number');
    expect(view.tiles).toBeDefined(); // 6 peças semeadas
    expect(Object.keys(view.tiles as object)).toHaveLength(6);
    expect(view.placeable).toBeDefined(); // é o jogador da vez
    // um jogador que NÃO é o da vez não recebe sugestões
    const other = P.find((p) => p !== m.snapshot.currentPlayer)!;
    const otherView = m.viewFor(other) as Record<string, unknown>;
    expect(otherView.placeable).toBeUndefined();
  });
});
