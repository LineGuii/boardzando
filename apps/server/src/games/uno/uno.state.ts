import type { PlayerId } from '@boardzando/contracts';

export type UnoColor = 'red' | 'yellow' | 'green' | 'blue';
export type CardKind = 'number' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild_draw4';

export interface UnoCard {
  id: string;
  /** 'wild' para curingas; cor concreta para as demais. */
  color: UnoColor | 'wild';
  kind: CardKind;
  /** Apenas para cartas numericas (0-9). */
  value?: number;
}

export interface UnoState {
  deck: UnoCard[];
  /** Pilha de descarte; o topo e o ultimo elemento. */
  discard: UnoCard[];
  hands: Record<PlayerId, UnoCard[]>;
  /** Cor ativa (importa apos um curinga). */
  activeColor: UnoColor;
  /** 1 = sentido horario, -1 = anti-horario. */
  direction: 1 | -1;
  /** Se o proximo jogador deve ser pulado (consumido em turn.onBegin). */
  skipNext: boolean;
  /** Vencedor, quando alguem zera a mao. */
  winner?: PlayerId;
}

export const UNO_COLORS: readonly UnoColor[] = ['red', 'yellow', 'green', 'blue'];
