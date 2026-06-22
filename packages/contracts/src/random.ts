/**
 * Contrato de RNG injetado nos moves. NUNCA use Math.random dentro da logica
 * de jogo: o RNG vive no servidor, e seeded e seu estado e persistido junto
 * com o estado do jogo, garantindo partidas deterministicas e replayaveis
 * (mesmo principio do `random` do boardgame.io).
 */
export interface RandomAPI {
  /** Float em [0, 1). */
  next(): number;
  /** Inteiro em [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Rola um dado de `sides` lados (1..sides). */
  die(sides: number): number;
  /** Retorna uma copia embaralhada (Fisher-Yates) sem mutar o array original. */
  shuffle<T>(items: readonly T[]): T[];
  /** Escolhe um elemento aleatorio. */
  pick<T>(items: readonly T[]): T;
}
