import type { PlayerId } from './types';

/**
 * Framework de "mesa livre" (sandbox). Um jogo sandbox so define um CATALOGO de
 * pecas (placeables) e um LAYOUT inicial; nao ha regras nem turnos. Os jogadores
 * arrastam, empilham, embaralham e levam pecas para a mao livremente.
 *
 * Tipos compartilhados client/servidor para garantir que o que o servidor
 * envia bate exatamente com o que o cliente renderiza.
 */

export type PlaceableCategory =
  | 'card'
  | 'money'
  | 'token'
  | 'house'
  | 'hotel'
  | 'die'
  | 'tile'
  | 'misc';

/** Como desenhar uma face (sem assets: cor + texto + emoji). */
export interface PlaceableFace {
  label?: string;
  sub?: string;
  emoji?: string;
  color?: string;
  textColor?: string;
}

/** Descritor de um tipo de peca no catalogo do jogo. */
export interface CatalogEntry {
  typeId: string;
  category: PlaceableCategory;
  /** Pecas com o mesmo stackGroup podem ser empilhadas juntas. */
  stackGroup: string;
  front: PlaceableFace;
  /** Verso (esconde a identidade na mao / virada para baixo). */
  backId: string;
  /** Pode ir para a mao? (configuracao do jogo, por tipo). */
  canHold: boolean;
  /** Tamanho relativo (unidades de mesa; usado p/ proporcao do render). */
  w: number;
  h: number;
  /** Numero de faces de um dado (so p/ category 'die'). */
  dieFaces?: number;
}

/** Descritor de um verso compartilhado por varios typeIds. */
export interface BackEntry {
  backId: string;
  face: PlaceableFace;
}

/** Instancia concreta de uma peca na mesa (ou na mao). */
export interface Placeable {
  id: string;
  typeId: string;
  /** Coordenadas normalizadas 0..1 (ancora no canto superior esquerdo). */
  x: number;
  y: number;
  /** Ordem de empilhamento global (maior = mais a frente). */
  z: number;
  /** true = mostra a frente; false = mostra o verso (na mesa). */
  faceUp: boolean;
  rotation?: number;
  /** Setado => esta na mao deste jogador (fora da mesa). */
  ownerId?: PlayerId;
  /** Agrupamento de pilha; membros compartilham posicao. */
  stackId?: string;
  stackOrder?: number;
  /** Valor de um dado rolado, etc. */
  value?: number;
}

/** Tipo de casa num tabuleiro perimetral estilo Monopoly. */
export type BoardSpaceType =
  | 'go'
  | 'property'
  | 'railroad'
  | 'utility'
  | 'chance'
  | 'chest'
  | 'tax'
  | 'jail'
  | 'parking'
  | 'gotojail';

/** Uma casa do tabuleiro (decorativa — sem regras). */
export interface BoardSpace {
  index: number; // 0..39
  name: string;
  type: BoardSpaceType;
  /** Cor do grupo (property/railroad/utility). */
  color?: string;
  /** Preco/valor (cosmetico). */
  price?: number;
  emoji?: string;
}

/**
 * Tabuleiro perimetral (estilo Monopoly): N*N celulas, 4*(N-1) casas na borda.
 * Puramente decorativo — os placeables ficam por cima. O jogo decide se tem um.
 */
export interface SandboxBoard {
  kind: 'perimeter';
  /** Lado do grid (ex.: 11 -> 40 casas na borda). */
  size: number;
  spaces: BoardSpace[];
}

export interface SandboxState {
  /** Marcador de roteamento p/ o cliente escolher o SandboxBoard. */
  kind: 'sandbox';
  /** Config global: pecas podem ir para a mao? */
  allowHand: boolean;
  catalog: Record<string, CatalogEntry>;
  backs: Record<string, BackEntry>;
  placeables: Record<string, Placeable>;
  /** Tabuleiro de fundo opcional (o jogo fornece; decorativo). */
  board?: SandboxBoard;
  /** Proximo valor de z a atribuir. */
  zCounter: number;
}

/**
 * Versao "escondida" de uma peca, enviada pelo playerView quando o viewer nao
 * pode ver a identidade (mao alheia, ou virada para baixo na mesa).
 */
export interface HiddenPlaceable {
  id: string;
  backId: string;
  category: PlaceableCategory;
  /** Presente quando esta na mao de outro jogador. */
  ownerId?: PlayerId;
  inHand?: boolean;
  /** Presente quando virada para baixo na mesa (posicao continua publica). */
  x?: number;
  y?: number;
  z?: number;
  rotation?: number;
  stackId?: string;
  stackOrder?: number;
  faceUp?: false;
}

// ---------- payloads dos moves ----------

export interface MoveItemPayload {
  id: string;
  x: number;
  y: number;
}
export interface MoveStackPayload {
  stackId: string;
  x: number;
  y: number;
}
export interface UnstackItemPayload {
  id: string;
  x: number;
  y: number;
}
export interface FlipItemPayload {
  id: string;
}
export interface ToHandPayload {
  id: string;
}
export interface FromHandPayload {
  id: string;
  x: number;
  y: number;
  faceUp: boolean;
}
export interface StackItemPayload {
  id: string;
  ontoId: string;
}
export interface ShuffleStackPayload {
  stackId: string;
}
export interface RollDiePayload {
  id: string;
}
