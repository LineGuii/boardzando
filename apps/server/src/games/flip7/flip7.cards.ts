/**
 * Baralho do Flip 7 (94 cartas):
 * - Números 0..12: a carta N tem N cópias (exceção: 0 e 1 têm 1 cópia cada).
 *   Total de números = 1(zero) + 1+2+...+12 = 79.
 * - Modificadores: +2, +4, +6, +8, +10, x2 (1 cada) = 6.
 * - Ações: Freeze, Flip Three, Second Chance (3 cada) = 9.
 */
export type Flip7Card =
  | { kind: 'number'; value: number } // 0..12
  | { kind: 'modifier'; mod: '+2' | '+4' | '+6' | '+8' | '+10' | 'x2' }
  | { kind: 'action'; action: 'freeze' | 'flip3' | 'second' };

export function buildDeck(): Flip7Card[] {
  const deck: Flip7Card[] = [];
  deck.push({ kind: 'number', value: 0 });
  for (let n = 1; n <= 12; n++) {
    const copies = n; // 1→1, 2→2, ... 12→12
    for (let i = 0; i < copies; i++) deck.push({ kind: 'number', value: n });
  }
  for (const mod of ['+2', '+4', '+6', '+8', '+10', 'x2'] as const) {
    deck.push({ kind: 'modifier', mod });
  }
  for (const action of ['freeze', 'flip3', 'second'] as const) {
    for (let i = 0; i < 3; i++) deck.push({ kind: 'action', action });
  }
  return deck;
}
