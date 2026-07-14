import type { Move, PlayerId, RandomAPI } from '@boardzando/contracts';
import { INVALID_MOVE } from '@boardzando/contracts';
import { canPlace, cellKey, connectedOpposite, scorePlacement } from './stopconnect.board';
import { buildLetterBag } from './stopconnect.letters';
import { STOPCONNECT_THEMES } from './stopconnect.themes';
import type {
  BoardTile,
  LetterTile,
  StopConnectPending,
  StopConnectState,
  TileKind,
  Verdict,
} from './stopconnect.state';

export interface PlacePayload {
  tileType: TileKind;
  col: number;
  row: number;
}
export interface SubmitAnswersPayload {
  answers: string[];
}
export interface JudgePayload {
  verdict: Verdict;
}
export type EndTurnPayload = Record<string, never>;

function clone(state: StopConnectState): StopConnectState {
  return structuredClone(state);
}
function keepTurn(state: StopConnectState): StopConnectState {
  (state as unknown as Record<string, unknown>).__keepTurn = true;
  return state;
}

/** Compra uma Letra; recria a pilha embaralhada quando esgota (fonte "infinita"). */
export function drawLetter(state: StopConnectState, rng: RandomAPI): LetterTile {
  if (state.letterBag.length === 0) state.letterBag = rng.shuffle(buildLetterBag());
  return state.letterBag.shift()!;
}
/** Compra um Tema; recria a pilha embaralhada quando esgota. */
export function drawTheme(state: StopConnectState, rng: RandomAPI): string {
  if (state.themeBag.length === 0) state.themeBag = rng.shuffle(STOPCONNECT_THEMES);
  return state.themeBag.shift()!;
}

function finishGame(state: StopConnectState): void {
  state.finished = true;
  const max = Math.max(...state.order.map((p) => state.scores[p] ?? 0));
  const leaders = state.order.filter((p) => (state.scores[p] ?? 0) === max);
  state.winnerId = leaders.length === 1 ? leaders[0] : undefined; // empate → sem winner
  state.lastEvent = 'Fim de jogo!';
}

/** Resolve o julgamento: soma pontos se aprovado e passa para o passo 'reveal'. */
function resolveJudging(
  state: StopConnectState,
  placer: PlayerId,
  approvals: number,
  rejections: number,
): void {
  const p = state.pending!;
  const approved = approvals >= rejections; // empate favorece quem jogou
  p.approved = approved;
  const placed = state.tiles[p.placedTileId]!;
  const connected = p.connectedTileIds.map((id) => state.tiles[id]!).filter(Boolean) as BoardTile[];
  const pts = approved ? scorePlacement(p.placedKind, placed.value ?? 0, connected) : 0;
  p.points = pts;
  if (approved && pts > 0) state.scores[placer] = (state.scores[placer] ?? 0) + pts;
  state.step = 'reveal';
  state.lastEvent = approved
    ? `Aprovado! ${placer} fez +${pts} ponto(s)`
    : `Rejeitado! ${placer} não pontuou`;
}

/** MOVE: o jogador da vez COLOCA uma das peças da mão numa célula válida. */
export const place: Move<StopConnectState, PlacePayload> = (state, ctx, payload) => {
  if (state.finished || state.pending || state.step !== 'place') return INVALID_MOVE;
  if (ctx.actor !== ctx.currentPlayer) return INVALID_MOVE;
  const { tileType, col, row } = payload;
  if (tileType !== 'letter' && tileType !== 'theme') return INVALID_MOVE;
  if (!Number.isInteger(col) || !Number.isInteger(row)) return INVALID_MOVE;
  const hand = state.hands[ctx.actor];
  if (!hand) return INVALID_MOVE;
  if (!canPlace(state, tileType, col, row)) return INVALID_MOVE;

  const next = clone(state);
  const id = `t${next.nextTileId++}`;
  const tile: BoardTile = { id, kind: tileType, col, row, placedBy: ctx.actor };
  if (tileType === 'letter') {
    tile.letter = next.hands[ctx.actor]!.letter.letter;
    tile.value = next.hands[ctx.actor]!.letter.value;
  } else {
    tile.theme = next.hands[ctx.actor]!.theme;
  }
  next.tiles[id] = tile;
  next.cells[cellKey(col, row)] = id;

  const connected = connectedOpposite(next, col, row, tileType);
  const pending: StopConnectPending = {
    placedTileId: id,
    placedKind: tileType,
    col,
    row,
    connectedTileIds: connected.map((t) => t.id),
    answers: [],
    votes: {},
  };
  next.pending = pending;
  next.step = 'answer';
  next.lastEvent =
    tileType === 'letter'
      ? `${ctx.actor} colocou a letra ${tile.letter}`
      : `${ctx.actor} colocou o tema "${tile.theme}"`;
  return keepTurn(next);
};

/** MOVE: o jogador digita as respostas (uma por peça conectada) e abre o julgamento. */
export const submitAnswers: Move<StopConnectState, SubmitAnswersPayload> = (state, ctx, payload) => {
  if (state.finished || state.step !== 'answer' || !state.pending) return INVALID_MOVE;
  if (ctx.actor !== ctx.currentPlayer) return INVALID_MOVE;
  const need = state.pending.connectedTileIds.length;
  const raw = Array.isArray(payload.answers) ? payload.answers : [];
  if (raw.length !== need) return INVALID_MOVE;
  const clean = raw.map((a) => (typeof a === 'string' ? a.trim() : ''));
  if (clean.some((a) => a.length === 0 || a.length > 40)) return INVALID_MOVE;

  const next = clone(state);
  next.pending!.answers = clean;
  next.pending!.votes = {};
  next.step = 'judging';
  next.lastEvent = `${ctx.actor} respondeu — aguardando julgamento`;
  return keepTurn(next);
};

/**
 * MOVE (off-turn): um jogador que NÃO é o da vez aprova/rejeita a jogada.
 * Resolve quando uma maioria estrita se forma ou quando todos os juízes votam
 * (empate favorece quem jogou). Move off-turn não avança o turno.
 */
export const judge: Move<StopConnectState, JudgePayload> = (state, ctx, payload) => {
  if (state.finished || state.step !== 'judging' || !state.pending) return INVALID_MOVE;
  if (ctx.actor === ctx.currentPlayer) return INVALID_MOVE; // quem jogou não julga
  if (payload.verdict !== 'approve' && payload.verdict !== 'reject') return INVALID_MOVE;
  if (state.pending.votes[ctx.actor]) return INVALID_MOVE; // já votou
  if (!state.order.includes(ctx.actor)) return INVALID_MOVE;

  const next = clone(state);
  next.pending!.votes[ctx.actor] = payload.verdict;

  const judges = next.order.filter((p) => p !== ctx.currentPlayer);
  const cast = judges.map((p) => next.pending!.votes[p]).filter(Boolean) as Verdict[];
  const approvals = cast.filter((v) => v === 'approve').length;
  const rejections = cast.filter((v) => v === 'reject').length;
  const remaining = judges.length - cast.length;
  const majority = Math.floor(judges.length / 2) + 1;

  const decided = approvals >= majority || rejections >= majority || remaining === 0;
  if (decided) resolveJudging(next, ctx.currentPlayer, approvals, rejections);
  return next;
};

/** MOVE: o jogador encerra a vez — reabastece a mão e o turno passa (com a lógica do último turno). */
export const endTurn: Move<StopConnectState, EndTurnPayload> = (state, ctx) => {
  if (state.finished || state.step !== 'reveal' || !state.pending) return INVALID_MOVE;
  if (ctx.actor !== ctx.currentPlayer) return INVALID_MOVE;

  const next = clone(state);
  // reabastece só o tipo jogado; a peça não usada permanece na mão
  const kind = next.pending!.placedKind;
  if (kind === 'letter') next.hands[ctx.actor]!.letter = drawLetter(next, ctx.random);
  else next.hands[ctx.actor]!.theme = drawTheme(next, ctx.random);
  next.pending = undefined;
  next.step = 'place';

  // último turno: 1º a atingir o alvo dispara; os demais jogam mais uma vez cada
  const target = next.options.targetScore;
  if (next.lastTurnBy === undefined) {
    if ((next.scores[ctx.actor] ?? 0) >= target) {
      next.lastTurnBy = ctx.actor;
      next.finalTurnsRemaining = next.order.length - 1;
      next.lastEvent = `${ctx.actor} atingiu ${target}! Último turno para os demais.`;
    }
  } else {
    next.finalTurnsRemaining = (next.finalTurnsRemaining ?? 0) - 1;
    if (next.finalTurnsRemaining <= 0) finishGame(next);
  }
  // move normal: o engine avança para o próximo jogador (ordem circular = horário)
  return next;
};
