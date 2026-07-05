import type { PlayerId } from '@boardzando/contracts';

/** Passo da rodada: dar dicas -> jogar cartas. */
export type ItoStep = 'clue' | 'play';

/** Um tema define a escala 1..100 (1 = `low`, 100 = `high`). */
export interface ItoTheme {
  topic: string;
  low: string;
  high: string;
}

export interface ItoCard {
  id: string; // opaco: nao deriva do valor nem do dono (segredo vai por playerView)
  value: number; // 1..100
  ownerId: PlayerId;
  /** Dica em palavras (publica) — sem revelar o numero. */
  clue?: string;
  played: boolean;
  /** Descartada por erro (carta menor deixada para tras). */
  discarded?: boolean;
  /** Ordem em que entrou na pilha de jogadas (1-based). */
  playedOrder?: number;
}

export interface ItoOptions {
  lives: number; // vidas da equipe
  maxLevel: number; // 1..3 (cartas por jogador no nivel final)
  startLevel: number; // normalmente 1
  /** Se true (default), o tema nunca se repete entre os niveis da partida. */
  uniqueThemes: boolean;
  /**
   * Modo anonimo: ninguem sabe de quem e cada carta nem quem votou nela. Na
   * fase de dicas cada um so ve as proprias cartas; ao comecar a jogar, as
   * cartas vao embaralhadas para a mesa (ver `tableOrder`).
   */
  anonymousCards: boolean;
}

export interface ItoState {
  options: ItoOptions;
  level: number; // cartas por jogador neste nivel
  maxLevel: number;
  lives: number;
  theme: ItoTheme;
  /**
   * Sequencia pre-sorteada de indices em ITO_THEMES (um por nivel, de
   * startLevel a maxLevel). Presente apenas quando options.uniqueThemes:
   * garante que nenhum tema se repita na partida.
   */
  themeOrder?: number[];
  /**
   * Ordem embaralhada dos ids das cartas na mesa (modo anonimo). Sorteada no
   * `startPlay` de cada nivel para que a posicao nao revele o dono.
   */
  tableOrder?: string[];
  step: ItoStep;
  cards: Record<string, ItoCard>;
  /**
   * Voto de cada jogador na carta que ele acha que deve ser jogada agora
   * (voter -> cardId). Coordenacao social — nao afeta as regras. Limpo a cada
   * jogada e a cada novo nivel.
   */
  votes: Record<PlayerId, string>;
  /** Ids na ordem em que foram jogados (idealmente crescente). */
  playedPile: string[];
  /** Maior valor ja jogado (0 no inicio do nivel). */
  lastPlayedValue: number;
  /** Resumo do ultimo erro, para a UI destacar. */
  lastMistake?: { count: number; byValue: number };
  /** Desfecho cooperativo quando o jogo termina. */
  outcome?: 'win' | 'lose';
}
