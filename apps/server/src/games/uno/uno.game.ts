import { Injectable } from '@nestjs/common';
import type { GameContext, GameDefinition, PlayerId } from '@boardzando/contracts';
import { GamePlugin } from '../../core/registry/game-plugin.decorator';
import { buildDeck, drawCards } from './uno.deck';
import { drawCard, playCard, unoNextPlayer } from './uno.moves';
import type { UnoColor, UnoState } from './uno.state';

/**
 * Plugin UNO. Implementa GameDefinition<UnoState>. O core nunca importa esta
 * classe diretamente: ela e descoberta via @GamePlugin pelo GameRegistry.
 *
 * A regra de "dizer UNO", penalidade por nao dizer e o desafio do wild_draw4
 * foram deixados como exercicio (ver skill add-game-plugin) para manter o
 * exemplo focado no contrato.
 */
@Injectable()
@GamePlugin()
export class UnoGame implements GameDefinition<UnoState> {
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
    };

    // 7 cartas por jogador
    for (const playerId of ctx.players) {
      state.hands[playerId] = drawCards(state, ctx.random, 7);
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

  moves = {
    playCard,
    drawCard,
  };

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
    };
  }
}
