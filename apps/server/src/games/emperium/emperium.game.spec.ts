import type { PlayerId } from '@boardzando/contracts';
import { GameInstance, InvalidMoveError } from '../../core/engine/game-instance';
import { CHARACTER_BY_ID, DECK_I, DECK_II, ALL_CHARACTERS, EQUIPMENT } from './emperium.cards';
import { EmperiumGame } from './emperium.game';
import { jogadorDoMercado } from './emperium.moves';
import { resolveEmperium, resolveRoom, type RoomInput } from './emperium.resolve';
import { ADJACENCY, ROOM_SLOTS, TOTAL_ROUNDS } from './emperium.rooms';
import type { Clan, EmperiumState, RoomState } from './emperium.state';

const PLAYERS: PlayerId[] = ['ana', 'bruno', 'carla', 'dora'];

function newMatch(seed = 7): GameInstance<EmperiumState> {
  return GameInstance.create(new EmperiumGame(), PLAYERS, seed);
}

/* ─────────────────────────────────────────────────────────────────────────
 * Helpers para testar a resolucao isoladamente
 * ───────────────────────────────────────────────────────────────────────── */

function makeClan(playerId: PlayerId, defIds: string[]): Clan {
  const chars: Clan['chars'] = {};
  defIds.forEach((defId, i) => {
    const instId = `${playerId}-${i}`;
    chars[instId] = { instId, defId, equips: [], local: 'comprometido', salasVisitadas: [] };
  });
  return {
    playerId,
    zeny: 20,
    gloria: 0,
    chars,
    equips: {},
    consumiveis: [],
    acoesRestantes: 0,
    ordensDisponiveis: [],
  };
}

function makeState(
  clans: Record<PlayerId, Clan>,
  opts: { tileId?: string; castleOwnerId?: PlayerId; round?: number } = {},
): EmperiumState {
  const rooms: Record<string, RoomState> = {};
  for (const slot of ROOM_SLOTS) {
    rooms[slot] = {
      slot,
      tileId: slot === 'b1' ? (opts.tileId ?? 'sala-patio') : 'sala-patio',
      controlador: null,
      guarnicaoFixa: 0,
      guardioesDefensor: 0,
    };
  }
  const order = Object.keys(clans);
  return {
    modo: 'cerco',
    round: opts.round ?? 4,
    step: 'resolucao',
    order,
    defenderId: opts.castleOwnerId ?? order[0]!,
    castleOwnerId: opts.castleOwnerId ?? order[0]!,
    scaling: { durabilidade: 18, guardioes: 3, linear: false },
    slots: [...ROOM_SLOTS],
    adjacency: ADJACENCY,
    rooms,
    clans,
    fileiraRecrutamento: [],
    fileiraEquip: [],
    deckRecrutamento: [],
    deckEquip: [],
    deckMonstros: [],
    deckConsumiveis: [],
    mercadoOrdem: order,
    mercadoIndex: 0,
    deckIILiberado: true,
    commitments: {},
    confirmados: [],
    emperiumCubos: {},
    emperiumDurabilidade: 18,
    log: [],
    ultimaResolucao: null,
    finished: false,
    nextInstId: 100,
  };
}

const ids = (clan: Clan) => Object.keys(clan.chars);

/** Anexa um equipamento (com refino e cartas encaixadas) ao personagem. */
function equiparTeste(
  clan: Clan,
  charInstId: string,
  defId: string,
  opts: { refino?: number; cartas?: string[] } = {},
): void {
  const instId = `${charInstId}-eq`;
  clan.equips[instId] = {
    instId,
    defId,
    refino: opts.refino ?? 0,
    encaixadas: opts.cartas ?? [],
    portador: charInstId,
  };
  clan.chars[charInstId]!.equips.push(instId);
}

/* ═════════════════════════════════════════════════════════════════════════ */

describe('EmperiumGame — catalogo', () => {
  it('tem 13 classes com exatamente 4 variacoes cada (52 no total)', () => {
    expect(ALL_CHARACTERS).toHaveLength(52);
    const porClasse = new Map<string, number>();
    for (const c of ALL_CHARACTERS) porClasse.set(c.classe, (porClasse.get(c.classe) ?? 0) + 1);
    expect(porClasse.size).toBe(13);
    for (const [classe, n] of porClasse) expect([classe, n]).toEqual([classe, 4]);
  });

  it('divide as variacoes em 26 Classicas e 26 Transcendentes', () => {
    expect(DECK_I).toHaveLength(26);
    expect(DECK_II).toHaveLength(26);
  });

  it('nenhuma carta tem mais de 2 palavras-chave (limite da gramatica)', () => {
    for (const c of ALL_CHARACTERS) {
      expect(c.keywords.length).toBeLessThanOrEqual(2);
    }
  });

  it('ids de personagem e equipamento sao unicos', () => {
    expect(new Set(ALL_CHARACTERS.map((c) => c.id)).size).toBe(52);
    expect(new Set(EQUIPMENT.map((e) => e.id)).size).toBe(EQUIPMENT.length);
  });
});

describe('EmperiumGame — setup', () => {
  it('sorteia um defensor que comeca dono do castelo, com mais zeny e mais gente', () => {
    const s = newMatch().snapshot.state;
    expect(s.castleOwnerId).toBe(s.defenderId);
    const def = s.clans[s.defenderId]!;
    expect(def.zeny).toBeGreaterThan(0);
    expect(Object.keys(def.chars)).toHaveLength(3);
    for (const p of PLAYERS) {
      if (p === s.defenderId) continue;
      expect(Object.keys(s.clans[p]!.chars)).toHaveLength(2);
    }
  });

  it('monta o castelo em losango com 7 salas e o defensor controlando tudo', () => {
    const s = newMatch().snapshot.state;
    expect(s.slots).toHaveLength(7);
    for (const slot of s.slots) {
      if (slot === 'emperium') continue;
      expect(s.rooms[slot]!.controlador).toBe(s.defenderId);
    }
  });

  it('comeca na rodada 1, fase de mercado, com o Deck II ainda fora', () => {
    const s = newMatch().snapshot.state;
    expect(s.round).toBe(1);
    expect(s.step).toBe('mercado');
    expect(s.deckIILiberado).toBe(false);
    for (const defId of s.fileiraRecrutamento) {
      expect(CHARACTER_BY_ID.get(defId)!.deck).toBe(1);
    }
  });

  it('a ordem do mercado e inversa a Gloria — quem perde compra primeiro', () => {
    const s = newMatch().snapshot.state;
    expect(s.mercadoOrdem).toHaveLength(PLAYERS.length);
    expect(jogadorDoMercado(s)).toBe(s.mercadoOrdem[0]);
  });
});

describe('EmperiumGame — mercado', () => {
  it('recrutar cobra o custo, entrega o personagem e gasta uma acao', () => {
    const match = newMatch();
    const s0 = match.snapshot.state;
    const p = jogadorDoMercado(s0)!;
    const antes = s0.clans[p]!;
    const alvo = CHARACTER_BY_ID.get(s0.fileiraRecrutamento[0]!)!;
    const zenyAntes = antes.zeny;
    const charsAntes = Object.keys(antes.chars).length;

    match.applyMove(p, 'recrutar', { type: 'recrutar', indice: 0 });

    const depois = match.snapshot.state.clans[p]!;
    expect(depois.zeny).toBe(zenyAntes - alvo.custo);
    expect(Object.keys(depois.chars)).toHaveLength(charsAntes + 1);
    expect(depois.acoesRestantes).toBe(antes.acoesRestantes - 1);
  });

  it('repoe a fileira de recrutamento apos a compra', () => {
    const match = newMatch();
    const p = jogadorDoMercado(match.snapshot.state)!;
    match.applyMove(p, 'recrutar', { type: 'recrutar', indice: 0 });
    expect(match.snapshot.state.fileiraRecrutamento).toHaveLength(5);
  });

  it('passa a vez para o proximo do mercado depois das 3 acoes', () => {
    const match = newMatch();
    const s0 = match.snapshot.state;
    const p = jogadorDoMercado(s0)!;
    for (let i = 0; i < 3; i++) {
      match.applyMove(p, 'passarMercado', { type: 'passarMercado' });
      if (jogadorDoMercado(match.snapshot.state) !== p) break;
    }
    expect(jogadorDoMercado(match.snapshot.state)).not.toBe(p);
  });

  it('rejeita recrutar fora da vez do mercado', () => {
    const match = newMatch();
    const s = match.snapshot.state;
    const p = jogadorDoMercado(s)!;
    const outro = PLAYERS.find((x) => x !== p)!;
    expect(() => match.applyMove(outro, 'recrutar', { type: 'recrutar', indice: 0 })).toThrow();
  });

  it('rejeita indice inexistente na fileira', () => {
    const match = newMatch();
    const p = jogadorDoMercado(match.snapshot.state)!;
    expect(() => match.applyMove(p, 'recrutar', { type: 'recrutar', indice: 99 })).toThrow(
      InvalidMoveError,
    );
  });

  it('chega na fase de comprometimento depois que todos passam', () => {
    const match = newMatch();
    for (let guard = 0; guard < 40; guard++) {
      const s = match.snapshot.state;
      if (s.step !== 'mercado') break;
      const p = jogadorDoMercado(s);
      if (!p) break;
      match.applyMove(p, 'passarMercado', { type: 'passarMercado' });
    }
    expect(match.snapshot.state.step).toBe('comprometimento');
  });
});

describe('EmperiumGame — resolucao de sala', () => {
  it('reproduz o exemplo trabalhado do design (Corredor Estreito, rodada 4)', () => {
    // Ana: Arquimago Nevasca (P4, MURALHA 4, ALCANCE) + Templario Escudeiro (P2)
    // Bruno: Mestre Punho de Asura (P10, SOLO 2) sozinho
    // Carla (defensora): Cacador Armadilheiro (P2, MURALHA 2)
    //                    + Sumo Sacerdote Assumptio (P3, ELO 2)
    const ana = makeClan('ana', ['arq-nevasca', 'tem-escudeiro']);
    // Cajado da Tempestade +2 com uma Carta Hydra encaixada (+2 atacando).
    equiparTeste(ana, ids(ana)[0]!, 'eq-cajado', { refino: 2, cartas: ['mc-hydra'] });
    const bruno = makeClan('bruno', ['mesq-asura']);
    const carla = makeClan('carla', ['cac-armadilheiro', 'sum-assumptio']);
    const state = makeState({ ana, bruno, carla }, {
      tileId: 'sala-corredor',
      castleOwnerId: 'carla',
      round: 4,
    });

    const inputs: RoomInput[] = [
      { playerId: 'ana', commitment: { slot: 'b1', charInstIds: ids(ana), ordem: 'investida' } },
      { playerId: 'bruno', commitment: { slot: 'b1', charInstIds: ids(bruno), ordem: 'emboscada' } },
      { playerId: 'carla', commitment: { slot: 'b1', charInstIds: ids(carla), ordem: 'resguardo' } },
    ];

    const res = resolveRoom(state, 'b1', inputs);
    const de = (p: PlayerId) => res.faccoes.find((f) => f.playerId === p)!;

    // Ana: Nevasca 4 + cajado 3 + refino 2 + Hydra 2 + Escudeiro 2 + investida 3 = 16.
    // Bruno: Asura 10 + SOLO 2 + emboscada 2 = 14.
    // Carla: 2 + 3 + ELO 2 - resguardo 2 = 5.
    expect(de('ana').poderBruto).toBe(16);
    expect(de('bruno').poderBruto).toBe(14);
    expect(de('carla').poderBruto).toBe(5);

    // Muralha: Carla tem 2, Ana tem 4.
    // Ana: 16-2=14. Bruno: 14-2-4=8. Carla: 5-4=1.
    expect(de('ana').poderFinal).toBe(14);
    expect(de('bruno').poderFinal).toBe(8);
    expect(de('carla').poderFinal).toBe(1);
    expect(res.controlador).toBe('ana');

    // Bruno perde por 6 e so tem o Mestre: ele cai.
    expect(de('bruno').baixas).toEqual(ids(bruno));

    // Resguardo cancela as baixas de Carla.
    expect(de('carla').baixas).toEqual([]);
  });

  it('PERFURAR devolve o Poder que a MURALHA tirou', () => {
    // Lorde Espiral (P6, PERFURAR 4) contra Arquimago Nevasca (P4, MURALHA 4).
    const ana = makeClan('ana', ['lor-espiral']);
    const bruno = makeClan('bruno', ['arq-nevasca']);
    const state = makeState({ ana, bruno }, { castleOwnerId: 'bruno' });
    const res = resolveRoom(state, 'b1', [
      { playerId: 'ana', commitment: { slot: 'b1', charInstIds: ids(ana), ordem: 'cerco' } },
      { playerId: 'bruno', commitment: { slot: 'b1', charInstIds: ids(bruno), ordem: 'cerco' } },
    ]);
    const ana_ = res.faccoes.find((f) => f.playerId === 'ana')!;
    // 6 - 1 (cerco) = 5 bruto; Muralha 4 - Perfurar 4 = 0 de reducao.
    expect(ana_.poderBruto).toBe(5);
    expect(ana_.poderFinal).toBe(5);
  });

  it('ELO cresce com o tamanho do grupo e SOLO so vale sozinho', () => {
    const grupo = makeClan('ana', ['sac-suporte', 'mon-combo', 'cav-lanca']);
    const state = makeState({ ana: grupo }, { castleOwnerId: 'ana' });
    const res = resolveRoom(state, 'b1', [
      { playerId: 'ana', commitment: { slot: 'b1', charInstIds: ids(grupo), ordem: 'cerco' } },
    ]);
    // Sacerdote Suporte P1 + ELO 2 x 2 outros = 5; Monge 4; Lanceiro 3. -1 cerco.
    expect(res.faccoes[0]!.poderBruto).toBe(1 + 4 + 4 + 3 - 1);
  });

  it('empate no topo: ninguem controla e os empatados sofrem baixa', () => {
    const ana = makeClan('ana', ['mon-combo']);
    const bruno = makeClan('bruno', ['mon-combo']);
    const state = makeState({ ana, bruno }, { castleOwnerId: 'carla' });
    const res = resolveRoom(state, 'b1', [
      { playerId: 'ana', commitment: { slot: 'b1', charInstIds: ids(ana), ordem: 'cerco' } },
      { playerId: 'bruno', commitment: { slot: 'b1', charInstIds: ids(bruno), ordem: 'cerco' } },
    ]);
    expect(res.controlador).toBeNull();
    expect(res.faccoes[0]!.baixas.length).toBe(1);
    expect(res.faccoes[1]!.baixas.length).toBe(1);
  });

  it('dois atacantes na mesma sala sao faccoes inimigas — o perdedor sangra', () => {
    const ana = makeClan('ana', ['lor-berserk']); // P8
    const bruno = makeClan('bruno', ['cav-lanca']); // P3
    const carla = makeClan('carla', ['sup-teimoso']); // defensora fraca, P2
    const state = makeState({ ana, bruno, carla }, { castleOwnerId: 'carla', round: 4 });
    const res = resolveRoom(state, 'b1', [
      { playerId: 'ana', commitment: { slot: 'b1', charInstIds: ids(ana), ordem: 'cerco' } },
      { playerId: 'bruno', commitment: { slot: 'b1', charInstIds: ids(bruno), ordem: 'cerco' } },
      { playerId: 'carla', commitment: { slot: 'b1', charInstIds: ids(carla), ordem: 'cerco' } },
    ]);
    expect(res.controlador).toBe('ana');
    // Bruno superou Carla mas perdeu para Ana: sangra do mesmo jeito.
    expect(res.faccoes.find((f) => f.playerId === 'bruno')!.baixas.length).toBeGreaterThan(0);
  });

  it('ESCUDAR cai antes dos outros personagens da faccao', () => {
    const ana = makeClan('ana', ['tem-escudeiro', 'bru-jupitel']);
    const bruno = makeClan('bruno', ['arq-meteoros']);
    const state = makeState({ ana, bruno }, { castleOwnerId: 'bruno' });
    const res = resolveRoom(state, 'b1', [
      { playerId: 'ana', commitment: { slot: 'b1', charInstIds: ids(ana), ordem: 'cerco' } },
      { playerId: 'bruno', commitment: { slot: 'b1', charInstIds: ids(bruno), ordem: 'investida' } },
    ]);
    const baixas = res.faccoes.find((f) => f.playerId === 'ana')!.baixas;
    expect(baixas[0]).toBe(ids(ana)[0]); // o Escudeiro
  });

  it('as baixas nunca passam de metade dos personagens da faccao', () => {
    const ana = makeClan('ana', ['sup-teimoso', 'sup-teimoso', 'sup-teimoso', 'sup-teimoso']);
    const bruno = makeClan('bruno', ['mesq-asura']);
    const state = makeState({ ana, bruno }, { castleOwnerId: 'bruno', round: 4 });
    const res = resolveRoom(state, 'b1', [
      { playerId: 'ana', commitment: { slot: 'b1', charInstIds: ids(ana), ordem: 'cerco' } },
      { playerId: 'bruno', commitment: { slot: 'b1', charInstIds: ids(bruno), ordem: 'investida' } },
    ]);
    expect(res.faccoes.find((f) => f.playerId === 'ana')!.baixas.length).toBeLessThanOrEqual(2);
  });
});

describe('EmperiumGame — Sala do Emperium', () => {
  it('o escudo absorve em ordem CRESCENTE: mandar pouco e dano zero', () => {
    // Escudo base rodada 4 = 6. Defensora carla sem ninguem la: escudo 6.
    const ana = makeClan('ana', ['cav-lanca']); // P3
    const bruno = makeClan('bruno', ['lor-berserk']); // P8
    const carla = makeClan('carla', []);
    const state = makeState({ ana, bruno, carla }, { castleOwnerId: 'carla', round: 4 });

    const res = resolveEmperium(state, [
      { playerId: 'ana', commitment: { slot: 'emperium', charInstIds: ids(ana), ordem: 'cerco' } },
      { playerId: 'bruno', commitment: { slot: 'emperium', charInstIds: ids(bruno), ordem: 'cerco' } },
    ]);

    // Ana 3-1=2 é absorvida inteira (escudo 6 -> 4). Bruno 8-1=7 passa 3.
    expect(res.danoPorJogador!['ana']).toBe(0);
    expect(res.danoPorJogador!['bruno']).toBe(3);
    // Ana foi totalmente absorvida: sofre 1 baixa.
    expect(res.faccoes.find((f) => f.playerId === 'ana')!.baixas.length).toBe(1);
  });

  it('o escudo decai com a rodada, deixando o fim de jogo explosivo', () => {
    const ana = makeClan('ana', ['lor-berserk']); // P8
    const carla = makeClan('carla', []);
    const dano = (round: number) => {
      const state = makeState({ ana, carla }, { castleOwnerId: 'carla', round });
      const res = resolveEmperium(state, [
        { playerId: 'ana', commitment: { slot: 'emperium', charInstIds: ids(ana), ordem: 'cerco' } },
      ]);
      return res.danoPorJogador!['ana'] ?? 0;
    };
    expect(dano(1)).toBe(0); // escudo 8 vs poder 7
    expect(dano(6)).toBe(5); // escudo 2 vs poder 7
  });

  it('quebra o Emperium e entrega o castelo a quem colocou mais cubos', () => {
    const ana = makeClan('ana', ['mesq-asura']); // P10 + SOLO 2 = 12
    const carla = makeClan('carla', []);
    const state = makeState({ ana, carla }, { castleOwnerId: 'carla', round: 6 });
    state.emperiumDurabilidade = 8;
    const res = resolveEmperium(state, [
      { playerId: 'ana', commitment: { slot: 'emperium', charInstIds: ids(ana), ordem: 'cerco' } },
    ]);
    expect(res.emperiumQuebrado).toBe(true);
    expect(res.novoDono).toBe('ana');
  });
});

describe('EmperiumGame — informacao oculta', () => {
  it('esconde o comprometimento alheio durante a fase simultanea', () => {
    const match = newMatch();
    for (let guard = 0; guard < 40; guard++) {
      const s = match.snapshot.state;
      if (s.step !== 'mercado') break;
      const p = jogadorDoMercado(s);
      if (!p) break;
      match.applyMove(p, 'passarMercado', { type: 'passarMercado' });
    }
    expect(match.snapshot.state.step).toBe('comprometimento');

    const view = new EmperiumGame().playerView(
      match.snapshot.state,
      { ...match.snapshot, actor: 'ana' } as never,
      'ana',
    ) as Record<string, unknown>;

    expect(view['todosComprometimentos']).toBeUndefined();
    const clans = view['clans'] as Record<string, Record<string, unknown>>;
    expect(clans['ana']!['consumiveis']).toBeDefined();
    expect(clans['bruno']!['consumiveis']).toBeUndefined();
    expect(clans['bruno']!['consumiveisCount']).toBeDefined();
  });
});

describe('EmperiumGame — partida completa', () => {
  /** Todos passam o mercado e comprometem no portao com o que tiverem. */
  function jogarRodada(match: GameInstance<EmperiumState>): void {
    for (let guard = 0; guard < 60; guard++) {
      const s = match.snapshot.state;
      if (s.step !== 'mercado') break;
      const p = jogadorDoMercado(s);
      if (!p) break;
      match.applyMove(p, 'passarMercado', { type: 'passarMercado' });
    }
    const s = match.snapshot.state;
    if (s.step !== 'comprometimento') return;
    for (const p of s.order) {
      const clan = s.clans[p]!;
      const disponiveis = Object.values(clan.chars)
        .filter((c) => c.local === 'reserva')
        .map((c) => c.instId);
      const commitments =
        disponiveis.length > 0
          ? [{ slot: 'portao' as const, charInstIds: disponiveis, ordem: 'investida' as const }]
          : [];
      match.applyMove(p, 'confirmarComprometimento', {
        type: 'confirmarComprometimento',
        commitments,
      });
    }
  }

  it('avanca as rodadas e termina na 6 com um vencedor por Gloria', () => {
    const match = newMatch();
    for (let r = 0; r < TOTAL_ROUNDS + 2; r++) {
      if (match.snapshot.state.finished) break;
      jogarRodada(match);
    }
    const s = match.snapshot.state;
    expect(s.finished).toBe(true);
    expect(s.round).toBe(TOTAL_ROUNDS);
    expect(s.winnerId).toBeDefined();
    // O defensor segurou o castelo a partida inteira: 5x2 + 8 = 18 de Gloria.
    expect(s.clans[s.castleOwnerId]!.gloria).toBeGreaterThanOrEqual(GLORIA_MINIMA_DONO);
  });

  it('libera o Deck II a partir da rodada 3', () => {
    const match = newMatch();
    jogarRodada(match);
    expect(match.snapshot.state.deckIILiberado).toBe(false);
    jogarRodada(match);
    expect(match.snapshot.state.round).toBe(3);
    expect(match.snapshot.state.deckIILiberado).toBe(true);
  });
});

const GLORIA_MINIMA_DONO = 18;
