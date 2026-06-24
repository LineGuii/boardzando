import type { HuesOptions, PlayerId } from '@boardzando/contracts';
import { GameInstance, InvalidMoveError } from '../../core/engine/game-instance';
import { HuesGame } from './hues.game';
import type { HuesState } from './hues.state';

const PLAYERS: PlayerId[] = ['alice', 'bob', 'carol'];

function newMatch(
  seed = 42,
  setupData?: Partial<HuesOptions>,
): GameInstance<HuesState> {
  return GameInstance.create(new HuesGame(), PLAYERS, seed, setupData);
}

describe('HuesGame', () => {
  it('setup distribui 4 alvos e zera os contadores', () => {
    const m = newMatch();
    const s = m.snapshot.state;
    expect(s.cardOptions).toHaveLength(4);
    expect(s.step).toBe('pick');
    expect(s.targetRounds).toBe(PLAYERS.length * 2); // default 2
    for (const p of PLAYERS) {
      expect(s.scores[p]).toBe(0);
      expect(s.cueGiverCount[p]).toBe(0);
      expect(s.guesses[p]).toEqual([]);
    }
  });

  it('respeita roundsPerPlayer vindo do setupData', () => {
    const m = newMatch(42, { roundsPerPlayer: 3, liveGuesses: false });
    expect(m.snapshot.state.targetRounds).toBe(PLAYERS.length * 3);
    expect(m.snapshot.state.options.liveGuesses).toBe(false);
  });

  it('selectColor exige cue-giver, indice valido e step=pick', () => {
    const m = newMatch();
    // bob nao e cue-giver
    expect(() => m.applyMove('bob', 'selectColor', { index: 0 })).toThrow();
    // indice fora -> InvalidMoveError
    expect(() => m.applyMove('alice', 'selectColor', { index: 9 })).toThrow(InvalidMoveError);
    // valido
    m.applyMove('alice', 'selectColor', { index: 1 });
    expect(m.snapshot.state.step).toBe('cue1');
    expect(m.snapshot.state.target).toBeDefined();
    // step 'pick' acabou: nao pode selectColor de novo
    expect(() => m.applyMove('alice', 'selectColor', { index: 0 })).toThrow(InvalidMoveError);
  });

  it('submitCue valida palavras (1 em cue1, 2 em cue2) e blocklist', () => {
    const m = newMatch();
    m.applyMove('alice', 'selectColor', { index: 0 });
    // 2 palavras em cue1 -> invalido
    expect(() => m.applyMove('alice', 'submitCue', { text: 'duas palavras' })).toThrow(
      InvalidMoveError,
    );
    // 1 palavra mas blocklisted -> invalido
    expect(() => m.applyMove('alice', 'submitCue', { text: 'vermelho' })).toThrow(
      InvalidMoveError,
    );
    expect(() => m.applyMove('alice', 'submitCue', { text: 'CLARO' })).toThrow(
      InvalidMoveError,
    );
    // 1 palavra ok
    m.applyMove('alice', 'submitCue', { text: 'fogo' });
    expect(m.snapshot.state.step).toBe('guess1');
    expect(m.snapshot.state.cue1).toBe('fogo');
  });

  it('placeCone rejeita cue-giver e cones a mais', () => {
    const m = newMatch();
    m.applyMove('alice', 'selectColor', { index: 0 });
    m.applyMove('alice', 'submitCue', { text: 'fogo' });
    // alice (cue-giver) nao pode placeCone
    expect(() => m.applyMove('alice', 'placeCone', { col: 0, row: 0 })).toThrow(
      InvalidMoveError,
    );
    m.applyMove('bob', 'placeCone', { col: 0, row: 0 });
    // bob ja colocou 1 (esperado em guess1) -> 2o e invalido
    expect(() => m.applyMove('bob', 'placeCone', { col: 1, row: 1 })).toThrow(InvalidMoveError);
  });

  it('quando todos palpitadores colocam, avanca para cue2; depois para reveal', () => {
    const m = newMatch();
    m.applyMove('alice', 'selectColor', { index: 0 });
    m.applyMove('alice', 'submitCue', { text: 'fogo' });
    m.applyMove('bob', 'placeCone', { col: 1, row: 1 });
    // carol ainda nao palpitou -> step continua guess1
    expect(m.snapshot.state.step).toBe('guess1');
    m.applyMove('carol', 'placeCone', { col: 2, row: 2 });
    expect(m.snapshot.state.step).toBe('cue2');

    m.applyMove('alice', 'submitCue', { text: 'cor quente' });
    expect(m.snapshot.state.step).toBe('guess2');
    m.applyMove('bob', 'placeCone', { col: 3, row: 3 });
    m.applyMove('carol', 'placeCone', { col: 4, row: 4 });
    expect(m.snapshot.state.step).toBe('reveal');
    // turno NAO avancou — alice ainda esta com a vez para finalizar
    expect(m.snapshot.currentPlayer).toBe('alice');
  });

  it('finalizeRound pontua 3/2/1 e cue-giver +1 por cone no frame', () => {
    const m = newMatch();
    // forca um alvo conhecido
    const s = structuredClone(m.snapshot.state);
    s.cardOptions = [{ col: 10, row: 8 }, { col: 0, row: 0 }, { col: 1, row: 1 }, { col: 2, row: 2 }];
    s.step = 'pick';
    const seeded = GameInstance.restore(new HuesGame(), { ...m.snapshot, state: s });
    seeded.applyMove('alice', 'selectColor', { index: 0 }); // alvo (10,8)
    seeded.applyMove('alice', 'submitCue', { text: 'tijolo' });

    // bob: exato (3 pts); carol: dentro do frame mas nao exato (2 pts)
    seeded.applyMove('bob', 'placeCone', { col: 10, row: 8 });
    seeded.applyMove('carol', 'placeCone', { col: 11, row: 9 });

    seeded.applyMove('alice', 'submitCue', { text: 'cor terrosa' });
    // bob: borda externa ortogonal (10, 6) -> Manhattan 2, Chebyshev 2 -> 1 pt
    seeded.applyMove('bob', 'placeCone', { col: 10, row: 6 });
    // carol: fora (longe) -> 0 pts
    seeded.applyMove('carol', 'placeCone', { col: 0, row: 0 });

    expect(seeded.snapshot.state.step).toBe('reveal');
    seeded.applyMove('alice', 'finalizeRound', {});

    // scores: bob = 3 (exato) + 1 (borda) = 4; carol = 2 + 0 = 2
    expect(seeded.snapshot.state.scores['bob']).toBe(4);
    expect(seeded.snapshot.state.scores['carol']).toBe(2);
    // cue-giver pontua 1 por cone no frame 3x3:
    //   bob cone1 (10,8) dentro; bob cone2 (10,6) fora; carol cone1 (11,9) dentro; carol cone2 (0,0) fora
    // -> 2 pontos para alice
    expect(seeded.snapshot.state.scores['alice']).toBe(2);
    expect(seeded.snapshot.state.cueGiverCount['alice']).toBe(1);
    // proximo cue-giver assume
    expect(seeded.snapshot.currentPlayer).toBe('bob');
    expect(seeded.snapshot.state.step).toBe('pick');
    expect(seeded.snapshot.state.cardOptions).toHaveLength(4);
  });

  it('endIf dispara apos numPlayers*roundsPerPlayer rodadas (config 1)', () => {
    const m = newMatch(7, { roundsPerPlayer: 1 });
    // joga 3 rodadas curtas (uma por jogador)
    for (let i = 0; i < PLAYERS.length; i++) {
      const cueGiver = m.snapshot.currentPlayer;
      m.applyMove(cueGiver, 'selectColor', { index: 0 });
      m.applyMove(cueGiver, 'submitCue', { text: `cue${i}a` });
      for (const p of PLAYERS) {
        if (p !== cueGiver) m.applyMove(p, 'placeCone', { col: 0, row: 0 });
      }
      m.applyMove(cueGiver, 'submitCue', { text: `cue${i} b` });
      for (const p of PLAYERS) {
        if (p !== cueGiver) m.applyMove(p, 'placeCone', { col: 0, row: 0 });
      }
      m.applyMove(cueGiver, 'finalizeRound', {});
    }
    expect(m.isOver).toBe(true);
    expect(m.snapshot.gameover).toBeDefined();
    expect(m.snapshot.gameover?.ranking).toHaveLength(PLAYERS.length);
  });

  it('playerView esconde target antes do reveal e cardOptions de nao-cue-giver', () => {
    const m = newMatch();
    m.applyMove('alice', 'selectColor', { index: 0 });
    const viewBob = m.viewFor('bob') as ReturnType<HuesGame['playerView']> & {
      target?: unknown;
      cardOptions?: unknown;
    };
    expect(viewBob.target).toBeUndefined();
    expect(viewBob.cardOptions).toBeUndefined();
    const viewAlice = m.viewFor('alice') as { cardOptions?: unknown };
    expect(viewAlice.cardOptions).toBeDefined();
  });

  it('playerView com liveGuesses=false esconde palpites dos outros', () => {
    const m = newMatch(42, { liveGuesses: false });
    m.applyMove('alice', 'selectColor', { index: 0 });
    m.applyMove('alice', 'submitCue', { text: 'fogo' });
    m.applyMove('bob', 'placeCone', { col: 5, row: 5 });
    // do ponto de vista de carol, ela so deve ver os proprios palpites
    const viewCarol = m.viewFor('carol') as { guesses: Record<string, unknown[]> };
    expect(viewCarol.guesses['bob']).toBeUndefined();
    expect(viewCarol.guesses['carol']).toEqual([]);
  });

  it('e deterministico para a mesma seed', () => {
    const a = newMatch(123).snapshot.state.cardOptions;
    const b = newMatch(123).snapshot.state.cardOptions;
    expect(a).toEqual(b);
  });
});
