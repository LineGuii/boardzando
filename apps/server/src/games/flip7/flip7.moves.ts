import type { GameContext, Move, PlayerId, RandomAPI } from '@boardzando/contracts';
import { INVALID_MOVE } from '@boardzando/contracts';
import { buildDeck } from './flip7.cards';
import type { Flip7Card } from './flip7.cards';
import type { Flip7PlayerState, Flip7State } from './flip7.state';

export type HitPayload = Record<string, never>;
export type StayPayload = Record<string, never>;
export interface ResolveActionPayload {
  targetId: PlayerId;
}
export interface GiveSecondPayload {
  targetId: PlayerId;
}

function clone(state: Flip7State): Flip7State {
  return structuredClone(state);
}
function keepTurn(state: Flip7State): Flip7State {
  (state as unknown as Record<string, unknown>).__keepTurn = true;
  return state;
}

/** Compra 1 carta; reembaralha o descarte quando o baralho zera. */
function draw(state: Flip7State, rng: RandomAPI): Flip7Card | undefined {
  if (state.deck.length === 0) {
    if (state.discard.length === 0) return undefined;
    state.deck = rng.shuffle(state.discard);
    state.discard = [];
  }
  return state.deck.shift();
}

/** Pontuação da rodada de um jogador (x2 multiplica antes dos "+"; Flip 7 = +15). */
export function scorePlayer(p: Flip7PlayerState): number {
  if (p.status === 'busted') return 0;
  let sum = p.numbers.reduce((a, b) => a + b, 0);
  if (p.modifiers.includes('x2')) sum *= 2;
  for (const m of p.modifiers) if (m !== 'x2') sum += parseInt(m, 10);
  if (p.numbers.length === 7) sum += 15;
  return sum;
}

function activePlayers(state: Flip7State): PlayerId[] {
  return state.order.filter((p) => state.players[p]!.status === 'active');
}

/** Um jogador sem Segunda Chance para receber o excedente. */
function targetForSecond(state: Flip7State, chooser: PlayerId): PlayerId | undefined {
  return state.order.find(
    (p) => p !== chooser && state.players[p]!.status === 'active' && !state.players[p]!.secondChance,
  );
}

function freshPlayer(): Flip7PlayerState {
  return { numbers: [], modifiers: [], secondChance: false, status: 'active' };
}

/** Zera as mãos, gira o dealer e começa uma nova rodada. Muta `state`. */
function startRound(state: Flip7State): void {
  for (const p of state.order) {
    // as cartas da rodada vão para o descarte (não reembaralha até o baralho zerar)
    const ps = state.players[p]!;
    // (não rastreamos cada objeto de carta na linha; o baralho tem folga de sobra)
    state.players[p] = freshPlayer();
    void ps;
  }
  state.round += 1;
  state.dealerIdx = (state.dealerIdx + 1) % state.order.length;
  state.turnPtr = state.dealerIdx;
  state.pending = undefined;
}

/** Encerra a rodada: pontua, acumula, checa vitória ou inicia a próxima. */
function endRound(state: Flip7State, flip7By?: PlayerId): void {
  const gained: Record<PlayerId, number> = {};
  const busted: PlayerId[] = [];
  for (const p of state.order) {
    const ps = state.players[p]!;
    const pts = scorePlayer(ps);
    gained[p] = pts;
    if (ps.status === 'busted') busted.push(p);
    state.totals[p] = (state.totals[p] ?? 0) + pts;
  }
  state.lastRound = { gained, busted, flip7By };

  // Fim de jogo: ao fim de uma rodada em que alguém atingiu o alvo.
  const max = Math.max(...state.order.map((p) => state.totals[p] ?? 0));
  if (max >= state.options.targetScore) {
    const leaders = state.order.filter((p) => (state.totals[p] ?? 0) === max);
    state.finished = true;
    state.winnerId = leaders.length === 1 ? leaders[0] : undefined; // empate → sem winner
    return;
  }
  startRound(state);
}

/**
 * Fecha a vez do jogador atual: se alguém fez Flip 7 encerra a rodada; se não
 * há mais ativos, encerra; senão passa para o próximo ativo.
 */
function endTurnOrRound(state: Flip7State): void {
  const flip7 = state.order.find((p) => state.players[p]!.numbers.length >= 7);
  if (flip7) {
    endRound(state, flip7);
    return;
  }
  const actives = activePlayers(state);
  if (actives.length === 0) {
    endRound(state);
    return;
  }
  // avança para o próximo ativo a partir de turnPtr
  const n = state.order.length;
  for (let i = 1; i <= n; i++) {
    const idx = (state.turnPtr + i) % n;
    if (state.players[state.order[idx]!]!.status === 'active') {
      state.turnPtr = idx;
      return;
    }
  }
}

/** Aplica uma carta comprada ao jogador `pid`. Retorna true se a vez continua
 *  pendente (precisa de escolha do jogador). Muta `state`. */
function applyCard(state: Flip7State, pid: PlayerId, card: Flip7Card): 'done' | 'pending' {
  const p = state.players[pid]!;
  if (card.kind === 'number') {
    if (p.numbers.includes(card.value)) {
      // duplicata: Segunda Chance salva, senão bust
      if (p.secondChance) {
        p.secondChance = false;
        state.discard.push(card, { kind: 'action', action: 'second' });
        state.lastEvent = `${pid} usou a Segunda Chance!`;
      } else {
        p.status = 'busted';
        state.lastEvent = `${pid} estourou no ${card.value}!`;
      }
    } else {
      p.numbers.push(card.value);
      state.lastEvent =
        p.numbers.length === 7 ? `${pid} fez FLIP 7! (+15)` : `${pid} virou o ${card.value}`;
    }
    return 'done';
  }
  if (card.kind === 'modifier') {
    p.modifiers.push(card.mod);
    state.lastEvent = `${pid} pegou ${card.mod}`;
    return 'done';
  }
  // ação
  if (card.action === 'second') {
    if (!p.secondChance) {
      p.secondChance = true;
      state.lastEvent = `${pid} guardou uma Segunda Chance`;
      return 'done';
    }
    // já tem uma: passa para outro ativo sem, senão descarta
    if (targetForSecond(state, pid)) {
      state.pending = { kind: 'giveSecond', chooser: pid };
      return 'pending';
    }
    state.discard.push(card);
    state.lastEvent = `${pid} descartou a Segunda Chance extra`;
    return 'done';
  }
  // freeze / flip3 precisam de alvo
  state.pending = { kind: 'action', action: card.action, chooser: pid };
  state.discard.push(card);
  return 'pending';
}

/**
 * Flip Three: o alvo vira 3 cartas, uma a uma. Para se estourar ou fizer Flip 7.
 * Simplificação documentada p/ cartas de ação aninhadas: Freeze aplicada ao
 * alvo (congela e para); Flip Three aninhada é descartada; Segunda Chance o
 * alvo guarda se não tiver.
 */
function applyFlipThree(state: Flip7State, target: PlayerId, rng: RandomAPI): void {
  const p = state.players[target]!;
  for (let i = 0; i < 3; i++) {
    if (p.status !== 'active' || p.numbers.length >= 7) break;
    const card = draw(state, rng);
    if (!card) break;
    if (card.kind === 'action' && (card.action === 'freeze' || card.action === 'flip3')) {
      state.discard.push(card);
      if (card.action === 'freeze') {
        p.status = 'frozen';
        state.lastEvent = `${target} foi congelado durante o Flip Three`;
        break;
      }
      // flip3 aninhado: ignorado (evita recursão)
      continue;
    }
    applyCard(state, target, card);
  }
}

/** MOVE: o jogador da vez COMPRA uma carta. */
export const hit: Move<Flip7State, HitPayload> = (state, ctx) => {
  if (state.finished || state.pending) return INVALID_MOVE;
  const p = state.players[ctx.actor];
  if (!p || p.status !== 'active') return INVALID_MOVE;
  if (state.order[state.turnPtr] !== ctx.actor) return INVALID_MOVE;

  const next = clone(state);
  const card = draw(next, ctx.random);
  if (!card) {
    // baralho impossível de repor — só encerra a vez
    endTurnOrRound(next);
    return next;
  }
  const res = applyCard(next, ctx.actor, card);
  if (res === 'pending') return keepTurn(next); // precisa escolher alvo
  endTurnOrRound(next);
  return next;
};

/** MOVE: o jogador da vez PARA (banca os pontos e sai da rodada). */
export const stay: Move<Flip7State, StayPayload> = (state, ctx) => {
  if (state.finished || state.pending) return INVALID_MOVE;
  const p = state.players[ctx.actor];
  if (!p || p.status !== 'active') return INVALID_MOVE;
  if (state.order[state.turnPtr] !== ctx.actor) return INVALID_MOVE;
  const next = clone(state);
  next.players[ctx.actor]!.status = 'stayed';
  next.lastEvent = `${ctx.actor} parou`;
  endTurnOrRound(next);
  return next;
};

/** MOVE: resolve uma ação pendente (Freeze/Flip Three) sobre um alvo ativo. */
export const resolveAction: Move<Flip7State, ResolveActionPayload> = (state, ctx, payload) => {
  const pend = state.pending;
  if (!pend || pend.kind !== 'action' || pend.chooser !== ctx.actor) return INVALID_MOVE;
  const target = state.players[payload.targetId];
  if (!target || target.status !== 'active') return INVALID_MOVE;

  const next = clone(state);
  next.pending = undefined;
  if (pend.action === 'freeze') {
    next.players[payload.targetId]!.status = 'frozen';
    next.lastEvent = `${payload.targetId} foi congelado`;
  } else {
    next.lastEvent = `${payload.targetId} recebeu Flip Three`;
    applyFlipThree(next, payload.targetId, ctx.random);
  }
  endTurnOrRound(next);
  return next;
};

/** MOVE: passa a Segunda Chance excedente para outro jogador ativo. */
export const giveSecond: Move<Flip7State, GiveSecondPayload> = (state, ctx, payload) => {
  const pend = state.pending;
  if (!pend || pend.kind !== 'giveSecond' || pend.chooser !== ctx.actor) return INVALID_MOVE;
  const target = state.players[payload.targetId];
  if (!target || target.status !== 'active' || target.secondChance || payload.targetId === ctx.actor)
    return INVALID_MOVE;
  const next = clone(state);
  next.players[payload.targetId]!.secondChance = true;
  next.pending = undefined;
  next.lastEvent = `${ctx.actor} deu a Segunda Chance para ${payload.targetId}`;
  endTurnOrRound(next);
  return next;
};

/** Próximo a jogar: o jogador em `turnPtr` (mantido sempre num ativo). */
export function flip7NextPlayer(state: Flip7State, ctx: GameContext): PlayerId {
  if (state.finished) return ctx.currentPlayer;
  return state.order[state.turnPtr] ?? state.order[0]!;
}

/** Cria o baralho inicial embaralhado (usado no setup). */
export function shuffledDeck(rng: RandomAPI): Flip7Card[] {
  return rng.shuffle(buildDeck());
}
