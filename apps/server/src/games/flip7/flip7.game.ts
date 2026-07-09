import { Injectable } from '@nestjs/common';
import type { GameContext, GameDefinition, GameOverResult, PlayerId } from '@boardzando/contracts';
import { INVALID_MOVE } from '@boardzando/contracts';
import { GamePlugin } from '../../core/registry/game-plugin.decorator';
import {
  flip7NextPlayer,
  giveSecond,
  hit,
  resolveAction,
  shuffledDeck,
  stay,
} from './flip7.moves';
import type {
  GiveSecondPayload,
  HitPayload,
  ResolveActionPayload,
  StayPayload,
} from './flip7.moves';
import type { Flip7Options, Flip7PlayerState, Flip7State } from './flip7.state';

type Flip7MovePayload = HitPayload | StayPayload | ResolveActionPayload | GiveSecondPayload;

const DEFAULTS: Flip7Options = { targetScore: 200 };

function readOptions(raw: unknown): Flip7Options {
  const o = (raw ?? {}) as Partial<Flip7Options>;
  const t = o.targetScore;
  const targetScore = t === 100 || t === 200 || t === 300 ? t : DEFAULTS.targetScore;
  return { targetScore };
}

/**
 * Flip 7 (The Op) — jogo de "empurre a sorte". Vire cartas de número: uma
 * duplicata te faz ESTOURAR (0 na rodada); 7 números únicos = FLIP 7 (+15 e
 * encerra a rodada). Modificadores (+2..+10, x2) e cartas de ação (Freeze,
 * Flip Three, Segunda Chance) apimentam. Vence quem chegar ao alvo (padrão 200)
 * ao fim de uma rodada. Turn-based; info aberta (só o baralho é secreto).
 */
@Injectable()
@GamePlugin()
export class Flip7Game implements GameDefinition<Flip7State, Flip7MovePayload> {
  readonly id = 'flip7';
  readonly name = 'Flip 7';
  readonly minPlayers = 2;
  readonly maxPlayers = 8;

  setup(ctx: GameContext, setupData?: unknown): Flip7State {
    const options = readOptions(setupData);
    const players: Record<PlayerId, Flip7PlayerState> = {};
    const totals: Record<PlayerId, number> = {};
    for (const p of ctx.players) {
      players[p] = { numbers: [], modifiers: [], secondChance: false, status: 'active' };
      totals[p] = 0;
    }
    return {
      options,
      deck: shuffledDeck(ctx.random),
      discard: [],
      order: [...ctx.players],
      turnPtr: 0,
      dealerIdx: 0,
      round: 1,
      players,
      totals,
    };
  }

  readonly moves = {
    hit,
    stay,
    resolveAction,
    giveSecond,
  } as Record<string, (state: Flip7State, ctx: GameContext, payload: Flip7MovePayload) => Flip7State | typeof INVALID_MOVE>;

  turn = {
    nextPlayer: flip7NextPlayer,
  };

  endIf(state: Flip7State): GameOverResult | void {
    if (!state.finished) return;
    const ranking = [...state.order].sort((a, b) => (state.totals[b] ?? 0) - (state.totals[a] ?? 0));
    if (state.winnerId) {
      return { winner: state.winnerId, ranking, meta: { totals: state.totals } };
    }
    return { draw: true, ranking, meta: { totals: state.totals } };
  }

  /** Tudo é aberto (cartas face para cima); só o baralho fica secreto (contagem). */
  playerView(state: Flip7State, ctx: GameContext, _viewer: PlayerId): unknown {
    return {
      options: state.options,
      round: state.round,
      order: state.order,
      players: state.players,
      totals: state.totals,
      turnPlayerId: ctx.players[state.turnPtr],
      dealerId: ctx.players[state.dealerIdx],
      pending: state.pending,
      deckCount: state.deck.length,
      discardCount: state.discard.length,
      lastEvent: state.lastEvent,
      lastRound: state.lastRound,
      targetScore: state.options.targetScore,
      winnerId: state.winnerId,
      finished: state.finished,
    };
  }
}
