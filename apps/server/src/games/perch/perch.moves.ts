import type { GameContext, Move, PlayerId, RandomAPI } from '@boardzando/contracts';
import { INVALID_MOVE } from '@boardzando/contracts';
import { scoreLocation } from './perch.scoring';
import type { Flock, PerchState } from './perch.state';

export interface PlaceBirdPayload {
  locationId: string;
  /** Índice da ave na mão do jogador. */
  birdIndex: number;
}

function clone(state: PerchState): PerchState {
  return structuredClone(state);
}

/** Saca `n` aves aleatórias da sacola, removendo-as (muta `bag`). */
export function drawFromBag(bag: Record<Flock, number>, rng: RandomAPI, n: number): Flock[] {
  const tokens: Flock[] = [];
  for (const [f, c] of Object.entries(bag)) for (let i = 0; i < c; i++) tokens.push(f);
  const shuffled = rng.shuffle(tokens);
  const drawn = shuffled.slice(0, n);
  const rest = shuffled.slice(n);
  for (const k of Object.keys(bag)) bag[k] = 0;
  for (const f of rest) bag[f] = (bag[f] ?? 0) + 1;
  return drawn;
}

/**
 * Início de rodada: Migração (cada jogador põe 2 aves na sacola) + Recrutamento
 * (cada um, em ordem de turno, saca 2 da sacola e pega 2 do próprio bando = 4).
 * Muta `state`.
 */
export function startRound(state: PerchState, players: readonly PlayerId[], rng: RandomAPI): void {
  // Migração
  for (const p of players) {
    const moved = Math.min(2, state.supply[p] ?? 0);
    state.supply[p] = (state.supply[p] ?? 0) - moved;
    const f = state.flockOf[p]!;
    state.bag[f] = (state.bag[f] ?? 0) + moved;
  }
  // Recrutamento (na ordem de turno)
  for (const p of state.turnOrder) {
    const drawn = drawFromBag(state.bag, rng, 2);
    const own = Math.min(2, state.supply[p] ?? 0);
    state.supply[p] = (state.supply[p] ?? 0) - own;
    const f = state.flockOf[p]!;
    state.hands[p] = [...drawn, ...Array<Flock>(own).fill(f)];
  }
}

/**
 * Upkeep: pontua CADA Local (cumulativo — as aves ficam no tabuleiro) com a
 * regra de empate-anula e recalcula a ordem de turno pelo placar (desc,
 * desempate estável pela ordem anterior). Muta `state`.
 */
export function runUpkeep(state: PerchState, players: readonly PlayerId[]): void {
  const lastScored: Record<string, Record<Flock, number>> = {};
  for (const loc of state.homestead) {
    const counts = state.birdsAt[loc.id] ?? {};
    const awards = scoreLocation(counts, loc.points);
    lastScored[loc.id] = awards;
    for (const [flock, pts] of Object.entries(awards)) {
      const owner = players.find((p) => state.flockOf[p] === flock);
      if (owner) state.scores[owner] = (state.scores[owner] ?? 0) + pts;
    }
  }
  state.lastScored = lastScored;

  const prevIndex = new Map(state.turnOrder.map((p, i) => [p, i]));
  state.turnOrder = [...players].sort((a, b) => {
    const d = (state.scores[b] ?? 0) - (state.scores[a] ?? 0);
    if (d !== 0) return d;
    return (prevIndex.get(a) ?? 0) - (prevIndex.get(b) ?? 0);
  });
}

function soleTopScorer(
  scores: Record<PlayerId, number>,
  players: readonly PlayerId[],
): PlayerId | undefined {
  const max = Math.max(...players.map((p) => scores[p] ?? 0));
  const leaders = players.filter((p) => (scores[p] ?? 0) === max);
  return leaders.length === 1 ? leaders[0] : undefined;
}

function handsRemaining(state: PerchState, players: readonly PlayerId[]): number {
  return players.reduce((sum, p) => sum + (state.hands[p]?.length ?? 0), 0);
}

/**
 * MOVE (na vez): o jogador da vez coloca 1 ave da mão num Local. Quando a última
 * ave da rodada é colocada, roda o Upkeep automaticamente e inicia a próxima
 * rodada (ou encerra o jogo após a 5ª).
 */
export const placeBird: Move<PerchState, PlaceBirdPayload> = (state, ctx, payload) => {
  if (state.step !== 'perch' || state.finished) return INVALID_MOVE;
  const hand = state.hands[ctx.actor];
  if (!hand) return INVALID_MOVE;
  if (!Number.isInteger(payload.birdIndex) || payload.birdIndex < 0 || payload.birdIndex >= hand.length)
    return INVALID_MOVE;
  const loc = state.homestead.find((l) => l.id === payload.locationId);
  if (!loc) return INVALID_MOVE;

  const next = clone(state);
  const f = next.hands[ctx.actor]!.splice(payload.birdIndex, 1)[0]!;
  (next.birdsAt[loc.id] ??= {})[f] = (next.birdsAt[loc.id]![f] ?? 0) + 1;

  if (handsRemaining(next, ctx.players) > 0) {
    next.turnPtr = (next.turnPtr + 1) % ctx.players.length;
  } else {
    // Fim da rodada: pontua e reordena.
    runUpkeep(next, ctx.players);
    next.round += 1;
    if (next.round > next.maxRounds) {
      next.step = 'done';
      next.finished = true;
      next.winnerId = soleTopScorer(next.scores, ctx.players);
    } else {
      startRound(next, ctx.players, ctx.random);
      next.turnPtr = 0;
    }
  }
  return next;
};

/** Próximo a jogar: lê a ordem de turno controlada no estado. */
export function perchNextPlayer(state: PerchState, ctx: GameContext): PlayerId {
  if (state.finished) return ctx.currentPlayer;
  return state.turnOrder[state.turnPtr] ?? state.turnOrder[0]!;
}
