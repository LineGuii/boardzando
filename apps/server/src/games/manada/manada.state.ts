import type { PlayerId } from '@boardzando/contracts';

/** Passo da rodada: escrever a resposta em segredo -> revelar e pontuar. */
export type ManadaStep = 'answer' | 'reveal';

export interface ManadaOptions {
  /** Vacas necessarias para vencer (escala: curto/padrao/longo). */
  targetCows: number;
}

/** Resposta de um jogador numa rodada (crua + normalizada para comparar). */
export interface ManadaAnswer {
  raw: string;
  norm: string;
}

/** Resumo do que aconteceu na rodada revelada (para a UI destacar). */
export interface ManadaRoundResult {
  themeText: string;
  answers: Record<PlayerId, ManadaAnswer>;
  /** Resposta normalizada da maioria (undefined se houve empate no topo). */
  majorityNorm?: string;
  /** Quem ganhou 1 vaca (fez parte da maioria). */
  cowWinners: PlayerId[];
  /** Empate no topo -> ninguem ganha vaca. */
  tieAtTop: boolean;
  /** Jogador que RECEBEU a Vaca Rosa nesta rodada (o unico "sobrando"). */
  pinkCowTo?: PlayerId;
  /** Se houve empate no alvo e o objetivo subiu, o novo alvo. */
  bumpedTargetTo?: number;
}

export interface ManadaState {
  options: ManadaOptions;
  /** Indices de MANADA_THEMES pre-sorteados, sem repeticao (um por rodada). */
  themeOrder: number[];
  /** Rodada atual (0-based). */
  roundIndex: number;
  step: ManadaStep;
  /** Indice (em ctx.players) do Vaqueiro da rodada — gira a cada rodada. */
  cowboyIdx: number;
  /** Respostas cruas da rodada em curso (secretas ate o reveal). */
  answers: Record<PlayerId, string>;
  /** Fichas de vaca acumuladas por jogador. */
  cows: Record<PlayerId, number>;
  /** Quem esta com a Vaca Rosa (nao pode vencer enquanto a tiver). */
  pinkCowHolder?: PlayerId;
  /** Alvo de vacas para vencer (sobe em caso de empate no topo). */
  target: number;
  lastRound?: ManadaRoundResult;
  winnerId?: PlayerId;
  finished?: boolean;
}
