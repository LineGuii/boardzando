import type { PlayerId } from '@boardzando/contracts';
import type { Flip7Card } from './flip7.cards';

/** Situação de um jogador na rodada. */
export type Flip7Status = 'active' | 'stayed' | 'busted' | 'frozen';

export interface Flip7PlayerState {
  /** Números únicos colecionados nesta rodada (duplicata = bust). */
  numbers: number[];
  /** Modificadores (+2..+10, x2) — não contam para o Flip 7. */
  modifiers: string[];
  /** Tem uma Segunda Chance guardada? (salva de um bust) */
  secondChance: boolean;
  status: Flip7Status;
}

/** Interação pendente que mantém a vez do jogador (escolha de alvo). */
export type Flip7Pending =
  | { kind: 'action'; action: 'freeze' | 'flip3'; chooser: PlayerId }
  | { kind: 'giveSecond'; chooser: PlayerId };

export interface Flip7Options {
  /** Pontuação-alvo para vencer (padrão 200). */
  targetScore: number;
}

export interface Flip7RoundResult {
  gained: Record<PlayerId, number>; // pontos da rodada por jogador
  busted: PlayerId[];
  flip7By?: PlayerId;
}

export interface Flip7State {
  options: Flip7Options;
  deck: Flip7Card[];
  discard: Flip7Card[];
  order: PlayerId[]; // assentos (ordem fixa)
  turnPtr: number; // índice em `order` do jogador da vez
  dealerIdx: number; // quem "abre" a rodada (gira a cada rodada)
  round: number;
  players: Record<PlayerId, Flip7PlayerState>;
  totals: Record<PlayerId, number>; // acumulado entre rodadas
  pending?: Flip7Pending;
  /** Log curto do último evento, para a UI narrar. */
  lastEvent?: string;
  lastRound?: Flip7RoundResult;
  winnerId?: PlayerId;
  finished?: boolean;
}
