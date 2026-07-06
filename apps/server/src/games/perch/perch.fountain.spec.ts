import type { PlayerId } from '@boardzando/contracts';
import { GameInstance, InvalidMoveError } from '../../core/engine/game-instance';
import { PerchGame } from './perch.game';
import { computeAdjacency } from './perch.adjacency';
import { addToFountain, emptyFountain, FOUNTAIN_CAPS, scoreFountainAndPlaza } from './perch.fountain';
import type { CreatureRuntime, PerchLocation, PerchState } from './perch.state';

const PLAYERS: PlayerId[] = ['a', 'b', 'c'];

function loc(id: string, defId: string, col: number, row: number): PerchLocation {
  return { id, defId, name: id, emoji: '🪺', points: [3, 2, 1], col, row };
}

function baseState(over: Partial<PerchState> = {}): PerchState {
  const homestead: PerchLocation[] = [
    loc('l0', 'pines', 0, 0),
    loc('l1', 'ash', 0, 1),
    loc('l2', 'country', 1, 0),
    loc('l3', 'elm', 1, 1),
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
    hands: { a: ['blue'], b: ['red'], c: ['yellow'] },
    homestead,
    birdsAt: {},
    fountain: emptyFountain(),
    plaza: [],
    birdhouses: { a: 0, b: 0, c: 0 },
    lightning: { a: 0, b: 0, c: 0 },
    birdhousesAt: {},
    scores: { a: 0, b: 0, c: 0 },
    ...over,
  };
}

function seed(state: PerchState): GameInstance<PerchState> {
  const base = GameInstance.create(new PerchGame(), PLAYERS, 1);
  return GameInstance.restore(new PerchGame(), {
    ...base.snapshot,
    players: [...PLAYERS],
    currentPlayer: state.turnOrder[state.turnPtr]!,
    state,
  });
}

describe('Perch — Fonte e Praça', () => {
  it('preenche de baixo para cima; transborda para a Praça quando cheia', () => {
    const s = baseState();
    const total = FOUNTAIN_CAPS.reduce((a, b) => a + b, 0);
    for (let i = 0; i < total; i++) addToFountain(s, 'blue');
    // Fonte cheia em todos os níveis
    s.fountain.forEach((lvl, i) => expect(lvl.length).toBe(FOUNTAIN_CAPS[i]));
    expect(s.plaza).toHaveLength(0);
    // a próxima vai para a Praça
    addToFountain(s, 'red');
    expect(s.plaza).toEqual(['red']);
  });

  it('pontuação de fim: níveis mais altos valem mais + Praça 1 cada', () => {
    const s = baseState({ scores: { a: 0, b: 0, c: 0 } });
    s.fountain[0] = ['blue']; // nível base = 1 pt
    s.fountain[2] = ['blue']; // nível 3 = 3 pts
    s.plaza = ['blue', 'red'];
    scoreFountainAndPlaza(s, PLAYERS);
    // a (blue): 1 + 3 (fonte) + 1 (praça) = 5 ; b (red): 1 (praça)
    expect(s.scores['a']).toBe(5);
    expect(s.scores['b']).toBe(1);
  });
});

describe('Perch — Casinha (Birdhouse)', () => {
  const creatures: Record<string, CreatureRuntime> = {};

  it('só nas rodadas 4/5, sobre pilha de 1+ aves; protege e conta +1', () => {
    const s = baseState({
      round: 3, // ainda não pode
      birdhouses: { a: 1, b: 0, c: 0 },
      birdsAt: { l0: { blue: 2 } },
      creatures,
    });
    const m = seed(s);
    expect(() => m.applyMove('a', 'buildBirdhouse', { locationId: 'l0', flock: 'blue' })).toThrow(
      InvalidMoveError,
    );

    // rodada 4: agora vale
    const s4 = baseState({ round: 4, birdhouses: { a: 1, b: 0, c: 0 }, birdsAt: { l0: { blue: 2 } } });
    const m4 = seed(s4);
    m4.applyMove('a', 'buildBirdhouse', { locationId: 'l0', flock: 'blue' });
    expect(m4.snapshot.state.birdhousesAt['l0']!['blue']).toBe(true);
    expect(m4.snapshot.state.birdhouses['a']).toBe(0); // consumiu
    // sem pilha -> inválido
    const s5 = baseState({ round: 4, birdhouses: { a: 1, b: 0, c: 0 }, birdsAt: {} });
    const m5 = seed(s5);
    expect(() => m5.applyMove('a', 'buildBirdhouse', { locationId: 'l0', flock: 'blue' })).toThrow(
      InvalidMoveError,
    );
  });

  it('a Casinha adiciona +1 à pontuação do bando (conta como ave)', () => {
    // l0: blue 1 + casinha = 2 efetivo; red 1 -> blue vence (mais), red 2º
    const s = baseState({
      round: 5,
      turnPtr: 0,
      hands: { a: ['blue'], b: [], c: [] },
      birdsAt: { l0: { blue: 1, red: 1 } },
      birdhousesAt: { l0: { blue: true } },
      scores: { a: 0, b: 0, c: 0 },
    });
    const m = seed(s);
    // 'a' coloca a última ave num Local vazio (l3) para fechar a rodada/jogo
    m.applyMove('a', 'placeBird', { locationId: 'l3', birdIndex: 0 });
    expect(m.isOver).toBe(true);
    // l0: blue efetivo 2 (1 ave + casinha) = maioria -> pontos[0]=3; red 2º -> pontos[1]=2
    // l3: blue 1 -> maioria -> pontos[0]=3
    // a = 3 (l0) + 3 (l3) = 6 ; b = 2 (l0)
    expect(m.snapshot.state.scores['a']).toBe(6);
    expect(m.snapshot.state.scores['b']).toBe(2);
  });

  it('não é possível colocar ave numa pilha protegida', () => {
    const s = baseState({
      round: 4,
      birdsAt: { l0: { blue: 1 } },
      birdhousesAt: { l0: { blue: true } },
      hands: { a: ['blue'], b: [], c: [] },
    });
    const m = seed(s);
    expect(() => m.applyMove('a', 'placeBird', { locationId: 'l0', birdIndex: 0 })).toThrow(
      InvalidMoveError,
    );
  });
});

describe('Perch — Raio (Lightning)', () => {
  it('só na rodada 5; remove 1 ave -> Fonte; respeita a Casinha', () => {
    const s = baseState({
      round: 5,
      lightning: { a: 1, b: 0, c: 0 },
      birdsAt: { l1: { red: 2 } },
      hands: { a: ['blue'], b: ['red'], c: ['yellow'] },
    });
    const m = seed(s);
    m.applyMove('a', 'zapBird', { locationId: 'l1', flock: 'red' });
    expect(m.snapshot.state.birdsAt['l1']!['red']).toBe(1);
    expect(m.snapshot.state.fountain[0]).toContain('red'); // foi p/ a Fonte
    expect(m.snapshot.state.lightning['a']).toBe(0);
    // a mesma jogada de novo na mesma vez (já usou bônus) é inválida
    expect(() => m.applyMove('a', 'zapBird', { locationId: 'l1', flock: 'red' })).toThrow(
      InvalidMoveError,
    );

    // rodada 4 não permite raio
    const s4 = baseState({ round: 4, lightning: { a: 1, b: 0, c: 0 }, birdsAt: { l1: { red: 1 } } });
    const m4 = seed(s4);
    expect(() => m4.applyMove('a', 'zapBird', { locationId: 'l1', flock: 'red' })).toThrow(
      InvalidMoveError,
    );

    // pilha protegida não pode ser zapada
    const sh = baseState({
      round: 5,
      lightning: { a: 1, b: 0, c: 0 },
      birdsAt: { l1: { red: 1 } },
      birdhousesAt: { l1: { red: true } },
    });
    const mh = seed(sh);
    expect(() => mh.applyMove('a', 'zapBird', { locationId: 'l1', flock: 'red' })).toThrow(
      InvalidMoveError,
    );
  });

  it('distribui Casinhas na rodada 4 e Raios na rodada 5', () => {
    // roda uma partida real automatizada e confere a distribuição
    const m = GameInstance.create(new PerchGame(), PLAYERS, 9);
    let guard = 0;
    let sawR4Houses = false;
    let sawR5Lightning = false;
    while (!m.isOver && guard < 500) {
      const cur = m.snapshot.currentPlayer;
      const st = m.snapshot.state;
      m.applyMove(cur, 'placeBird', { locationId: st.homestead[0]!.id, birdIndex: 0 });
      if (!m.isOver && m.snapshot.currentPlayer === cur && m.snapshot.state.placedThisTurn) {
        m.applyMove(cur, 'endTurn', {});
      }
      const s = m.snapshot.state;
      if (s.round === 4 && PLAYERS.every((p) => (s.birdhouses[p] ?? 0) >= 1)) sawR4Houses = true;
      if (s.round === 5 && PLAYERS.every((p) => (s.lightning[p] ?? 0) >= 1)) sawR5Lightning = true;
      guard += 1;
    }
    expect(sawR4Houses).toBe(true);
    expect(sawR5Lightning).toBe(true);
  });
});
