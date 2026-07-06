import { reachable } from './perch.adjacency';
import { controllerOf } from './perch.scoring';
import type { Flock, PerchState } from './perch.state';

/**
 * Criaturas (Fase B) — FIEL-NO-ESPÍRITO. As fontes públicas cobrem ~6 das 9
 * cartas; onde o texto exato não está disponível, a habilidade é uma
 * interpretação documentada (marcada com «interpretação»). Sistema data-driven:
 * cada criatura tem uma regra de MOVIMENTO (alcance na adjacência por colunas)
 * e um EFEITO (primitiva) aplicado no Local onde ela para.
 *
 * Controle: quem tem a maioria isolada no Local-CASA da criatura assume o
 * controle na próxima rodada (definido no Upkeep). Cada criatura é ativada no
 * máximo 1×/rodada, como Ação Bônus do controlador, na sua vez.
 *
 * Aves removidas voltam ao bando (supply) do dono — o roteamento para a Fonte
 * chega na Fase C.
 */
export type CreatureMove = 'adjacent' | 'range2' | 'range3' | 'anywhere';
export type CreatureEffectKind =
  | 'removeBirds' // remove n aves de um bando no destino
  | 'moveBird' // move 1 ave do destino para um Local adjacente
  | 'swapBirds' // troca 1 ave do destino por 1 ave de qualquer Local
  | 'pullBird' // traz 1 ave de qualquer Local ao destino (exige cor já presente)
  | 'pullAdjacent'; // traz 1 ave de um Local adjacente ao destino

export interface CreatureDef {
  id: string;
  name: string;
  emoji: string;
  homeDefId: string; // defId do Local-casa
  move: CreatureMove;
  effect: CreatureEffectKind;
  n?: number; // p/ removeBirds
  desc: string;
}

export const PERCH_CREATURES: readonly CreatureDef[] = [
  { id: 'dog', name: 'Cão', emoji: '🐶', homeDefId: 'doghouse', move: 'adjacent', effect: 'moveBird', desc: 'Move o Cão para um Local adjacente e afasta 1 ave dali para um Local vizinho.' },
  { id: 'cat', name: 'Gato', emoji: '🐱', homeDefId: 'porch', move: 'range2', effect: 'removeBirds', n: 2, desc: 'Move o Gato até 2 Locais e remove 2 aves de um bando onde ele parar.' },
  { id: 'hawk', name: 'Falcão', emoji: '🦅', homeDefId: 'hawksnest', move: 'anywhere', effect: 'removeBirds', n: 1, desc: 'Move o Falcão para qualquer Local e remove 1 ave de lá.' },
  { id: 'fox', name: 'Raposa', emoji: '🦊', homeDefId: 'foxden', move: 'range2', effect: 'removeBirds', n: 1, desc: 'Move a Raposa até 2 Locais e espanta 1 ave de lá. «interpretação»' },
  { id: 'owl', name: 'Coruja', emoji: '🦉', homeDefId: 'owlbarn', move: 'range3', effect: 'moveBird', desc: 'Move a Coruja até 3 Locais e afasta 1 ave dali para um Local vizinho.' },
  { id: 'cuckoo', name: 'Cuco', emoji: '🐦‍⬛', homeDefId: 'thornbush', move: 'adjacent', effect: 'swapBirds', desc: 'Move o Cuco para um Local adjacente e troca 1 ave de lá por 1 ave de qualquer Local.' },
  { id: 'bee', name: 'Abelha', emoji: '🐝', homeDefId: 'beehive', move: 'adjacent', effect: 'pullBird', desc: 'Move a Abelha para um Local adjacente e atrai 1 ave de qualquer Local, desde que já haja uma ave dessa cor no destino.' },
  { id: 'squirrel', name: 'Esquilo', emoji: '🐿️', homeDefId: 'oaknut', move: 'adjacent', effect: 'pullAdjacent', desc: 'Move o Esquilo para um Local adjacente e traz 1 ave de um Local vizinho para junto dele. «interpretação»' },
  { id: 'scarecrow', name: 'Espantalho', emoji: '🎃', homeDefId: 'cornfield', move: 'anywhere', effect: 'removeBirds', n: 1, desc: 'Assusta: remove 1 ave de qualquer Local. «interpretação»' },
];

export const CREATURE_BY_ID: Record<string, CreatureDef> = Object.fromEntries(
  PERCH_CREATURES.map((c) => [c.id, c]),
);
export const CREATURE_BY_HOME: Record<string, CreatureDef> = Object.fromEntries(
  PERCH_CREATURES.map((c) => [c.homeDefId, c]),
);

export function maxStepsOf(move: CreatureMove): number {
  return move === 'adjacent' ? 1 : move === 'range2' ? 2 : move === 'range3' ? 3 : Infinity;
}

/** Local-casa (instância) de uma criatura na homestead. */
export function homeLocationId(state: PerchState, creatureId: string): string | undefined {
  const def = CREATURE_BY_ID[creatureId];
  if (!def) return undefined;
  return state.homestead.find((l) => l.defId === def.homeDefId)?.id;
}

/**
 * Upkeep: (re)atribui o controle de cada criatura EM JOGO pela maioria isolada
 * no seu Local-casa, coloca o standee na casa na 1ª vez, e zera o "ativada
 * nesta rodada". Muta `state`.
 */
export function assignCreatureControl(state: PerchState): void {
  for (const [cid, cr] of Object.entries(state.creatures)) {
    const homeId = homeLocationId(state, cid);
    cr.activatedThisRound = false;
    if (!homeId) continue;
    const flock = controllerOf(state.birdsAt[homeId] ?? {});
    const owner = flock
      ? Object.keys(state.flockOf).find((p) => state.flockOf[p] === flock)
      : undefined;
    cr.controller = owner;
    if (cr.standeeLocId === undefined) cr.standeeLocId = homeId; // 1ª colocação
  }
}

function countAt(state: PerchState, locId: string, flock: Flock): number {
  return state.birdsAt[locId]?.[flock] ?? 0;
}
function removeOne(state: PerchState, locId: string, flock: Flock): boolean {
  const c = countAt(state, locId, flock);
  if (c <= 0) return false;
  state.birdsAt[locId]![flock] = c - 1;
  return true;
}
function addOne(state: PerchState, locId: string, flock: Flock): void {
  (state.birdsAt[locId] ??= {})[flock] = countAt(state, locId, flock) + 1;
}
function toSupply(state: PerchState, flock: Flock): void {
  const owner = Object.keys(state.flockOf).find((p) => state.flockOf[p] === flock);
  if (owner) state.supply[owner] = (state.supply[owner] ?? 0) + 1;
}

export interface CreatureActionPayload {
  creatureId: string;
  /** Local onde a criatura para (destino do movimento). */
  toLocationId: string;
  /** Bando alvo no destino (para remover/mover/trocar/atrair). */
  targetFlock?: Flock;
  /** Local secundário (adjacente p/ mover/esquilo; qualquer p/ trocar/abelha). */
  secondLocationId?: string;
  /** Bando no Local secundário (para a troca). */
  secondFlock?: Flock;
}

/**
 * Valida e aplica o efeito da criatura. Retorna true se ok, false se ilegal
 * (o move traduz false em INVALID_MOVE). Muta `state`.
 */
export function applyCreatureEffect(
  state: PerchState,
  adj: Record<string, string[]>,
  payload: CreatureActionPayload,
): boolean {
  const cr = state.creatures[payload.creatureId];
  const def = CREATURE_BY_ID[payload.creatureId];
  if (!cr || !def || cr.standeeLocId === undefined) return false;
  const dest = payload.toLocationId;
  if (!state.homestead.some((l) => l.id === dest)) return false;

  // movimento: destino deve ser alcançável a partir do standee atual
  const reach = reachable(adj, cr.standeeLocId, maxStepsOf(def.move));
  if (!reach.has(dest)) return false;

  const tf = payload.targetFlock;
  switch (def.effect) {
    case 'removeBirds': {
      if (!tf) return false;
      let removed = 0;
      for (let i = 0; i < (def.n ?? 1); i++) {
        if (removeOne(state, dest, tf)) {
          toSupply(state, tf);
          removed += 1;
        }
      }
      if (removed === 0) return false; // precisa remover ao menos 1
      break;
    }
    case 'moveBird': {
      if (!tf || !payload.secondLocationId) return false;
      const to2 = payload.secondLocationId;
      if (!(adj[dest] ?? []).includes(to2)) return false; // vizinho do destino
      if (!removeOne(state, dest, tf)) return false;
      addOne(state, to2, tf);
      break;
    }
    case 'swapBirds': {
      if (!tf || !payload.secondLocationId || !payload.secondFlock) return false;
      const loc2 = payload.secondLocationId;
      if (loc2 === dest) return false;
      if (countAt(state, dest, tf) <= 0 || countAt(state, loc2, payload.secondFlock) <= 0)
        return false;
      removeOne(state, dest, tf);
      removeOne(state, loc2, payload.secondFlock);
      addOne(state, loc2, tf);
      addOne(state, dest, payload.secondFlock);
      break;
    }
    case 'pullBird': {
      // Abelha: exige cor já presente no destino (color matching)
      if (!tf || !payload.secondLocationId) return false;
      if (countAt(state, dest, tf) <= 0) return false;
      if (!removeOne(state, payload.secondLocationId, tf)) return false;
      addOne(state, dest, tf);
      break;
    }
    case 'pullAdjacent': {
      if (!tf || !payload.secondLocationId) return false;
      const from = payload.secondLocationId;
      if (!(adj[dest] ?? []).includes(from)) return false; // vizinho do destino
      if (!removeOne(state, from, tf)) return false;
      addOne(state, dest, tf);
      break;
    }
    default:
      return false;
  }

  cr.standeeLocId = dest;
  cr.activatedThisRound = true;
  return true;
}
