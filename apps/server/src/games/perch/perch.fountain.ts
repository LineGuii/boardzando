import type { PlayerId } from '@boardzando/contracts';
import type { Flock, PerchState } from './perch.state';

/**
 * A FONTE (Fase C): pirâmide de encaixes preenchida de baixo para cima
 * (colocação "suportada" — só sobe de nível quando o de baixo enche). Níveis
 * mais ALTOS valem mais pontos no fim do jogo. Cheia a Fonte, a ave vai para a
 * PRAÇA (1 ponto cada). Valores por nível são uma interpretação documentada
 * (o tabuleiro físico traz os números exatos).
 */
export const FOUNTAIN_CAPS = [6, 5, 4, 3, 2, 1] as const; // capacidade por nível (base→topo)
export const FOUNTAIN_PTS = [1, 2, 3, 4, 5, 6] as const; // pontos por nível (mais alto = mais)

export function emptyFountain(): Flock[][] {
  return FOUNTAIN_CAPS.map(() => []);
}

/** Envia uma ave à Fonte no nível preenchível mais baixo; se cheia, à Praça. */
export function addToFountain(state: PerchState, flock: Flock): void {
  for (let lvl = 0; lvl < FOUNTAIN_CAPS.length; lvl++) {
    state.fountain[lvl] ??= [];
    if (state.fountain[lvl]!.length < FOUNTAIN_CAPS[lvl]!) {
      state.fountain[lvl]!.push(flock);
      return;
    }
  }
  state.plaza.push(flock); // Fonte cheia → Praça
}

/** Pontuação de fim de jogo da Fonte (por nível) e da Praça (1 cada). Muta scores. */
export function scoreFountainAndPlaza(state: PerchState, players: readonly PlayerId[]): void {
  const ownerOf = (flock: Flock): PlayerId | undefined =>
    players.find((p) => state.flockOf[p] === flock);
  state.fountain.forEach((birds, lvl) => {
    const pts = FOUNTAIN_PTS[lvl] ?? 0;
    for (const f of birds) {
      const o = ownerOf(f);
      if (o) state.scores[o] = (state.scores[o] ?? 0) + pts;
    }
  });
  for (const f of state.plaza) {
    const o = ownerOf(f);
    if (o) state.scores[o] = (state.scores[o] ?? 0) + 1;
  }
}
