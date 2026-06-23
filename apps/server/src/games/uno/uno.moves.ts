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
export type CallUnoPayload = Record<string, never>;
export interface ContestUnoPayload {
  target: PlayerId;
}

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
  const me = ctx.actor;
  const hand = state.hands[me] ?? [];
  const card = hand.find((c) => c.id === payload.cardId);
  if (!card) return INVALID_MOVE;

  const top = state.discard[state.discard.length - 1]!;
  if (!isPlayable(card, state.activeColor, top)) return INVALID_MOVE;

  // Regra de empilhamento: enquanto ha um stack de draw2 aberto, o jogador SO
  // pode jogar outra draw2 (acumula) ou comprar com drawCard (pega o stack).
  if (state.pendingDraw > 0 && card.kind !== 'draw2') return INVALID_MOVE;

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

  // ao chegar em 1 carta, o jogador PRECISA cantar "UNO!"; abre a janela de
  // contestacao para os oponentes ate o callUno.
  if (next.hands[me]!.length === 1) {
    next.unoCalled[me] = false;
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
      // Empilha em vez de aplicar a compra imediata. A vez passa normalmente
      // para o proximo jogador (sem skipNext), que decide: empilhar outro
      // draw2 (+2) ou drawCard para pegar a pilha e perder a vez.
      next.pendingDraw = state.pendingDraw + 2;
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
 * Se houver um stack de draw2 aberto (pendingDraw > 0), compra TUDO que esta
 * acumulado, zera o stack e perde a vez normalmente.
 */
export const drawCard: Move<UnoState, DrawPayload> = (state, ctx) => {
  const me = ctx.actor;
  const next = clone(state);
  const count = state.pendingDraw > 0 ? state.pendingDraw : 1;
  const drawn = drawCards(next, ctx.random, count);
  if (drawn.length > 0) next.hands[me] = [...(next.hands[me] ?? []), ...drawn];
  if (state.pendingDraw > 0) next.pendingDraw = 0;
  return next;
};

/**
 * MOVE off-turn: o jogador canta "UNO!". So vale quando ele tem 1 carta na mao.
 * Idempotente: chamar de novo nao faz nada (e nao quebra).
 */
export const callUno: Move<UnoState, CallUnoPayload> = (state, ctx) => {
  const me = ctx.actor;
  if ((state.hands[me]?.length ?? 0) !== 1) return INVALID_MOVE;
  if (state.unoCalled[me]) return state; // ja cantou
  const next = clone(state);
  next.unoCalled[me] = true;
  return next;
};

/**
 * MOVE off-turn: outro jogador contesta um alvo que tem 1 carta e nao cantou
 * UNO. Penalidade: alvo compra 2 cartas. (Cliente atrasa o botao em 1s; o
 * servidor nao mede tempo — quem clicar primeiro entre "callUno" e "contestUno"
 * vence.)
 */
export const contestUno: Move<UnoState, ContestUnoPayload> = (state, ctx, payload) => {
  const challenger = ctx.actor;
  const target = payload.target;
  if (target === challenger) return INVALID_MOVE;
  if (!state.hands[target]) return INVALID_MOVE;
  if (state.hands[target].length !== 1) return INVALID_MOVE;
  if (state.unoCalled[target]) return INVALID_MOVE;
  const next = clone(state);
  const drawn = drawCards(next, ctx.random, 2);
  next.hands[target] = [...next.hands[target]!, ...drawn];
  // a mao saiu de 1 -> a obrigacao de UNO some naturalmente
  next.unoCalled[target] = true;
  return next;
};

/** nextPlayer do turn: respeita direcao e consome skipNext (em onBegin). */
export function unoNextPlayer(state: UnoState, ctx: GameContext): PlayerId {
  const step = state.skipNext ? 2 : 1;
  const idx = ctx.players.indexOf(ctx.currentPlayer);
  const n = ctx.players.length;
  return ctx.players[(idx + state.direction * step + n * 2) % n]!;
}
