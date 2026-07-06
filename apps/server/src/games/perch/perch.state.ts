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

export interface PerchState {
  round: number; // 1..maxRounds
  maxRounds: number; // 5
  step: 'perch' | 'done';

  /** Ordem de turno da rodada (recalculada por placar no Upkeep). */
  turnOrder: PlayerId[];
  /** Índice em turnOrder de quem joga a próxima ave. */
  turnPtr: number;

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

  scores: Record<PlayerId, number>;
  /** Pontos concedidos por Local no último Upkeep (para a UI destacar). */
  lastScored?: Record<string, Record<Flock, number>>;

  winnerId?: PlayerId;
  finished?: boolean;
}
