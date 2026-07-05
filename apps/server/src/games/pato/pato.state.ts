import type { PlayerId } from '@boardzando/contracts';

/** Passo da rodada: leilao de lances -> reveal (apos o "Nem a Pato!"). */
export type PatoStep = 'bid' | 'reveal';

export interface PatoOptions {
  /** Numero total de rodadas na partida (5/8/12). */
  roundsTotal: number;
}

/** Um lance dito em voz alta (publico, sempre maior que o anterior). */
export interface PatoBid {
  playerId: PlayerId;
  value: number;
}

export interface PatoLastRound {
  question: string;
  answer: number;
  unit: string;
  explanation: string;
  /** Escada de lances da rodada, em ordem. */
  bids: PatoBid[];
  /** Quem gritou "Nem a Pato!". */
  callerId: PlayerId;
  /** O desafiado: quem deu o ultimo lance. */
  lastBidderId: PlayerId;
  /** O ultimo lance passou da resposta? (o caller estava certo) */
  overshot: boolean;
  /** Dono do maior lance <= resposta (+1 ponto); ausente se todos passaram. */
  winnerId?: PlayerId;
  winningValue?: number;
}

export interface PatoState {
  options: PatoOptions;
  /** Indices de PATO_QUESTIONS sorteados na ordem, sem repeticao. */
  questionOrder: number[];
  /** Rodada atual (0-based). */
  roundIndex: number;
  step: PatoStep;
  /** Lances da rodada atual, estritamente crescentes (inteiros). */
  bids: PatoBid[];
  /** Indice (em ctx.players) do jogador da vez — obrigado a dar um lance. */
  turnIdx: number;
  scores: Record<PlayerId, number>;
  lastRound?: PatoLastRound;
  finished?: boolean;
}
