import type { BoardTile, StopConnectState, TileKind } from './stopconnect.state';

export function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

function opposite(kind: TileKind): TileKind {
  return kind === 'letter' ? 'theme' : 'letter';
}

/** As 4 células ortogonalmente vizinhas de (col,row). */
export function neighbors(col: number, row: number): Array<[number, number]> {
  return [
    [col + 1, row],
    [col - 1, row],
    [col, row + 1],
    [col, row - 1],
  ];
}

export function tileAt(state: StopConnectState, col: number, row: number): BoardTile | undefined {
  const id = state.cells[cellKey(col, row)];
  return id ? state.tiles[id] : undefined;
}

/** Peças vizinhas do tipo OPOSTO a `kind` na posição (col,row) — as que a jogada conecta. */
export function connectedOpposite(
  state: StopConnectState,
  col: number,
  row: number,
  kind: TileKind,
): BoardTile[] {
  const opp = opposite(kind);
  const out: BoardTile[] = [];
  for (const [c, r] of neighbors(col, row)) {
    const t = tileAt(state, c, r);
    if (t && t.kind === opp) out.push(t);
  }
  return out;
}

/**
 * Colocação válida: célula vazia, com ≥1 vizinho do tipo OPOSTO e NENHUM vizinho
 * do MESMO tipo (Letra nunca toca Letra; Tema nunca toca Tema).
 */
export function canPlace(
  state: StopConnectState,
  kind: TileKind,
  col: number,
  row: number,
): boolean {
  if (tileAt(state, col, row)) return false;
  let opp = 0;
  for (const [c, r] of neighbors(col, row)) {
    const t = tileAt(state, c, r);
    if (!t) continue;
    if (t.kind === kind) return false; // mesmo tipo tocando -> proibido
    opp += 1;
  }
  return opp >= 1;
}

/** Todas as células vazias onde uma peça de `kind` pode ser colocada. */
export function placeableCells(
  state: StopConnectState,
  kind: TileKind,
): Array<{ col: number; row: number }> {
  const opp = opposite(kind);
  const seen = new Set<string>();
  const out: Array<{ col: number; row: number }> = [];
  // candidatas = células vazias vizinhas de peças do tipo oposto
  for (const t of Object.values(state.tiles)) {
    if (t.kind !== opp) continue;
    for (const [c, r] of neighbors(t.col, t.row)) {
      const key = cellKey(c, r);
      if (seen.has(key)) continue;
      seen.add(key);
      if (canPlace(state, kind, c, r)) out.push({ col: c, row: r });
    }
  }
  return out;
}

/**
 * Pontuação da jogada, se APROVADA:
 * - Colocou Tema  → soma dos valores das Letras conectadas.
 * - Colocou Letra → valor da Letra × número de Temas conectados.
 */
export function scorePlacement(
  placedKind: TileKind,
  placedValue: number,
  connected: BoardTile[],
): number {
  if (placedKind === 'theme') {
    return connected.reduce((a, t) => a + (t.value ?? 0), 0);
  }
  return placedValue * connected.length;
}
