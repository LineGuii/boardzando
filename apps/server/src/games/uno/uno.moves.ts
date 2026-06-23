import type { GameContext, Move, PlayerId } from '@boardzando/contracts';
import { INVALID_MOVE } from '@boardzando/contracts';
import { drawCards, isPlayable } from './uno.deck';
import type { UnoCard, UnoColor, UnoState } from './uno.state';

/** Payloads dos moves do UNO. */
export interface PlayCardPayload {
  cardId: string;
  /** Obrigatorio ao jogar um curinga: a cor escolhida. */
  chosenColor?: UnoColor;
}
export type DrawPayload = Record<string, never>;

function clone(state: UnoState): UnoState {
  return structuredClone(state);
}

function playerAfter(players: readonly PlayerId[], current: PlayerId, dir: 1 | -1): PlayerId {
  const idx = players.indexOf(current);
  return players[(idx + dir + players.length) % players.length]!;
}

/**
 * MOVE: jogar uma carta. Reducer puro — valida posse, legalidade e aplica os
 * efeitos das cartas especiais (skip / reverse / draw2 / wild / wild_draw4).
 */
export const playCard: Move<UnoState, PlayCardPayload> = (state, ctx, payload) => {
  const me = ctx.currentPlayer;
  const hand = state.hands[me] ?? [];
  const card = hand.find((c) => c.id === payload.cardId);
  if (!card) return INVALID_MOVE;

  const top = state.discard[state.discard.length - 1]!;
  if (!isPlayable(card, state.activeColor, top)) return INVALID_MOVE;

  const isWild = card.color === 'wild';
  if (isWild && !payload.chosenColor) return INVALID_MOVE; // curinga exige cor

  const next = clone(state);
  // remove a carta da mao e descarta
  next.hands[me] = (next.hands[me] ?? []).filter((c) => c.id !== card.id);
  next.discard.push(card);
  next.activeColor = isWild ? payload.chosenColor! : (card.color as UnoColor);

  // vitoria
  if (next.hands[me]!.length === 0) {
    next.winner = me;
    return next;
  }

  // efeitos
  const twoPlayers = ctx.players.length === 2;
  switch (card.kind) {
    case 'skip':
      next.skipNext = true;
      break;
    case 'reverse':
      next.direction = (next.direction * -1) as 1 | -1;
      if (twoPlayers) next.skipNext = true; // com 2 jogadores, reverse = skip
      break;
    case 'draw2': {
      const victim = playerAfter(ctx.players, me, next.direction);
      next.hands[victim] = [...(next.hands[victim] ?? []), ...drawCards(next, ctx.random, 2)];
      next.skipNext = true;
      break;
    }
    case 'wild_draw4': {
      const victim = playerAfter(ctx.players, me, next.direction);
      next.hands[victim] = [...(next.hands[victim] ?? []), ...drawCards(next, ctx.random, 4)];
      next.skipNext = true;
      break;
    }
    default:
      break;
  }
  return next;
};

/**
 * MOVE: comprar uma carta. Regra simplificada: comprar encerra o turno.
 */
export const drawCard: Move<UnoState, DrawPayload> = (state, ctx) => {
  const me = ctx.currentPlayer;
  const next = clone(state);
  const [card] = drawCards(next, ctx.random, 1);
  if (card) next.hands[me] = [...(next.hands[me] ?? []), card];
  return next;
};

/** nextPlayer do turn: respeita direcao e consome skipNext (em onBegin). */
export function unoNextPlayer(state: UnoState, ctx: GameContext): PlayerId {
  const step = state.skipNext ? 2 : 1;
  const idx = ctx.players.indexOf(ctx.currentPlayer);
  const n = ctx.players.length;
  return ctx.players[(idx + state.direction * step + n * 2) % n]!;
}
