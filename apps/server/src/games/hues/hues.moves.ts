import type { GameContext, HuesCoord, Move, PlayerId, RandomAPI } from '@boardzando/contracts';
import {
  HUES_COLS,
  HUES_CUE_BLOCKLIST,
  HUES_ROWS,
  INVALID_MOVE,
  huesConePoints,
  huesInsideFrame,
  isValidHuesCoord,
} from '@boardzando/contracts';
import type { HuesState, HuesStep } from './hues.state';

// ---------- payloads ----------

export interface SelectColorPayload {
  /** Indice 0..3 sobre cardOptions. */
  index: number;
}

export interface SubmitCuePayload {
  text: string;
}

export interface PlaceConePayload {
  col: number;
  row: number;
}

export type FinalizeRoundPayload = Record<string, never>;

// ---------- helpers ----------

function clone(state: HuesState): HuesState {
  return structuredClone(state);
}

/** Sorteia 4 alvos distintos. */
export function rollCardOptions(rng: RandomAPI): HuesCoord[] {
  const picks: HuesCoord[] = [];
  const seen = new Set<string>();
  while (picks.length < 4) {
    const col = rng.int(0, HUES_COLS - 1);
    const row = rng.int(0, HUES_ROWS - 1);
    const key = `${col},${row}`;
    if (seen.has(key)) continue;
    seen.add(key);
    picks.push({ col, row });
  }
  return picks;
}

/** Normaliza texto para a checagem da blocklist: lowercase + sem acentos. */
function normalizeWord(w: string): string {
  return w
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function splitWords(text: string): string[] {
  return text.trim().split(/\s+/).filter((w) => w.length > 0);
}

function hasBlocklistedWord(text: string): boolean {
  const words = splitWords(text).map(normalizeWord);
  const set = new Set(HUES_CUE_BLOCKLIST.map(normalizeWord));
  return words.some((w) => set.has(w));
}

/** Identifica todos os palpitadores (excluindo o cue-giver). */
function guessers(state: HuesState, ctx: GameContext): PlayerId[] {
  return ctx.players.filter((p) => p !== ctx.currentPlayer);
}

function expectedConesPerGuesser(step: HuesStep): number {
  if (step === 'guess1') return 1;
  if (step === 'guess2') return 2;
  return 0;
}

function allGuessersDone(state: HuesState, ctx: GameContext, step: HuesStep): boolean {
  const need = expectedConesPerGuesser(step);
  return guessers(state, ctx).every((p) => (state.guesses[p]?.length ?? 0) >= need);
}

// ---------- moves ----------

/** Cue-giver escolhe 1 dos 4 alvos. */
export const selectColor: Move<HuesState, SelectColorPayload> = (state, ctx, payload) => {
  if (ctx.actor !== ctx.currentPlayer) return INVALID_MOVE;
  if (state.step !== 'pick') return INVALID_MOVE;
  const idx = payload.index;
  if (!Number.isInteger(idx) || idx < 0 || idx >= state.cardOptions.length) {
    return INVALID_MOVE;
  }
  const next = clone(state);
  next.target = next.cardOptions[idx];
  next.step = 'cue1';
  (next as unknown as Record<string, unknown>).__keepTurn = true;
  return next;
};

/** Cue-giver envia a dica da fase corrente (cue1 ou cue2). */
export const submitCue: Move<HuesState, SubmitCuePayload> = (state, ctx, payload) => {
  if (ctx.actor !== ctx.currentPlayer) return INVALID_MOVE;
  if (state.step !== 'cue1' && state.step !== 'cue2') return INVALID_MOVE;
  const text = (payload.text ?? '').trim();
  if (text.length === 0 || text.length > 80) return INVALID_MOVE;
  const words = splitWords(text);
  const expected = state.step === 'cue1' ? 1 : 2;
  if (words.length !== expected) return INVALID_MOVE;
  if (hasBlocklistedWord(text)) return INVALID_MOVE;

  const next = clone(state);
  if (state.step === 'cue1') {
    next.cue1 = text;
    next.step = 'guess1';
  } else {
    next.cue2 = text;
    next.step = 'guess2';
  }
  (next as unknown as Record<string, unknown>).__keepTurn = true;
  return next;
};

/**
 * Palpitador coloca um cone. Off-turn (qualquer jogador exceto o cue-giver).
 * Mantem `__keepTurn = true` para o engine nao avancar o turno do cue-giver.
 * Quando todos os palpitadores completam a fase, avanca de guess1 -> cue2 ou
 * de guess2 -> reveal.
 */
export const placeCone: Move<HuesState, PlaceConePayload> = (state, ctx, payload) => {
  const me = ctx.actor;
  if (me === ctx.currentPlayer) return INVALID_MOVE;
  if (state.step !== 'guess1' && state.step !== 'guess2') return INVALID_MOVE;
  const cone: HuesCoord = { col: payload.col, row: payload.row };
  if (!isValidHuesCoord(cone)) return INVALID_MOVE;

  const need = expectedConesPerGuesser(state.step);
  const have = state.guesses[me]?.length ?? 0;
  if (have >= need) return INVALID_MOVE;

  const next = clone(state);
  next.guesses[me] = [...(next.guesses[me] ?? []), cone];

  if (allGuessersDone(next, ctx, next.step)) {
    next.step = next.step === 'guess1' ? 'cue2' : 'reveal';
  }
  // off-turn moves ja nao avancam o turno; setamos por seguranca/intencao.
  (next as unknown as Record<string, unknown>).__keepTurn = true;
  return next;
};

/** Cue-giver fecha a rodada: pontua, prepara a proxima e cede a vez. */
export const finalizeRound: Move<HuesState, FinalizeRoundPayload> = (state, ctx) => {
  if (ctx.actor !== ctx.currentPlayer) return INVALID_MOVE;
  if (state.step !== 'reveal') return INVALID_MOVE;
  if (!state.target) return INVALID_MOVE;
  const target = state.target;

  const next = clone(state);
  const pointsThisRound: Record<PlayerId, number> = {};
  let cueGiverPoints = 0;
  for (const p of ctx.players) {
    if (p === ctx.currentPlayer) continue;
    const cones = next.guesses[p] ?? [];
    let total = 0;
    for (const cone of cones) {
      total += huesConePoints(target, cone);
      if (huesInsideFrame(target, cone)) cueGiverPoints += 1;
    }
    pointsThisRound[p] = total;
    next.scores[p] = (next.scores[p] ?? 0) + total;
  }
  next.scores[ctx.currentPlayer] =
    (next.scores[ctx.currentPlayer] ?? 0) + cueGiverPoints;
  next.cueGiverCount[ctx.currentPlayer] =
    (next.cueGiverCount[ctx.currentPlayer] ?? 0) + 1;

  next.lastRound = {
    target,
    cueGiver: ctx.currentPlayer,
    pointsThisRound,
    cueGiverPoints,
    cue1: next.cue1,
    cue2: next.cue2,
  };

  // prepara proxima rodada
  next.step = 'pick';
  next.target = undefined;
  next.cue1 = undefined;
  next.cue2 = undefined;
  next.guesses = {};
  for (const p of ctx.players) next.guesses[p] = [];
  next.cardOptions = rollCardOptions(ctx.random);

  // move normal: engine avanca o turno -> proximo cue-giver assume.
  return next;
};
