import type { RandomAPI } from '@board-games/contracts';
import { UNO_COLORS, type UnoCard, type UnoColor, type UnoState } from './uno.state';

/** Monta um baralho UNO padrao (108 cartas). Ids estaveis para referencia. */
export function buildDeck(): UnoCard[] {
  const cards: UnoCard[] = [];
  let n = 0;
  const add = (c: Omit<UnoCard, 'id'>) => cards.push({ ...c, id: `c${n++}` });

  for (const color of UNO_COLORS) {
    add({ color, kind: 'number', value: 0 }); // um unico zero por cor
    for (let v = 1; v <= 9; v++) {
      add({ color, kind: 'number', value: v });
      add({ color, kind: 'number', value: v });
    }
    for (const kind of ['skip', 'reverse', 'draw2'] as const) {
      add({ color, kind });
      add({ color, kind });
    }
  }
  for (let i = 0; i < 4; i++) {
    add({ color: 'wild', kind: 'wild' });
    add({ color: 'wild', kind: 'wild_draw4' });
  }
  return cards;
}

/** Compra `count` cartas do topo do deck, reembaralhando o descarte se preciso. */
export function drawCards(state: UnoState, random: RandomAPI, count: number): UnoCard[] {
  const drawn: UnoCard[] = [];
  for (let i = 0; i < count; i++) {
    if (state.deck.length === 0) reshuffleDiscardIntoDeck(state, random);
    const card = state.deck.pop();
    if (!card) break; // sem cartas em lugar nenhum (raro)
    drawn.push(card);
  }
  return drawn;
}

/** Reembaralha o descarte (menos o topo) de volta no deck. */
export function reshuffleDiscardIntoDeck(state: UnoState, random: RandomAPI): void {
  const top = state.discard.pop();
  state.deck = random.shuffle(state.discard);
  state.discard = top ? [top] : [];
}

/** Uma carta e jogavel sobre o topo atual? */
export function isPlayable(card: UnoCard, topColor: UnoColor, top: UnoCard): boolean {
  if (card.color === 'wild') return true;
  if (card.color === topColor) return true;
  if (card.kind === 'number' && top.kind === 'number') return card.value === top.value;
  if (card.kind !== 'number' && card.kind === top.kind) return true;
  return false;
}
