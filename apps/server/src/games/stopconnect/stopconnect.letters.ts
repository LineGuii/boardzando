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
  { letter: 'A', value: 3, count: 10 },
  { letter: 'E', value: 3, count: 10 },
  { letter: 'I', value: 3, count: 10 },
  { letter: 'O', value: 3, count: 10 },
  { letter: 'S', value: 3, count: 8 },
  { letter: 'U', value: 3, count: 7 },
  { letter: 'M', value: 3, count: 6 },
  { letter: 'R', value: 3, count: 6 },
  { letter: 'T', value: 3, count: 5 },
  { letter: 'D', value: 4, count: 5 },
  { letter: 'L', value: 4, count: 5 },
  { letter: 'C', value: 4, count: 4 },
  { letter: 'P', value: 4, count: 4 },
  { letter: 'N', value: 5, count: 4 },
  { letter: 'B', value: 5, count: 4 },
  { letter: 'F', value: 5, count: 4 },
  { letter: 'G', value: 5, count: 4 },
  { letter: 'H', value: 5, count: 4 },
  { letter: 'V', value: 5, count: 4 },
  { letter: 'J', value: 6, count: 4 },
  { letter: 'K', value: 6, count: 3 },
  { letter: 'W', value: 6, count: 3 },
  { letter: 'Y', value: 6, count: 3 },
  { letter: 'Q', value: 6, count: 3 },
  { letter: 'X', value: 7, count: 3 },
  { letter: 'Z', value: 7, count: 3 },
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
