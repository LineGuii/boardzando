/**
 * Geometria e cores do tabuleiro do Hues & Cues. Compartilhado entre servidor
 * e cliente para garantir que o pixel onde o palpitador clica == o pixel que o
 * servidor pontua. NAO depende de runtime, side-effects, nem DOM — pode ser
 * importado por reducers puros.
 */

export const HUES_COLS = 30; // 0..29
export const HUES_ROWS = 16; // 0..15

export interface HuesCoord {
  col: number;
  row: number;
}

/**
 * Cor de uma celula (col, row) -> HSL. Deterministica.
 *
 *  - Hue: varia linearmente com a coluna (0..360).
 *  - Lightness: varia com a linha — topo claro (95%) -> base escura (10%).
 *  - Saturation: alta no miolo, cai nas extremidades de lightness
 *    para refletir o tabuleiro fisico onde os topos sao pastel e a base
 *    e quase preta.
 */
export function cellHsl(col: number, row: number): { h: number; s: number; l: number } {
  const h = (col / HUES_COLS) * 360;
  // l de ~95% (topo) a ~10% (base)
  const l = 95 - (row / (HUES_ROWS - 1)) * 85;
  // saturation cai quando l se afasta de 50 (cores muito claras ou muito
  // escuras ficam quase cinzas)
  const lDist = Math.abs(l - 50) / 50; // 0 no meio, 1 nas pontas
  const s = 100 - lDist * 35; // 65..100
  return { h, s, l };
}

/** Conveniencia: string CSS `hsl(...)` para usar em background/fill. */
export function cellColor(col: number, row: number): string {
  const { h, s, l } = cellHsl(col, row);
  return `hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%)`;
}

/** Distancia de Chebyshev (anel quadrado) entre duas coordenadas. */
export function chebyshev(a: HuesCoord, b: HuesCoord): number {
  return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));
}

/** Distancia de Manhattan (usada na borda externa "ortogonal"). */
export function manhattan(a: HuesCoord, b: HuesCoord): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

/**
 * Pontos que um cone vale na pontuacao de Hues & Cues.
 *   3 → exatamente sobre o alvo
 *   2 → dentro da moldura 3x3 (Chebyshev <= 1, mas != alvo)
 *   1 → borda externa "ortogonal" (Manhattan == 2 ao redor do alvo — i.e.
 *       as 4 celulas N/S/L/O imediatamente fora do 3x3; sem diagonais).
 *   0 → caso contrario.
 */
export function huesConePoints(target: HuesCoord, cone: HuesCoord): 0 | 1 | 2 | 3 {
  if (target.col === cone.col && target.row === cone.row) return 3;
  if (chebyshev(target, cone) <= 1) return 2;
  if (manhattan(target, cone) === 2 && chebyshev(target, cone) === 2) return 1;
  return 0;
}

/** Verdadeiro se o cone esta dentro da moldura 3x3 (inclusive o alvo). */
export function huesInsideFrame(target: HuesCoord, cone: HuesCoord): boolean {
  return chebyshev(target, cone) <= 1;
}

/** Coordenada valida no tabuleiro? */
export function isValidHuesCoord(c: HuesCoord): boolean {
  return (
    Number.isInteger(c.col) &&
    Number.isInteger(c.row) &&
    c.col >= 0 &&
    c.col < HUES_COLS &&
    c.row >= 0 &&
    c.row < HUES_ROWS
  );
}

/** Opcoes da partida (definidas pelo host ao iniciar). */
export interface HuesOptions {
  /** Quantas vezes cada jogador sera cue-giver antes do fim. */
  roundsPerPlayer: 1 | 2 | 3;
  /** Se true, palpitadores veem os cones dos outros em tempo real. */
  liveGuesses: boolean;
}

export const HUES_DEFAULT_OPTIONS: HuesOptions = {
  roundsPerPlayer: 2,
  liveGuesses: true,
};

/**
 * Lista pequena de palavras proibidas em dicas (nomes basicos de cor e
 * "claro/escuro"). Mantida pt-BR; o servidor compara case-insensitive,
 * ignorando acentos.
 */
export const HUES_CUE_BLOCKLIST: readonly string[] = [
  // cores basicas
  'vermelho', 'vermelha',
  'verde',
  'azul',
  'amarelo', 'amarela',
  'laranja',
  'roxo', 'roxa',
  'rosa',
  'marrom',
  'preto', 'preta',
  'branco', 'branca',
  'cinza',
  'ciano',
  'magenta',
  'violeta',
  // modificadores proibidos
  'claro', 'clara',
  'escuro', 'escura',
];
