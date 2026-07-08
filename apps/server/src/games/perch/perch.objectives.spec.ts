import type { PlayerId } from '@boardzando/contracts';
import { GameInstance } from '../../core/engine/game-instance';
import { PerchGame } from './perch.game';
import { computeAdjacency } from './perch.adjacency';
import { emptyFountain } from './perch.fountain';
import { largestSingleFlockOwner, controlledLocationIds, cornerLocIds } from './perch.board';
import { OBJECTIVE_BY_ID } from './perch.objectives';
import { effectiveCounts } from './perch.scoring';
import type { PerchLocation, PerchState } from './perch.state';

const PLAYERS: PlayerId[] = ['a', 'b', 'c'];

function loc(
  id: string,
  col: number,
  row: number,
  nests = 0,
): PerchLocation {
  return { id, defId: id, name: id, emoji: '🪺', points: [3, 2, 1], nests, col, row };
}

function baseState(over: Partial<PerchState> = {}): PerchState {
  const homestead: PerchLocation[] = [
    loc('l0', 0, 0),
    loc('l1', 0, 1),
    loc('l2', 1, 0, 1), // tem ninho
    loc('l3', 1, 1),
  ];
  return {
    round: 5,
    maxRounds: 5,
    step: 'perch',
    turnOrder: ['a', 'b', 'c'],
    turnPtr: 0,
    placedThisTurn: false,
    bonusThisTurn: false,
    adjacency: computeAdjacency(homestead),
    creatures: {},
    flockOf: { a: 'blue', b: 'red', c: 'yellow' },
    supply: { a: 20, b: 20, c: 20 },
    bag: {},
    hands: { a: [], b: [], c: [] },
    homestead,
    birdsAt: {},
    fountain: emptyFountain(),
    plaza: [],
    birdhouses: { a: 0, b: 0, c: 0 },
    lightning: { a: 0, b: 0, c: 0 },
    birdhousesAt: {},
    objectives: {},
    scores: { a: 0, b: 0, c: 0 },
    ...over,
  };
}

describe('Perch — ninhos e maior bando', () => {
  it('ninho dá +1 ao bando com a maioria crua (contagem efetiva)', () => {
    // l2 tem 1 ninho; blue 1, red 1 -> sem maioria crua, ninho não aplica
    expect(effectiveCounts({ blue: 1, red: 1 }, undefined, 1)).toEqual({ blue: 1, red: 1 });
    // blue 2, red 1 -> blue é maioria crua -> +1 ninho => blue 3
    expect(effectiveCounts({ blue: 2, red: 1 }, undefined, 1)).toEqual({ blue: 3, red: 1 });
  });

  it('largestSingleFlockOwner: maior pilha única sem empate', () => {
    const s = baseState({ birdsAt: { l0: { blue: 3 }, l1: { red: 2 } } });
    expect(largestSingleFlockOwner(s)).toBe('blue');
    // empate no topo entre cores diferentes -> undefined
    const s2 = baseState({ birdsAt: { l0: { blue: 3 }, l1: { red: 3 } } });
    expect(largestSingleFlockOwner(s2)).toBeUndefined();
  });

  it('cornerLocIds: topo/base das colunas extremas', () => {
    const corners = new Set(cornerLocIds(baseState()));
    expect(corners.has('l0')).toBe(true); // topo da 1ª coluna
    expect(corners.has('l1')).toBe(true); // base da 1ª coluna
    expect(corners.has('l2')).toBe(true); // topo da última
    expect(corners.has('l3')).toBe(true); // base da última
  });
});

describe('Perch — objetivos ocultos', () => {
  it('setup dá 1 objetivo por jogador e o playerView só revela o próprio', () => {
    const m = GameInstance.create(new PerchGame(), PLAYERS, 3);
    const s = m.snapshot.state;
    for (const p of PLAYERS) expect(OBJECTIVE_BY_ID[s.objectives[p]!]).toBeDefined();
    const va = m.viewFor('a') as {
      myObjective?: { id: string };
      objectivesReveal?: unknown;
    };
    expect(va.myObjective?.id).toBe(s.objectives['a']);
    expect(va.objectivesReveal).toBeUndefined(); // só no fim
  });

  it('"Dono do Pedaço": controlar 3+ Locais concede o reward', () => {
    const obj = OBJECTIVE_BY_ID['landlord']!;
    const s = baseState({
      birdsAt: { l0: { blue: 2 }, l1: { blue: 2 }, l2: { blue: 2 }, l3: { red: 1 } },
    });
    expect(controlledLocationIds(s, 'blue')).toHaveLength(3);
    expect(obj.check(s, 'a', 'blue')).toBe(true);
    expect(obj.check(s, 'b', 'red')).toBe(false);
  });

  it('"Rei do Poleiro": ter o maior bando único', () => {
    const obj = OBJECTIVE_BY_ID['king']!;
    const s = baseState({ birdsAt: { l0: { blue: 4 }, l1: { red: 2 } } });
    expect(obj.check(s, 'a', 'blue')).toBe(true);
    expect(obj.check(s, 'b', 'red')).toBe(false);
  });

  it('objetivo cumprido soma o reward no fim do jogo', () => {
    // 'a' (blue) controla l0..l3 com maioria e cumpre "Dono do Pedaço" (+6)
    const s = baseState({
      round: 5,
      turnPtr: 0,
      hands: { a: ['blue'], b: [], c: [] },
      // pré-condição: blue já domina l1,l2,l3; vai colocar a última em l0
      birdsAt: { l1: { blue: 2 }, l2: { blue: 2 }, l3: { blue: 2 } },
      objectives: { a: 'landlord', b: 'king', c: 'corners' },
      scores: { a: 0, b: 0, c: 0 },
    });
    const base = GameInstance.create(new PerchGame(), PLAYERS, 1);
    const m = GameInstance.restore(new PerchGame(), {
      ...base.snapshot,
      players: [...PLAYERS],
      currentPlayer: 'a',
      state: s,
    });
    m.applyMove('a', 'placeBird', { locationId: 'l0', birdIndex: 0 }); // fecha o jogo
    expect(m.isOver).toBe(true);
    // 'a' controla 4 Locais (l0 blue1, l1..l3 blue2) -> cumpre landlord (+6)
    // pontuação de Local: cada um blue maioria -> pontos[0]=3 x4 = 12
    // + maior bando único (blue 2) ... pode empatar entre l1/l2/l3 (todos blue 2) -> mesmo bando -> +10
    // + objetivo +6  => a >= 12+10+6
    expect(m.snapshot.state.scores['a']).toBeGreaterThanOrEqual(12 + 10 + 6);
    const va = m.viewFor('a') as {
      objectivesReveal?: Record<string, { achieved: boolean }>;
    };
    expect(va.objectivesReveal?.['a']?.achieved).toBe(true);
  });
});
