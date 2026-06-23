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
  /**
   * Total de cartas pendentes para compra encadeada por draw2.
   * Enquanto > 0, o jogador da vez SO pode jogar outra draw2 (acumula +2) ou
   * usar `drawCard` para "pegar o stack" (compra tudo e perde a vez).
   */
  pendingDraw: number;
  /**
   * Marca, por jogador, se ele ja "cantou" UNO. So importa quando o jogador
   * tem 1 carta na mao: se `false`, qualquer outro jogador pode `contestUno`
   * (penalidade de +2). Resetado para `false` cada vez que a mao vai a 1.
   */
  unoCalled: Record<PlayerId, boolean>;
  /** Vencedor, quando alguem zera a mao. */
  winner?: PlayerId;
}

export const UNO_COLORS: readonly UnoColor[] = ['red', 'yellow', 'green', 'blue'];
