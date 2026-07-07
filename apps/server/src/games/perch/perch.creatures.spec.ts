import type { PlayerId } from '@boardzando/contracts';
import { GameInstance, InvalidMoveError } from '../../core/engine/game-instance';
import { PerchGame } from './perch.game';
import { computeAdjacency, reachable } from './perch.adjacency';
import {
  applyCreatureEffect,
  assignCreatureControl,
  homeLocationId,
} from './perch.creatures';
import type { CreatureRuntime, PerchLocation, PerchState } from './perch.state';

function seed(state: PerchState): GameInstance<PerchState> {
  const base = GameInstance.create(new PerchGame(), ['a', 'b', 'c'], 1);
  return GameInstance.restore(new PerchGame(), {
    ...base.snapshot,
    players: ['a', 'b', 'c'],
    currentPlayer: state.turnOrder[state.turnPtr]!,
    state,
  });
}

/** Homestead 3x? simples: 2 colunas de 2 tiles para testar adjacência. */
function loc(id: string, defId: string, col: number, row: number, points = [3, 2, 1] as [number, number, number]): PerchLocation {
  return { id, defId, name: id, emoji: '🪺', points, col, row };
}

function baseState(over: Partial<PerchState> = {}): PerchState {
  const homestead: PerchLocation[] = [
    loc('l0', 'doghouse', 0, 0), // casa do Cão
    loc('l1', 'pines', 0, 1),
    loc('l2', 'hawksnest', 1, 0), // casa do Falcão
    loc('l3', 'ash', 1, 1),
  ];
  const flockOf: Record<PlayerId, string> = { a: 'blue', b: 'red', c: 'yellow' };
  const supply: Record<PlayerId, number> = { a: 20, b: 20, c: 20 };
  const scores: Record<PlayerId, number> = { a: 0, b: 0, c: 0 };
  const creatures: Record<string, CreatureRuntime> = {
    dog: { defId: 'dog', activatedThisRound: false },
    hawk: { defId: 'hawk', activatedThisRound: false },
  };
  return {
    round: 2,
    maxRounds: 5,
    step: 'perch',
    turnOrder: ['a', 'b', 'c'],
    turnPtr: 0,
    placedThisTurn: false,
    bonusThisTurn: false,
    adjacency: computeAdjacency(homestead),
    creatures,
    flockOf,
    supply,
    bag: {},
    hands: { a: [], b: [], c: [] },
    homestead,
    birdsAt: {},
    fountain: [[], [], [], [], [], []],
    plaza: [],
    birdhouses: { a: 0, b: 0, c: 0 },
    lightning: { a: 0, b: 0, c: 0 },
    birdhousesAt: {},
    objectives: {},
    scores,
    ...over,
  };
}

describe('Perch — adjacência por colunas', () => {
  it('mesma coluna consecutiva e colunas vizinhas com sobreposição são adjacentes; sem wrap', () => {
    const homestead: PerchLocation[] = [
      loc('a0', 'x', 0, 0),
      loc('a1', 'x', 0, 1),
      loc('a2', 'x', 0, 2),
      loc('b0', 'x', 1, 0),
      loc('b1', 'x', 1, 1),
      loc('c0', 'x', 2, 0),
      loc('c1', 'x', 2, 1),
      loc('c2', 'x', 2, 2),
    ];
    const adj = computeAdjacency(homestead);
    // mesma coluna
    expect(adj['a0']).toContain('a1');
    expect(adj['a1']).toContain('a2');
    // colunas vizinhas 0<->1 (sobreposição de intervalos)
    expect(adj['a0']).toContain('b0');
    // sem "dar a volta": coluna 0 e coluna 2 nunca se ligam
    expect(adj['a0']).not.toContain('c0');
    expect(adj['a2']).not.toContain('c2');
  });

  it('reachable respeita o alcance de passos', () => {
    const adj = { l0: ['l1'], l1: ['l0', 'l2'], l2: ['l1'] } as Record<string, string[]>;
    expect([...reachable(adj, 'l0', 1)].sort()).toEqual(['l1']);
    expect([...reachable(adj, 'l0', 2)].sort()).toEqual(['l1', 'l2']);
    expect([...reachable(adj, 'l0', Infinity)].sort()).toEqual(['l1', 'l2']);
  });
});

describe('Perch — controle de criatura (Upkeep)', () => {
  it('quem tem maioria isolada no Local-casa controla e o standee vai para a casa', () => {
    const s = baseState({ birdsAt: { l0: { blue: 2, red: 1 }, l2: {} } });
    assignCreatureControl(s);
    expect(s.creatures['dog']!.controller).toBe('a'); // blue = jogador a
    expect(s.creatures['dog']!.standeeLocId).toBe(homeLocationId(s, 'dog'));
    // falcão sem aves na casa -> sem controlador
    expect(s.creatures['hawk']!.controller).toBeUndefined();
  });

  it('empate no Local-casa não dá controle', () => {
    const s = baseState({ birdsAt: { l0: { blue: 1, red: 1 } } });
    assignCreatureControl(s);
    expect(s.creatures['dog']!.controller).toBeUndefined();
  });
});

describe('Perch — efeitos das criaturas', () => {
  it('Falcão (removeBirds 1): remove 1 ave do destino e a envia à Fonte', () => {
    const s = baseState({
      birdsAt: { l3: { red: 2 } },
      creatures: { hawk: { defId: 'hawk', activatedThisRound: false, standeeLocId: 'l2' } },
    });
    const ok = applyCreatureEffect(s, s.adjacency, {
      creatureId: 'hawk',
      toLocationId: 'l3', // falcão vai a qualquer lugar
      targetFlock: 'red',
    });
    expect(ok).toBe(true);
    expect(s.birdsAt['l3']!['red']).toBe(1);
    expect(s.fountain[0]).toContain('red'); // ave removida caiu na Fonte (nível base)
    expect(s.creatures['hawk']!.standeeLocId).toBe('l3');
    expect(s.creatures['hawk']!.activatedThisRound).toBe(true);
  });

  it('pilha protegida por Casinha é imune à criatura', () => {
    const s = baseState({
      birdsAt: { l3: { red: 2 } },
      birdhousesAt: { l3: { red: true } },
      creatures: { hawk: { defId: 'hawk', activatedThisRound: false, standeeLocId: 'l2' } },
    });
    const ok = applyCreatureEffect(s, s.adjacency, {
      creatureId: 'hawk',
      toLocationId: 'l3',
      targetFlock: 'red',
    });
    expect(ok).toBe(false);
    expect(s.birdsAt['l3']!['red']).toBe(2); // intacta
  });

  it('Cão (moveBird): afasta 1 ave do destino para um Local ADJACENTE', () => {
    const s = baseState({
      birdsAt: { l0: { red: 1 } },
      creatures: { dog: { defId: 'dog', activatedThisRound: false, standeeLocId: 'l1' } },
    });
    // l1 -> l0 é adjacente (mesma coluna); de l0 mover para l2 (vizinho de l0)
    expect(s.adjacency['l0']).toContain('l2');
    const ok = applyCreatureEffect(s, s.adjacency, {
      creatureId: 'dog',
      toLocationId: 'l0',
      targetFlock: 'red',
      secondLocationId: 'l2',
    });
    expect(ok).toBe(true);
    expect(s.birdsAt['l0']!['red'] ?? 0).toBe(0);
    expect(s.birdsAt['l2']!['red']).toBe(1);
  });

  it('movimento inválido (fora do alcance) é rejeitado', () => {
    const s = baseState({
      birdsAt: { l1: { red: 1 } },
      // Cão só move 1 (adjacente); de l0, l3 não é alcançável em 1 passo aqui
      creatures: { dog: { defId: 'dog', activatedThisRound: false, standeeLocId: 'l0' } },
    });
    const reach = reachable(s.adjacency, 'l0', 1);
    const far = s.homestead.find((l) => !reach.has(l.id) && l.id !== 'l0')!;
    const ok = applyCreatureEffect(s, s.adjacency, {
      creatureId: 'dog',
      toLocationId: far.id,
      targetFlock: 'red',
      secondLocationId: 'l1',
    });
    expect(ok).toBe(false);
  });

  it('remover sem aves-alvo no destino é inválido', () => {
    const s = baseState({
      birdsAt: { l3: {} },
      creatures: { hawk: { defId: 'hawk', activatedThisRound: false, standeeLocId: 'l2' } },
    });
    const ok = applyCreatureEffect(s, s.adjacency, {
      creatureId: 'hawk',
      toLocationId: 'l3',
      targetFlock: 'red',
    });
    expect(ok).toBe(false);
  });
});

describe('Perch — fluxo de turno com Ação Bônus (via engine)', () => {
  it('ativar a criatura ANTES de colocar mantém a vez; colocar depois encerra', () => {
    const s = baseState({
      turnOrder: ['a', 'b', 'c'],
      turnPtr: 0,
      hands: { a: ['blue'], b: ['red'], c: ['yellow'] }, // todos com aves (rodada não acaba)
      birdsAt: { l3: { red: 2 } },
      creatures: {
        hawk: { defId: 'hawk', activatedThisRound: false, standeeLocId: 'l2', controller: 'a' },
      },
    });
    const m = seed(s);
    expect(m.snapshot.currentPlayer).toBe('a');

    // Ação Bônus (Falcão) antes de colocar → mantém a vez de 'a'
    m.applyMove('a', 'activateCreature', { creatureId: 'hawk', toLocationId: 'l3', targetFlock: 'red' });
    expect(m.snapshot.currentPlayer).toBe('a');
    expect(m.snapshot.state.bonusThisTurn).toBe(true);
    expect(m.snapshot.state.birdsAt['l3']!['red']).toBe(1);
    // não pode ativar de novo na mesma vez
    expect(() =>
      m.applyMove('a', 'activateCreature', { creatureId: 'hawk', toLocationId: 'l3', targetFlock: 'red' }),
    ).toThrow(InvalidMoveError);

    // agora coloca a ave → encerra a vez, passa para 'b'
    m.applyMove('a', 'placeBird', { locationId: 'l1', birdIndex: 0 });
    expect(m.snapshot.currentPlayer).toBe('b');
    expect(m.snapshot.state.placedThisTurn).toBe(false);
  });

  it('+3 pontos por criatura controlada no fim do jogo', () => {
    // Última rodada/última ave. 'a' (blue) tem maioria na casa do Falcão (l2),
    // então no Upkeep final assume o controle e ganha +3 no fim.
    const s = baseState({
      round: 5,
      turnOrder: ['a', 'b', 'c'],
      turnPtr: 0,
      hands: { a: ['blue'], b: [], c: [] },
      birdsAt: { l2: { blue: 1 } }, // l2 = casa do Falcão (hawksnest), pontos [3,2,1]
      scores: { a: 5, b: 4, c: 3 },
      creatures: { hawk: { defId: 'hawk', activatedThisRound: true, standeeLocId: 'l2', controller: 'a' } },
    });
    const m = seed(s);
    // coloca a última ave na própria casa (l2) → só l2 pontua (blue 2 = maioria)
    m.applyMove('a', 'placeBird', { locationId: 'l2', birdIndex: 0 });
    expect(m.isOver).toBe(true);
    // 5 (inicial) + 3 (maioria em l2) + 3 (Falcão) + 10 (maior bando único blue 2) = 21
    expect(m.snapshot.state.scores['a']).toBe(21);
    expect(m.snapshot.gameover?.winner).toBe('a');
  });
});
