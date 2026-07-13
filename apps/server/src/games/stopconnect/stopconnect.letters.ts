import type { LetterTile } from './stopconnect.state';

export interface LetterSpec {
  letter: string;
  value: number;
  count: number;
}

/**
 * Distribuição das Letras inspirada no Scrabble PT-BR: letras comuns valem pouco
 * e aparecem muito; letras raras (Q, X, Z…) valem mais. O valor aparece embaixo
 * da letra na peça e é o que pontua.
 */
export const LETTER_SPECS: LetterSpec[] = [
  { letter: 'A', value: 1, count: 14 },
  { letter: 'E', value: 1, count: 11 },
  { letter: 'I', value: 1, count: 10 },
  { letter: 'O', value: 1, count: 10 },
  { letter: 'S', value: 1, count: 8 },
  { letter: 'U', value: 1, count: 7 },
  { letter: 'M', value: 1, count: 6 },
  { letter: 'R', value: 1, count: 6 },
  { letter: 'T', value: 1, count: 5 },
  { letter: 'D', value: 2, count: 5 },
  { letter: 'L', value: 2, count: 5 },
  { letter: 'C', value: 2, count: 4 },
  { letter: 'P', value: 2, count: 4 },
  { letter: 'N', value: 3, count: 4 },
  { letter: 'B', value: 3, count: 3 },
  { letter: 'F', value: 4, count: 2 },
  { letter: 'G', value: 4, count: 2 },
  { letter: 'H', value: 4, count: 2 },
  { letter: 'V', value: 4, count: 2 },
  { letter: 'J', value: 5, count: 2 },
  { letter: 'K', value: 5, count: 1 },
  { letter: 'W', value: 5, count: 1 },
  { letter: 'Y', value: 5, count: 1 },
  { letter: 'Q', value: 6, count: 1 },
  { letter: 'X', value: 8, count: 1 },
  { letter: 'Z', value: 8, count: 1 },
];

/** Gera o multiset de peças de Letra (a pilha de compra, antes de embaralhar). */
export function buildLetterBag(): LetterTile[] {
  const bag: LetterTile[] = [];
  for (const s of LETTER_SPECS) {
    for (let i = 0; i < s.count; i++) bag.push({ letter: s.letter, value: s.value });
  }
  return bag;
}

/** Mapa letra -> valor (útil para a UI). */
export const LETTER_VALUES: Record<string, number> = Object.fromEntries(
  LETTER_SPECS.map((s) => [s.letter, s.value]),
);
