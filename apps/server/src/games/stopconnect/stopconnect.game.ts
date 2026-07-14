import { Injectable } from '@nestjs/common';
import type { GameContext, GameDefinition, GameOverResult, PlayerId } from '@boardzando/contracts';
import { INVALID_MOVE } from '@boardzando/contracts';
import { GamePlugin } from '../../core/registry/game-plugin.decorator';
import { cellKey, placeableCells } from './stopconnect.board';
import { buildLetterBag } from './stopconnect.letters';
import { endTurn, judge, place, submitAnswers } from './stopconnect.moves';
import type {
  EndTurnPayload,
  JudgePayload,
  PlacePayload,
  SubmitAnswersPayload,
} from './stopconnect.moves';
import { STOPCONNECT_THEMES } from './stopconnect.themes';
import type {
  BoardTile,
  Hand,
  StopConnectOptions,
  StopConnectState,
} from './stopconnect.state';

type StopConnectMovePayload =
  | PlacePayload
  | SubmitAnswersPayload
  | JudgePayload
  | EndTurnPayload;

const DEFAULTS: StopConnectOptions = { targetScore: 50 };

function readOptions(raw: unknown): StopConnectOptions {
  const o = (raw ?? {}) as Partial<StopConnectOptions>;
  const t = o.targetScore;
  const targetScore = t === 50 || t === 75 || t === 100 ? t : DEFAULTS.targetScore;
  return { targetScore };
}

/**
 * StopConnect — mistura de palavras-cruzadas com Stop e Scrabble. Peças de Letra
 * (fundo branco, valor tipo Scrabble) e de Tema (fundo rosa) são colocadas numa
 * grade em que Letra nunca toca Letra e Tema nunca toca Tema. Ao colocar, o
 * jogador diz uma resposta por peça vizinha (o tema começando com a letra); os
 * outros jogadores aprovam/rejeitam. Colocar Tema pontua a soma das Letras
 * conectadas; colocar Letra pontua valor × nº de Temas. Ao atingir o alvo
 * (padrão 50) dispara-se o último turno; vence quem tiver mais pontos.
 */
@Injectable()
@GamePlugin()
export class StopConnectGame
  implements GameDefinition<StopConnectState, StopConnectMovePayload>
{
  readonly id = 'stopconnect';
  readonly name = 'StopConnect';
  readonly minPlayers = 2;
  readonly maxPlayers = 8;

  setup(ctx: GameContext, setupData?: unknown): StopConnectState {
    const options = readOptions(setupData);
    const rng = ctx.random;
    let letterBag = rng.shuffle(buildLetterBag());
    let themeBag = rng.shuffle(STOPCONNECT_THEMES);

    const tiles: Record<string, BoardTile> = {};
    const cells: Record<string, string> = {};
    let nextTileId = 0;

    const takeLetter = () => {
      if (letterBag.length === 0) letterBag = rng.shuffle(buildLetterBag());
      return letterBag.shift()!;
    };
    const takeTheme = () => {
      if (themeBag.length === 0) themeBag = rng.shuffle(STOPCONNECT_THEMES);
      return themeBag.shift()!;
    };
    const seedLetter = (col: number, row: number) => {
      const lt = takeLetter();
      const id = `t${nextTileId++}`;
      tiles[id] = { id, kind: 'letter', col, row, letter: lt.letter, value: lt.value };
      cells[cellKey(col, row)] = id;
    };
    const seedTheme = (col: number, row: number) => {
      const th = takeTheme();
      const id = `t${nextTileId++}`;
      tiles[id] = { id, kind: 'theme', col, row, theme: th };
      cells[cellKey(col, row)] = id;
    };

    // Como na imagem inicial: 3 Letras na diagonal; o 1º Tema encosta (lado a
    // lado) na última Letra e os outros dois seguem a diagonal. Nenhuma Letra
    // toca Letra e nenhum Tema toca Tema (só o 1º Tema conecta com a Letra).
    // L(0,0) L(1,1) L(2,2)  ·  T(3,2) T(4,3) T(5,4)
    seedLetter(0, 0);
    seedLetter(1, 1);
    seedLetter(2, 2);
    seedTheme(3, 2);
    seedTheme(4, 3);
    seedTheme(5, 4);

    const hands: Record<PlayerId, Hand> = {};
    const scores: Record<PlayerId, number> = {};
    for (const p of ctx.players) {
      hands[p] = { letter: takeLetter(), theme: takeTheme() };
      scores[p] = 0;
    }

    return {
      options,
      order: [...ctx.players],
      tiles,
      cells,
      nextTileId,
      letterBag,
      themeBag,
      hands,
      scores,
      step: 'place',
    };
  }

  readonly moves = {
    place,
    submitAnswers,
    judge,
    endTurn,
  } as Record<
    string,
    (
      state: StopConnectState,
      ctx: GameContext,
      payload: StopConnectMovePayload,
    ) => StopConnectState | typeof INVALID_MOVE
  >;

  readonly offTurnMoves = ['judge'] as const;

  endIf(state: StopConnectState): GameOverResult | void {
    if (!state.finished) return;
    const ranking = [...state.order].sort(
      (a, b) => (state.scores[b] ?? 0) - (state.scores[a] ?? 0),
    );
    if (state.winnerId) {
      return { winner: state.winnerId, ranking, meta: { scores: state.scores } };
    }
    return { draw: true, ranking, meta: { scores: state.scores } };
  }

  /**
   * Esconde as pilhas de compra (só contagens) e as mãos alheias (só a do
   * viewer). As respostas ficam ocultas durante 'answer' e públicas a partir de
   * 'judging' (os juízes precisam vê-las). Sugere as células jogáveis ao jogador
   * da vez.
   */
  playerView(state: StopConnectState, ctx: GameContext, viewer: PlayerId): unknown {
    const p = state.pending;
    const pendingView = p
      ? {
          placedTileId: p.placedTileId,
          placedKind: p.placedKind,
          col: p.col,
          row: p.row,
          connectedTileIds: p.connectedTileIds,
          answers: state.step === 'answer' ? [] : p.answers,
          votes: p.votes,
          voteCount: Object.keys(p.votes).length,
          approved: p.approved,
          points: p.points,
        }
      : undefined;

    return {
      options: state.options,
      order: state.order,
      turnPlayerId: ctx.currentPlayer,
      tiles: state.tiles,
      cells: state.cells,
      scores: state.scores,
      step: state.step,
      pending: pendingView,
      myHand: state.hands[viewer],
      handCounts: Object.fromEntries(state.order.map((pl) => [pl, state.hands[pl] ? 2 : 0])),
      placeable:
        state.step === 'place' && ctx.currentPlayer === viewer
          ? { letter: placeableCells(state, 'letter'), theme: placeableCells(state, 'theme') }
          : undefined,
      letterCount: state.letterBag.length,
      themeCount: state.themeBag.length,
      lastTurnBy: state.lastTurnBy,
      finalTurnsRemaining: state.finalTurnsRemaining,
      lastEvent: state.lastEvent,
      targetScore: state.options.targetScore,
      winnerId: state.winnerId,
      finished: state.finished,
    };
  }
}