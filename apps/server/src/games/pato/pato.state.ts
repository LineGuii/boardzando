import type { PlayerId } from '@boardzando/contracts';

export type PatoStep = 'guess' | 'reveal';

export interface PatoOptions {
  /** Numero total de rodadas na partida (5/8/12). */
  roundsTotal: number;
}

export interface PatoLastRound {
  question: string;
  answer: number;
  unit: string;
  explanation: string;
  guesses: Record<PlayerId, number>;
  /** Vencedores desta rodada (mais proximos; empate divide). */
  winners: PlayerId[];
  /** Alguem cravou o valor exato? */
  exact: boolean;
  /** Pontos ganhos NESTA rodada por jogador. */
  gained: Record<PlayerId, number>;
}

export interface PatoState {
  options: PatoOptions;
  /** Indices de PATO_QUESTIONS sorteados na ordem, sem repeticao. */
  questionOrder: number[];
  /** Rodada atual (0-based). */
  roundIndex: number;
  step: PatoStep;
  /** Palpite de cada jogador na rodada atual (secreto ate o reveal). */
  guesses: Record<PlayerId, number>;
  scores: Record<PlayerId, number>;
  lastRound?: PatoLastRound;
  finished?: boolean;
}
