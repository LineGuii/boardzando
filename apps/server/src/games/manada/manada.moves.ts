import type { Move, PlayerId } from '@boardzando/contracts';
import { INVALID_MOVE } from '@boardzando/contracts';
import { MANADA_THEMES } from './manada.themes';
import type { ManadaAnswer, ManadaRoundResult, ManadaState } from './manada.state';

export interface SubmitAnswerPayload {
  text: string;
}
export type NextRoundPayload = Record<string, never>;

function clone(state: ManadaState): ManadaState {
  return structuredClone(state);
}

/**
 * Normaliza uma resposta para comparacao FLEXIVEL: minusculas, sem acentos,
 * sem pontuacao das bordas, espacos colapsados. Assim "Ketchup", "ketchup " e
 * "KETCHUP" contam como a mesma resposta.
 */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos (marcas diacriticas)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // pontuacao -> espaco
    .trim()
    .replace(/\s+/g, ' ');
}

function themeText(state: ManadaState): string {
  return MANADA_THEMES[state.themeOrder[state.roundIndex]!]!;
}

/**
 * Resolve a rodada quando TODOS responderam. Regras (do manual):
 * - Maioria: se ha UM unico grupo com a maior contagem, todos dele ganham +1
 *   vaca. Empate no topo -> ninguem ganha.
 * - Vaca Rosa: se EXATAMENTE um jogador ficou sozinho (resposta unica), ela
 *   passa para ele; senao permanece com o dono atual.
 * - Vitoria: entre quem NAO tem a Vaca Rosa, se o lider isolado atinge o alvo,
 *   vence; empate no alvo sobe o alvo em 1.
 * Muta `next` no lugar (o chamador ja clonou).
 */
function resolveRound(next: ManadaState, players: readonly PlayerId[]): void {
  const answers: Record<PlayerId, ManadaAnswer> = {};
  const counts = new Map<string, number>();
  for (const p of players) {
    const raw = next.answers[p] ?? '';
    const norm = normalize(raw);
    answers[p] = { raw, norm };
    // respostas vazias nao "batem" com ninguem: cada uma conta isolada
    if (norm.length > 0) counts.set(norm, (counts.get(norm) ?? 0) + 1);
  }

  // ---- maioria ----
  let maxCount = 0;
  for (const c of counts.values()) if (c > maxCount) maxCount = c;
  const topNorms = [...counts.entries()].filter(([, c]) => c === maxCount).map(([n]) => n);
  const tieAtTop = maxCount < 2 || topNorms.length !== 1;
  const majorityNorm = tieAtTop ? undefined : topNorms[0];

  const cowWinners: PlayerId[] = [];
  if (majorityNorm) {
    for (const p of players) {
      if (answers[p]!.norm === majorityNorm) {
        next.cows[p] = (next.cows[p] ?? 0) + 1;
        cowWinners.push(p);
      }
    }
  }

  // ---- vaca rosa: o unico "sobrando" (resposta singleton) ----
  const singletons = players.filter((p) => {
    const norm = answers[p]!.norm;
    return norm.length > 0 && counts.get(norm) === 1;
  });
  let pinkCowTo: PlayerId | undefined;
  if (singletons.length === 1) {
    pinkCowTo = singletons[0];
    next.pinkCowHolder = pinkCowTo;
  }

  // ---- vitoria ----
  let bumpedTargetTo: number | undefined;
  const eligible = players.filter((p) => p !== next.pinkCowHolder);
  let topCows = 0;
  for (const p of eligible) if ((next.cows[p] ?? 0) > topCows) topCows = next.cows[p] ?? 0;
  if (topCows >= next.target) {
    const leaders = eligible.filter((p) => (next.cows[p] ?? 0) === topCows);
    if (leaders.length === 1) {
      next.winnerId = leaders[0];
      next.finished = true;
    } else {
      next.target = topCows + 1; // empate no alvo: sobe o objetivo
      bumpedTargetTo = next.target;
    }
  }

  const result: ManadaRoundResult = {
    themeText: themeText(next),
    answers,
    majorityNorm,
    cowWinners,
    tieAtTop,
    pinkCowTo,
    bumpedTargetTo,
  };
  next.lastRound = result;
  next.step = 'reveal';
}

/**
 * MOVE (off-turn): o jogador escreve sua resposta secreta da rodada. Quando
 * todos responderam, resolve a rodada automaticamente.
 */
export const submitAnswer: Move<ManadaState, SubmitAnswerPayload> = (state, ctx, payload) => {
  if (state.step !== 'answer') return INVALID_MOVE;
  if (state.answers[ctx.actor] !== undefined) return INVALID_MOVE; // ja respondeu
  const text = (payload.text ?? '').trim();
  if (text.length === 0 || text.length > 40) return INVALID_MOVE;

  const next = clone(state);
  next.answers[ctx.actor] = text;

  if (ctx.players.every((p) => next.answers[p] !== undefined)) {
    resolveRound(next, ctx.players);
  }
  return next;
};

/**
 * MOVE (off-turn): avanca para a proxima rodada. Gira o Vaqueiro. Bloqueado se
 * o jogo ja acabou.
 */
export const nextRound: Move<ManadaState, NextRoundPayload> = (state, ctx) => {
  if (state.step !== 'reveal' || state.winnerId) return INVALID_MOVE;
  const next = clone(state);
  next.roundIndex += 1;
  // Se (improvavel) o banco de temas se esgotar, encerra sem vencedor.
  if (next.roundIndex >= next.themeOrder.length) {
    next.finished = true;
    return next;
  }
  next.cowboyIdx = next.roundIndex % ctx.players.length;
  next.answers = {};
  next.lastRound = undefined;
  next.step = 'answer';
  return next;
};

// re-exporta para o game/spec
export { resolveRound };
