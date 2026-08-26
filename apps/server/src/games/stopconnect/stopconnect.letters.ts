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
  { letter: 'A', value: 2, count: 3 },
  { letter: 'C', value: 2, count: 3 },
  { letter: 'R', value: 2, count: 3 },
  { letter: 'E', value: 2, count: 2 },
  { letter: 'I', value: 4, count: 2 },
  { letter: 'O', value: 3, count: 2 },
  { letter: 'S', value: 4, count: 2 },
  { letter: 'L', value: 3, count: 2 },
  { letter: 'U', value: 5, count: 2 },
  { letter: 'N', value: 3, count: 2 },
  { letter: 'M', value: 3, count: 2 },
  { letter: 'T', value: 4, count: 2 },
  { letter: 'V', value: 3, count: 2 },
  { letter: 'D', value: 3, count: 2 },
  { letter: 'P', value: 3, count: 2 },
  { letter: 'B', value: 3, count: 2 },
  { letter: 'F', value: 3, count: 2 },
  { letter: 'G', value: 5, count: 2 },
  { letter: 'H', value: 5, count: 2 },
  { letter: 'J', value: 4, count: 2 },
  { letter: 'W', value: 4, count: 2 },
  { letter: 'Q', value: 6, count: 2 },
  { letter: 'Z', value: 5, count: 2 },
  { letter: 'K', value: 6, count: 1 },
  { letter: 'X', value: 6, count: 1 },
  { letter: 'Y', value: 7, count: 1 },
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
