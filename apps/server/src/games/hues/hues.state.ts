import type { HuesCoord, HuesOptions, PlayerId } from '@boardzando/contracts';

/** Etapas de uma rodada. Avancam de pick -> cue1 -> guess1 -> cue2 -> guess2 -> reveal -> pick. */
export type HuesStep = 'pick' | 'cue1' | 'guess1' | 'cue2' | 'guess2' | 'reveal';

export interface HuesLastRound {
  target: HuesCoord;
  cueGiver: PlayerId;
  /** Pontos ganhos NESTA rodada por cada jogador (palpitadores). */
  pointsThisRound: Record<PlayerId, number>;
  /** Pontos ganhos NESTA rodada pelo cue-giver. */
  cueGiverPoints: number;
  /** Cues mostrados (para o resumo). */
  cue1?: string;
  cue2?: string;
}

export interface HuesState {
  options: HuesOptions;
  step: HuesStep;
  /** 4 alvos sorteados — visivel apenas para o cue-giver. */
  cardOptions: HuesCoord[];
  /** Alvo escolhido — secreto ate o reveal. */
  target?: HuesCoord;
  cue1?: string;
  cue2?: string;
  /** Cones colocados por cada jogador (ordem cronologica, ate 2). */
  guesses: Record<PlayerId, HuesCoord[]>;
  /** Pontuacao acumulada. */
  scores: Record<PlayerId, number>;
  /** Quantas vezes cada jogador ja foi cue-giver. */
  cueGiverCount: Record<PlayerId, number>;
  /** Total de turnos de cue-giver ate o fim (numPlayers * roundsPerPlayer). */
  targetRounds: number;
  /** Snapshot do ultimo round (para a UI mostrar pontuacao na fase reveal). */
  lastRound?: HuesLastRound;
}
