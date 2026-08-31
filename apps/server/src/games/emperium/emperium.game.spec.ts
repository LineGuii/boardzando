import type { PlayerId } from '@boardzando/contracts';
import { GameInstance, InvalidMoveError } from '../../core/engine/game-instance';
import {
  ALL_CHARACTERS,
  CHARACTER_BY_ID,
  DECK_I,
  EQUIPMENT,
  TRANSCENDENCIAS,
  TRANSCENDENCIA_BY_ID,
  caminhosDaClasse,
} from './emperium.cards';
import { EmperiumGame } from './emperium.game';
import { jogadorDoMercado } from './emperium.moves';
import {
  ANULAVEIS,
  aplicarInfiltracoes,
  resolveEmperium,
  resolveRoom,
  type RoomInput,
} from './emperium.resolve';
import {
  ADJACENCY,
  FIXED_TILES,
  LIMITE_PADRAO,
  ROOM_SLOTS,
  TILE_BY_ID,
  TOTAL_ROUNDS,
  WING_TILES,
} from './emperium.rooms';
import {
  MARCHA_PENALIDADE,
  allowedSlots,
  slotDistances,
  type Clan,
  type EmperiumState,
  type OrderId,
  type RoomState,
} from './emperium.state';

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
    altarAberto: true,
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

interface CommitmentTeste {
  ordem: OrderId;
  combo?: string;
  anulares?: { charInstId: string; alvoInstId: string; keyword: string }[];
}

const ids = (clan: Clan) => Object.keys(clan.chars);

/** Empilha uma evolucao do Altar sobre um personagem ja existente. */
function transcenderTeste(clan: Clan, charInstId: string, transId: string): void {
  clan.chars[charInstId]!.transcendencia = transId;
}

/** Um cla com um unico personagem, ja transcendido. */
function makeClanTr(playerId: PlayerId, defId: string, transId: string): Clan {
  const clan = makeClan(playerId, [defId]);
  transcenderTeste(clan, ids(clan)[0]!, transId);
  return clan;
}

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
    const disponiveis = Object.values(s.clans[p]!.chars)
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

/* ═════════════════════════════════════════════════════════════════════════ */

describe('EmperiumGame — catalogo', () => {
  it('tem 14 classes com 3 variacoes base cada (42 no total)', () => {
    expect(DECK_I).toHaveLength(42);
    expect(ALL_CHARACTERS).toHaveLength(42);
    const porClasse = new Map<string, number>();
    for (const c of ALL_CHARACTERS) porClasse.set(c.classe, (porClasse.get(c.classe) ?? 0) + 1);
    expect(porClasse.size).toBe(14);
    for (const [classe, n] of porClasse) expect([classe, n]).toEqual([classe, 3]);
  });

  it('tem 3 caminhos de Transcendencia por classe (42 no total)', () => {
    expect(TRANSCENDENCIAS).toHaveLength(42);
    for (const c of DECK_I) {
      expect(caminhosDaClasse(c.classe)).toHaveLength(3);
    }
  });

  it('base x caminho da 9 desfechos por classe, 126 no total', () => {
    const desfechos = DECK_I.reduce((n, c) => n + caminhosDaClasse(c.classe).length, 0);
    expect(desfechos).toBe(126);
  });

  it('toda Transcendencia aponta para uma classe que existe', () => {
    const classes = new Set(DECK_I.map((c) => c.classe));
    for (const t of TRANSCENDENCIAS) expect(classes.has(t.classe)).toBe(true);
  });

  it('nenhuma carta tem mais de 2 palavras-chave (limite da gramatica)', () => {
    for (const c of ALL_CHARACTERS) expect(c.keywords.length).toBeLessThanOrEqual(2);
    for (const t of TRANSCENDENCIAS) expect(t.keywords.length).toBeLessThanOrEqual(2);
  });

  it('ids sao unicos em personagens, evolucoes e equipamentos', () => {
    expect(new Set(ALL_CHARACTERS.map((c) => c.id)).size).toBe(42);
    expect(new Set(TRANSCENDENCIAS.map((t) => t.id)).size).toBe(42);
    expect(new Set(EQUIPMENT.map((e) => e.id)).size).toBe(EQUIPMENT.length);
  });

  it('a Transcendencia nunca sai mais barata que o recrutamento mais caro', () => {
    // Evoluir e investimento, nao atalho: o personagem transcendido custa o
    // recrutamento MAIS a evolucao, e por isso perde-lo doi.
    const maiorBase = Math.max(...DECK_I.map((c) => c.custo));
    for (const t of TRANSCENDENCIAS) expect(t.custo).toBeGreaterThanOrEqual(maiorBase);
  });

  it('so o Superaprendiz evolui barato — ele nao transcende, so insiste', () => {
    const baratas = TRANSCENDENCIAS.filter((t) => t.custo < 9);
    expect(baratas.every((t) => t.classe === 'Superaprendiz')).toBe(true);
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
    expect(s.altarAberto).toBe(false);
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

describe('EmperiumGame — Transcendencia', () => {
  it('SOMA Poder e palavras-chave a carta base em vez de substitui-la', () => {
    // Bruxo Tempestade: Poder 3, MURALHA 2, ALCANCE.
    // + Arquimago Nevasca: +2 Poder, +MURALHA 2  =>  Poder 5, MURALHA 4.
    const ana = makeClan('ana', ['bru-tempestade']);
    ana.chars[ids(ana)[0]!]!.transcendencia = 'tr-bru-nevasca';
    // Bruno com tropa suficiente para a reducao inteira aparecer: a Muralha
    // nunca empurra o Poder abaixo de zero.
    const bruno = makeClan('bruno', ['mon-combo', 'mon-combo']);
    const state = makeState({ ana, bruno }, { castleOwnerId: 'bruno' });

    const res = resolveRoom(state, 'b1', [
      { playerId: 'ana', commitment: { slot: 'b1', charInstIds: ids(ana), ordem: 'cerco', marcha: 0 } },
      { playerId: 'bruno', commitment: { slot: 'b1', charInstIds: ids(bruno), ordem: 'cerco', marcha: 0 } },
    ]);
    const anaRes = res.clas.find((f) => f.playerId === 'ana')!;
    const brunoRes = res.clas.find((f) => f.playerId === 'bruno')!;

    // base 3 + evolucao 2 + 1 (Pátio Aberto premia ALCANCE) - 1 (cerco).
    expect(anaRes.poderBruto).toBe(3 + 2 + 1 - 1);
    // Muralha 2 (base) + 2 (evolucao) = 4, aplicada em Bruno.
    expect(brunoRes.poderBruto - brunoRes.poderFinal).toBe(4);
  });

  it('qual base transcendeu continua importando', () => {
    // O mesmo caminho sobre bases diferentes produz personagens diferentes.
    const comTempestade = makeClan('ana', ['bru-tempestade']); // 3, MURALHA 2
    comTempestade.chars[ids(comTempestade)[0]!]!.transcendencia = 'tr-bru-nevasca';
    const comJupitel = makeClan('bruno', ['bru-jupitel']); // 4, sem muralha
    comJupitel.chars[ids(comJupitel)[0]!]!.transcendencia = 'tr-bru-nevasca';
    const state = makeState({ ana: comTempestade, bruno: comJupitel }, { castleOwnerId: 'carla' });

    const res = resolveRoom(state, 'b1', [
      { playerId: 'ana', commitment: { slot: 'b1', charInstIds: ids(comTempestade), ordem: 'cerco', marcha: 0 } },
      { playerId: 'bruno', commitment: { slot: 'b1', charInstIds: ids(comJupitel), ordem: 'cerco', marcha: 0 } },
    ]);
    const a = res.clas.find((f) => f.playerId === 'ana')!;
    const b = res.clas.find((f) => f.playerId === 'bruno')!;
    // Jupitel tem mais Poder bruto, Tempestade tem mais Muralha: sao builds
    // distintos mesmo com a MESMA evolucao comprada.
    expect(b.poderBruto).toBeGreaterThan(a.poderBruto);
    expect(a.poderFinal).toBeGreaterThan(b.poderFinal);
  });

  it('o move cobra o custo, marca o personagem e gasta uma acao', () => {
    const match = newMatch();
    // Forca o Altar aberto e da dinheiro, sem mexer no resto do fluxo.
    const p = jogadorDoMercado(match.snapshot.state)!;
    const st = match.snapshot.state;
    st.altarAberto = true;
    st.clans[p]!.zeny = 40;
    const alvoId = Object.keys(st.clans[p]!.chars)[0]!;
    const classe = CHARACTER_BY_ID.get(st.clans[p]!.chars[alvoId]!.defId)!.classe;
    const caminho = caminhosDaClasse(classe)[0]!;

    match.applyMove(p, 'transcender', {
      type: 'transcender',
      charInstId: alvoId,
      transId: caminho.id,
    });

    const depois = match.snapshot.state.clans[p]!;
    expect(depois.chars[alvoId]!.transcendencia).toBe(caminho.id);
    expect(depois.zeny).toBe(40 - caminho.custo);
    expect(depois.acoesRestantes).toBe(2);
  });

  it('rejeita caminho de outra classe, e transcender duas vezes', () => {
    const match = newMatch();
    const p = jogadorDoMercado(match.snapshot.state)!;
    const st = match.snapshot.state;
    st.altarAberto = true;
    st.clans[p]!.zeny = 60;
    const alvoId = Object.keys(st.clans[p]!.chars)[0]!;
    const classe = CHARACTER_BY_ID.get(st.clans[p]!.chars[alvoId]!.defId)!.classe;
    const outraClasse = TRANSCENDENCIAS.find((t) => t.classe !== classe)!;

    expect(() =>
      match.applyMove(p, 'transcender', {
        type: 'transcender',
        charInstId: alvoId,
        transId: outraClasse.id,
      }),
    ).toThrow(InvalidMoveError);

    const caminho = caminhosDaClasse(classe)[0]!;
    match.applyMove(p, 'transcender', { type: 'transcender', charInstId: alvoId, transId: caminho.id });
    expect(() =>
      match.applyMove(p, 'transcender', {
        type: 'transcender',
        charInstId: alvoId,
        transId: caminhosDaClasse(classe)[1]!.id,
      }),
    ).toThrow(InvalidMoveError);
  });

  it('rejeita transcender antes do Altar abrir', () => {
    const match = newMatch();
    const p = jogadorDoMercado(match.snapshot.state)!;
    const st = match.snapshot.state;
    expect(st.altarAberto).toBe(false);
    st.clans[p]!.zeny = 40;
    const alvoId = Object.keys(st.clans[p]!.chars)[0]!;
    const classe = CHARACTER_BY_ID.get(st.clans[p]!.chars[alvoId]!.defId)!.classe;
    expect(() =>
      match.applyMove(p, 'transcender', {
        type: 'transcender',
        charInstId: alvoId,
        transId: caminhosDaClasse(classe)[0]!.id,
      }),
    ).toThrow(InvalidMoveError);
  });

  it('transcender um caido na Enfermaria o traz de volta na hora (Rebirth)', () => {
    const match = newMatch();
    const p = jogadorDoMercado(match.snapshot.state)!;
    const st = match.snapshot.state;
    st.altarAberto = true;
    st.clans[p]!.zeny = 40;
    const alvoId = Object.keys(st.clans[p]!.chars)[0]!;
    st.clans[p]!.chars[alvoId]!.local = 'enfermaria';
    st.clans[p]!.chars[alvoId]!.voltaNaRodada = 99;
    const classe = CHARACTER_BY_ID.get(st.clans[p]!.chars[alvoId]!.defId)!.classe;

    match.applyMove(p, 'transcender', {
      type: 'transcender',
      charInstId: alvoId,
      transId: caminhosDaClasse(classe)[0]!.id,
    });

    const depois = match.snapshot.state.clans[p]!.chars[alvoId]!;
    expect(depois.local).toBe('reserva');
    expect(depois.voltaNaRodada).toBeUndefined();
  });

  it('MOVER encurta a Marcha Forcada em vez de anula-la', () => {
    const semGuia = makeClan('ana', ['mon-combo']);
    const comGuia = makeClan('bruno', ['mon-combo']);
    comGuia.chars[ids(comGuia)[0]!]!.transcendencia = 'tr-mon-salto';
    const state = makeState({ ana: semGuia, bruno: comGuia }, { castleOwnerId: 'carla' });

    const res = resolveRoom(state, 'b1', [
      { playerId: 'ana', commitment: { slot: 'b1', charInstIds: ids(semGuia), ordem: 'cerco', marcha: 3 } },
      { playerId: 'bruno', commitment: { slot: 'b1', charInstIds: ids(comGuia), ordem: 'cerco', marcha: 3 } },
    ]);
    const a = res.clas.find((f) => f.playerId === 'ana')!;
    const b = res.clas.find((f) => f.playerId === 'bruno')!;
    expect(a.poderBruto).toBe(4 - 1 - MARCHA_PENALIDADE * 3);
    // Salto e MOVER 2: das 3 salas de marcha, so 1 e paga.
    expect(b.poderBruto).toBe(4 + 3 - 1 - MARCHA_PENALIDADE);
  });

  it('o Altar abre na rodada 3 sem mexer no baralho de recrutamento', () => {
    const match = newMatch();
    jogarRodada(match);
    expect(match.snapshot.state.altarAberto).toBe(false);
    jogarRodada(match);
    const s = match.snapshot.state;
    expect(s.round).toBe(3);
    expect(s.altarAberto).toBe(true);
    // A fileira continua sendo so de cartas base.
    for (const defId of s.fileiraRecrutamento) expect(CHARACTER_BY_ID.get(defId)).toBeDefined();
    expect(TRANSCENDENCIA_BY_ID.get(s.fileiraRecrutamento[0] ?? '')).toBeUndefined();
  });
});

describe('EmperiumGame — as Ordens', () => {
  it('so a Sala do Emperium fica sem limite — e por isso o Cerco vale a pena', () => {
    // Sem limite quase universal, o Cerco so servia no Corredor Estreito.
    const semLimite = [...WING_TILES, ...Object.values(FIXED_TILES)].filter((t) => t.limite === 0);
    expect(semLimite.map((t) => t.nome)).toEqual(['Sala do Emperium']);
  });

  it('3 e o limite da maioria; 2 no Corredor e 4 nas duas salas amplas', () => {
    const porLimite = new Map<number, string[]>();
    for (const t of [...WING_TILES, ...Object.values(FIXED_TILES)]) {
      porLimite.set(t.limite, [...(porLimite.get(t.limite) ?? []), t.nome].sort());
    }
    expect(porLimite.get(2)).toEqual(['Corredor Estreito']);
    expect(porLimite.get(4)).toEqual(['Pátio Aberto', 'Salão do Trono']);
    expect(porLimite.get(0)).toEqual(['Sala do Emperium']);
    // A maioria: as onze restantes.
    expect(porLimite.get(LIMITE_PADRAO)).toHaveLength(11);
  });

  it('o limite barra o comprometimento, e o Cerco atravessa', () => {
    const match = newMatch();
    for (let guard = 0; guard < 40; guard++) {
      const st = match.snapshot.state;
      if (st.step !== 'mercado') break;
      const p = jogadorDoMercado(st);
      if (!p) break;
      match.applyMove(p, 'passarMercado', { type: 'passarMercado' });
    }
    const st = match.snapshot.state;
    // O defensor comeca com 3 personagens: cabe no Portao (3), nao no Corredor (2).
    const dono = st.castleOwnerId;
    const meus = Object.values(st.clans[dono]!.chars)
      .filter((c) => c.local === 'reserva')
      .map((c) => c.instId);
    expect(meus.length).toBeGreaterThanOrEqual(3);

    const salaDeDois = st.slots.find(
      (sl) => TILE_BY_ID.get(st.rooms[sl]!.tileId)?.limite === 2,
    );
    if (!salaDeDois) return; // o Corredor nao entrou nesta partida

    expect(() =>
      match.applyMove(dono, 'confirmarComprometimento', {
        type: 'confirmarComprometimento',
        commitments: [{ slot: salaDeDois, charInstIds: meus.slice(0, 3), ordem: 'investida' }],
      }),
    ).toThrow(InvalidMoveError);

    // Com Cerco, os mesmos tres passam.
    match.applyMove(dono, 'confirmarComprometimento', {
      type: 'confirmarComprometimento',
      commitments: [{ slot: salaDeDois, charInstIds: meus.slice(0, 3), ordem: 'cerco' }],
    });
    expect(match.snapshot.state.confirmados).toContain(dono);
  });

  it('a EMBOSCADA cancela o bonus positivo da Ordem alheia', () => {
    const emboscador = makeClan('ana', ['mon-combo']);
    const investida = makeClan('bruno', ['mon-combo']);
    const state = makeState({ ana: emboscador, bruno: investida }, { castleOwnerId: 'carla' });

    const semEmboscada = resolveRoom(state, 'b1', [
      { playerId: 'ana', commitment: { slot: 'b1', charInstIds: ids(emboscador), ordem: 'cerco', marcha: 0 } },
      { playerId: 'bruno', commitment: { slot: 'b1', charInstIds: ids(investida), ordem: 'investida', marcha: 0 } },
    ]);
    const comEmboscada = resolveRoom(state, 'b1', [
      { playerId: 'ana', commitment: { slot: 'b1', charInstIds: ids(emboscador), ordem: 'emboscada', marcha: 0 } },
      { playerId: 'bruno', commitment: { slot: 'b1', charInstIds: ids(investida), ordem: 'investida', marcha: 0 } },
    ]);

    const brunoSem = semEmboscada.clas.find((f) => f.playerId === 'bruno')!;
    const brunoCom = comEmboscada.clas.find((f) => f.playerId === 'bruno')!;
    expect(brunoSem.poderBruto - brunoCom.poderBruto).toBe(3); // os +3 da Investida
    expect(brunoCom.emboscado).toBe(true);
  });

  it('a EMBOSCADA nao devolve o -2 de quem se resguardou', () => {
    const emboscador = makeClan('ana', ['mon-combo']);
    const recuado = makeClan('bruno', ['mon-combo']);
    const state = makeState({ ana: emboscador, bruno: recuado }, { castleOwnerId: 'carla' });
    const res = resolveRoom(state, 'b1', [
      { playerId: 'ana', commitment: { slot: 'b1', charInstIds: ids(emboscador), ordem: 'emboscada', marcha: 0 } },
      { playerId: 'bruno', commitment: { slot: 'b1', charInstIds: ids(recuado), ordem: 'resguardo', marcha: 0 } },
    ]);
    const bruno = res.clas.find((f) => f.playerId === 'bruno')!;
    expect(bruno.poderBruto).toBe(4 - 2); // Monge 4, Resguardo -2 mantido
    expect(bruno.emboscado).toBe(false);
  });

  it('duas Emboscadas se cancelam: ambas perdem o bonus', () => {
    const ana = makeClan('ana', ['mon-combo']);
    const bruno = makeClan('bruno', ['mon-combo']);
    const state = makeState({ ana, bruno }, { castleOwnerId: 'carla' });
    const res = resolveRoom(state, 'b1', [
      { playerId: 'ana', commitment: { slot: 'b1', charInstIds: ids(ana), ordem: 'emboscada', marcha: 0 } },
      { playerId: 'bruno', commitment: { slot: 'b1', charInstIds: ids(bruno), ordem: 'emboscada', marcha: 0 } },
    ]);
    // Com duas Emboscadas o bonus ja e -2 (nao exclusiva), entao nao ha bonus
    // positivo para cancelar — as duas ficam com Poder 4 - 2 = 2.
    for (const f of res.clas) expect(f.poderBruto).toBe(2);
  });
});

describe('EmperiumGame — Combos', () => {
  /** Resolve uma sala com combos declarados. */
  function sala(
    clans: Record<PlayerId, Clan>,
    decls: Record<PlayerId, { ordem?: OrderId; combo?: string; marcha?: number }>,
    opts: { tileId?: string; castleOwnerId?: PlayerId } = {},
  ) {
    const state = makeState(clans, { tileId: opts.tileId ?? 'sala-corredor', ...opts });
    const inputs: RoomInput[] = Object.keys(clans).map((p) => ({
      playerId: p,
      commitment: {
        slot: 'b1',
        charInstIds: ids(clans[p]!),
        ordem: decls[p]?.ordem ?? 'cerco',
        combo: decls[p]?.combo,
        marcha: decls[p]?.marcha ?? 0,
      },
    }));
    const res = resolveRoom(state, 'b1', inputs);
    return { res, de: (p: PlayerId) => res.clas.find((f) => f.playerId === p)! };
  }

  it('so acende com o companheiro exigido na sala', () => {
    // Sabio Protecao de Solo: COMBO Bruxo -> a cla ignora toda a Muralha.
    const semBruxo = makeClan('ana', ['sab-solo', 'mon-combo']); // sem Bruxo junto
    const comBruxo = makeClan('bruno', ['sab-solo', 'bru-jupitel']);
    // Parede grossa o bastante para o ANULAR do proprio Sabio nao zerar sozinho.
    const parede = () => makeClan('carla', ['bru-tempestade', 'bru-tempestade']);

    const a = sala({ ana: semBruxo, carla: parede() }, { ana: { combo: ids(semBruxo)[0] } });
    const b = sala({ bruno: comBruxo, carla: parede() }, { bruno: { combo: ids(comBruxo)[0] } });

    expect(a.de('ana').combo).toBeUndefined(); // sem Bruxo, nao acende
    expect(b.de('bruno').combo).toContain('COMBO Bruxo');
    // Com o combo aceso, nenhuma Muralha morde.
    expect(b.de('bruno').poderBruto - b.de('bruno').poderFinal).toBe(0);
    // Sem ele, o que o ANULAR nao apagou ainda machuca.
    expect(a.de('ana').poderBruto - a.de('ana').poderFinal).toBeGreaterThan(0);
  });

  it('so UM combo por cla, e e o declarado no comprometimento', () => {
    // Dois portadores de combo na mesma sala; so o declarado dispara.
    const ana = makeClan('ana', ['sab-solo', 'bru-jupitel', 'fer-mercador']);
    const carla = makeClan('carla', ['bru-tempestade']);
    const semDeclarar = sala({ ana, carla }, {});
    const declarandoSabio = sala({ ana, carla }, { ana: { combo: ids(ana)[0] } });

    expect(semDeclarar.de('ana').combo).toBeUndefined();
    expect(declarandoSabio.de('ana').combo).toContain('COMBO Bruxo');
    // O combo do Ferreiro (poder por zeny) NAO entrou junto.
    expect(declarandoSabio.de('ana').combo).not.toContain('zeny');
  });

  it('EXPOSTO zera a Muralha do alvo — e dispara sem ser declarado', () => {
    // Alquimista Boticario: ESPECIAL -> a maior cla inimiga fica EXPOSTA.
    // Como ESPECIAL nao se declara, o controle e a PRESENCA dele na sala.
    const sem = makeClan('ana', ['mon-combo', 'mon-combo']);
    const com = makeClan('ana', ['alq-boticario', 'mon-combo']);
    const parede = () => makeClan('carla', ['bru-tempestade', 'bru-tempestade']); // MURALHA 4

    const semEle = sala({ ana: sem, carla: parede() }, {});
    // Nenhuma declaracao: o ESPECIAL acende so por ele estar ali.
    const comEle = sala({ ana: com, carla: parede() }, {});

    expect(semEle.de('ana').poderBruto - semEle.de('ana').poderFinal).toBeGreaterThan(0);
    expect(comEle.de('ana').poderBruto - comEle.de('ana').poderFinal).toBe(0);
    expect(comEle.de('carla').marcas).toContain('exposto');
  });

  it('PRESO tira o bonus da Ordem e o Proteger do alvo', () => {
    // Monge Corpo de Aco: COMBO -> a maior cla inimiga fica PRESA.
    const ana = makeClan('ana', ['mon-aco', 'mon-combo']);
    const carla = makeClan('carla', ['tem-escudeiro', 'cav-bb']);
    const r = sala({ ana, carla }, { ana: { combo: ids(ana)[0] }, carla: { ordem: 'investida' } });

    const c = r.de('carla');
    expect(c.marcas).toContain('preso');
    // O +3 da Investida foi embora.
    expect(c.poderBruto).toBe(2 + 4 + 1); // Escudeiro 2 + Bola de Boliche 4 + ELO 1, sem Investida
  });

  it('o Professor devolve o folego do Monge — o segundo Asura', () => {
    const ana = makeClan('ana', ['sab-encantador', 'mon-combo']);
    transcenderTeste(ana, ids(ana)[0]!, 'tr-sab-memorizar'); // COMBO Monge: cancela Esgotar
    transcenderTeste(ana, ids(ana)[1]!, 'tr-mon-asura'); // ESGOTAR
    const carla = makeClan('carla', ['sup-teimoso']);
    const r = sala({ ana, carla }, { ana: { combo: ids(ana)[0] } });

    expect(r.de('ana').combo).toContain('COMBO Monge');
    expect(r.de('ana').cancelaEsgotar).toBe(true);
  });

  it('o tanque protege o conjurador de sofrer baixa', () => {
    // Templario Defensor: COMBO Arcano -> seus Arcanos nao sofrem baixa.
    const ana = makeClan('ana', ['tem-defensor', 'bru-jupitel']);
    const carla = makeClan('carla', ['mon-combo', 'mon-combo', 'mon-combo']);
    const r = sala({ ana, carla }, { ana: { combo: ids(ana)[0] }, carla: { ordem: 'investida' } });

    const baixas = r.de('ana').baixas;
    expect(baixas.length).toBeGreaterThan(0);
    // O Bruxo (Arcano) esta protegido: so o Templario pode cair.
    expect(baixas).not.toContain(ids(ana)[1]);
  });

  it('o Ferreiro converte o bolso em Poder', () => {
    const rico = makeClan('ana', ['fer-mercador']);
    rico.zeny = 40;
    const pobre = makeClan('bruno', ['fer-mercador']);
    pobre.zeny = 5;
    const r = sala(
      { ana: rico, bruno: pobre },
      { ana: { combo: ids(rico)[0] }, bruno: { combo: ids(pobre)[0] } },
    );
    // +1 a cada 5 zeny: 40 -> +8, 5 -> +1.
    expect(r.de('ana').poderBruto - r.de('bruno').poderBruto).toBe(7);
  });

  it('RAPTO arranca 1 inimigo da sala antes da soma', () => {
    const ana = makeClan('ana', ['arr-gatuno', 'mer-furtivo']); // Gatuno: COMBO Agil -> RAPTO
    const carla = makeClan('carla', ['mon-combo', 'sup-teimoso']);
    const semRapto = sala({ ana, carla }, {});
    const comRapto = sala({ ana, carla }, { ana: { combo: ids(ana)[0] } });

    expect(comRapto.res.raptados).toHaveLength(1);
    // O de maior Poder de carta (o Monge, 4) foi arrancado.
    expect(comRapto.res.raptados[0]).toBe(ids(carla)[0]);
    expect(comRapto.de('carla').poderBruto).toBeLessThan(semRapto.de('carla').poderBruto);
  });

  it('o raptado nao conta como baixa — ele so sai da sala', () => {
    const ana = makeClan('ana', ['arr-gatuno', 'mer-furtivo']);
    const carla = makeClan('carla', ['mon-combo', 'sup-teimoso']);
    const r = sala({ ana, carla }, { ana: { combo: ids(ana)[0] } });
    expect(r.de('carla').baixas).not.toContain(r.res.raptados[0]);
  });

  it('um combo de MOVER devolve parte da Marcha Forcada da cla inteira', () => {
    // Sacerdote Suporte: COMBO Vanguarda -> a cla inteira ganha MOVER 1.
    const ana = makeClan('ana', ['sac-suporte', 'cav-bb']);
    const carla = makeClan('carla', ['sup-teimoso']);
    const sem = sala({ ana, carla }, { ana: { marcha: 3 } });
    const com = sala({ ana, carla }, { ana: { marcha: 3, combo: ids(ana)[0] } });
    expect(com.de('ana').poderBruto - sem.de('ana').poderBruto).toBe(MARCHA_PENALIDADE);
  });

  it('a evolucao substitui o combo da base quando traz um', () => {
    // Arruaceiro Gatuno: COMBO Agil -> RAPTO. Marcha Silenciosa (evolucao)
    // troca por um ESPECIAL de RAPTO, que dispara sem declaracao nenhuma.
    const ana = makeClan('ana', ['arr-gatuno']);
    transcenderTeste(ana, ids(ana)[0]!, 'tr-arr-silenciosa');
    const carla = makeClan('carla', ['mon-combo', 'mon-combo']);

    // Sem declarar nada: o ESPECIAL da evolucao acende sozinho e rapta.
    const r = sala({ ana, carla }, {});
    expect(r.res.raptados).toHaveLength(1);
  });

  it('todo combo tem texto, e o texto comeca com COMBO ou ESPECIAL', () => {
    const todos = [
      ...DECK_I.filter((c) => c.combo).map((c) => c.combo!),
      ...TRANSCENDENCIAS.filter((t) => t.combo).map((t) => t.combo!),
    ];
    expect(todos.length).toBeGreaterThanOrEqual(20);
    // ESPECIAL e o prefixo dos efeitos que NAO exigem companheiro; COMBO, dos
    // que exigem. Os dois sao validos.
    for (const c of todos) expect(/^(COMBO|ESPECIAL)/.test(c.texto)).toBe(true);
  });
});

describe('EmperiumGame — Marcha Forcada', () => {
  it('na rodada 1 o atacante alcanca TODAS as salas, nao so o portao', () => {
    const s = newMatch().snapshot.state;
    const atacante = s.order.find((p) => p !== s.defenderId)!;
    const permitidas = allowedSlots(s, atacante);
    // Sem Marcha Forcada isso seria ['portao'] e a rodada 1 nao teria decisao.
    expect(permitidas.sort()).toEqual([...s.slots].sort());
  });

  it('a distancia e 0 na linha de frente e cresce para dentro do castelo', () => {
    const s = newMatch().snapshot.state;
    const atacante = s.order.find((p) => p !== s.defenderId)!;
    const d = slotDistances(s, atacante);
    expect(d['portao']).toBe(0);
    expect(d['b1']).toBe(1);
    expect(d['b2']).toBe(2);
    expect(d['trono']).toBe(3);
    expect(d['emperium']).toBe(4);
  });

  it('o dono do castelo se move de graca dentro do proprio castelo', () => {
    const s = newMatch().snapshot.state;
    const d = slotDistances(s, s.defenderId);
    for (const slot of s.slots) expect(d[slot]).toBe(0);
  });

  it('cobra -2 de Poder por sala marchada', () => {
    const ana = makeClan('ana', ['mon-combo']); // Poder 4
    const state = makeState({ ana }, { castleOwnerId: 'ana' });
    const semMarcha = resolveRoom(state, 'b1', [
      { playerId: 'ana', commitment: { slot: 'b1', charInstIds: ids(ana), ordem: 'cerco', marcha: 0 } },
    ]);
    const comMarcha = resolveRoom(state, 'b1', [
      { playerId: 'ana', commitment: { slot: 'b1', charInstIds: ids(ana), ordem: 'cerco', marcha: 3 } },
    ]);
    expect(semMarcha.clas[0]!.poderBruto).toBe(3); // 4 - 1 (cerco)
    expect(comMarcha.clas[0]!.poderBruto).toBe(3 - MARCHA_PENALIDADE * 3);
    expect(comMarcha.clas[0]!.marcha).toBe(3);
    expect(comMarcha.resumo).toContain('marcha -6');
  });

  it('conquistar uma sala aproxima a linha de frente na rodada seguinte', () => {
    const s = structuredClone(newMatch().snapshot.state) as EmperiumState;
    const atacante = s.order.find((p) => p !== s.defenderId)!;
    expect(slotDistances(s, atacante)['b2']).toBe(2);
    s.rooms['b1']!.controlador = atacante;
    // Com b1 na mao, b2 passa a ser fronteira: entrada normal.
    expect(slotDistances(s, atacante)['b2']).toBe(0);
    expect(slotDistances(s, atacante)['trono']).toBe(1);
  });
});

describe('EmperiumGame — resolucao de sala', () => {
  it('reproduz o exemplo trabalhado do design (Corredor Estreito, rodada 4)', () => {
    // Ana: Bruxo Tempestade transcendido em Arquimago Nevasca + Templario Escudeiro
    // Bruno: Monge Combo transcendido em Punho de Asura, sozinho
    // Carla (defensora): Cacador Armadilheiro + Sacerdote Suporte em Assumptio
    const ana = makeClan('ana', ['bru-tempestade', 'tem-escudeiro']);
    transcenderTeste(ana, ids(ana)[0]!, 'tr-bru-nevasca');
    // Cajado da Tempestade +2 com uma Carta Hydra encaixada (+2 atacando).
    equiparTeste(ana, ids(ana)[0]!, 'eq-cajado', { refino: 2, cartas: ['mc-hydra'] });
    const bruno = makeClan('bruno', ['mon-combo']);
    transcenderTeste(bruno, ids(bruno)[0]!, 'tr-mon-asura');
    const carla = makeClan('carla', ['cac-armadilheiro', 'sac-suporte']);
    transcenderTeste(carla, ids(carla)[1]!, 'tr-sac-assumptio');
    const state = makeState({ ana, bruno, carla }, {
      tileId: 'sala-corredor',
      castleOwnerId: 'carla',
      round: 4,
    });

    const inputs: RoomInput[] = [
      { playerId: 'ana', commitment: { slot: 'b1', charInstIds: ids(ana), ordem: 'investida', marcha: 0 } },
      { playerId: 'bruno', commitment: { slot: 'b1', charInstIds: ids(bruno), ordem: 'emboscada', marcha: 0 } },
      { playerId: 'carla', commitment: { slot: 'b1', charInstIds: ids(carla), ordem: 'resguardo', marcha: 0 } },
    ];

    const res = resolveRoom(state, 'b1', inputs);
    const de = (p: PlayerId) => res.clas.find((f) => f.playerId === p)!;

    // Ana: Tempestade 3 + Nevasca 2 + cajado 3 + refino 2 + Hydra 2
    //      + Escudeiro 2 + investida 3 = 17 — mas Bruno EMBOSCOU, e a Emboscada
    //      cancela o bonus positivo da Ordem alheia: os +3 da Investida somem.
    // Bruno: Combo 4 + Asura 8 + emboscada 2 = 14.
    // Carla: Armadilheiro 2 + Suporte 1 + Assumptio 2 + ELO 2 - resguardo 2 = 5.
    //      O -2 do Resguardo NAO e devolvido: emboscar nao premia quem recuou.
    expect(de('ana').poderBruto).toBe(14);
    expect(de('ana').emboscado).toBe(true);
    expect(de('bruno').poderBruto).toBe(14);
    expect(de('carla').poderBruto).toBe(5);
    expect(de('carla').emboscado).toBe(false);

    // Muralha: Carla tem 2; Ana tem 2 (base) + 2 (evolucao) = 4.
    // Ana: 14-2=12. Bruno: 14-2-4=8. Carla: 5-4=1.
    expect(de('ana').poderFinal).toBe(12);
    expect(de('bruno').poderFinal).toBe(8);
    expect(de('carla').poderFinal).toBe(1);
    expect(res.controlador).toBe('ana');

    // Bruno perde por 4 e so tem o Mestre: ele cai.
    expect(de('bruno').baixas).toEqual(ids(bruno));

    // Resguardo cancela as baixas de Carla.
    expect(de('carla').baixas).toEqual([]);
  });

  it('PERFURAR devolve o Poder que a MURALHA tirou', () => {
    // Lorde Espiral (P6, PERFURAR 4) contra Arquimago Nevasca (P4, MURALHA 4).
    const ana = makeClan('ana', ['cav-lanca']);
    transcenderTeste(ana, ids(ana)[0]!, 'tr-cav-espiral');
    const bruno = makeClan('bruno', ['bru-tempestade']);
    transcenderTeste(bruno, ids(bruno)[0]!, 'tr-bru-nevasca');
    const state = makeState({ ana, bruno }, { castleOwnerId: 'bruno' });
    const res = resolveRoom(state, 'b1', [
      { playerId: 'ana', commitment: { slot: 'b1', charInstIds: ids(ana), ordem: 'cerco' } },
      { playerId: 'bruno', commitment: { slot: 'b1', charInstIds: ids(bruno), ordem: 'cerco' } },
    ]);
    const ana_ = res.clas.find((f) => f.playerId === 'ana')!;
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
    expect(res.clas[0]!.poderBruto).toBe(1 + 4 + 4 + 3 - 1);
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
    expect(res.clas[0]!.baixas.length).toBe(1);
    expect(res.clas[1]!.baixas.length).toBe(1);
  });

  it('dois atacantes na mesma sala sao clas inimigas — o perdedor sangra', () => {
    const ana = makeClanTr('ana', 'cav-bb', 'tr-cav-berserk'); // P8
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
    expect(res.clas.find((f) => f.playerId === 'bruno')!.baixas.length).toBeGreaterThan(0);
  });

  it('ESCUDAR cai antes dos outros personagens da cla', () => {
    const ana = makeClan('ana', ['tem-escudeiro', 'bru-jupitel']);
    const bruno = makeClanTr('bruno', 'bru-jupitel', 'tr-bru-meteoros');
    const state = makeState({ ana, bruno }, { castleOwnerId: 'bruno' });
    const res = resolveRoom(state, 'b1', [
      { playerId: 'ana', commitment: { slot: 'b1', charInstIds: ids(ana), ordem: 'cerco' } },
      { playerId: 'bruno', commitment: { slot: 'b1', charInstIds: ids(bruno), ordem: 'investida' } },
    ]);
    const baixas = res.clas.find((f) => f.playerId === 'ana')!.baixas;
    expect(baixas[0]).toBe(ids(ana)[0]); // o Escudeiro
  });

  it('as baixas nunca passam de metade dos personagens da cla', () => {
    const ana = makeClan('ana', ['sup-teimoso', 'sup-teimoso', 'sup-teimoso', 'sup-teimoso']);
    const bruno = makeClanTr('bruno', 'mon-combo', 'tr-mon-asura');
    const state = makeState({ ana, bruno }, { castleOwnerId: 'bruno', round: 4 });
    const res = resolveRoom(state, 'b1', [
      { playerId: 'ana', commitment: { slot: 'b1', charInstIds: ids(ana), ordem: 'cerco' } },
      { playerId: 'bruno', commitment: { slot: 'b1', charInstIds: ids(bruno), ordem: 'investida' } },
    ]);
    expect(res.clas.find((f) => f.playerId === 'ana')!.baixas.length).toBeLessThanOrEqual(2);
  });
});

describe('EmperiumGame — Sala do Emperium', () => {
  it('o escudo absorve em ordem CRESCENTE: mandar pouco e dano zero', () => {
    // Escudo base rodada 4 = 6. Defensora carla sem ninguem la: escudo 6.
    const ana = makeClan('ana', ['cav-lanca']); // P3
    const bruno = makeClanTr('bruno', 'cav-bb', 'tr-cav-berserk'); // 4 + 5 = P9
    const carla = makeClan('carla', []);
    const state = makeState({ ana, bruno, carla }, { castleOwnerId: 'carla', round: 4 });

    const res = resolveEmperium(state, [
      { playerId: 'ana', commitment: { slot: 'emperium', charInstIds: ids(ana), ordem: 'cerco', marcha: 0 } },
      { playerId: 'bruno', commitment: { slot: 'emperium', charInstIds: ids(bruno), ordem: 'cerco', marcha: 0 } },
    ]);

    // Ana 3-1=2 e absorvida inteira (escudo 6 -> 4). Bruno 9-1=8 passa 4.
    expect(res.danoPorJogador!['ana']).toBe(0);
    expect(res.danoPorJogador!['bruno']).toBe(4);
    // Ana foi totalmente absorvida: sofre 1 baixa.
    expect(res.clas.find((f) => f.playerId === 'ana')!.baixas.length).toBe(1);
  });

  it('o escudo decai com a rodada, deixando o fim de jogo explosivo', () => {
    const ana = makeClanTr('ana', 'cav-bb', 'tr-cav-berserk'); // 4 + 5 = P9
    const carla = makeClan('carla', []);
    const dano = (round: number) => {
      const state = makeState({ ana, carla }, { castleOwnerId: 'carla', round });
      const res = resolveEmperium(state, [
        { playerId: 'ana', commitment: { slot: 'emperium', charInstIds: ids(ana), ordem: 'cerco', marcha: 0 } },
      ]);
      return res.danoPorJogador!['ana'] ?? 0;
    };
    expect(dano(1)).toBe(0); // escudo 8 vs poder 8
    expect(dano(6)).toBe(6); // escudo 2 vs poder 8
  });

  it('quebra o Emperium e entrega o castelo a quem colocou mais cubos', () => {
    const ana = makeClanTr('ana', 'mon-combo', 'tr-mon-asura'); // P10 + SOLO 2 = 12
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

  it('mostra os montes de bruços alheios: quantas cartas e onde, e so isso', () => {
    const match = newMatch();
    for (let guard = 0; guard < 40; guard++) {
      const s = match.snapshot.state;
      if (s.step !== 'mercado') break;
      const p = jogadorDoMercado(s);
      if (!p) break;
      match.applyMove(p, 'passarMercado', { type: 'passarMercado' });
    }

    const antes = match.snapshot.state;
    const doBruno = Object.values(antes.clans['bruno']!.chars)
      .filter((c) => c.local === 'reserva')
      .map((c) => c.instId);
    match.applyMove('bruno', 'confirmarComprometimento', {
      type: 'confirmarComprometimento',
      commitments: [{ slot: 'portao', charInstIds: doBruno, ordem: 'emboscada' }],
    });

    const view = new EmperiumGame().playerView(
      match.snapshot.state,
      { ...match.snapshot, actor: 'ana' } as never,
      'ana',
    ) as Record<string, unknown>;

    const montes = view['montes'] as Record<string, { slot: string; quantidade: number }[]>;
    // Ana ve o monte do Bruno: sala e contagem.
    expect(montes['bruno']).toEqual([{ slot: 'portao', quantidade: doBruno.length }]);
    // E nao ve o proprio monte por aqui — esse vem por meusComprometimentos.
    expect(montes['ana']).toBeUndefined();
    // O que esta no verso continua no verso: nenhum instId, nenhuma Ordem.
    const cru = JSON.stringify(montes['bruno']);
    expect(cru).not.toContain('emboscada');
    for (const id of doBruno) expect(cru).not.toContain(id);
  });
});

describe('EmperiumGame — partida completa', () => {
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

  it('relata TODAS as salas, inclusive onde ninguem foi', () => {
    const match = newMatch();
    jogarRodada(match);
    const res = match.snapshot.state.ultimaResolucao!;
    // Uma entrada por sala do castelo, nao so pelas disputadas.
    expect(res).toHaveLength(match.snapshot.state.slots.length);
    const vazias = res.filter((r) => r.semDisputa);
    expect(vazias.length).toBeGreaterThan(0);
    for (const v of vazias) {
      expect(v.clas).toEqual([]);
      expect(v.resumo).toContain('ninguem veio');
    }
    // E o log tambem cobre cada sala.
    const log = match.snapshot.state.log.join('\n');
    expect(log).toContain('o portao se abre');
    expect(log).toContain('ninguem veio');
  });

  it('marca quem se resguardou no resumo da sala', () => {
    const ana = makeClan('ana', ['mon-combo']);
    const bruno = makeClan('bruno', ['cav-lanca']);
    const state = makeState({ ana, bruno }, { castleOwnerId: 'bruno' });
    const res = resolveRoom(state, 'b1', [
      { playerId: 'ana', commitment: { slot: 'b1', charInstIds: ids(ana), ordem: 'investida' } },
      { playerId: 'bruno', commitment: { slot: 'b1', charInstIds: ids(bruno), ordem: 'resguardo' } },
    ]);
    expect(res.resumo).toContain('bruno resguardou-se');
    expect(res.clas.find((f) => f.playerId === 'bruno')!.ordem).toBe('resguardo');
  });

  it('uma cla sozinha na sala toma sem resistencia', () => {
    const ana = makeClan('ana', ['mon-combo']);
    const state = makeState({ ana }, { castleOwnerId: 'ana' });
    const res = resolveRoom(state, 'b1', [
      { playerId: 'ana', commitment: { slot: 'b1', charInstIds: ids(ana), ordem: 'cerco' } },
    ]);
    expect(res.semResistencia).toBe(true);
    expect(res.resumo).toContain('sem resistencia');
  });

  it('libera o Deck II a partir da rodada 3', () => {
    const match = newMatch();
    jogarRodada(match);
    expect(match.snapshot.state.altarAberto).toBe(false);
    jogarRodada(match);
    expect(match.snapshot.state.round).toBe(3);
    expect(match.snapshot.state.altarAberto).toBe(true);
  });
});

const GLORIA_MINIMA_DONO = 18;

/* ═════════════════════════════════════════════════════════════════════════ */

describe('EmperiumGame — v0.3: Alcance, Anular, Imitar e infiltracao', () => {
  function duelo(
    clans: Record<PlayerId, Clan>,
    opts: {
      tileId?: string;
      castleOwnerId?: PlayerId;
      /** ANULAR apontados, por jogador. */
      anulares?: Record<PlayerId, { charInstId: string; alvoInstId: string; keyword: string }[]>;
    } = {},
  ) {
    const state = makeState(clans, { tileId: opts.tileId ?? 'sala-patio', ...opts });
    const inputs: RoomInput[] = Object.keys(clans).map((p) => ({
      playerId: p,
      commitment: {
        slot: 'b1',
        charInstIds: ids(clans[p]!),
        ordem: 'cerco' as OrderId,
        marcha: 0,
        anulares: opts.anulares?.[p],
      },
    }));
    const res = resolveRoom(state, 'b1', inputs);
    return { res, de: (p: PlayerId) => res.clas.find((f) => f.playerId === p)! };
  }

  it('ALCANCE nao sofre baixa enquanto houver um PROTEGER vivo na sala', () => {
    // Templario Escudeiro (proteger) + Cacador Tiro Duplo (alcance).
    const ana = makeClan('ana', ['tem-escudeiro', 'cac-tiroduplo']);
    const [escudeiro, atirador] = ids(ana);
    // Poder alto do outro lado: baixas o bastante para pegar os dois.
    const bruno = makeClan('bruno', ['cav-bb', 'cav-bb', 'cav-bb', 'cav-bb']);

    const r = duelo({ ana, bruno });
    const baixas = r.de('ana').baixas;
    expect(baixas).toContain(escudeiro);
    expect(baixas).not.toContain(atirador);
  });

  it('sem PROTEGER na sala, o ALCANCE cai como qualquer um', () => {
    const ana = makeClan('ana', ['cac-tiroduplo']);
    const bruno = makeClan('bruno', ['cav-bb', 'cav-bb', 'cav-bb']);
    expect(duelo({ ana, bruno }).de('ana').baixas).toContain(ids(ana)[0]);
  });

  it('ANULAR cancela a palavra-chave APONTADA, e nao a maior da sala', () => {
    // Tres Cavaleiros Bola de Boliche: ELO 1 cada, +2 de Poder por cabeca.
    const alvo = () => makeClan('carla', ['cav-bb', 'cav-bb', 'cav-bb']);
    const semAnular = duelo({ carla: alvo(), ana: makeClan('ana', ['bru-jupitel']) });

    const carla = alvo();
    const ana = makeClan('ana', ['sab-solo']);
    const comAnular = duelo(
      { carla, ana },
      {
        anulares: {
          ana: [{ charInstId: ids(ana)[0]!, alvoInstId: ids(carla)[0]!, keyword: 'elo' }],
        },
      },
    );

    // Nenhum dos dois lados tem Muralha: a unica diferenca e o ELO arrancado
    // do Cavaleiro que a Ana APONTOU.
    expect(comAnular.de('carla').poderFinal).toBe(semAnular.de('carla').poderFinal - 2);
  });

  it('ANULAR sem alvo na sala se perde — e o preco de apostar no escuro', () => {
    const carla = makeClan('carla', ['cav-bb', 'cav-bb', 'cav-bb']);
    const ana = makeClan('ana', ['sab-solo']);
    // Aponta alguem que existe no elenco da Carla mas NAO veio a esta sala.
    const foraDaSala = 'carla-99';
    const r = duelo(
      { carla, ana },
      { anulares: { ana: [{ charInstId: ids(ana)[0]!, alvoInstId: foraDaSala, keyword: 'elo' }] } },
    );
    const semNada = duelo({ carla: makeClan('carla', ['cav-bb', 'cav-bb', 'cav-bb']), ana: makeClan('ana', ['sab-solo']) });
    expect(r.de('carla').poderFinal).toBe(semNada.de('carla').poderFinal);
  });

  it('anular uma palavra-chave RUIM DEVOLVE Poder ao inimigo — a armadilha', () => {
    // Algoz Veneno Mortal: PERFURAR 3 e MALDICAO 2.
    const isca = () => {
      const c = makeClan('carla', ['mer-furtivo']);
      transcenderTeste(c, ids(c)[0]!, 'tr-mer-veneno');
      return c;
    };

    const semAnular = duelo({ carla: isca(), ana: makeClan('ana', ['bru-jupitel']) });

    const carla = isca();
    const ana = makeClan('ana', ['sab-solo']);
    const mordeuAIsca = duelo(
      { carla, ana },
      {
        anulares: {
          ana: [{ charInstId: ids(ana)[0]!, alvoInstId: ids(carla)[0]!, keyword: 'maldicao' }],
        },
      },
    );

    // Cancelar a MALDICAO 2 devolveu 2 de Poder a quem a carregava.
    expect(mordeuAIsca.de('carla').poderBruto).toBe(semAnular.de('carla').poderBruto + 2);
  });

  it('nao se anula um ANULAR: dois Sabios frente a frente mantem os dois', () => {
    const ana = makeClan('ana', ['sab-solo', 'bru-tempestade']);
    const bruno = makeClan('bruno', ['sab-solo', 'bru-tempestade']);
    const r = duelo({ ana, bruno });
    // Simetria total: cada Anular corta a Muralha do outro, e o empate se mantem.
    expect(r.de('ana').poderFinal).toBe(r.de('bruno').poderFinal);
  });

  it('IMITAR copia a palavra-chave do maior inimigo da sala', () => {
    // Superaprendiz Improvisado: IMITAR 2 e nenhuma palavra-chave propria.
    const imitador = makeClan('ana', ['sup-improvisado']);
    // Templario Escudeiro: mesmo Poder 2, mas sem IMITAR — o controle.
    const controle = makeClan('ana', ['tem-escudeiro']);
    const muralha = () => makeClan('bruno', ['bru-tempestade']); // MURALHA 2

    const sem = duelo({ ana: controle, bruno: muralha() });
    const com = duelo({ ana: imitador, bruno: muralha() });

    // Copiada a MURALHA 2, ela passa a morder o Bruxo do outro lado.
    expect(sem.de('bruno').poderFinal).toBe(sem.de('bruno').poderBruto);
    expect(com.de('bruno').poderFinal).toBe(com.de('bruno').poderBruto - 2);
  });

  it('a evolucao pode abrir um slot de equipamento (Teimosia Absurda)', () => {
    const base = CHARACTER_BY_ID.get('sup-teimoso')!;
    const tr = TRANSCENDENCIA_BY_ID.get('tr-sup-teimosia')!;
    expect(base.slots).toBe(3);
    expect(tr.slotsBonus).toBe(1);
  });

  it('o OCULTO infiltra para a sala vizinha sem pagar marcha', () => {
    const ana = makeClan('ana', ['mer-furtivo', 'cav-bb']);
    const [furtivo] = ids(ana);
    const state = makeState({ ana }, { castleOwnerId: 'bruno' });
    state.commitments['ana'] = [
      {
        slot: 'portao',
        charInstIds: ids(ana),
        ordem: 'investida',
        marcha: 0,
        infiltrar: { charInstId: furtivo!, destino: ADJACENCY['portao']![0]! },
      },
    ];
    const linhas = aplicarInfiltracoes(state);
    const grupos = state.commitments['ana']!;
    expect(linhas.join(' ')).toContain('infiltrou-se');
    expect(grupos.find((c) => c.slot === 'portao')!.charInstIds).not.toContain(furtivo);
    const infiltrado = grupos.find((c) => c.slot !== 'portao')!;
    expect(infiltrado.charInstIds).toEqual([furtivo]);
    expect(infiltrado.marcha).toBe(0);
    expect(infiltrado.semOrdem).toBe(true);
  });

  it('quem tem olho para ocultos prende o infiltrado na sala de origem', () => {
    const ana = makeClan('ana', ['mer-furtivo']);
    const [furtivo] = ids(ana);
    // Olho de Falcao: revela ocultos.
    const bruno = makeClanTr('bruno', ['cac-tiroduplo'][0]!, 'tr-cac-falcao');
    const state = makeState({ ana, bruno }, { castleOwnerId: 'carla' });
    state.commitments['ana'] = [
      {
        slot: 'portao',
        charInstIds: ids(ana),
        ordem: 'investida',
        marcha: 0,
        infiltrar: { charInstId: furtivo!, destino: ADJACENCY['portao']![0]! },
      },
    ];
    state.commitments['bruno'] = [
      { slot: 'portao', charInstIds: ids(bruno), ordem: 'cerco', marcha: 0 },
    ];
    const linhas = aplicarInfiltracoes(state);
    expect(linhas.join(' ')).toContain('REVELADO');
    expect(state.commitments['ana']![0]!.charInstIds).toContain(furtivo);
    expect(state.commitments['ana']).toHaveLength(1);
  });
});

/* ═════════════════════════════════════════════════════════════════════════ */

describe('EmperiumGame — v0.3 fase 2: Devocao e o dueto', () => {
  function duelo(clans: Record<PlayerId, Clan>) {
    const state = makeState(clans, { tileId: 'sala-corredor' });
    const inputs: RoomInput[] = Object.keys(clans).map((p) => ({
      playerId: p,
      commitment: { slot: 'b1', charInstIds: ids(clans[p]!), ordem: 'cerco' as OrderId, marcha: 0 },
    }));
    const res = resolveRoom(state, 'b1', inputs);
    return { res, de: (p: PlayerId) => res.clas.find((f) => f.playerId === p)! };
  }

  it('DEVOCAO absorve a margem no lugar dos outros e cai sozinho', () => {
    // Templario Redentor: DEVOCAO 2. Ele cai, e leva o dobro de margem com ele.
    const comDevoto = makeClan('ana', ['tem-redentor', 'bru-jupitel', 'sup-teimoso']);
    // Mesmo grupo, mas o tanque nao tem DEVOCAO: mais gente cai.
    const semDevoto = makeClan('ana', ['tem-escudeiro', 'bru-jupitel', 'sup-teimoso']);
    // Margem 3: o PROTEGER comum (Poder de carta 2) nao cobre sozinho, o
    // DEVOCAO 2 (2 x 2 = 4) cobre.
    const rolo = () => makeClan('bruno', ['cav-bb', 'cav-bb']);

    const com = duelo({ ana: comDevoto, bruno: rolo() });
    const sem = duelo({ ana: semDevoto, bruno: rolo() });

    expect(com.de('ana').baixas).toHaveLength(1);
    expect(sem.de('ana').baixas).toHaveLength(2);
    // Quem caiu foi o devoto — os outros ficaram de pe.
    expect(com.de('ana').baixas).toEqual([ids(comDevoto)[0]]);
  });

  it('o Ensemble so acende com um Bardo E uma Odalisca na sala', () => {
    // Menestrel com Ensemble, mas so com outro Bardo do lado: nao e dueto.
    const soBardos = makeClan('ana', ['bar-cancao', 'bar-idun']);
    transcenderTeste(soBardos, ids(soBardos)[0]!, 'tr-bar-ensemble');
    // Mesmo Menestrel, agora com uma Odalisca: o dueto sobe.
    const dueto = makeClan('bruno', ['bar-cancao', 'oda-servico']);
    transcenderTeste(dueto, ids(dueto)[0]!, 'tr-bar-ensemble');

    const a = duelo({ ana: soBardos, carla: makeClan('carla', ['mon-combo']) });
    const b = duelo({ bruno: dueto, carla: makeClan('carla', ['mon-combo']) });

    // Mesmas cartas dos dois lados: a unica diferenca e o dueto acender.
    expect(b.de('bruno').poderBruto - a.de('ana').poderBruto).toBe(10);
  });

  it('cada classe tem 3 caminhos, inclusive as duas novas', () => {
    expect(caminhosDaClasse('Bardo')).toHaveLength(3);
    expect(caminhosDaClasse('Odalisca')).toHaveLength(3);
    expect(caminhosDaClasse('Superaprendiz').map((t) => t.id)).not.toContain('tr-sup-sorte');
    expect(CHARACTER_BY_ID.get('sup-sorte')?.classe).toBe('Superaprendiz');
  });
});

/* ═════════════════════════════════════════════════════════════════════════ */

describe('EmperiumGame — MURALHA acumula', () => {
  function duelo(clans: Record<PlayerId, Clan>) {
    const state = makeState(clans, { tileId: 'sala-corredor' });
    const inputs: RoomInput[] = Object.keys(clans).map((p) => ({
      playerId: p,
      commitment: { slot: 'b1', charInstIds: ids(clans[p]!), ordem: 'cerco' as OrderId, marcha: 0 },
    }));
    const res = resolveRoom(state, 'b1', inputs);
    return { res, de: (p: PlayerId) => res.clas.find((f) => f.playerId === p)! };
  }

  it('duas MURALHAS do mesmo clã somam contra cada inimigo', () => {
    // Bruxo Tempestade tem MURALHA 2. Dois deles = 4 de reducao.
    const um = duelo({
      ana: makeClan('ana', ['bru-tempestade']),
      bruno: makeClan('bruno', ['mon-combo', 'mon-combo']),
    });
    const dois = duelo({
      ana: makeClan('ana', ['bru-tempestade', 'bru-tempestade']),
      bruno: makeClan('bruno', ['mon-combo', 'mon-combo']),
    });
    const b1 = um.de('bruno');
    const b2 = dois.de('bruno');
    expect(b1.poderBruto).toBe(b2.poderBruto); // o Bruno nao mudou
    expect(b1.poderBruto - b1.poderFinal).toBe(2);
    expect(b2.poderBruto - b2.poderFinal).toBe(4);
  });

  it('as MURALHAS de clãs inimigos DIFERENTES tambem somam sobre voce', () => {
    const r = duelo({
      ana: makeClan('ana', ['mon-combo', 'mon-combo']),
      bruno: makeClan('bruno', ['bru-tempestade']),
      carla: makeClan('carla', ['bru-tempestade']),
    });
    const a = r.de('ana');
    // Duas Muralhas 2, de dois clas distintos: 4 a menos.
    expect(a.poderBruto - a.poderFinal).toBe(4);
  });

  it('a MURALHA nunca leva o Poder abaixo de zero', () => {
    const r = duelo({
      ana: makeClan('ana', ['sup-teimoso']), // Poder 1
      bruno: makeClan('bruno', ['bru-tempestade', 'bru-tempestade', 'bru-tempestade']),
    });
    expect(r.de('ana').poderFinal).toBe(0);
  });
});

/* ═════════════════════════════════════════════════════════════════════════ */

describe('EmperiumGame — quem e o dono do castelo', () => {
  const abrir = (options?: unknown, seed = 7) =>
    GameInstance.create(new EmperiumGame(), PLAYERS, seed, options).snapshot.state;

  it('sem opcao nenhuma, sorteia — e o sorteio e reprodutivel pela seed', () => {
    const a = abrir(undefined, 11);
    const b = abrir(undefined, 11);
    expect(PLAYERS).toContain(a.defenderId);
    expect(a.defenderId).toBe(b.defenderId);
  });

  it('respeita o defensor escolhido', () => {
    const s = abrir({ donoDoCastelo: 'escolhido', donoDoCasteloId: 'dora' });
    expect(s.defenderId).toBe('dora');
    expect(s.castleOwnerId).toBe('dora');
  });

  it('o defensor escolhido comeca com as vantagens do dono', () => {
    const s = abrir({ donoDoCastelo: 'escolhido', donoDoCasteloId: 'carla' });
    // A renda da rodada 1 ja entrou no setup, entao o que importa e a
    // VANTAGEM do dono sobre os atacantes, nao o numero absoluto.
    expect(s.clans['carla']!.zeny).toBeGreaterThan(s.clans['ana']!.zeny);
    expect(Object.keys(s.clans['carla']!.chars)).toHaveLength(3);
    expect(Object.keys(s.clans['ana']!.chars)).toHaveLength(2);
    // Todas as salas fora o Emperium comecam sob controle dele.
    for (const slot of s.slots) {
      if (slot === 'emperium') continue;
      expect(s.rooms[slot]!.controlador).toBe('carla');
    }
  });

  it('id de quem nao esta na mesa cai no sorteio, sem quebrar o start', () => {
    const s = abrir({ donoDoCastelo: 'escolhido', donoDoCasteloId: 'fantasma' });
    expect(PLAYERS).toContain(s.defenderId);
    expect(s.log[0]).toContain('sorteado');
  });

  it('modo anfitriao usa o id que o cliente resolveu', () => {
    const s = abrir({ donoDoCastelo: 'anfitriao', donoDoCasteloId: 'bruno' });
    expect(s.defenderId).toBe('bruno');
    expect(s.log[0]).toContain('abriu a sala');
  });

  it('o log da rodada 1 diz por que aquele jogador defende', () => {
    expect(abrir({ donoDoCastelo: 'escolhido', donoDoCasteloId: 'dora' }).log[0]).toContain(
      'escolhido pelo anfitriao',
    );
    expect(abrir(undefined).log[0]).toContain('sorteado');
  });
});

/* ═════════════════════════════════════════════════════════════════════════ */

describe('EmperiumGame — PRESO nao premia quem se resguardou', () => {
  it('so tira o bonus POSITIVO da Ordem, como a Emboscada', () => {
    // Monge Corpo de Aco: ESPECIAL -> o maior cla inimigo fica PRESO. Como
    // ESPECIAL nao se declara, o controle e a presenca dele na sala.
    const comCarrasco = () => makeClan('ana', ['mon-aco', 'cav-bb', 'cav-bb']);
    const semCarrasco = () => makeClan('ana', ['mon-combo', 'cav-bb', 'cav-bb']);
    const alvo = () => makeClan('bruno', ['mon-combo']);

    const rodar = (ordemDoAlvo: OrderId, comPreso: boolean) => {
      const c = comPreso ? comCarrasco() : semCarrasco();
      const b = alvo();
      const state = makeState({ ana: c, bruno: b }, {
        tileId: 'sala-corredor',
        castleOwnerId: 'carla',
      });
      const res = resolveRoom(state, 'b1', [
        { playerId: 'ana', commitment: { slot: 'b1', charInstIds: ids(c), ordem: 'cerco', marcha: 0 } },
        { playerId: 'bruno', commitment: { slot: 'b1', charInstIds: ids(b), ordem: ordemDoAlvo, marcha: 0 } },
      ]);
      return res.clas.find((f) => f.playerId === 'bruno')!;
    };

    // Investida: PRESO tira os +3.
    expect(rodar('investida', false).poderBruto - rodar('investida', true).poderBruto).toBe(3);
    // Resguardo: o -2 dele NAO e devolvido. Marcar nao pode fortalecer o alvo.
    expect(rodar('resguardo', true).poderBruto).toBe(rodar('resguardo', false).poderBruto);
  });
});

/* ═════════════════════════════════════════════════════════════════════════ */

describe('EmperiumGame — as palavras-chave ruins', () => {
  function duelo(clans: Record<PlayerId, Clan>) {
    const state = makeState(clans, { tileId: 'sala-corredor' });
    const inputs: RoomInput[] = Object.keys(clans).map((p) => ({
      playerId: p,
      commitment: { slot: 'b1', charInstIds: ids(clans[p]!), ordem: 'cerco' as OrderId, marcha: 0 },
    }));
    const res = resolveRoom(state, 'b1', inputs);
    return { res, de: (p: PlayerId) => res.clas.find((f) => f.playerId === p)! };
  }

  it('MALDICAO tira Poder de quem a carrega', () => {
    // Algoz Veneno Mortal: +5 de evolucao, MALDICAO 2.
    const com = makeClan('ana', ['mer-furtivo']);
    transcenderTeste(com, ids(com)[0]!, 'tr-mer-veneno');
    // Presa Sombria: +2, sem maldicao. A diferenca de evolucao e 3.
    const sem = makeClan('ana', ['mer-furtivo']);
    transcenderTeste(sem, ids(sem)[0]!, 'tr-mer-presa');
    const alvo = () => makeClan('bruno', ['mon-combo']);

    const a = duelo({ ana: com, bruno: alvo() }).de('ana').poderBruto;
    const b = duelo({ ana: sem, bruno: alvo() }).de('ana').poderBruto;
    // +5 -2 contra +2: a diferenca liquida e 1, e nao os 3 de Poder impresso.
    expect(a - b).toBe(1);
  });

  it('BERSERK cai primeiro, mesmo com PROTEGER e DEVOCAO na sala', () => {
    const ana = makeClan('ana', ['cav-bb', 'tem-escudeiro', 'tem-redentor']);
    transcenderTeste(ana, ids(ana)[0]!, 'tr-cav-berserk');
    const bruno = makeClan('bruno', ['cav-bb', 'cav-bb', 'cav-bb', 'cav-bb']);

    const baixas = duelo({ ana, bruno }).de('ana').baixas;
    // O berserker vem antes do devoto e do protetor.
    expect(baixas[0]).toBe(ids(ana)[0]);
  });

  it('FRAGIL cai antes do resto — mas quem cobre passa na frente dele', () => {
    // Cacador Rajada de Flechas: ALCANCE e FRAGIL.
    const semTanque = makeClan('ana', ['cac-tiroduplo', 'mon-combo']);
    const bruno = () => makeClan('bruno', ['cav-bb', 'cav-bb', 'cav-bb']);

    // Sozinho, o fragil e o primeiro a cair.
    expect(duelo({ ana: semTanque, bruno: bruno() }).de('ana').baixas[0]).toBe(ids(semTanque)[0]);

    // Com um PROTEGER vivo, o ALCANCE dele nem entra na fila de baixas.
    const comTanque = makeClan('ana', ['cac-tiroduplo', 'tem-escudeiro']);
    const r = duelo({ ana: comTanque, bruno: bruno() });
    expect(r.de('ana').baixas).not.toContain(ids(comTanque)[0]);
    expect(r.de('ana').baixas).toContain(ids(comTanque)[1]);
  });

  it('as ruins sao anulaveis — e e isso que faz o Anular poder dar errado', () => {
    for (const k of ['esgotar', 'fragil', 'berserk', 'maldicao']) {
      expect(ANULAVEIS).toContain(k);
    }
  });
});

describe('EmperiumGame — ESPECIAL dispara sozinho', () => {
  it('todo efeito que nao exige companheiro se chama ESPECIAL', () => {
    const todos = [
      ...DECK_I.filter((c) => c.combo).map((c) => c.combo!),
      ...TRANSCENDENCIAS.filter((t) => t.combo).map((t) => t.combo!),
    ];
    for (const c of todos) {
      if (c.exige.tipo === 'nenhum') expect(c.texto.startsWith('ESPECIAL')).toBe(true);
      else expect(c.texto.startsWith('COMBO')).toBe(true);
    }
  });

  it('o ESPECIAL nao gasta o combo declarado da sala', () => {
    // Alquimista Boticario (ESPECIAL: EXPOSTO) + Sabio Protecao de Solo
    // (COMBO Bruxo) + um Bruxo para o combo acender. Os dois acendem juntos.
    const ana = makeClan('ana', ['alq-boticario', 'sab-solo', 'bru-jupitel']);
    const carla = makeClan('carla', ['bru-tempestade', 'bru-tempestade']);
    const state = makeState({ ana, carla }, { tileId: 'sala-patio' });
    const res = resolveRoom(state, 'b1', [
      {
        playerId: 'ana',
        commitment: {
          slot: 'b1',
          charInstIds: ids(ana),
          ordem: 'cerco',
          marcha: 0,
          combo: ids(ana)[1],
          anulares: [{ charInstId: ids(ana)[1]!, alvoInstId: ids(carla)[0]!, keyword: 'muralha' }],
        },
      },
      { playerId: 'carla', commitment: { slot: 'b1', charInstIds: ids(carla), ordem: 'cerco', marcha: 0 } },
    ]);
    const de = (p: PlayerId) => res.clas.find((f) => f.playerId === p)!;
    // O COMBO declarado aparece no resultado...
    expect(de('ana').combo).toContain('COMBO Bruxo');
    // ...e o ESPECIAL do Boticario tambem valeu, sem ter sido declarado.
    expect(de('carla').marcas).toContain('exposto');
  });
});

/* ═════════════════════════════════════════════════════════════════════════ */

describe('EmperiumGame — o quebrador de Emperium', () => {
  it('ESTILHACAR nao vale nada fora da Sala do Emperium', () => {
    // Monge Disparar Esferas: Poder 1, ESTILHACAR 4.
    const ana = makeClan('ana', ['mon-dilema']);
    const bruno = makeClan('bruno', ['mon-combo']);
    const state = makeState({ ana, bruno }, { tileId: 'sala-corredor' });
    const res = resolveRoom(state, 'b1', [
      { playerId: 'ana', commitment: { slot: 'b1', charInstIds: ids(ana), ordem: 'cerco', marcha: 0 } },
      { playerId: 'bruno', commitment: { slot: 'b1', charInstIds: ids(bruno), ordem: 'cerco', marcha: 0 } },
    ]);
    // Poder 1 - 1 do Cerco = 0. Ele nao segura corredor nenhum.
    expect(res.clas.find((f) => f.playerId === 'ana')!.poderBruto).toBe(0);
  });

  it('ESTILHACAR vale contra o cristal', () => {
    const ana = makeClan('ana', ['mon-dilema']);
    const carla = makeClan('carla', []);
    const state = makeState({ ana, carla }, { castleOwnerId: 'carla', round: 6 });
    const res = resolveEmperium(state, [
      { playerId: 'ana', commitment: { slot: 'emperium', charInstIds: ids(ana), ordem: 'cerco', marcha: 0 } },
    ]);
    // Poder 1 + ESTILHACAR 4 - 1 do Cerco = 4.
    expect(res.clas.find((f) => f.playerId === 'ana')!.poderBruto).toBe(4);
  });

  it('ARIETE atravessa o Escudo, e quem nao tem nao atravessa', () => {
    const comAriete = makeClan('ana', ['mon-combo']);
    transcenderTeste(comAriete, ids(comAriete)[0]!, 'tr-mon-asura');
    const semAriete = makeClan('ana', ['bru-jupitel']);
    transcenderTeste(semAriete, ids(semAriete)[0]!, 'tr-bru-meteoros');

    const rodar = (atacante: Clan) => {
      const carla = makeClan('carla', ['cav-bb', 'cav-bb', 'cav-bb']);
      const state = makeState({ ana: atacante, carla }, { castleOwnerId: 'carla', round: 4 });
      return resolveEmperium(state, [
        { playerId: 'ana', commitment: { slot: 'emperium', charInstIds: ids(atacante), ordem: 'cerco', marcha: 0 } },
        { playerId: 'carla', commitment: { slot: 'emperium', charInstIds: ids(carla), ordem: 'cerco', marcha: 0 } },
      ]);
    };

    expect(rodar(semAriete).danoPorJogador!['ana']).toBe(0);
    expect(rodar(comAriete).danoPorJogador!['ana']).toBeGreaterThan(0);
  });

  it('ARIETE nao gasta o Escudo — ele passa por fora', () => {
    const asura = makeClan('ana', ['mon-combo']);
    transcenderTeste(asura, ids(asura)[0]!, 'tr-mon-asura');

    const comAna = makeState(
      { ana: asura, bruno: makeClan('bruno', ['cav-bb']), carla: makeClan('carla', ['cav-bb', 'cav-bb']) },
      { castleOwnerId: 'carla', round: 4 },
    );
    const res = resolveEmperium(comAna, [
      { playerId: 'ana', commitment: { slot: 'emperium', charInstIds: Object.keys(comAna.clans['ana']!.chars), ordem: 'cerco', marcha: 0 } },
      { playerId: 'bruno', commitment: { slot: 'emperium', charInstIds: Object.keys(comAna.clans['bruno']!.chars), ordem: 'cerco', marcha: 0 } },
      { playerId: 'carla', commitment: { slot: 'emperium', charInstIds: Object.keys(comAna.clans['carla']!.chars), ordem: 'cerco', marcha: 0 } },
    ]);

    const semAna = makeState(
      { bruno: makeClan('bruno', ['cav-bb']), carla: makeClan('carla', ['cav-bb', 'cav-bb']) },
      { castleOwnerId: 'carla', round: 4 },
    );
    const ref = resolveEmperium(semAna, [
      { playerId: 'bruno', commitment: { slot: 'emperium', charInstIds: Object.keys(semAna.clans['bruno']!.chars), ordem: 'cerco', marcha: 0 } },
      { playerId: 'carla', commitment: { slot: 'emperium', charInstIds: Object.keys(semAna.clans['carla']!.chars), ordem: 'cerco', marcha: 0 } },
    ]);

    // O Bruno leva o mesmo dano com ou sem o ariete na sala: o quebrador
    // passou por fora e nao gastou escudo para ninguem.
    expect(res.danoPorJogador!['bruno']).toBe(ref.danoPorJogador!['bruno']);
  });
});

/* ═════════════════════════════════════════════════════════════════════════ */

describe('EmperiumGame — a Sala do Emperium usa o pipeline inteiro', () => {
  const atacar = (
    clans: Record<PlayerId, Clan>,
    decls: Record<PlayerId, Partial<CommitmentTeste>> = {},
    round = 4,
  ) => {
    const state = makeState(clans, { castleOwnerId: 'carla', round });
    const res = resolveEmperium(
      state,
      Object.keys(clans).map((p) => ({
        playerId: p,
        commitment: {
          slot: 'emperium' as const,
          charInstIds: ids(clans[p]!),
          ordem: (decls[p]?.ordem ?? 'cerco') as OrderId,
          marcha: 0,
          combo: decls[p]?.combo,
          anulares: decls[p]?.anulares,
        },
      })),
    );
    return { res, de: (p: PlayerId) => res.clas.find((f) => f.playerId === p)! };
  };

  it('COMBO declarado vale no assalto final', () => {
    // Alquimista Fogo Grego: COMBO Arcano -> +4 de Poder.
    const semCombo = makeClan('ana', ['alq-fogogrego', 'bru-jupitel']);
    const comCombo = makeClan('ana', ['alq-fogogrego', 'bru-jupitel']);
    const carla = () => makeClan('carla', []);

    const a = atacar({ ana: semCombo, carla: carla() }).de('ana').poderBruto;
    const b = atacar(
      { ana: comCombo, carla: carla() },
      { ana: { combo: ids(comCombo)[0] } },
    ).de('ana').poderBruto;
    expect(b - a).toBe(4);
  });

  it('ESPECIAL dispara aqui tambem, sem declaracao', () => {
    // Alquimista Boticario: ESPECIAL -> o maior cla inimigo fica EXPOSTO.
    const ana = makeClan('ana', ['alq-boticario', 'mon-combo']);
    const carla = makeClan('carla', ['sac-pneuma']);
    const r = atacar({ ana, carla });
    expect(r.de('carla').marcas).toContain('exposto');
  });

  it('MURALHA da defensora reduz o Poder de quem ataca o cristal', () => {
    // Sacerdote Pneuma: MURALHA 2 na defesa.
    const atacante = () => makeClan('ana', ['cav-bb', 'cav-bb']);
    const semMuralha = atacar({ ana: atacante(), carla: makeClan('carla', ['mon-combo']) });
    const comMuralha = atacar({ ana: atacante(), carla: makeClan('carla', ['sac-pneuma']) });

    expect(semMuralha.de('ana').poderFinal).toBe(semMuralha.de('ana').poderBruto);
    expect(comMuralha.de('ana').poderFinal).toBe(comMuralha.de('ana').poderBruto - 2);
  });

  it('ANULAR apontado funciona no assalto final', () => {
    const carlaBase = () => makeClan('carla', ['sac-pneuma']);
    const semAnular = atacar({ ana: makeClan('ana', ['bru-jupitel']), carla: carlaBase() });

    const carla = carlaBase();
    const ana = makeClan('ana', ['sab-solo']);
    const comAnular = atacar(
      { ana, carla },
      {
        ana: {
          anulares: [{ charInstId: ids(ana)[0]!, alvoInstId: ids(carla)[0]!, keyword: 'muralha' }],
        },
      },
    );
    // Sem o Anular, a Muralha 2 da Pneuma corta o Poder da Ana.
    expect(semAnular.de('ana').poderBruto - semAnular.de('ana').poderFinal).toBe(2);
    // Com o Anular apontado nela, nao corta mais nada.
    expect(comAnular.de('ana').poderBruto - comAnular.de('ana').poderFinal).toBe(0);
  });

  it('RAPTO arranca alguem do assalto final', () => {
    // Desordeiro Marcha Silenciosa: ESPECIAL -> RAPTO.
    const ana = makeClan('ana', ['arr-gatuno']);
    transcenderTeste(ana, ids(ana)[0]!, 'tr-arr-silenciosa');
    const carla = makeClan('carla', ['cav-bb', 'cav-bb']);
    const r = atacar({ ana, carla });
    expect(r.res.raptados).toHaveLength(1);
  });

  it('a EMBOSCADA cancela o bonus da Ordem alheia tambem aqui', () => {
    const ana = makeClan('ana', ['mon-combo']);
    const bruno = makeClan('bruno', ['mon-combo']);
    const carla = makeClan('carla', []);
    const r = atacar(
      { ana, bruno, carla },
      { ana: { ordem: 'emboscada' }, bruno: { ordem: 'investida' } },
    );
    expect(r.de('bruno').emboscado).toBe(true);
  });

  it('nao exibe combo que nao disparou', () => {
    // Sabio Protecao de Solo exige um Bruxo junto; sozinho, nao acende.
    const ana = makeClan('ana', ['sab-solo']);
    const carla = makeClan('carla', []);
    const r = atacar({ ana, carla }, { ana: { combo: ids(ana)[0] } });
    expect(r.de('ana').combo).toBeUndefined();
  });
});

/* ═════════════════════════════════════════════════════════════════════════ */

describe('EmperiumGame — ARIETE por combo', () => {
  it('o combo estende a travessia do Escudo ao cla inteiro', () => {
    // Criador Bomba de Esferas: COMBO Vanguarda -> a cla atravessa o Escudo.
    const montar = () => {
      const c = makeClan('ana', ['alq-homunculo', 'cav-bb']);
      transcenderTeste(c, ids(c)[0]!, 'tr-alq-esferas');
      return c;
    };
    const defensora = () => makeClan('carla', ['cav-bb', 'cav-bb', 'cav-bb']);

    const rodar = (declara: boolean) => {
      const ana = montar();
      const carla = defensora();
      const state = makeState({ ana, carla }, { castleOwnerId: 'carla', round: 4 });
      return resolveEmperium(state, [
        {
          playerId: 'ana',
          commitment: {
            slot: 'emperium',
            charInstIds: ids(ana),
            ordem: 'cerco',
            marcha: 0,
            combo: declara ? ids(ana)[0] : undefined,
          },
        },
        { playerId: 'carla', commitment: { slot: 'emperium', charInstIds: ids(carla), ordem: 'cerco', marcha: 0 } },
      ]);
    };

    // Sem o combo, o escudo da defensora engole o ataque inteiro.
    expect(rodar(false).danoPorJogador!['ana']).toBe(0);
    // Com o combo, a cla inteira passa por fora do escudo.
    const com = rodar(true);
    expect(com.danoPorJogador!['ana']).toBeGreaterThan(0);
    expect(com.clas.find((f) => f.playerId === 'ana')!.combo).toContain('Escudo do Emperium');
  });
});
