/**
 * Catálogo de Locais (Fase A): tiles simples, sem efeitos especiais/ninhos —
 * só o essencial da pontuação por maioria com valores variáveis por tile
 * (às vezes o 2º ou 3º paga mais!). Fases futuras adicionam ninhos, efeitos,
 * criaturas (creatureHome) e objetivos.
 */
export interface PerchLocationDef {
  id: string;
  name: string;
  emoji: string;
  /** Pontos ao 1º, 2º e 3º lugar em nº de aves. */
  points: [number, number, number];
}

export const PERCH_LOCATIONS: readonly PerchLocationDef[] = [
  { id: 'pines', name: 'Pinheiros Perfumados', emoji: '🌲', points: [3, 2, 1] },
  { id: 'ash', name: 'Grande Freixo', emoji: '🌳', points: [4, 2, 1] },
  { id: 'country', name: 'Casa de Campo', emoji: '🏡', points: [2, 0, 1] },
  { id: 'elm', name: 'Olmo Solitário', emoji: '🌲', points: [5, 0, 0] },
  { id: 'earlybird', name: 'Madrugador', emoji: '🐤', points: [3, 2, 1] },
  { id: 'birdbath', name: 'Banho Feliz', emoji: '🛁', points: [2, 0, 1] },
  { id: 'oak', name: 'Poderoso Carvalho', emoji: '🌳', points: [6, 4, 0] },
  { id: 'birch', name: 'Bétulas Descascando', emoji: '🌳', points: [4, 3, 2] },
  { id: 'powerlines', name: 'Fios Balançando', emoji: '⚡', points: [3, 3, 0] },
  { id: 'rookery', name: 'A Colônia', emoji: '🪺', points: [2, 2, 2] },
  { id: 'birdhouse', name: 'Casinha Lotada', emoji: '🏠', points: [1, 3, 0] },
  { id: 'meadow', name: 'Prado Ensolarado', emoji: '🌼', points: [3, 1, 0] },
  { id: 'berry', name: 'Arbusto de Frutinhas', emoji: '🫐', points: [2, 1, 1] },
  { id: 'reeds', name: 'Juncos Altos', emoji: '🌾', points: [4, 0, 2] },
];

/**
 * Nº de Locais e layout em colunas por contagem de jogadores (do rulebook):
 * 3p → 8 tiles (colunas 3,2,3); 4p → 10 (2,3,2,3); 5p → 13 (3,2,3,2,3).
 */
export const PERCH_LAYOUT: Record<number, number[]> = {
  3: [3, 2, 3],
  4: [2, 3, 2, 3],
  5: [3, 2, 3, 2, 3],
};
