import type { RandomAPI } from '@board-games/contracts';

/**
 * RNG deterministico (mulberry32). Vive no servidor. O `state` e serializavel,
 * o que permite persistir a partida e reproduzi-la exatamente. NUNCA exponha
 * o estado do RNG no playerView, ou clientes poderao prever cartas futuras.
 */
export class SeededRandom implements RandomAPI {
  private state: number;

  constructor(seed: number) {
    // garante inteiro 32-bit nao-zero
    this.state = seed >>> 0 || 0x9e3779b9;
  }

  /** Exporta o estado interno para persistencia. */
  getState(): number {
    return this.state;
  }

  static fromState(state: number): SeededRandom {
    const r = new SeededRandom(1);
    (r as unknown as { state: number }).state = state >>> 0;
    return r;
  }

  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  die(sides: number): number {
    return this.int(1, sides);
  }

  shuffle<T>(items: readonly T[]): T[] {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    }
    return arr;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('pick() em colecao vazia');
    return items[this.int(0, items.length - 1)]!;
  }
}
