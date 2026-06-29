import type { GameContext, Move, Placeable, SandboxState } from '@boardzando/contracts';
import {
  INVALID_MOVE,
  type FlipItemPayload,
  type FromHandPayload,
  type MoveItemPayload,
  type MoveStackPayload,
  type RollDiePayload,
  type ShuffleStackPayload,
  type StackItemPayload,
  type ToHandPayload,
  type UnstackItemPayload,
} from '@boardzando/contracts';

function clone(state: SandboxState): SandboxState {
  return structuredClone(state);
}

/** Membros de uma pilha, ordenados por stackOrder asc (base -> topo). */
function stackMembers(state: SandboxState, stackId: string): Placeable[] {
  return Object.values(state.placeables)
    .filter((p) => p.stackId === stackId)
    .sort((a, b) => (a.stackOrder ?? 0) - (b.stackOrder ?? 0));
}

function topOrder(members: Placeable[]): number {
  return members.reduce((max, p) => Math.max(max, p.stackOrder ?? 0), -1);
}

/** MOVE: posiciona uma peca livre e a traz para a frente. */
export const moveItem: Move<SandboxState, MoveItemPayload> = (state, _ctx, payload) => {
  const item = state.placeables[payload.id];
  if (!item) return INVALID_MOVE;
  const next = clone(state);
  const p = next.placeables[payload.id]!;
  p.x = payload.x;
  p.y = payload.y;
  p.z = ++next.zCounter;
  return next;
};

/** MOVE: move uma pilha inteira (preservando os offsets relativos dos membros). */
export const moveStack: Move<SandboxState, MoveStackPayload> = (state, _ctx, payload) => {
  const members = stackMembers(state, payload.stackId);
  if (members.length === 0) return INVALID_MOVE;
  const anchor = members[0]!;
  const dx = payload.x - anchor.x;
  const dy = payload.y - anchor.y;
  const next = clone(state);
  for (const m of members) {
    const p = next.placeables[m.id]!;
    p.x += dx;
    p.y += dy;
    p.z = ++next.zCounter;
  }
  return next;
};

/** MOVE: tira uma peca de uma pilha e a posiciona livre. */
export const unstackItem: Move<SandboxState, UnstackItemPayload> = (state, _ctx, payload) => {
  const item = state.placeables[payload.id];
  if (!item || !item.stackId) return INVALID_MOVE;
  const next = clone(state);
  const p = next.placeables[payload.id]!;
  p.stackId = undefined;
  p.stackOrder = undefined;
  p.x = payload.x;
  p.y = payload.y;
  p.z = ++next.zCounter;
  return next;
};

/** MOVE: vira uma peca (frente <-> verso). */
export const flipItem: Move<SandboxState, FlipItemPayload> = (state, _ctx, payload) => {
  const item = state.placeables[payload.id];
  if (!item) return INVALID_MOVE;
  const next = clone(state);
  next.placeables[payload.id]!.faceUp = !item.faceUp;
  return next;
};

/** MOVE: leva uma peca para a mao do autor (so ele vera a frente). */
export const toHand: Move<SandboxState, ToHandPayload> = (state, ctx, payload) => {
  const item = state.placeables[payload.id];
  if (!item) return INVALID_MOVE;
  if (!state.allowHand) return INVALID_MOVE;
  const entry = state.catalog[item.typeId];
  if (!entry?.canHold) return INVALID_MOVE;
  const next = clone(state);
  const p = next.placeables[payload.id]!;
  p.ownerId = ctx.actor;
  p.stackId = undefined;
  p.stackOrder = undefined;
  p.faceUp = true; // o dono passa a olhar a frente
  return next;
};

/** MOVE: coloca uma peca da mao de volta na mesa, com a face escolhida. */
export const fromHand: Move<SandboxState, FromHandPayload> = (state, ctx, payload) => {
  const item = state.placeables[payload.id];
  if (!item) return INVALID_MOVE;
  if (item.ownerId !== ctx.actor) return INVALID_MOVE;
  const next = clone(state);
  const p = next.placeables[payload.id]!;
  p.ownerId = undefined;
  p.x = payload.x;
  p.y = payload.y;
  p.z = ++next.zCounter;
  p.faceUp = payload.faceUp;
  return next;
};

/** MOVE: empilha `id` sobre `ontoId` (exige mesmo stackGroup). */
export const stackItem: Move<SandboxState, StackItemPayload> = (state, _ctx, payload) => {
  if (payload.id === payload.ontoId) return INVALID_MOVE;
  const a = state.placeables[payload.id];
  const b = state.placeables[payload.ontoId];
  if (!a || !b) return INVALID_MOVE;
  const ea = state.catalog[a.typeId];
  const eb = state.catalog[b.typeId];
  if (!ea || !eb || ea.stackGroup !== eb.stackGroup) return INVALID_MOVE;

  const next = clone(state);
  // determina o stack de destino (cria se b for solto)
  let stackId = b.stackId;
  if (!stackId) {
    stackId = `stk-${b.id}`;
    const nb = next.placeables[b.id]!;
    nb.stackId = stackId;
    nb.stackOrder = 0;
  }
  const members = stackMembers(next, stackId);
  const na = next.placeables[a.id]!;
  na.stackId = stackId;
  na.stackOrder = topOrder(members) + 1;
  na.x = next.placeables[b.id]!.x;
  na.y = next.placeables[b.id]!.y;
  na.z = ++next.zCounter;
  return next;
};

/** MOVE: embaralha a ordem de uma pilha (RNG seeded, deterministico). */
export const shuffleStack: Move<SandboxState, ShuffleStackPayload> = (state, ctx, payload) => {
  const members = stackMembers(state, payload.stackId);
  if (members.length < 2) return INVALID_MOVE;
  const next = clone(state);
  const order = ctx.random.shuffle(members.map((m) => m.id));
  order.forEach((id, i) => {
    next.placeables[id]!.stackOrder = i;
  });
  return next;
};

/** MOVE: rola um dado (define value 1..dieFaces). */
export const rollDie: Move<SandboxState, RollDiePayload> = (state, ctx, payload) => {
  const item = state.placeables[payload.id];
  if (!item) return INVALID_MOVE;
  const entry = state.catalog[item.typeId];
  if (!entry || entry.category !== 'die') return INVALID_MOVE;
  const next = clone(state);
  next.placeables[payload.id]!.value = ctx.random.int(1, entry.dieFaces ?? 6);
  return next;
};

/** Conjunto de moves do sandbox (todos off-turn). */
export function makeSandboxMoves(): Record<
  string,
  (state: SandboxState, ctx: GameContext, payload: never) => SandboxState | typeof INVALID_MOVE
> {
  return {
    moveItem,
    moveStack,
    unstackItem,
    flipItem,
    toHand,
    fromHand,
    stackItem,
    shuffleStack,
    rollDie,
  } as Record<
    string,
    (state: SandboxState, ctx: GameContext, payload: never) => SandboxState | typeof INVALID_MOVE
  >;
}

/** Todos os moves do sandbox sao off-turn (mesa sem turnos). */
export const SANDBOX_MOVE_NAMES = [
  'moveItem',
  'moveStack',
  'unstackItem',
  'flipItem',
  'toHand',
  'fromHand',
  'stackItem',
  'shuffleStack',
  'rollDie',
] as const;
