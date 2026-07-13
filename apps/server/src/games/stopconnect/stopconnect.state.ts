import type { PlayerId } from '@boardzando/contracts';

export type TileKind = 'letter' | 'theme';

/** Uma peça de Letra na mão / no baralho (letra + valor tipo Scrabble). */
export interface LetterTile {
  letter: string;
  value: number;
}

/** Uma peça colocada (ou semeada) na mesa, com posição na grade. */
export interface BoardTile {
  id: string;
  kind: TileKind;
  col: number;
  row: number;
  /** kind === 'letter' */
  letter?: string;
  value?: number;
  /** kind === 'theme' */
  theme?: string;
  /** quem colocou; undefined = semente inicial da mesa. */
  placedBy?: PlayerId;
}

/** Mão de um jogador: sempre 1 Letra + 1 Tema. */
export interface Hand {
  letter: LetterTile;
  theme: string;
}

export type StopConnectStep = 'place' | 'answer' | 'judging' | 'reveal';

export type Verdict = 'approve' | 'reject';

/** Jogada em andamento: peça colocada + respostas + votos dos juízes. */
export interface StopConnectPending {
  placedTileId: string;
  placedKind: TileKind;
  col: number;
  row: number;
  /** ids das peças vizinhas do tipo oposto que a jogada conectou. */
  connectedTileIds: string[];
  /** uma resposta por peça conectada (preenchida no passo 'answer'). */
  answers: string[];
  /** voto de cada juiz. */
  votes: Record<PlayerId, Verdict>;
  approved?: boolean;
  points?: number;
}

export interface StopConnectOptions {
  /** Total que dispara o último turno (padrão 50). */
  targetScore: number;
}

export interface StopConnectState {
  options: StopConnectOptions;
  order: PlayerId[];
  /** peças na mesa por id. */
  tiles: Record<string, BoardTile>;
  /** "col,row" -> tileId (lookup de adjacência). */
  cells: Record<string, string>;
  nextTileId: number;
  /** pilhas de compra (ocultas no playerView). */
  letterBag: LetterTile[];
  themeBag: string[];
  /** mãos secretas (só a do próprio viewer vai no playerView). */
  hands: Record<PlayerId, Hand>;
  scores: Record<PlayerId, number>;
  step: StopConnectStep;
  pending?: StopConnectPending;
  /** quem disparou o último turno ao atingir o alvo. */
  lastTurnBy?: PlayerId;
  /** turnos restantes após o disparo (os demais jogam uma vez cada). */
  finalTurnsRemaining?: number;
  lastEvent?: string;
  winnerId?: PlayerId;
  finished?: boolean;
}
