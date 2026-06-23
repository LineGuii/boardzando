import { Injectable } from '@nestjs/common';
import type { GameContext, GameDefinition, PlayerId } from '@boardzando/contracts';
import { INVALID_MOVE } from '@boardzando/contracts';
import { GamePlugin } from '../../core/registry/game-plugin.decorator';
import { buildDeck, drawCards } from './uno.deck';
import { callUno, contestUno, drawCard, playCard, unoNextPlayer } from './uno.moves';
import type {
  CallUnoPayload,
  ContestUnoPayload,
  DrawPayload,
  PlayCardPayload,
} from './uno.moves';
import type { UnoColor, UnoState } from './uno.state';

/**
 * Plugin UNO. Implementa GameDefinition<UnoState>. O core nunca importa esta
 * classe diretamente: ela e descoberta via @GamePlugin pelo GameRegistry.
 *
 * A regra de "dizer UNO", penalidade por nao dizer e o desafio do wild_draw4
 * foram deixados como exercicio (ver skill add-game-plugin) para manter o
 * exemplo focado no contrato.
 */
type UnoMovePayload = PlayCardPayload | DrawPayload | CallUnoPayload | ContestUnoPayload;

@Injectable()
@GamePlugin()
export class UnoGame implements GameDefinition<UnoState, UnoMovePayload> {
  readonly id = 'uno';
  readonly name = 'UNO';
  readonly minPlayers = 2;
  readonly maxPlayers = 10;

  setup(ctx: GameContext): UnoState {
    const deck = ctx.random.shuffle(buildDeck());
    const state: UnoState = {
      deck,
      discard: [],
      hands: {},
      activeColor: 'red',
      direction: 1,
      skipNext: false,
      pendingDraw: 0,
      unoCalled: {},
    };

    // 7 cartas por jogador
    for (const playerId of ctx.players) {
      state.hands[playerId] = drawCards(state, ctx.random, 7);
      // comecam com 7 -> sem obrigacao de cantar UNO; flag so importa quando mao = 1
      state.unoCalled[playerId] = true;
    }

    // vira a primeira carta (garante que nao seja curinga, por simplicidade)
    let first = drawCards(state, ctx.random, 1)[0]!;
    while (first.color === 'wild') {
      state.deck.unshift(first);
      state.deck = ctx.random.shuffle(state.deck);
      first = drawCards(state, ctx.random, 1)[0]!;
    }
    state.discard.push(first);
    state.activeColor = first.color as UnoColor;
    return state;
  }

  readonly moves = {
    playCard,
    drawCard,
    callUno,
    contestUno,
  } as Record<string, (state: UnoState, ctx: GameContext, payload: UnoMovePayload) => UnoState | typeof INVALID_MOVE>;

  /** callUno e contestUno podem ser invocados por qualquer jogador a qualquer hora. */
  readonly offTurnMoves = ['callUno', 'contestUno'] as const;

  turn = {
    nextPlayer: unoNextPlayer,
    // consome o skip ao iniciar o turno do proximo jogador
    onBegin: (state: UnoState): UnoState =>
      state.skipNext ? { ...state, skipNext: false } : state,
  };

  endIf(state: UnoState) {
    if (state.winner) return { winner: state.winner };
  }

  /** Esconde a mao dos oponentes; expoe apenas a contagem de cartas. */
  playerView(state: UnoState, _ctx: GameContext, playerId: PlayerId) {
    const opponents: Record<PlayerId, number> = {};
    for (const [pid, hand] of Object.entries(state.hands)) {
      if (pid !== playerId) opponents[pid] = hand.length;
    }
    return {
      myHand: state.hands[playerId] ?? [],
      opponents,
      topCard: state.discard[state.discard.length - 1],
      activeColor: state.activeColor,
      direction: state.direction,
      deckCount: state.deck.length,
      pendingDraw: state.pendingDraw,
      /** Para a UI decidir quem ja cantou UNO (chave -> bool). */
      unoCalled: state.unoCalled,
    };
  }
}
