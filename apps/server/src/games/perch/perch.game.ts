import { Injectable } from '@nestjs/common';
import type { GameContext, GameDefinition, GameOverResult, PlayerId } from '@boardzando/contracts';
import { INVALID_MOVE } from '@boardzando/contracts';
import { GamePlugin } from '../../core/registry/game-plugin.decorator';
import {
  activateCreature,
  buildBirdhouse,
  endTurn,
  perchNextPlayer,
  placeBird,
  startRound,
  zapBird,
} from './perch.moves';
import type {
  ActivateCreaturePayload,
  BuildBirdhousePayload,
  EndTurnPayload,
  PlaceBirdPayload,
  ZapBirdPayload,
} from './perch.moves';
import { computeAdjacency } from './perch.adjacency';
import { CREATURE_BY_HOME, PERCH_CREATURES } from './perch.creatures';
import { emptyFountain, FOUNTAIN_PTS } from './perch.fountain';
import { PERCH_CREATURE_HOMES, PERCH_LAYOUT, PERCH_LOCATIONS } from './perch.locations';
import { FLOCK_HEX, FLOCKS } from './perch.state';
import type { CreatureRuntime, Flock, PerchLocation, PerchState } from './perch.state';

type PerchMovePayload =
  | PlaceBirdPayload
  | ActivateCreaturePayload
  | BuildBirdhousePayload
  | ZapBirdPayload
  | EndTurnPayload;

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
    const birdhouses: Record<PlayerId, number> = {};
    const lightning: Record<PlayerId, number> = {};
    players.forEach((p, i) => {
      flockOf[p] = FLOCKS[i % FLOCKS.length]!;
      supply[p] = BIRDS_PER_FLOCK;
      scores[p] = 0;
      birdhouses[p] = 0;
      lightning[p] = 0;
    });

    // Monta a homestead: inclui K Locais-CASA de criatura (K = nº de jogadores)
    // + Locais básicos, embaralhados nas colunas conforme a contagem.
    const layout = PERCH_LAYOUT[players.length] ?? PERCH_LAYOUT[3]!;
    const tileCount = layout.reduce((a, b) => a + b, 0);
    const creatureHomes = ctx.random.shuffle(PERCH_CREATURE_HOMES).slice(0, players.length);
    const basics = ctx.random
      .shuffle(PERCH_LOCATIONS)
      .slice(0, tileCount - creatureHomes.length);
    const chosen = ctx.random.shuffle([...creatureHomes, ...basics]);
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

    // Criaturas em jogo = as que têm o Local-casa presente na homestead.
    const creatures: Record<string, CreatureRuntime> = {};
    for (const l of homestead) {
      const def = CREATURE_BY_HOME[l.defId];
      if (def) creatures[def.id] = { defId: def.id, activatedThisRound: false };
    }

    const state: PerchState = {
      round: 1,
      maxRounds: MAX_ROUNDS,
      step: 'perch',
      turnOrder: [...players],
      turnPtr: 0,
      placedThisTurn: false,
      bonusThisTurn: false,
      adjacency: computeAdjacency(homestead),
      creatures,
      flockOf,
      supply,
      bag: {},
      hands: {},
      homestead,
      birdsAt,
      fountain: emptyFountain(),
      plaza: [],
      birdhouses,
      lightning,
      birdhousesAt: {},
      scores,
    };
    // Migração + Recrutamento da 1ª rodada.
    startRound(state, players, ctx.random);
    state.turnPtr = 0;
    return state;
  }

  readonly moves = {
    placeBird,
    activateCreature,
    buildBirdhouse,
    zapBird,
    endTurn,
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

    // Criaturas com os metadados de catálogo para a UI.
    const creatures: Record<string, unknown> = {};
    for (const c of PERCH_CREATURES) {
      const cr = state.creatures[c.id];
      if (!cr) continue;
      const home = state.homestead.find((l) => l.defId === c.homeDefId);
      creatures[c.id] = {
        id: c.id,
        name: c.name,
        emoji: c.emoji,
        desc: c.desc,
        move: c.move,
        effect: c.effect,
        n: c.n,
        homeLocId: home?.id,
        standeeLocId: cr.standeeLocId,
        controller: cr.controller,
        activatedThisRound: cr.activatedThisRound,
      };
    }

    return {
      round: state.round,
      maxRounds: state.maxRounds,
      step: state.step,
      turnOrder: state.turnOrder,
      placedThisTurn: state.placedThisTurn,
      bonusThisTurn: state.bonusThisTurn,
      adjacency: state.adjacency,
      creatures,
      flockOf: state.flockOf,
      flockHex: FLOCK_HEX,
      homestead: state.homestead,
      birdsAt: state.birdsAt,
      birdhousesAt: state.birdhousesAt,
      fountain: state.fountain,
      fountainPts: FOUNTAIN_PTS,
      plaza: state.plaza,
      birdhouses: state.birdhouses,
      lightning: state.lightning,
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
