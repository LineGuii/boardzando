import type { GameContext, Move, PlayerId, RandomAPI } from '@boardzando/contracts';
import { INVALID_MOVE } from '@boardzando/contracts';
import { effectiveCounts, scoreLocation } from './perch.scoring';
import { applyCreatureEffect, assignCreatureControl } from './perch.creatures';
import type { CreatureActionPayload } from './perch.creatures';
import { addToFountain, scoreFountainAndPlaza } from './perch.fountain';
import { controllerAt, largestSingleFlockOwner } from './perch.board';
import { OBJECTIVE_BY_ID } from './perch.objectives';
import type { Flock, PerchState } from './perch.state';

const LARGEST_FLOCK_BONUS = 10;

/** Migração: Locais com `migrateAddBirds` deixam o controlador pôr +n na sacola. */
function applyMigrateEffects(state: PerchState): void {
  for (const loc of state.homestead) {
    if (loc.effect?.kind !== 'migrateAddBirds') continue;
    const flock = controllerAt(state, loc.id);
    if (!flock) continue;
    const owner = Object.keys(state.flockOf).find((p) => state.flockOf[p] === flock);
    if (!owner) continue;
    const add = Math.min(loc.effect.n, state.supply[owner] ?? 0);
    state.supply[owner] = (state.supply[owner] ?? 0) - add;
    state.bag[flock] = (state.bag[flock] ?? 0) + add;
  }
}

/** Upkeep: Locais com `upkeepSendToFountain` mandam n aves do controlador à Fonte. */
function applyUpkeepEffects(state: PerchState): void {
  for (const loc of state.homestead) {
    if (loc.effect?.kind !== 'upkeepSendToFountain') continue;
    const flock = controllerAt(state, loc.id);
    if (!flock || state.birdhousesAt[loc.id]?.[flock]) continue; // protegida não sai
    let sent = 0;
    while (sent < loc.effect.n && (state.birdsAt[loc.id]?.[flock] ?? 0) > 0) {
      state.birdsAt[loc.id]![flock] = (state.birdsAt[loc.id]![flock] ?? 0) - 1;
      addToFountain(state, flock);
      sent += 1;
    }
  }
}

export interface PlaceBirdPayload {
  locationId: string;
  /** Índice da ave na mão do jogador. */
  birdIndex: number;
}
export type ActivateCreaturePayload = CreatureActionPayload;
export interface BuildBirdhousePayload {
  locationId: string;
  flock: Flock;
}
export interface ZapBirdPayload {
  locationId: string;
  flock: Flock;
}
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
  applyMigrateEffects(state); // Locais que adicionam aves à sacola
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
    const counts = effectiveCounts(state.birdsAt[loc.id] ?? {}, state.birdhousesAt[loc.id], loc.nests ?? 0);
    const awards = scoreLocation(counts, loc.points);
    lastScored[loc.id] = awards;
    for (const [flock, pts] of Object.entries(awards)) {
      const owner = players.find((p) => state.flockOf[p] === flock);
      if (owner) state.scores[owner] = (state.scores[owner] ?? 0) + pts;
    }
  }
  state.lastScored = lastScored;
  applyUpkeepEffects(state); // Locais que disparam no Upkeep (ex.: mandar à Fonte)

  const prevIndex = new Map(state.turnOrder.map((p, i) => [p, i]));
  state.turnOrder = [...players].sort((a, b) => {
    const d = (state.scores[b] ?? 0) - (state.scores[a] ?? 0);
    if (d !== 0) return d;
    return (prevIndex.get(a) ?? 0) - (prevIndex.get(b) ?? 0);
  });

  assignCreatureControl(state); // controle da próxima rodada + zera "ativada"
}

/**
 * Bônus de fim de jogo (consolida a Fase D): +3 por criatura controlada, Fonte
 * (por nível), Praça (1 cada), +10 do maior bando único (sem empate) e os
 * objetivos ocultos cumpridos. Muta `state`.
 */
export function scoreEndGame(state: PerchState, players: readonly PlayerId[]): void {
  for (const cr of Object.values(state.creatures)) {
    if (cr.controller) state.scores[cr.controller] = (state.scores[cr.controller] ?? 0) + 3;
  }
  scoreFountainAndPlaza(state, players);

  const bigFlock = largestSingleFlockOwner(state);
  if (bigFlock) {
    const owner = players.find((p) => state.flockOf[p] === bigFlock);
    if (owner) state.scores[owner] = (state.scores[owner] ?? 0) + LARGEST_FLOCK_BONUS;
  }

  for (const p of players) {
    const obj = OBJECTIVE_BY_ID[state.objectives[p] ?? ''];
    if (obj && obj.check(state, p, state.flockOf[p]!)) {
      state.scores[p] = (state.scores[p] ?? 0) + obj.reward;
    }
  }
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

/** Existe alguma pilha (Local, bando) com ao menos 1 ave, não protegida? */
function anyStack(state: PerchState): boolean {
  for (const loc of state.homestead) {
    for (const [flock, n] of Object.entries(state.birdsAt[loc.id] ?? {})) {
      if (n > 0 && !state.birdhousesAt[loc.id]?.[flock]) return true;
    }
  }
  return false;
}

/** Pode ainda tomar UMA Ação Bônus nesta vez (criatura / casinha / raio)? */
function canBonus(state: PerchState, player: PlayerId): boolean {
  if (state.bonusThisTurn) return false;
  const creature = Object.values(state.creatures).some(
    (cr) => cr.controller === player && !cr.activatedThisRound && cr.standeeLocId !== undefined,
  );
  const birdhouse = state.round >= 4 && (state.birdhouses[player] ?? 0) > 0 && anyStack(state);
  const zap = state.round === 5 && (state.lightning[player] ?? 0) > 0 && anyStack(state);
  return creature || birdhouse || zap;
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
    scoreEndGame(next, ctx.players);
    next.step = 'done';
    next.finished = true;
    next.winnerId = soleTopScorer(next.scores, ctx.players);
  } else {
    // início das rodadas 4/5: distribui Casinhas / Raios
    if (next.round === 4) for (const p of ctx.players) next.birdhouses[p] = (next.birdhouses[p] ?? 0) + 1;
    if (next.round === 5) for (const p of ctx.players) next.lightning[p] = (next.lightning[p] ?? 0) + 1;
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
  const f = hand[payload.birdIndex]!;
  if (state.birdhousesAt[loc.id]?.[f]) return INVALID_MOVE; // pilha protegida: não recebe aves

  const next = clone(state);
  next.hands[ctx.actor]!.splice(payload.birdIndex, 1);
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

/**
 * MOVE (na vez, Ação Bônus — rodadas 4/5): constrói uma Casinha sobre uma pilha
 * de 1+ aves. A pilha fica protegida (sem adicionar/remover, imune a
 * criaturas/raios) e conta +1 para o bando.
 */
export const buildBirdhouse: Move<PerchState, BuildBirdhousePayload> = (state, ctx, payload) => {
  if (state.step !== 'perch' || state.finished || state.bonusThisTurn) return INVALID_MOVE;
  if (state.round < 4 || (state.birdhouses[ctx.actor] ?? 0) <= 0) return INVALID_MOVE;
  const loc = state.homestead.find((l) => l.id === payload.locationId);
  if (!loc) return INVALID_MOVE;
  if ((state.birdsAt[loc.id]?.[payload.flock] ?? 0) < 1) return INVALID_MOVE; // precisa de pilha
  if (state.birdhousesAt[loc.id]?.[payload.flock]) return INVALID_MOVE; // já tem casinha

  const next = clone(state);
  (next.birdhousesAt[loc.id] ??= {})[payload.flock] = true;
  next.birdhouses[ctx.actor] = (next.birdhouses[ctx.actor] ?? 0) - 1;
  next.bonusThisTurn = true;
  if (next.placedThisTurn) finalizeTurn(next, ctx);
  else keepTurn(next);
  return next;
};

/**
 * MOVE (na vez, Ação Bônus — rodada 5): Raio remove 1 ave de qualquer Local
 * (não protegido por Casinha) e a envia à Fonte.
 */
export const zapBird: Move<PerchState, ZapBirdPayload> = (state, ctx, payload) => {
  if (state.step !== 'perch' || state.finished || state.bonusThisTurn) return INVALID_MOVE;
  if (state.round !== 5 || (state.lightning[ctx.actor] ?? 0) <= 0) return INVALID_MOVE;
  const loc = state.homestead.find((l) => l.id === payload.locationId);
  if (!loc) return INVALID_MOVE;
  if ((state.birdsAt[loc.id]?.[payload.flock] ?? 0) < 1) return INVALID_MOVE;
  if (state.birdhousesAt[loc.id]?.[payload.flock]) return INVALID_MOVE; // protegida

  const next = clone(state);
  next.birdsAt[loc.id]![payload.flock] = (next.birdsAt[loc.id]![payload.flock] ?? 0) - 1;
  addToFountain(next, payload.flock);
  next.lightning[ctx.actor] = (next.lightning[ctx.actor] ?? 0) - 1;
  next.bonusThisTurn = true;
  if (next.placedThisTurn) finalizeTurn(next, ctx);
  else keepTurn(next);
  return next;
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
