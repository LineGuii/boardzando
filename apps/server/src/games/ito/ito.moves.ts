import type { GameContext, Move, PlayerId, RandomAPI } from '@boardzando/contracts';
import { INVALID_MOVE } from '@boardzando/contracts';
import { ITO_THEMES } from './ito.themes';
import type { ItoCard, ItoState } from './ito.state';

export interface SetCluePayload {
  cardId: string;
  text: string;
}
export type StartPlayPayload = Record<string, never>;
export interface PlayLowestPayload {
  cardId: string;
}
export interface VoteCardPayload {
  cardId: string;
}

function clone(state: ItoState): ItoState {
  return structuredClone(state);
}

/** Distribui `level` cartas (valores 1..100) por jogador, num baralho fresco. */
export function dealLevel(
  state: ItoState,
  players: readonly PlayerId[],
  rng: RandomAPI,
  level: number,
): void {
  const deck = rng.shuffle(Array.from({ length: 100 }, (_, i) => i + 1));
  let idx = 0;
  const dealt: Array<{ value: number; ownerId: PlayerId }> = [];
  for (const pid of players) {
    for (let k = 0; k < level; k++) {
      dealt.push({ value: deck[idx++]!, ownerId: pid });
    }
  }
  // Ids posicionais sobre a lista RE-embaralhada: nem o id nem a ordem de
  // insercao no Record podem vazar dono/valor (o playerView esconde ambos, mas
  // um id tipo `ito-<valor>` entregaria o segredo no payload).
  const cards: Record<string, ItoCard> = {};
  rng.shuffle(dealt).forEach((c, i) => {
    const id = `ito-${i + 1}`;
    cards[id] = { id, value: c.value, ownerId: c.ownerId, played: false };
  });
  state.cards = cards;
  state.votes = {};
  state.playedPile = [];
  state.lastPlayedValue = 0;
  state.lastMistake = undefined;
  state.tableOrder = undefined;
  state.step = 'clue';
}

/** Cartas ainda em jogo (nao jogadas nem descartadas). */
function remaining(state: ItoState): ItoCard[] {
  return Object.values(state.cards).filter((c) => !c.played && !c.discarded);
}

/** MOVE (off-turn): define/atualiza a dica de uma carta propria. */
export const setClue: Move<ItoState, SetCluePayload> = (state, ctx, payload) => {
  const card = state.cards[payload.cardId];
  if (!card || card.ownerId !== ctx.actor || card.played || card.discarded) return INVALID_MOVE;
  const text = (payload.text ?? '').trim();
  if (text.length > 60) return INVALID_MOVE;
  const next = clone(state);
  next.cards[payload.cardId]!.clue = text;
  return next;
};

/** MOVE (off-turn): a equipe decide comecar a jogar as cartas. */
export const startPlay: Move<ItoState, StartPlayPayload> = (state, ctx) => {
  if (state.step !== 'clue') return INVALID_MOVE;
  const inPlay = remaining(state);
  // Modo anonimo: so comeca quando TODAS as cartas tem dica — elas vao para a
  // mesa sem dono, e uma carta sem dica seria injogavel as cegas.
  if (state.options.anonymousCards && inPlay.some((c) => !(c.clue ?? '').trim())) {
    return INVALID_MOVE;
  }
  const next = clone(state);
  next.step = 'play';
  if (next.options.anonymousCards) {
    // Mesa embaralhada: a posicao das cartas nao pode revelar o dono.
    next.tableOrder = ctx.random.shuffle(inPlay.map((c) => c.id));
  }
  return next;
};

/**
 * MOVE (off-turn): vota na carta que o jogador acha que deve ser jogada agora
 * (a propria = "quero jogar esta"; a de outro = sugestao). Toggle: votar de
 * novo na mesma carta remove o voto. Cada jogador tem 1 voto por vez.
 */
export const voteCard: Move<ItoState, VoteCardPayload> = (state, ctx, payload) => {
  if (state.step !== 'play') return INVALID_MOVE;
  const card = state.cards[payload.cardId];
  if (!card || card.played || card.discarded) return INVALID_MOVE;
  const next = clone(state);
  if (next.votes[ctx.actor] === payload.cardId) delete next.votes[ctx.actor];
  else next.votes[ctx.actor] = payload.cardId;
  return next;
};

/**
 * MOVE (off-turn): joga uma carta propria (face para cima). Erros: toda carta
 * ainda em jogo com valor MENOR que a recem-jogada e descartada e custa 1 vida.
 * Zera as vidas -> derrota. Esvaziou as cartas -> nivel concluido (avanca ou
 * vitoria final).
 */
export const playLowest: Move<ItoState, PlayLowestPayload> = (state, ctx, payload) => {
  if (state.step !== 'play') return INVALID_MOVE;
  const card = state.cards[payload.cardId];
  if (!card || card.ownerId !== ctx.actor || card.played || card.discarded) return INVALID_MOVE;

  const next = clone(state);
  const v = card.value;
  const lower = remaining(next).filter((c) => c.id !== card.id && c.value < v);

  const played = next.cards[card.id]!;
  played.played = true;
  played.playedOrder = next.playedPile.length + 1;
  next.playedPile.push(played.id);
  next.lastPlayedValue = v;
  next.votes = {}; // a situacao mudou: zera os votos

  if (lower.length > 0) {
    for (const lc of lower) next.cards[lc.id]!.discarded = true;
    next.lives -= lower.length;
    next.lastMistake = { count: lower.length, byValue: v };
  } else {
    next.lastMistake = undefined;
  }

  if (next.lives <= 0) {
    next.lives = Math.max(0, next.lives);
    next.outcome = 'lose';
    return next;
  }

  if (remaining(next).length === 0) {
    if (next.level >= next.maxLevel) {
      next.outcome = 'win';
    } else {
      next.level += 1;
      // Com uniqueThemes, segue a sequencia pre-sorteada no setup (sem
      // repeticao); senao, sorteio livre como antes.
      const orderIdx = next.level - next.options.startLevel;
      next.theme =
        next.options.uniqueThemes && next.themeOrder?.[orderIdx] !== undefined
          ? ITO_THEMES[next.themeOrder[orderIdx]!]!
          : ctx.random.pick(ITO_THEMES);
      dealLevel(next, ctx.players, ctx.random, next.level);
    }
  }
  return next;
};
