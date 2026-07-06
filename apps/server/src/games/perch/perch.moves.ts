import type { GameContext, Move, PlayerId, RandomAPI } from '@boardzando/contracts';
import { INVALID_MOVE } from '@boardzando/contracts';
import { scoreLocation } from './perch.scoring';
import { applyCreatureEffect, assignCreatureControl } from './perch.creatures';
import type { CreatureActionPayload } from './perch.creatures';
import type { Flock, PerchState } from './perch.state';

export interface PlaceBirdPayload {
  locationId: string;
  /** Índice da ave na mão do jogador. */
  birdIndex: number;
}
export type ActivateCreaturePayload = CreatureActionPayload;
export type EndTurnPayload = Record<string, never>;

function clone(state: PerchState): PerchState {
  return structuredClone(state);
}
function keepTurn(state: PerchState): PerchState {
  (state as unknown as Record<string, unknown>).__keepTurn = true;
  return state;
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

/** Migração + Recrutamento do início de rodada. Muta `state`. */
export function startRound(state: PerchState, players: readonly PlayerId[], rng: RandomAPI): void {
  for (const p of players) {
    const moved = Math.min(2, state.supply[p] ?? 0);
    state.supply[p] = (state.supply[p] ?? 0) - moved;
    const f = state.flockOf[p]!;
    state.bag[f] = (state.bag[f] ?? 0) + moved;
  }
  for (const p of state.turnOrder) {
    const drawn = drawFromBag(state.bag, rng, 2);
    const own = Math.min(2, state.supply[p] ?? 0);
    state.supply[p] = (state.supply[p] ?? 0) - own;
    const f = state.flockOf[p]!;
    state.hands[p] = [...drawn, ...Array<Flock>(own).fill(f)];
  }
}

/** Upkeep: pontua (empate-anula), reordena por placar e reatribui criaturas. */
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

  assignCreatureControl(state); // controle da próxima rodada + zera "ativada"
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

/** Pode ainda tomar a Ação Bônus (ativar criatura) nesta vez? */
function canBonus(state: PerchState, player: PlayerId): boolean {
  if (state.bonusThisTurn) return false;
  return Object.values(state.creatures).some(
    (cr) => cr.controller === player && !cr.activatedThisRound && cr.standeeLocId !== undefined,
  );
}

/** Encerra a vez: passa ao próximo, ou roda o Upkeep e a próxima rodada/fim. */
function finalizeTurn(next: PerchState, ctx: GameContext): void {
  next.placedThisTurn = false;
  next.bonusThisTurn = false;
  if (handsRemaining(next, ctx.players) > 0) {
    next.turnPtr = (next.turnPtr + 1) % ctx.players.length;
    return;
  }
  runUpkeep(next, ctx.players);
  next.round += 1;
  if (next.round > next.maxRounds) {
    // bônus de fim: +3 por criatura controlada
    for (const cr of Object.values(next.creatures)) {
      if (cr.controller) next.scores[cr.controller] = (next.scores[cr.controller] ?? 0) + 3;
    }
    next.step = 'done';
    next.finished = true;
    next.winnerId = soleTopScorer(next.scores, ctx.players);
  } else {
    startRound(next, ctx.players, ctx.random);
    next.turnPtr = 0;
  }
}

/**
 * MOVE (na vez): coloca 1 ave da mão num Local. Se o jogador ainda pode ativar
 * uma criatura (Ação Bônus), a vez continua (ele decide ativar ou passar);
 * senão a vez encerra.
 */
export const placeBird: Move<PerchState, PlaceBirdPayload> = (state, ctx, payload) => {
  if (state.step !== 'perch' || state.finished) return INVALID_MOVE;
  if (state.placedThisTurn) return INVALID_MOVE; // já colocou nesta vez
  const hand = state.hands[ctx.actor];
  if (!hand) return INVALID_MOVE;
  if (!Number.isInteger(payload.birdIndex) || payload.birdIndex < 0 || payload.birdIndex >= hand.length)
    return INVALID_MOVE;
  const loc = state.homestead.find((l) => l.id === payload.locationId);
  if (!loc) return INVALID_MOVE;

  const next = clone(state);
  const f = next.hands[ctx.actor]!.splice(payload.birdIndex, 1)[0]!;
  (next.birdsAt[loc.id] ??= {})[f] = (next.birdsAt[loc.id]![f] ?? 0) + 1;
  next.placedThisTurn = true;

  if (canBonus(next, ctx.actor)) return keepTurn(next);
  finalizeTurn(next, ctx);
  return next;
};

/**
 * MOVE (na vez, Ação Bônus): ativa uma criatura que o jogador controla — move
 * o standee e aplica o efeito. Pode ser antes ou depois de colocar a ave.
 */
export const activateCreature: Move<PerchState, ActivateCreaturePayload> = (state, ctx, payload) => {
  if (state.step !== 'perch' || state.finished) return INVALID_MOVE;
  if (state.bonusThisTurn) return INVALID_MOVE;
  const cr = state.creatures[payload.creatureId];
  if (!cr || cr.controller !== ctx.actor || cr.activatedThisRound || cr.standeeLocId === undefined)
    return INVALID_MOVE;

  const next = clone(state);
  if (!applyCreatureEffect(next, next.adjacency, payload)) return INVALID_MOVE;
  next.bonusThisTurn = true;

  if (next.placedThisTurn) {
    finalizeTurn(next, ctx);
    return next;
  }
  return keepTurn(next); // ainda precisa colocar a ave
};

/** MOVE (na vez): encerra a vez após já ter colocado a ave (bônus dispensado). */
export const endTurn: Move<PerchState, EndTurnPayload> = (state, ctx) => {
  if (state.step !== 'perch' || state.finished) return INVALID_MOVE;
  if (!state.placedThisTurn) return INVALID_MOVE; // precisa ter colocado a ave
  const next = clone(state);
  finalizeTurn(next, ctx);
  return next;
};

/** Próximo a jogar: lê a ordem de turno controlada no estado. */
export function perchNextPlayer(state: PerchState, ctx: GameContext): PlayerId {
  if (state.finished) return ctx.currentPlayer;
  return state.turnOrder[state.turnPtr] ?? state.turnOrder[0]!;
}
