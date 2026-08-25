import { Injectable } from '@nestjs/common';
import type { GameContext, GameDefinition, GameOverResult, PlayerId } from '@boardzando/contracts';
import { INVALID_MOVE } from '@boardzando/contracts';
import { GamePlugin } from '../../core/registry/game-plugin.decorator';
import {
  DECK_I,
  buildConsumableDeck,
  buildEquipmentDeck,
  buildMonsterDeck,
} from './emperium.cards';
import {
  ADJACENCY,
  FIXED_TILES,
  LINEAR_ADJACENCY,
  LINEAR_SLOTS,
  ROOM_SLOTS,
  SCALING,
  SHIELD_BY_ROUND,
  TILE_BY_ID,
  WING_TILES,
  type RoomSlot,
} from './emperium.rooms';
import {
  comprarCartaMonstro,
  comprarConsumivel,
  confirmarComprometimento,
  equipar,
  iniciarRodada,
  jogadorDoMercado,
  passarMercado,
  recrutar,
  refinar,
  type EmperiumMovePayload,
} from './emperium.moves';
import {
  ALL_ORDERS,
  allowedSlots,
  type Clan,
  type EmperiumState,
  type RoomState,
} from './emperium.state';

/**
 * Guerra do Emperium — board game original inspirado na War of Emperium do
 * Ragnarok Online. Cla rivais cercam um castelo; quem quebra o Emperium o toma,
 * e quem esta com ele no fim da rodada 6 quase sempre vence.
 *
 * O motor e recrutamento em tableau + comprometimento simultaneo oculto +
 * resolucao sala a sala. O combate e deterministico: a incerteza vem do mercado
 * e de nao saber onde os rivais apostaram. Dado so no refino de equipamento.
 *
 * v0.1 implementa o Modo 3 (Cerco): um defensor, os demais atacam.
 * Regras completas em `docs/emperium/01-design-v0.1.md`.
 */
@Injectable()
@GamePlugin()
export class EmperiumGame implements GameDefinition<EmperiumState, EmperiumMovePayload> {
  readonly id = 'emperium';
  readonly name = 'Guerra do Emperium';
  readonly minPlayers = 3;
  readonly maxPlayers = 5;

  setup(ctx: GameContext): EmperiumState {
    const rng = ctx.random;
    const order = [...ctx.players];
    const atacantes = Math.min(4, Math.max(2, order.length - 1));
    const scaling = SCALING[atacantes] ?? SCALING[3]!;

    // O defensor e sorteado entre os jogadores.
    const defenderId = rng.pick(order);

    const slots: RoomSlot[] = scaling.linear ? [...LINEAR_SLOTS] : [...ROOM_SLOTS];
    const adjacency = scaling.linear ? LINEAR_ADJACENCY : ADJACENCY;

    // Sorteia as fichas de ala que entram nesta partida.
    const alas = slots.filter((s) => s !== 'portao' && s !== 'trono' && s !== 'emperium');
    const sorteadas = rng.shuffle(WING_TILES).slice(0, alas.length);

    const rooms: Record<string, RoomState> = {};
    for (const slot of slots) {
      let tileId: string;
      if (slot === 'portao') tileId = FIXED_TILES.portao.id;
      else if (slot === 'trono') tileId = FIXED_TILES.trono.id;
      else if (slot === 'emperium') tileId = FIXED_TILES.emperium.id;
      else tileId = sorteadas[alas.indexOf(slot)]!.id;

      const tile = TILE_BY_ID.get(tileId);
      rooms[slot] = {
        slot,
        tileId,
        controlador: slot === 'emperium' ? null : defenderId,
        guarnicaoFixa: tile?.effect === 'guarnicao6' ? 6 : 0,
        guardioesDefensor: 0,
      };
    }

    // Guardioes do defensor distribuidos nas salas mais internas.
    const internas = slots.filter((s) => s !== 'portao' && s !== 'emperium').reverse();
    for (let i = 0; i < scaling.guardioes; i++) {
      const slot = internas[i % internas.length];
      if (slot && rooms[slot]) rooms[slot]!.guardioesDefensor += 1;
    }

    const deckRecrutamento = rng.shuffle(DECK_I.map((c) => c.id));
    const clans: Record<PlayerId, Clan> = {};
    let nextInstId = 1;

    for (const p of order) {
      const ehDefensor = p === defenderId;
      const clan: Clan = {
        playerId: p,
        zeny: ehDefensor ? 18 : 12,
        gloria: 0,
        chars: {},
        equips: {},
        consumiveis: [],
        acoesRestantes: 0,
        ordensDisponiveis: [...ALL_ORDERS],
      };
      const quantos = ehDefensor ? 3 : 2;
      for (let i = 0; i < quantos; i++) {
        const defId = deckRecrutamento.shift();
        if (!defId) break;
        const instId = `ch${nextInstId++}`;
        clan.chars[instId] = { instId, defId, equips: [], local: 'reserva', salasVisitadas: [] };
      }
      clans[p] = clan;
    }

    const state: EmperiumState = {
      modo: 'cerco',
      round: 1,
      step: 'mercado',
      order,
      defenderId,
      castleOwnerId: defenderId,
      scaling,
      slots,
      adjacency,
      rooms,
      clans,
      fileiraRecrutamento: [],
      fileiraEquip: [],
      deckRecrutamento,
      deckEquip: rng.shuffle(buildEquipmentDeck()),
      deckMonstros: rng.shuffle(buildMonsterDeck()),
      deckConsumiveis: rng.shuffle(buildConsumableDeck()),
      mercadoOrdem: [...order],
      mercadoIndex: 0,
      deckIILiberado: false,
      commitments: {},
      confirmados: [],
      emperiumCubos: {},
      emperiumDurabilidade: scaling.durabilidade,
      log: [`${defenderId} defende o castelo. Os demais atacam.`],
      ultimaResolucao: null,
      finished: false,
      nextInstId,
    };

    iniciarRodada(state, ctx);
    return state;
  }

  readonly moves = {
    recrutar,
    equipar,
    refinar,
    comprarConsumivel,
    comprarCartaMonstro,
    passarMercado,
    confirmarComprometimento,
  } as Record<
    string,
    (
      state: EmperiumState,
      ctx: GameContext,
      payload: EmperiumMovePayload,
    ) => EmperiumState | typeof INVALID_MOVE
  >;

  /**
   * TODOS os moves sao off-turn, e isso e deliberado.
   *
   * O turno circular do engine nao consegue expressar este jogo: a ordem do
   * mercado e INVERSA a Gloria e recalculada a cada rodada, e a fase de
   * comprometimento e simultanea (todo mundo age ao mesmo tempo). Em vez de
   * torcer o `nextPlayer`, a ordem vive no estado (`mercadoOrdem`/
   * `mercadoIndex`) e cada move do mercado valida `jogadorDoMercado(state)`
   * devolvendo INVALID_MOVE — o gate continua sendo server-side e autoritativo.
   *
   * Consequencia para a UI: `<TurnGate>` nao serve aqui. O tabuleiro deve
   * habilitar os controles do mercado comparando com `view.jogadorDoMercado`,
   * e os de comprometimento com `view.confirmados`.
   */
  readonly offTurnMoves = [
    'recrutar',
    'equipar',
    'refinar',
    'comprarConsumivel',
    'comprarCartaMonstro',
    'passarMercado',
    'confirmarComprometimento',
  ] as const;

  endIf(state: EmperiumState): GameOverResult | void {
    if (!state.finished) return;
    const ranking = [...state.order].sort(
      (a, b) => (state.clans[b]?.gloria ?? 0) - (state.clans[a]?.gloria ?? 0),
    );
    const scores = Object.fromEntries(state.order.map((p) => [p, state.clans[p]?.gloria ?? 0]));
    if (state.winnerId) return { winner: state.winnerId, ranking, meta: { gloria: scores } };
    return { draw: true, ranking, meta: { gloria: scores } };
  }

  /**
   * Esconde os comprometimentos alheios durante a fase simultanea — e a
   * informacao oculta central do jogo. Tambem esconde consumiveis na mao dos
   * outros e os baralhos (so contagens).
   */
  playerView(state: EmperiumState, ctx: GameContext, viewer: PlayerId): unknown {
    const emComprometimento = state.step === 'comprometimento';

    const clans = Object.fromEntries(
      state.order.map((p) => {
        const c = state.clans[p]!;
        const proprio = p === viewer;
        return [
          p,
          {
            playerId: p,
            zeny: c.zeny,
            gloria: c.gloria,
            chars: c.chars,
            equips: c.equips,
            acoesRestantes: c.acoesRestantes,
            ordensDisponiveis: proprio ? c.ordensDisponiveis : undefined,
            ordensRestantes: c.ordensDisponiveis.length,
            consumiveis: proprio ? c.consumiveis : undefined,
            consumiveisCount: c.consumiveis.length,
          },
        ];
      }),
    );

    return {
      modo: state.modo,
      round: state.round,
      step: state.step,
      order: state.order,
      defenderId: state.defenderId,
      castleOwnerId: state.castleOwnerId,
      slots: state.slots,
      adjacency: state.adjacency,
      rooms: state.rooms,
      clans,
      fileiraRecrutamento: state.fileiraRecrutamento,
      fileiraEquip: state.fileiraEquip,
      deckRecrutamentoCount: state.deckRecrutamento.length,
      deckEquipCount: state.deckEquip.length,
      deckMonstrosCount: state.deckMonstros.length,
      deckConsumiveisCount: state.deckConsumiveis.length,
      deckIILiberado: state.deckIILiberado,
      mercadoOrdem: state.mercadoOrdem,
      jogadorDoMercado: jogadorDoMercado(state),
      // O comprometimento so e publico depois da revelacao.
      meusComprometimentos: state.commitments[viewer] ?? [],
      confirmados: state.confirmados,
      todosComprometimentos: emComprometimento ? undefined : state.commitments,
      salasPermitidas: allowedSlots(state, viewer),
      emperiumCubos: state.emperiumCubos,
      emperiumDurabilidade: state.emperiumDurabilidade,
      escudoBase: SHIELD_BY_ROUND[state.round - 1] ?? 2,
      ultimaResolucao: state.ultimaResolucao,
      // O log virou o relatorio da rodada (uma linha por sala), entao precisa
      // de folga para caber uma rodada inteira mais o mercado.
      log: state.log.slice(-60),
      finished: state.finished,
      winnerId: state.winnerId,
    };
  }
}
