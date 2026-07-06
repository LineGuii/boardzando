import type { PlayerId } from '@boardzando/contracts';

/** Cor do bando de um jogador (Perch tem 5 cores fixas de aves). */
export type Flock = string;

/** As 5 cores de bando, atribuídas por assento. */
export const FLOCKS = ['blue', 'red', 'yellow', 'green', 'teal'] as const;

/** Hex de cada bando, para a UI pintar as fichas de ave. */
export const FLOCK_HEX: Record<string, string> = {
  blue: '#3b82f6',
  red: '#ef4444',
  yellow: '#eab308',
  green: '#22c55e',
  teal: '#14b8a6',
};

/** Instância de um Local na homestead (posição em coluna/linha p/ adjacência futura). */
export interface PerchLocation {
  id: string; // id da instância (ex.: 'loc-0')
  defId: string; // id no catálogo
  name: string;
  emoji: string;
  /** Pontos pagos ao 1º, 2º e 3º em nº de aves. */
  points: [number, number, number];
  col: number;
  row: number;
}

/** Estado em jogo de uma criatura (Fase B). */
export interface CreatureRuntime {
  defId: string;
  /** Local onde o standee está agora (undefined até ser controlada pela 1ª vez). */
  standeeLocId?: string;
  /** Jogador que controla a criatura nesta rodada (maioria no Local-casa). */
  controller?: PlayerId;
  /** Já ativada nesta rodada? (máx. 1×/rodada) */
  activatedThisRound: boolean;
}

export interface PerchState {
  round: number; // 1..maxRounds
  maxRounds: number; // 5
  step: 'perch' | 'done';

  /** Ordem de turno da rodada (recalculada por placar no Upkeep). */
  turnOrder: PlayerId[];
  /** Índice em turnOrder de quem joga a próxima ave. */
  turnPtr: number;
  /** Já colocou a ave da vez atual? (uma ave obrigatória por turno) */
  placedThisTurn: boolean;
  /** Já usou a Ação Bônus (ativar criatura) nesta vez? (máx. 1/turno) */
  bonusThisTurn: boolean;

  /** Adjacência da homestead (por colunas, sem wrap). */
  adjacency: Record<string, string[]>;
  /** Criaturas em jogo (chave = id da criatura). */
  creatures: Record<string, CreatureRuntime>;

  flockOf: Record<PlayerId, Flock>;
  /** Aves restantes no bando (Roost) de cada jogador. */
  supply: Record<PlayerId, number>;
  /** Sacola de migração: multiset de aves por bando (OCULTO). */
  bag: Record<Flock, number>;
  /** As 4 aves recrutadas de cada jogador nesta rodada (OCULTO por jogador). */
  hands: Record<PlayerId, Flock[]>;

  homestead: PerchLocation[];
  /** Aves em cada Local: locId -> bando -> contagem (persiste entre rodadas). */
  birdsAt: Record<string, Record<Flock, number>>;

  /**
   * FONTE: pirâmide de níveis (base→topo), preenchida de baixo para cima.
   * Aves removidas/zapadas caem aqui e valem pontos por nível no fim.
   */
  fountain: Flock[][];
  /** PRAÇA: aves que transbordaram da Fonte; valem 1 ponto cada no fim. */
  plaza: Flock[];
  /** Casinhas disponíveis por jogador (recebidas na rodada 4). */
  birdhouses: Record<PlayerId, number>;
  /** Raios disponíveis por jogador (recebidos na rodada 5). */
  lightning: Record<PlayerId, number>;
  /** Casinhas construídas: locId -> bando -> true (pilha protegida, +1). */
  birdhousesAt: Record<string, Record<Flock, boolean>>;

  scores: Record<PlayerId, number>;
  /** Pontos concedidos por Local no último Upkeep (para a UI destacar). */
  lastScored?: Record<string, Record<Flock, number>>;

  winnerId?: PlayerId;
  finished?: boolean;
}
