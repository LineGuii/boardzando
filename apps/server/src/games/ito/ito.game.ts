import { Injectable } from '@nestjs/common';
import type { GameContext, GameDefinition, GameOverResult, PlayerId } from '@boardzando/contracts';
import { INVALID_MOVE } from '@boardzando/contracts';
import { GamePlugin } from '../../core/registry/game-plugin.decorator';
import { dealLevel, playLowest, setClue, startPlay, voteCard } from './ito.moves';
import type {
  PlayLowestPayload,
  SetCluePayload,
  StartPlayPayload,
  VoteCardPayload,
} from './ito.moves';
import { ITO_THEMES } from './ito.themes';
import type { ItoOptions, ItoState } from './ito.state';

type ItoMovePayload = SetCluePayload | StartPlayPayload | PlayLowestPayload | VoteCardPayload;

const DEFAULTS: ItoOptions = {
  lives: 3,
  maxLevel: 3,
  startLevel: 1,
  uniqueThemes: true,
  anonymousCards: false,
};

function readOptions(raw: unknown): ItoOptions {
  const o = (raw ?? {}) as Partial<ItoOptions>;
  const clampInt = (v: unknown, lo: number, hi: number, dflt: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : dflt;
  const maxLevel = clampInt(o.maxLevel, 1, 3, DEFAULTS.maxLevel);
  return {
    lives: clampInt(o.lives, 1, 9, DEFAULTS.lives),
    maxLevel,
    startLevel: clampInt(o.startLevel, 1, maxLevel, DEFAULTS.startLevel),
    uniqueThemes:
      typeof o.uniqueThemes === 'boolean' ? o.uniqueThemes : DEFAULTS.uniqueThemes,
    anonymousCards:
      typeof o.anonymousCards === 'boolean' ? o.anonymousCards : DEFAULTS.anonymousCards,
  };
}

/**
 * Ito (modo cooperativo "Spider's Thread"). Baralho 1..100; um tema define a
 * escala; cada jogador recebe cartas secretas e da uma DICA em palavras (sem
 * dizer o numero). A equipe joga as cartas em ordem CRESCENTE — cada carta que
 * deixa uma menor para tras custa 1 vida. Niveis 1->maxLevel aumentam as cartas
 * por jogador. Vitoria/derrota sao da EQUIPE (jogo cooperativo).
 */
@Injectable()
@GamePlugin()
export class ItoGame implements GameDefinition<ItoState, ItoMovePayload> {
  readonly id = 'ito';
  readonly name = 'Ito (cooperativo)';
  readonly minPlayers = 2;
  readonly maxPlayers = 10;

  setup(ctx: GameContext, setupData?: unknown): ItoState {
    const options = readOptions(setupData);
    // Com uniqueThemes, a sequencia de temas da partida inteira e pre-sorteada
    // aqui (um indice por nivel) — garante zero repeticao entre niveis.
    let themeOrder: number[] | undefined;
    let theme = ctx.random.pick(ITO_THEMES);
    if (options.uniqueThemes) {
      const levels = options.maxLevel - options.startLevel + 1;
      themeOrder = ctx.random
        .shuffle(ITO_THEMES.map((_, i) => i))
        .slice(0, levels);
      theme = ITO_THEMES[themeOrder[0]!]!;
    }
    const state: ItoState = {
      options,
      level: options.startLevel,
      maxLevel: options.maxLevel,
      lives: options.lives,
      theme,
      themeOrder,
      step: 'clue',
      cards: {},
      votes: {},
      playedPile: [],
      lastPlayedValue: 0,
    };
    dealLevel(state, ctx.players, ctx.random, state.level);
    return state;
  }

  readonly moves = {
    setClue,
    startPlay,
    playLowest,
    voteCard,
  } as Record<string, (state: ItoState, ctx: GameContext, payload: ItoMovePayload) => ItoState | typeof INVALID_MOVE>;

  /** Jogo sem turnos: qualquer um age a qualquer momento. */
  readonly offTurnMoves = ['setClue', 'startPlay', 'playLowest', 'voteCard'] as const;

  endIf(state: ItoState): GameOverResult | void {
    if (state.outcome === 'win') {
      return {
        coop: { outcome: 'win', detail: `Todos os ${state.maxLevel} níveis concluídos!` },
        meta: { level: state.level, lives: state.lives },
      };
    }
    if (state.outcome === 'lose') {
      return {
        coop: { outcome: 'lose', detail: `A equipe ficou sem vidas no nível ${state.level}.` },
        meta: { level: state.level },
      };
    }
  }

  /**
   * Esconde o NUMERO das cartas nao reveladas dos outros jogadores; as DICAS
   * sao publicas (e como a equipe se coordena). Numeros aparecem quando a carta
   * e jogada ou descartada, e o jogador sempre ve as proprias.
   *
   * Modo anonimo (options.anonymousCards): alem do numero, o DONO das cartas
   * alheias tambem some (para sempre — nem jogada/descartada revela). Na fase
   * de dicas o viewer nem recebe as cartas dos outros (senao mapearia dica ->
   * autor assistindo a digitacao), so um progresso por jogador. Votos viram
   * contagem anonima; o viewer ve apenas o proprio voto.
   */
  playerView(state: ItoState, ctx: GameContext, viewer: PlayerId): unknown {
    const anon = state.options.anonymousCards;
    const cards: Record<string, unknown> = {};
    for (const c of Object.values(state.cards)) {
      const mine = c.ownerId === viewer;
      if (anon && state.step === 'clue' && !mine) continue;
      const reveal = c.played || c.discarded || mine;
      cards[c.id] = {
        id: c.id,
        ownerId: anon && !mine ? undefined : c.ownerId,
        clue: c.clue,
        played: c.played,
        discarded: c.discarded,
        playedOrder: c.playedOrder,
        value: reveal ? c.value : undefined,
      };
    }

    // Fase de dicas no modo anonimo: progresso (dicas prontas/total) por
    // jogador, para a UI mostrar quem falta sem expor as cartas.
    let clueProgress: Record<PlayerId, { done: number; total: number }> | undefined;
    if (anon && state.step === 'clue') {
      clueProgress = {};
      for (const pid of ctx.players) {
        const own = Object.values(state.cards).filter(
          (c) => c.ownerId === pid && !c.played && !c.discarded,
        );
        clueProgress[pid] = {
          done: own.filter((c) => (c.clue ?? '').trim().length > 0).length,
          total: own.length,
        };
      }
    }

    // Votos: no modo anonimo o viewer ve so o proprio; o resto vira contagem.
    let votes: Record<PlayerId, string> = state.votes;
    let voteCounts: Record<string, number> | undefined;
    if (anon) {
      voteCounts = {};
      for (const cid of Object.values(state.votes)) {
        voteCounts[cid] = (voteCounts[cid] ?? 0) + 1;
      }
      votes = state.votes[viewer] ? { [viewer]: state.votes[viewer]! } : {};
    }

    return {
      theme: state.theme,
      level: state.level,
      maxLevel: state.maxLevel,
      lives: state.lives,
      step: state.step,
      playedPile: state.playedPile,
      lastPlayedValue: state.lastPlayedValue,
      lastMistake: state.lastMistake,
      anonymous: anon,
      tableOrder: state.tableOrder,
      clueProgress,
      votes,
      voteCounts,
      cards,
    };
  }
}
