/**
 * Tipos base compartilhados por todo o sistema.
 * Mantidos propositalmente "primitivos" para serem reutilizados por
 * qualquer jogo plugado sem acoplamento a regras especificas.
 */

/** Identificador de um jogador dentro de uma sala (UUID gerado no join). */
export type PlayerId = string;

/** Identificador de uma sala. */
export type RoomId = string;

/** Identificador estavel de um jogo plugavel (ex.: "uno"). */
export type GameId = string;

/** Resultado de fim de jogo. `draw` indica empate; `winner` o vencedor. */
export interface GameOverResult {
  draw?: boolean;
  winner?: PlayerId;
  /** Ranking opcional do 1o ao ultimo. */
  ranking?: PlayerId[];
  /** Espaco livre para metadados especificos do jogo (pontuacao etc.). */
  meta?: Record<string, unknown>;
}

/** Constante retornada por um move quando a jogada e invalida. */
export const INVALID_MOVE = Symbol.for('board-games/INVALID_MOVE');
export type InvalidMove = typeof INVALID_MOVE;
