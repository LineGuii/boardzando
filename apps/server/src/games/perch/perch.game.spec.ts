import type { PlayerId } from '@boardzando/contracts';
import { GameInstance } from '../../core/engine/game-instance';
import { PerchGame } from './perch.game';
import { scoreLocation, controllerOf } from './perch.scoring';
import type { PerchState } from './perch.state';

const P3: PlayerId[] = ['a', 'b', 'c'];
const P4: PlayerId[] = ['a', 'b', 'c', 'd'];

function newMatch(players: PlayerId[] = P4, seed = 42): GameInstance<PerchState> {
  return GameInstance.create(new PerchGame(), players, seed);
}

describe('Perch — pontuação com empate-anula (regra-assinatura)', () => {
  it('exemplo "Happy Birdbath" [2,0,1]: 4/2/1 aves → 2 / 0 / 1', () => {
    const awards = scoreLocation({ green: 4, yellow: 2, blue: 1 }, [2, 0, 1]);
    expect(awards).toEqual({ green: 2, yellow: 0, blue: 1 });
  });

  it('exemplo "Early Bird" [3,2,1]: 5/2/2/1 → só o 1º pontua (empate no 2º anula 2º e 3º)', () => {
    const awards = scoreLocation({ blue: 5, red: 2, yellow: 2, green: 1 }, [3, 2, 1]);
    expect(awards.blue).toBe(3);
    expect(awards.red ?? 0).toBe(0);
    expect(awards.yellow ?? 0).toBe(0);
    expect(awards.green ?? 0).toBe(0); // 4º lugar, fora do pódio
  });

  it('empate no 1º (2 bandos) consome slots 1–2; o próximo distinto pega o 3º', () => {
    const awards = scoreLocation({ a: 3, b: 3, c: 1 }, [5, 4, 2]);
    expect(awards.a ?? 0).toBe(0);
    expect(awards.b ?? 0).toBe(0);
    expect(awards.c).toBe(2); // 3º
  });

  it('empate no 1º (3 bandos) anula todo o pódio (ninguém recebe award)', () => {
    const awards = scoreLocation({ a: 2, b: 2, c: 2 }, [5, 4, 2]);
    expect(awards.a ?? 0).toBe(0);
    expect(awards.b ?? 0).toBe(0);
    expect(awards.c ?? 0).toBe(0);
  });

  it('empate no 2º: 1º pontua, 2º e 3º anulam', () => {
    const awards = scoreLocation({ a: 5, b: 2, c: 2 }, [3, 2, 1]);
    expect(awards.a).toBe(3);
    expect(awards.b ?? 0).toBe(0);
    expect(awards.c ?? 0).toBe(0);
  });

  it('controllerOf: maioria isolada controla; empate no topo = sem controlador', () => {
    expect(controllerOf({ a: 3, b: 1 })).toBe('a');
    expect(controllerOf({ a: 2, b: 2 })).toBeUndefined();
    expect(controllerOf({})).toBeUndefined();
  });
});

describe('Perch — setup e ciclo de rodada', () => {
  it('setup: homestead por contagem de jogadores, mãos de 4 aves, pontos zerados', () => {
    const s3 = newMatch(P3, 1).snapshot.state;
    expect(s3.homestead).toHaveLength(8); // 3p → 8 tiles
    const s4 = newMatch(P4, 1).snapshot.state;
    expect(s4.homestead).toHaveLength(10); // 4p → 10 tiles
    const s5 = newMatch(['a', 'b', 'c', 'd', 'e'], 1).snapshot.state;
    expect(s5.homestead).toHaveLength(13); // 5p → 13 tiles

    for (const p of P4) {
      expect(s4.hands[p]).toHaveLength(4); // 2 sacadas + 2 próprias
      expect(s4.scores[p]).toBe(0);
    }
    // sacola esvazia após o recrutamento (todos sacam o que foi migrado)
    expect(Object.values(s4.bag).reduce((a, b) => a + b, 0)).toBe(0);
    expect(s4.round).toBe(1);
  });

  it('mãos contêm aves de OUTROS bandos (o truque do jogo)', () => {
    // com seed fixo, ao menos um jogador deve ter na mão uma cor != a sua
    const s = newMatch(P4, 7).snapshot.state;
    const foreign = P4.some((p) =>
      (s.hands[p] ?? []).some((f) => f !== s.flockOf[p]),
    );
    expect(foreign).toBe(true);
  });

  it('só o jogador da vez coloca; a vez segue turnOrder e some da mão', () => {
    const m = newMatch(P4, 3);
    const first = m.snapshot.currentPlayer;
    expect(first).toBe(m.snapshot.state.turnOrder[0]);
    const loc0 = m.snapshot.state.homestead[0]!.id;
    const handBefore = m.snapshot.state.hands[first]!.length;
    m.applyMove(first, 'placeBird', { locationId: loc0, birdIndex: 0 });
    expect(m.snapshot.state.hands[first]).toHaveLength(handBefore - 1);
    expect(m.snapshot.state.birdsAt[loc0]).toBeDefined();
    // a vez passou para o próximo da ordem
    expect(m.snapshot.currentPlayer).toBe(m.snapshot.state.turnOrder[1]);
  });

  it('playerView esconde a sacola e as mãos alheias', () => {
    const m = newMatch(P4, 5);
    const va = m.viewFor('a') as {
      myHand: string[];
      handCounts: Record<string, number>;
      bagCount: number;
      bag?: unknown;
    };
    expect(va.myHand).toHaveLength(4);
    expect(va.handCounts['b']).toBe(4); // só a contagem dos outros
    expect((va as { hands?: unknown }).hands).toBeUndefined(); // mãos alheias não vazam
    expect(va.bagCount).toBe(0);
  });

  it('joga uma partida inteira (4 aves × jogadores × 5 rodadas) e termina com vencedor/empate', () => {
    const m = newMatch(P3, 11);
    let guard = 0;
    while (!m.isOver && guard < 500) {
      const cur = m.snapshot.currentPlayer;
      const st = m.snapshot.state;
      // coloca sempre a 1ª ave da mão no 1º Local
      m.applyMove(cur, 'placeBird', { locationId: st.homestead[0]!.id, birdIndex: 0 });
      guard += 1;
    }
    expect(m.isOver).toBe(true);
    // 3 jogadores × 4 aves × 5 rodadas = 60 jogadas
    expect(guard).toBe(60);
    const go = m.snapshot.gameover!;
    expect(go).toBeDefined();
    // deve haver um vencedor OU empate declarado
    expect(go.winner !== undefined || go.draw === true).toBe(true);
    expect(go.ranking).toHaveLength(3);
  });

  it('a ordem de turno é refeita pelo placar após o Upkeep', () => {
    // joga a rodada 1 toda concentrando as aves de 'a' num Local que paga muito
    const m = newMatch(P3, 2);
    const st = m.snapshot.state;
    const rich = [...st.homestead].sort((x, y) => y.points[0] - x.points[0])[0]!; // maior 1º lugar
    let guard = 0;
    const firstRound = 3 * 4; // 3 jogadores × 4 aves
    while (guard < firstRound) {
      const cur = m.snapshot.currentPlayer;
      const hand = m.snapshot.state.hands[cur]!;
      // cada um joga suas aves no Local rico (empilha)
      m.applyMove(cur, 'placeBird', { locationId: rich.id, birdIndex: hand.length - 1 });
      guard += 1;
    }
    // após o upkeep da rodada 1, turnOrder reordenou por pontos (desc)
    const s2 = m.snapshot.state;
    expect(s2.round).toBe(2);
    const scores = s2.scores;
    for (let i = 0; i + 1 < s2.turnOrder.length; i++) {
      expect(scores[s2.turnOrder[i]!]).toBeGreaterThanOrEqual(scores[s2.turnOrder[i + 1]!]!);
    }
  });
});
