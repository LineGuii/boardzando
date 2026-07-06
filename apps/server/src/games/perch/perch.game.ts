import { Injectable } from '@nestjs/common';
import type { GameContext, GameDefinition, GameOverResult, PlayerId } from '@boardzando/contracts';
import { INVALID_MOVE } from '@boardzando/contracts';
import { GamePlugin } from '../../core/registry/game-plugin.decorator';
import { perchNextPlayer, placeBird, startRound } from './perch.moves';
import type { PlaceBirdPayload } from './perch.moves';
import { PERCH_LAYOUT, PERCH_LOCATIONS } from './perch.locations';
import { FLOCK_HEX, FLOCKS } from './perch.state';
import type { Flock, PerchLocation, PerchState } from './perch.state';

type PerchMovePayload = PlaceBirdPayload;

const BIRDS_PER_FLOCK = 28;
const MAX_ROUNDS = 5;

/**
 * "Perch" — controle de área ("battle of the birds"). Fase A (núcleo jogável):
 * 5 rodadas de Migrar → Recrutar → Empoleirar → Manutenção. Cada jogador
 * coloca 4 aves por rodada (2 sacadas da sacola comum, de qualquer cor, + 2 do
 * próprio bando) nos Locais. Pontua-se por maioria com valores variáveis por
 * tile e **empates que se anulam**; a ordem de turno é refeita pelo placar a
 * cada rodada. Vence quem tiver mais pontos após a 5ª rodada.
 *
 * Criaturas, Fonte/Praça, Casinhas, Raios e objetivos entram nas fases B–D.
 */
@Injectable()
@GamePlugin()
export class PerchGame implements GameDefinition<PerchState, PerchMovePayload> {
  readonly id = 'perch';
  readonly name = 'Perch 🐦';
  readonly minPlayers = 3;
  readonly maxPlayers = 5;

  setup(ctx: GameContext): PerchState {
    const players = ctx.players;
    const flockOf: Record<PlayerId, Flock> = {};
    const supply: Record<PlayerId, number> = {};
    const scores: Record<PlayerId, number> = {};
    players.forEach((p, i) => {
      flockOf[p] = FLOCKS[i % FLOCKS.length]!;
      supply[p] = BIRDS_PER_FLOCK;
      scores[p] = 0;
    });

    // Monta a homestead em colunas conforme a contagem de jogadores.
    const layout = PERCH_LAYOUT[players.length] ?? PERCH_LAYOUT[3]!;
    const tileCount = layout.reduce((a, b) => a + b, 0);
    const chosen = ctx.random.shuffle(PERCH_LOCATIONS).slice(0, tileCount);
    const homestead: PerchLocation[] = [];
    let idx = 0;
    layout.forEach((height, col) => {
      for (let row = 0; row < height; row++) {
        const def = chosen[idx]!;
        homestead.push({
          id: `loc-${idx}`,
          defId: def.id,
          name: def.name,
          emoji: def.emoji,
          points: def.points,
          col,
          row,
        });
        idx += 1;
      }
    });
    const birdsAt: Record<string, Record<Flock, number>> = {};
    for (const l of homestead) birdsAt[l.id] = {};

    const state: PerchState = {
      round: 1,
      maxRounds: MAX_ROUNDS,
      step: 'perch',
      turnOrder: [...players],
      turnPtr: 0,
      flockOf,
      supply,
      bag: {},
      hands: {},
      homestead,
      birdsAt,
      scores,
    };
    // Migração + Recrutamento da 1ª rodada.
    startRound(state, players, ctx.random);
    state.turnPtr = 0;
    return state;
  }

  readonly moves = {
    placeBird,
  } as Record<string, (state: PerchState, ctx: GameContext, payload: PerchMovePayload) => PerchState | typeof INVALID_MOVE>;

  turn = {
    nextPlayer: perchNextPlayer,
  };

  endIf(state: PerchState): GameOverResult | void {
    if (!state.finished) return;
    const players = Object.keys(state.scores);
    const ranking = [...players].sort((a, b) => (state.scores[b] ?? 0) - (state.scores[a] ?? 0));
    if (state.winnerId) {
      return { winner: state.winnerId, ranking, meta: { scores: state.scores } };
    }
    return { draw: true, ranking, meta: { scores: state.scores } };
  }

  /**
   * Esconde a SACOLA (só o total) e as MÃOS alheias (só a contagem). Expõe o
   * tabuleiro, pontos, ordem de turno e a própria mão.
   */
  playerView(state: PerchState, _ctx: GameContext, viewer: PlayerId): unknown {
    const handCounts: Record<PlayerId, number> = {};
    for (const [pid, h] of Object.entries(state.hands)) handCounts[pid] = h.length;
    const bagCount = Object.values(state.bag).reduce((a, b) => a + b, 0);
    return {
      round: state.round,
      maxRounds: state.maxRounds,
      step: state.step,
      turnOrder: state.turnOrder,
      flockOf: state.flockOf,
      flockHex: FLOCK_HEX,
      homestead: state.homestead,
      birdsAt: state.birdsAt,
      scores: state.scores,
      lastScored: state.lastScored,
      supply: state.supply,
      myHand: state.hands[viewer] ?? [],
      handCounts,
      bagCount,
      winnerId: state.winnerId,
      finished: state.finished,
    };
  }
}
