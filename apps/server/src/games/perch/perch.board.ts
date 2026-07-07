import { controllerOf, effectiveCounts } from './perch.scoring';
import type { Flock, PerchState } from './perch.state';

/** Contagem efetiva (aves + casinha + ninhos) de um Local. */
export function effectiveAt(state: PerchState, locId: string): Record<Flock, number> {
  const loc = state.homestead.find((l) => l.id === locId);
  return effectiveCounts(state.birdsAt[locId] ?? {}, state.birdhousesAt[locId], loc?.nests ?? 0);
}

/** Bando que controla o Local (maioria isolada na contagem efetiva). */
export function controllerAt(state: PerchState, locId: string): Flock | undefined {
  return controllerOf(effectiveAt(state, locId));
}

/** Locais controlados por um bando. */
export function controlledLocationIds(state: PerchState, flock: Flock): string[] {
  return state.homestead.filter((l) => controllerAt(state, l.id) === flock).map((l) => l.id);
}

/**
 * Dono do MAIOR BANDO ÚNICO (maior pilha efetiva de uma cor num único Local).
 * Empate no topo → undefined (vale o bônus de +10 só para líder isolado).
 */
export function largestSingleFlockOwner(state: PerchState): Flock | undefined {
  let max = 0;
  let owners: Flock[] = [];
  for (const l of state.homestead) {
    for (const [f, n] of Object.entries(effectiveAt(state, l.id))) {
      if (n > max) {
        max = n;
        owners = [f];
      } else if (n === max) {
        owners.push(f);
      }
    }
  }
  const uniq = [...new Set(owners)];
  return max > 0 && uniq.length === 1 ? uniq[0] : undefined;
}

/** Locais de canto: topo e base das colunas mais à esquerda e à direita. */
export function cornerLocIds(state: PerchState): string[] {
  const cols = [...new Set(state.homestead.map((l) => l.col))].sort((a, b) => a - b);
  if (cols.length === 0) return [];
  const ids: string[] = [];
  for (const c of [cols[0]!, cols[cols.length - 1]!]) {
    const col = state.homestead.filter((l) => l.col === c).sort((a, b) => a.row - b.row);
    if (col.length) {
      ids.push(col[0]!.id);
      ids.push(col[col.length - 1]!.id);
    }
  }
  return [...new Set(ids)];
}

/** Nº de aves de um bando na Fonte. */
export function birdsInFountain(state: PerchState, flock: Flock): number {
  return state.fountain.reduce((sum, lvl) => sum + lvl.filter((f) => f === flock).length, 0);
}

/** Nº de aves de um bando na Praça. */
export function birdsInPlaza(state: PerchState, flock: Flock): number {
  return state.plaza.filter((f) => f === flock).length;
}

/** Nº de Locais distintos onde o bando tem ao menos 1 ave (aves cruas). */
export function locationsWithFlock(state: PerchState, flock: Flock): number {
  return state.homestead.filter((l) => (state.birdsAt[l.id]?.[flock] ?? 0) > 0).length;
}
