import type { PlayerId } from '@boardzando/contracts';
import { GameInstance, InvalidMoveError } from '../../core/engine/game-instance';
import { ManadaGame } from './manada.game';
import { MANADA_THEMES } from './manada.themes';
import { normalize } from './manada.moves';
import type { ManadaState } from './manada.state';

const P4: PlayerId[] = ['a', 'b', 'c', 'd'];

function newMatch(
  players: PlayerId[] = P4,
  seed = 42,
  opts?: Partial<{ targetCows: 5 | 8 | 11 }>,
): GameInstance<ManadaState> {
  return GameInstance.create(new ManadaGame(), players, seed, opts);
}

function seed(state: ManadaState, players: PlayerId[] = P4): GameInstance<ManadaState> {
  const base = GameInstance.create(new ManadaGame(), players, 1);
  return GameInstance.restore(new ManadaGame(), { ...base.snapshot, players, state });
}

/** Estado base pronto para uma rodada 'answer'. */
function baseState(over: Partial<ManadaState> = {}, players: PlayerId[] = P4): ManadaState {
  const cows: Record<PlayerId, number> = {};
  for (const p of players) cows[p] = 0;
  return {
    options: { targetCows: 8 },
    themeOrder: [0, 1, 2, 3, 4],
    roundIndex: 0,
    step: 'answer',
    cowboyIdx: 0,
    answers: {},
    cows,
    target: 8,
    ...over,
  };
}

/** Aplica um mapa de respostas (fecha a rodada quando todos respondem). */
function answerAll(m: GameInstance<ManadaState>, map: Record<PlayerId, string>): void {
  for (const [p, text] of Object.entries(map)) {
    m.applyMove(p as PlayerId, 'submitAnswer', { text });
  }
}

describe('ManadaGame (Efeito Manada)', () => {
  it('normalize é flexível (maiúsculas, acentos, espaços, pontuação)', () => {
    expect(normalize('  Ketchup ')).toBe('ketchup');
    expect(normalize('AÇAÍ')).toBe('acai');
    expect(normalize('São   Paulo!')).toBe('sao paulo');
    expect(normalize('rock-n-roll')).toBe('rock n roll');
  });

  it('setup pré-sorteia todos os temas, zera vacas e começa em answer', () => {
    const s = newMatch(P4, 7, { targetCows: 8 }).snapshot.state;
    expect(s.step).toBe('answer');
    expect(s.target).toBe(8);
    expect(s.themeOrder).toHaveLength(MANADA_THEMES.length);
    expect(new Set(s.themeOrder).size).toBe(MANADA_THEMES.length);
    expect(s.cowboyIdx).toBe(0);
    for (const p of P4) expect(s.cows[p]).toBe(0);
  });

  it('submitAnswer: 1 por rodada, rejeita vazio e >40 chars', () => {
    const m = seed(baseState());
    m.applyMove('a', 'submitAnswer', { text: 'vaca' });
    expect(m.snapshot.state.answers['a']).toBe('vaca');
    expect(() => m.applyMove('a', 'submitAnswer', { text: 'outra' })).toThrow(InvalidMoveError);
    expect(() => m.applyMove('b', 'submitAnswer', { text: '   ' })).toThrow(InvalidMoveError);
    expect(() => m.applyMove('b', 'submitAnswer', { text: 'x'.repeat(41) })).toThrow(
      InvalidMoveError,
    );
  });

  it('playerView esconde respostas alheias em answer e revela no reveal', () => {
    const m = seed(baseState());
    m.applyMove('a', 'submitAnswer', { text: 'ketchup' });
    const vb = m.viewFor('b') as {
      answered: string[];
      myAnswer?: string;
      lastRound?: unknown;
      cowboyId: string;
    };
    expect(vb.answered).toContain('a');
    expect(vb.myAnswer).toBeUndefined(); // b ainda não respondeu
    expect(vb.lastRound).toBeUndefined(); // fase answer
    expect(vb.cowboyId).toBe('a'); // cowboyIdx 0 -> primeiro jogador
    const va = m.viewFor('a') as { myAnswer?: string };
    expect(va.myAnswer).toBe('ketchup'); // vejo a minha
  });

  it('EXEMPLO maioria clara: maioria ganha vaca, o único de fora leva a Vaca Rosa', () => {
    const m = seed(baseState());
    // 3× "ketchup", d sozinho com "mostarda"
    answerAll(m, { a: 'ketchup', b: 'Ketchup', c: 'KETCHUP', d: 'mostarda' });
    const s = m.snapshot.state;
    expect(s.step).toBe('reveal');
    expect(s.cows).toEqual({ a: 1, b: 1, c: 1, d: 0 });
    expect(s.lastRound?.cowWinners.sort()).toEqual(['a', 'b', 'c']);
    expect(s.pinkCowHolder).toBe('d');
    expect(s.lastRound?.pinkCowTo).toBe('d');
    expect(s.lastRound?.tieAtTop).toBe(false);
  });

  it('EXEMPLO sem perdedor: 2 singletons distintos → maioria pontua, sem Vaca Rosa', () => {
    const m = seed(baseState());
    // a,c "10 centavos" (maioria); b e d singletons diferentes
    answerAll(m, { a: '10 centavos', b: '25 centavos', c: '10 centavos', d: '50 centavos' });
    const s = m.snapshot.state;
    expect(s.cows).toEqual({ a: 1, b: 0, c: 1, d: 0 });
    expect(s.pinkCowHolder).toBeUndefined(); // 2 singletons -> ninguém leva
    expect(s.lastRound?.pinkCowTo).toBeUndefined();
  });

  it('EXEMPLO maioria dividida: empate no topo → ninguém ganha nada', () => {
    const m = seed(baseState());
    answerAll(m, { a: 'racionais', b: 'rita lee', c: 'racionais', d: 'rita lee' });
    const s = m.snapshot.state;
    expect(s.cows).toEqual({ a: 0, b: 0, c: 0, d: 0 });
    expect(s.lastRound?.tieAtTop).toBe(true);
    expect(s.pinkCowHolder).toBeUndefined(); // sem singletons
  });

  it('a Vaca Rosa transfere para o novo "sobrando" numa rodada seguinte', () => {
    // d começa com a Vaca Rosa
    const m = seed(baseState({ pinkCowHolder: 'd' }));
    // agora quem sobra é b (singleton); a,c maioria; d acompanha a maioria
    answerAll(m, { a: 'sol', b: 'banana', c: 'sol', d: 'sol' });
    expect(m.snapshot.state.pinkCowHolder).toBe('b'); // saiu de d, foi p/ b
  });

  it('jogador com a Vaca Rosa não vence mesmo atingindo o alvo', () => {
    const m = seed(
      baseState({ target: 2, cows: { a: 1, b: 0, c: 0, d: 0 }, pinkCowHolder: 'a' }),
    );
    // a e b formam a maioria (a chega a 2), mas há DOIS singletons (c, d) — logo
    // a Vaca Rosa PERMANECE com a, que fica bloqueado de vencer.
    answerAll(m, { a: 'lua', b: 'lua', c: 'sol', d: 'estrela' });
    const s = m.snapshot.state;
    expect(s.cows['a']).toBe(2);
    expect(s.pinkCowHolder).toBe('a'); // 2 singletons -> ninguém novo assume
    expect(s.winnerId).toBeUndefined(); // bloqueado pela Vaca Rosa
    expect(m.isOver).toBe(false);
  });

  it('atingir o alvo sozinho e sem Vaca Rosa vence o jogo (endIf)', () => {
    const m = seed(baseState({ target: 2, cows: { a: 1, b: 0, c: 0, d: 0 } }));
    // a chega a 2 na maioria; b sozinho pega a rosa; a vence
    answerAll(m, { a: 'azul', b: 'verde', c: 'azul', d: 'azul' });
    const s = m.snapshot.state;
    expect(s.cows['a']).toBe(2);
    expect(s.winnerId).toBe('a');
    expect(m.isOver).toBe(true);
    expect(m.snapshot.gameover?.winner).toBe('a');
    expect(m.snapshot.gameover?.ranking?.[0]).toBe('a');
  });

  it('empate no alvo sobe o objetivo em vez de declarar vencedor', () => {
    // a e c com 1 vaca, alvo 2; ambos acompanham a maioria e chegam a 2 juntos
    const m = seed(baseState({ target: 2, cows: { a: 1, b: 0, c: 1, d: 0 } }));
    answerAll(m, { a: 'gato', b: 'gato', c: 'gato', d: 'peixe' });
    const s = m.snapshot.state;
    expect(s.cows['a']).toBe(2);
    expect(s.cows['c']).toBe(2);
    expect(s.winnerId).toBeUndefined();
    expect(s.target).toBe(3); // subiu
    expect(s.lastRound?.bumpedTargetTo).toBe(3);
  });

  it('nextRound gira o Vaqueiro e limpa as respostas', () => {
    const m = seed(baseState());
    answerAll(m, { a: 'x', b: 'y', c: 'x', d: 'z' });
    expect(m.snapshot.state.step).toBe('reveal');
    m.applyMove('b', 'nextRound', {});
    const s = m.snapshot.state;
    expect(s.step).toBe('answer');
    expect(s.roundIndex).toBe(1);
    expect(s.cowboyIdx).toBe(1); // girou: rodada 1 -> segundo jogador
    expect(s.answers).toEqual({});
    // nextRound fora do reveal é inválido
    expect(() => m.applyMove('a', 'nextRound', {})).toThrow(InvalidMoveError);
  });
});
