import type { PlayerId, SandboxState } from '@boardzando/contracts';
import { GameInstance, InvalidMoveError } from '../../core/engine/game-instance';
import { MonopolyGame } from './monopoly.game';

const PLAYERS: PlayerId[] = ['alice', 'bob', 'carol'];

function newMatch(seed = 42): GameInstance<SandboxState> {
  return GameInstance.create(new MonopolyGame(), PLAYERS, seed);
}

/** Acha o id de uma peca por typeId (a primeira encontrada). */
function findId(s: SandboxState, typeId: string): string {
  const hit = Object.values(s.placeables).find((p) => p.typeId === typeId);
  if (!hit) throw new Error(`peca ${typeId} nao encontrada`);
  return hit.id;
}

function countType(s: SandboxState, typeIdPrefix: string): number {
  return Object.values(s.placeables).filter((p) => p.typeId.startsWith(typeIdPrefix)).length;
}

describe('MonopolyGame (sandbox)', () => {
  it('setup distribui o conjunto oficial e tudo comeca na mesa', () => {
    const s = newMatch().snapshot.state;
    expect(s.kind).toBe('sandbox');
    expect(s.allowHand).toBe(true);
    // 16 Sorte, 16 Cofre, 28 titulos, 32 casas, 12 hoteis, 2 dados
    expect(countType(s, 'chance-')).toBe(16);
    expect(countType(s, 'chest-')).toBe(16);
    expect(countType(s, 'deed-')).toBe(28);
    expect(Object.values(s.placeables).filter((p) => p.typeId === 'house')).toHaveLength(32);
    expect(Object.values(s.placeables).filter((p) => p.typeId === 'hotel')).toHaveLength(12);
    expect(Object.values(s.placeables).filter((p) => p.typeId === 'die')).toHaveLength(2);
    // dinheiro: soma das denominacoes
    const money = Object.values(s.placeables).filter((p) => p.typeId.startsWith('money-'));
    expect(money.length).toBe(40 + 40 + 40 + 50 + 30 + 20 + 20);
    // ninguem comeca com peca na mao
    expect(Object.values(s.placeables).every((p) => p.ownerId === undefined)).toBe(true);
    // decks de Sorte/Cofre comecam virados
    const chance = Object.values(s.placeables).filter((p) => p.typeId.startsWith('chance-'));
    expect(chance.every((p) => p.faceUp === false)).toBe(true);
  });

  it('moveItem reposiciona e traz a peca para a frente', () => {
    const m = newMatch();
    const id = findId(m.snapshot.state, 'token-0');
    const beforeZ = m.snapshot.state.placeables[id]!.z;
    m.applyMove('bob', 'moveItem', { id, x: 0.5, y: 0.5 });
    const p = m.snapshot.state.placeables[id]!;
    expect(p.x).toBe(0.5);
    expect(p.y).toBe(0.5);
    expect(p.z).toBeGreaterThan(beforeZ);
    // sem turnos: carol tambem pode mover logo em seguida
    const id2 = findId(m.snapshot.state, 'token-1');
    expect(() => m.applyMove('carol', 'moveItem', { id: id2, x: 0.1, y: 0.1 })).not.toThrow();
  });

  it('flipItem alterna a face', () => {
    const m = newMatch();
    const id = findId(m.snapshot.state, 'chance-0'); // comeca virada (false)
    expect(m.snapshot.state.placeables[id]!.faceUp).toBe(false);
    m.applyMove('alice', 'flipItem', { id });
    expect(m.snapshot.state.placeables[id]!.faceUp).toBe(true);
  });

  it('toHand/fromHand: dono leva e devolve com a face escolhida', () => {
    const m = newMatch();
    const id = findId(m.snapshot.state, 'money-500');
    m.applyMove('alice', 'toHand', { id });
    expect(m.snapshot.state.placeables[id]!.ownerId).toBe('alice');
    // bob nao pode devolver peca da mao de alice
    expect(() =>
      m.applyMove('bob', 'fromHand', { id, x: 0.3, y: 0.3, faceUp: false }),
    ).toThrow(InvalidMoveError);
    // alice devolve virada para baixo
    m.applyMove('alice', 'fromHand', { id, x: 0.3, y: 0.3, faceUp: false });
    const p = m.snapshot.state.placeables[id]!;
    expect(p.ownerId).toBeUndefined();
    expect(p.faceUp).toBe(false);
    expect(p.x).toBeCloseTo(0.3);
  });

  it('stackItem exige mesmo stackGroup', () => {
    const m = newMatch();
    const house1 = Object.values(m.snapshot.state.placeables).find((p) => p.typeId === 'house')!.id;
    const house2 = Object.values(m.snapshot.state.placeables)
      .filter((p) => p.typeId === 'house')
      .map((p) => p.id)
      .find((id) => id !== house1)!;
    const die = findId(m.snapshot.state, 'die');
    // casa sobre casa: ok
    m.applyMove('alice', 'unstackItem', { id: house1, x: 0.4, y: 0.4 });
    expect(() => m.applyMove('alice', 'stackItem', { id: house1, ontoId: house2 })).not.toThrow();
    // casa sobre dado: grupos diferentes -> invalido
    expect(() => m.applyMove('alice', 'stackItem', { id: house1, ontoId: die })).toThrow(
      InvalidMoveError,
    );
  });

  it('shuffleStack reordena (deterministico) e exige >=2', () => {
    const m = newMatch(7);
    const chanceStack = Object.values(m.snapshot.state.placeables).find((p) =>
      p.typeId.startsWith('chance-'),
    )!.stackId!;
    const before = Object.values(m.snapshot.state.placeables)
      .filter((p) => p.stackId === chanceStack)
      .sort((a, b) => (a.stackOrder ?? 0) - (b.stackOrder ?? 0))
      .map((p) => p.id);
    m.applyMove('alice', 'shuffleStack', { stackId: chanceStack });
    const after = Object.values(m.snapshot.state.placeables)
      .filter((p) => p.stackId === chanceStack)
      .sort((a, b) => (a.stackOrder ?? 0) - (b.stackOrder ?? 0))
      .map((p) => p.id);
    expect(after).not.toEqual(before); // ordem mudou
    expect(after.slice().sort()).toEqual(before.slice().sort()); // mesmos membros

    // determinismo: mesma seed -> mesma ordem
    const m2 = GameInstance.create(new MonopolyGame(), PLAYERS, 7);
    m2.applyMove('alice', 'shuffleStack', { stackId: chanceStack });
    const after2 = Object.values(m2.snapshot.state.placeables)
      .filter((p) => p.stackId === chanceStack)
      .sort((a, b) => (a.stackOrder ?? 0) - (b.stackOrder ?? 0))
      .map((p) => p.id);
    expect(after2).toEqual(after);

    // stack de 1 -> invalido (token-0 e solto)
    const lone = findId(m.snapshot.state, 'token-0');
    expect(() => m.applyMove('alice', 'shuffleStack', { stackId: `stk-${lone}` })).toThrow(
      InvalidMoveError,
    );
  });

  it('rollDie define value 1..6 e recusa nao-dado', () => {
    const m = newMatch();
    const die = findId(m.snapshot.state, 'die');
    m.applyMove('bob', 'rollDie', { id: die });
    const v = m.snapshot.state.placeables[die]!.value!;
    expect(v).toBeGreaterThanOrEqual(1);
    expect(v).toBeLessThanOrEqual(6);
    const token = findId(m.snapshot.state, 'token-0');
    expect(() => m.applyMove('bob', 'rollDie', { id: token })).toThrow(InvalidMoveError);
  });

  it('playerView esconde a mao alheia e a identidade de viradas', () => {
    const m = newMatch();
    const moneyId = findId(m.snapshot.state, 'money-100');
    m.applyMove('alice', 'toHand', { id: moneyId });

    // bob nao ve a identidade da peca na mao de alice
    const viewBob = m.viewFor('bob') as {
      placeables: Record<string, { typeId?: string; inHand?: boolean; ownerId?: string }>;
    };
    expect(viewBob.placeables[moneyId]!.typeId).toBeUndefined();
    expect(viewBob.placeables[moneyId]!.inHand).toBe(true);
    expect(viewBob.placeables[moneyId]!.ownerId).toBe('alice');

    // alice ve a propria peca por completo
    const viewAlice = m.viewFor('alice') as {
      placeables: Record<string, { typeId?: string }>;
    };
    expect(viewAlice.placeables[moneyId]!.typeId).toBe('money-100');

    // carta de Sorte virada para baixo: identidade escondida ate de quem olha
    const chanceId = findId(m.snapshot.state, 'chance-0');
    const c = (m.viewFor('carol') as {
      placeables: Record<string, { typeId?: string; faceUp?: boolean; backId?: string }>;
    }).placeables[chanceId]!;
    expect(c.typeId).toBeUndefined();
    expect(c.faceUp).toBe(false);
    expect(c.backId).toBe('back-chance');
  });

  it('o jogo nunca termina sozinho (sem endIf)', () => {
    const m = newMatch();
    const id = findId(m.snapshot.state, 'die');
    m.applyMove('alice', 'rollDie', { id });
    expect(m.isOver).toBe(false);
  });

  it('expõe um tabuleiro perimetral de 40 casas com cidades brasileiras', () => {
    const s = newMatch().snapshot.state;
    expect(s.board?.kind).toBe('perimeter');
    expect(s.board?.size).toBe(11);
    expect(s.board?.spaces).toHaveLength(40);
    // índices 0..39 únicos
    const idxs = s.board!.spaces.map((sp) => sp.index).sort((a, b) => a - b);
    expect(idxs).toEqual(Array.from({ length: 40 }, (_, i) => i));
    // cantos canônicos
    const byIndex = Object.fromEntries(s.board!.spaces.map((sp) => [sp.index, sp]));
    expect(byIndex[0]!.type).toBe('go');
    expect(byIndex[10]!.type).toBe('jail');
    expect(byIndex[20]!.type).toBe('parking');
    expect(byIndex[30]!.type).toBe('gotojail');
    // 22 propriedades + 4 ferrovias + 2 utilidades = 28 casas "compráveis"
    const props = s.board!.spaces.filter((sp) => sp.type === 'property');
    const rails = s.board!.spaces.filter((sp) => sp.type === 'railroad');
    const utils = s.board!.spaces.filter((sp) => sp.type === 'utility');
    expect(props).toHaveLength(22);
    expect(rails).toHaveLength(4);
    expect(utils).toHaveLength(2);
    // São Paulo é a propriedade mais cara (casa 39)
    expect(byIndex[39]!.name).toBe('São Paulo');
    // o nº de casas compráveis bate com os 28 títulos (deeds)
    expect(props.length + rails.length + utils.length).toBe(countType(s, 'deed-'));
  });
});
