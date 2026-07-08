import type { PerchLocation } from './perch.state';

/**
 * Adjacência da homestead POR COLUNAS (sem "dar a volta": a coluna mais à
 * esquerda e a mais à direita NÃO são vizinhas). Regra:
 * - Mesma coluna: linhas consecutivas são adjacentes.
 * - Colunas vizinhas (col ± 1): dois tiles são adjacentes se seus intervalos
 *   verticais (row/altura da coluna) se sobrepõem — respeita o escalonamento
 *   das colunas de alturas diferentes.
 * Determinístico e planar; base para o movimento das criaturas.
 */
export function computeAdjacency(homestead: readonly PerchLocation[]): Record<string, string[]> {
  const byCol = new Map<number, PerchLocation[]>();
  for (const l of homestead) (byCol.get(l.col) ?? byCol.set(l.col, []).get(l.col)!).push(l);
  for (const col of byCol.values()) col.sort((a, b) => a.row - b.row);

  const heightOf = (col: number): number => byCol.get(col)?.length ?? 0;
  const span = (l: PerchLocation): [number, number] => {
    const h = heightOf(l.col) || 1;
    return [l.row / h, (l.row + 1) / h];
  };
  const overlaps = (a: PerchLocation, b: PerchLocation): boolean => {
    const [at, ab] = span(a);
    const [bt, bb] = span(b);
    return Math.min(ab, bb) - Math.max(at, bt) > 1e-9;
  };

  const adj: Record<string, Set<string>> = {};
  for (const l of homestead) adj[l.id] = new Set();
  const link = (a: string, b: string): void => {
    adj[a]!.add(b);
    adj[b]!.add(a);
  };

  // mesma coluna: consecutivos
  for (const col of byCol.values()) {
    for (let i = 0; i + 1 < col.length; i++) link(col[i]!.id, col[i + 1]!.id);
  }
  // colunas vizinhas: sobreposição de intervalo
  for (const l of homestead) {
    for (const cc of [l.col - 1, l.col + 1]) {
      for (const other of byCol.get(cc) ?? []) {
        if (overlaps(l, other)) link(l.id, other.id);
      }
    }
  }

  const out: Record<string, string[]> = {};
  for (const [id, set] of Object.entries(adj)) out[id] = [...set];
  return out;
}

/**
 * Conjunto de Locais alcançáveis a partir de `start` em 1..maxSteps passos
 * (BFS), excluindo o próprio start. `maxSteps = Infinity` = qualquer Local.
 */
export function reachable(
  adj: Record<string, string[]>,
  start: string,
  maxSteps: number,
): Set<string> {
  if (!Number.isFinite(maxSteps)) {
    // "qualquer Local" (exceto o atual)
    const all = new Set(Object.keys(adj));
    all.delete(start);
    return all;
  }
  const seen = new Set<string>([start]);
  let frontier = [start];
  for (let step = 0; step < maxSteps; step++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const nb of adj[id] ?? []) {
        if (!seen.has(nb)) {
          seen.add(nb);
          next.push(nb);
        }
      }
    }
    frontier = next;
  }
  seen.delete(start);
  return seen;
}
