import type { GameContext, PlayerId } from '@boardzando/contracts';
import { INVALID_MOVE } from '@boardzando/contracts';
import { CHARACTER_BY_ID, DECK_II, EQUIP_BY_ID } from './emperium.cards';
import {
  ACOES_MERCADO,
  GLORIA_BREAK_BONUS,
  GLORIA_HOLD,
  GLORIA_HOLD_FINAL,
  RENDA_BASE,
  RENDA_CASTELO,
  RESOLUTION_ORDER,
  TILE_BY_ID,
  TOTAL_ROUNDS,
  type RoomSlot,
} from './emperium.rooms';
import { resolveEmperium, resolveRoom, type RoomInput } from './emperium.resolve';
import {
  ALL_ORDERS,
  allowedSlots,
  type Commitment,
  type EmperiumState,
  type RoomResolution,
} from './emperium.state';

const clone = (s: EmperiumState): EmperiumState => structuredClone(s) as EmperiumState;

const TAM_FILEIRA_RECRUTA = 5;
const TAM_FILEIRA_EQUIP = 4;
const CUSTO_REFINO = 3;
const CUSTO_CONSUMIVEL = 4;
const CUSTO_CARTA_MONSTRO = 5;
const REFINO_MAX = 3;

/* ─────────────────────────────────────────────────────────────────────────
 * Helpers de baralho e fileira
 * ───────────────────────────────────────────────────────────────────────── */

function reporFileiras(state: EmperiumState): void {
  while (state.fileiraRecrutamento.length < TAM_FILEIRA_RECRUTA && state.deckRecrutamento.length > 0) {
    state.fileiraRecrutamento.push(state.deckRecrutamento.shift()!);
  }
  while (state.fileiraEquip.length < TAM_FILEIRA_EQUIP && state.deckEquip.length > 0) {
    state.fileiraEquip.push(state.deckEquip.shift()!);
  }
}

function novoInstId(state: EmperiumState, prefixo: string): string {
  return `${prefixo}${state.nextInstId++}`;
}

/** Ferreiro na Reserva anula a quebra no refino (design secao 11). */
function temFerreiro(state: EmperiumState, p: PlayerId): boolean {
  const clan = state.clans[p];
  if (!clan) return false;
  return Object.values(clan.chars).some((c) => {
    const def = CHARACTER_BY_ID.get(c.defId);
    return def?.classe === 'Ferreiro' && c.local !== 'enfermaria';
  });
}

/* ─────────────────────────────────────────────────────────────────────────
 * Ciclo da rodada
 * ───────────────────────────────────────────────────────────────────────── */

/**
 * Fase 1 (Renda) + preparo da fase 2 (Mercado). Chamada no inicio de cada
 * rodada. Ordem de mercado e INVERSA a Gloria: quem perde compra primeiro.
 */
export function iniciarRodada(state: EmperiumState, ctx: GameContext): void {
  // Deck II entra no mercado a partir da rodada 3.
  if (state.round >= 3 && !state.deckIILiberado) {
    state.deckIILiberado = true;
    state.deckRecrutamento = ctx.random.shuffle([
      ...state.deckRecrutamento,
      ...DECK_II.map((c) => c.id),
    ]);
    state.log.push('Rodada 3: a Transcendencia chega a guerra — Deck II liberado.');
  }

  for (const p of state.order) {
    const clan = state.clans[p];
    if (!clan) continue;
    let renda = RENDA_BASE;
    if (state.castleOwnerId === p) renda += RENDA_CASTELO;
    // Anel do Mercador: +2 de renda.
    for (const eq of Object.values(clan.equips)) {
      const def = EQUIP_BY_ID.get(eq.defId);
      if (def?.special === 'renda2' && eq.portador) renda += 2;
    }
    clan.zeny += renda;

    // Broche do Guildmaster: +1 acao de mercado.
    let acoes = ACOES_MERCADO;
    for (const eq of Object.values(clan.equips)) {
      const def = EQUIP_BY_ID.get(eq.defId);
      if (def?.special === 'acao-extra' && eq.portador) acoes += 1;
    }
    clan.acoesRestantes = acoes;
    clan.ordensDisponiveis = [...ALL_ORDERS];
  }

  state.mercadoOrdem = [...state.order].sort((a, b) => {
    const ga = state.clans[a]?.gloria ?? 0;
    const gb = state.clans[b]?.gloria ?? 0;
    if (ga !== gb) return ga - gb;
    return (state.clans[a]?.zeny ?? 0) - (state.clans[b]?.zeny ?? 0);
  });
  state.mercadoIndex = 0;
  state.step = 'mercado';
  state.commitments = {};
  state.confirmados = [];
  reporFileiras(state);
}

/** Avanca para o proximo jogador do mercado, ou para a fase simultanea. */
function avancarMercado(state: EmperiumState): void {
  while (state.mercadoIndex < state.mercadoOrdem.length) {
    const p = state.mercadoOrdem[state.mercadoIndex]!;
    if ((state.clans[p]?.acoesRestantes ?? 0) > 0) return;
    state.mercadoIndex++;
  }
  state.step = 'comprometimento';
}

function gastarAcao(state: EmperiumState, p: PlayerId): void {
  const clan = state.clans[p];
  if (!clan) return;
  clan.acoesRestantes = Math.max(0, clan.acoesRestantes - 1);
  avancarMercado(state);
}

/** Quem esta na vez do mercado. */
export function jogadorDoMercado(state: EmperiumState): PlayerId | null {
  if (state.step !== 'mercado') return null;
  return state.mercadoOrdem[state.mercadoIndex] ?? null;
}

/* ─────────────────────────────────────────────────────────────────────────
 * Moves do mercado (sequenciais, na vez do jogador)
 * ───────────────────────────────────────────────────────────────────────── */

export interface RecrutarPayload {
  type: 'recrutar';
  indice: number;
}

export const recrutar = (state: EmperiumState, ctx: GameContext, payload: RecrutarPayload) => {
  if (state.step !== 'mercado') return INVALID_MOVE;
  const p = ctx.actor;
  if (jogadorDoMercado(state) !== p) return INVALID_MOVE;
  const clan = state.clans[p];
  if (!clan || clan.acoesRestantes <= 0) return INVALID_MOVE;

  const defId = state.fileiraRecrutamento[payload.indice];
  if (!defId) return INVALID_MOVE;
  const def = CHARACTER_BY_ID.get(defId);
  if (!def || clan.zeny < def.custo) return INVALID_MOVE;

  const next = clone(state);
  const c = next.clans[p]!;
  c.zeny -= def.custo;
  const instId = novoInstId(next, 'ch');
  c.chars[instId] = { instId, defId, equips: [], local: 'reserva', salasVisitadas: [] };
  next.fileiraRecrutamento.splice(payload.indice, 1);
  reporFileiras(next);
  next.log.push(`${p} recrutou ${def.nome} por ${def.custo}z.`);
  gastarAcao(next, p);
  return next;
};

export interface EquiparPayload {
  type: 'equipar';
  indice: number;
  charInstId: string;
}

export const equipar = (state: EmperiumState, ctx: GameContext, payload: EquiparPayload) => {
  if (state.step !== 'mercado') return INVALID_MOVE;
  const p = ctx.actor;
  if (jogadorDoMercado(state) !== p) return INVALID_MOVE;
  const clan = state.clans[p];
  if (!clan || clan.acoesRestantes <= 0) return INVALID_MOVE;

  const eqDefId = state.fileiraEquip[payload.indice];
  if (!eqDefId) return INVALID_MOVE;
  const eqDef = EQUIP_BY_ID.get(eqDefId);
  if (!eqDef || clan.zeny < eqDef.custo) return INVALID_MOVE;

  const charInst = clan.chars[payload.charInstId];
  if (!charInst) return INVALID_MOVE;
  const charDef = CHARACTER_BY_ID.get(charInst.defId);
  if (!charDef) return INVALID_MOVE;

  // Papel compativel (lista vazia = qualquer um) e slot livre.
  if (eqDef.papeis.length > 0 && !eqDef.papeis.includes(charDef.papel)) return INVALID_MOVE;
  if (charInst.equips.length >= charDef.slots) return INVALID_MOVE;
  // Arco Composto exige que o portador tenha Alcance.
  if (eqDef.exige && !charDef.keywords.some((k) => k.kw === eqDef.exige)) return INVALID_MOVE;

  const next = clone(state);
  const c = next.clans[p]!;
  c.zeny -= eqDef.custo;
  const instId = novoInstId(next, 'eq');
  c.equips[instId] = { instId, defId: eqDefId, refino: 0, encaixadas: [], portador: payload.charInstId };
  c.chars[payload.charInstId]!.equips.push(instId);
  next.fileiraEquip.splice(payload.indice, 1);
  reporFileiras(next);
  next.log.push(`${p} equipou ${eqDef.nome} em ${charDef.nome}.`);
  gastarAcao(next, p);
  return next;
};

export interface RefinarPayload {
  type: 'refinar';
  equipInstId: string;
}

export const refinar = (state: EmperiumState, ctx: GameContext, payload: RefinarPayload) => {
  if (state.step !== 'mercado') return INVALID_MOVE;
  const p = ctx.actor;
  if (jogadorDoMercado(state) !== p) return INVALID_MOVE;
  const clan = state.clans[p];
  if (!clan || clan.acoesRestantes <= 0 || clan.zeny < CUSTO_REFINO) return INVALID_MOVE;
  const eq = clan.equips[payload.equipInstId];
  if (!eq || eq.refino >= REFINO_MAX) return INVALID_MOVE;

  const next = clone(state);
  const c = next.clans[p]!;
  c.zeny -= CUSTO_REFINO;
  const alvo = c.equips[payload.equipInstId]!;
  const eqDef = EQUIP_BY_ID.get(alvo.defId);
  const d = ctx.random.die(6);
  const protegido = temFerreiro(next, p);

  if (d === 1 && !protegido) {
    // Quebra: descarta o equipamento e as cartas encaixadas.
    if (alvo.portador) {
      const port = c.chars[alvo.portador];
      if (port) port.equips = port.equips.filter((id) => id !== alvo.instId);
    }
    delete c.equips[payload.equipInstId];
    next.log.push(`${p} rolou 1: ${eqDef?.nome ?? 'equipamento'} QUEBROU.`);
  } else if (d >= 4) {
    alvo.refino += 1;
    next.log.push(`${p} rolou ${d}: ${eqDef?.nome ?? 'equipamento'} foi para +${alvo.refino}.`);
  } else {
    next.log.push(`${p} rolou ${d}: nada aconteceu.`);
  }
  gastarAcao(next, p);
  return next;
};

export interface ComprarConsumivelPayload {
  type: 'comprarConsumivel';
}

export const comprarConsumivel = (state: EmperiumState, ctx: GameContext) => {
  if (state.step !== 'mercado') return INVALID_MOVE;
  const p = ctx.actor;
  if (jogadorDoMercado(state) !== p) return INVALID_MOVE;
  const clan = state.clans[p];
  if (!clan || clan.acoesRestantes <= 0 || clan.zeny < CUSTO_CONSUMIVEL) return INVALID_MOVE;
  if (state.deckConsumiveis.length === 0) return INVALID_MOVE;

  const next = clone(state);
  const c = next.clans[p]!;
  c.zeny -= CUSTO_CONSUMIVEL;
  c.consumiveis.push(next.deckConsumiveis.shift()!);
  next.log.push(`${p} comprou um consumivel.`);
  gastarAcao(next, p);
  return next;
};

export interface ComprarCartaMonstroPayload {
  type: 'comprarCartaMonstro';
  equipInstId: string;
}

export const comprarCartaMonstro = (
  state: EmperiumState,
  ctx: GameContext,
  payload: ComprarCartaMonstroPayload,
) => {
  if (state.step !== 'mercado') return INVALID_MOVE;
  const p = ctx.actor;
  if (jogadorDoMercado(state) !== p) return INVALID_MOVE;
  const clan = state.clans[p];
  if (!clan || clan.acoesRestantes <= 0 || clan.zeny < CUSTO_CARTA_MONSTRO) return INVALID_MOVE;
  if (state.deckMonstros.length === 0) return INVALID_MOVE;
  const eq = clan.equips[payload.equipInstId];
  if (!eq) return INVALID_MOVE;
  const eqDef = EQUIP_BY_ID.get(eq.defId);
  if (!eqDef || eq.encaixadas.length >= eqDef.encaixes) return INVALID_MOVE;

  const next = clone(state);
  const c = next.clans[p]!;
  c.zeny -= CUSTO_CARTA_MONSTRO;
  const mcId = next.deckMonstros.shift()!;
  c.equips[payload.equipInstId]!.encaixadas.push(mcId);
  next.log.push(`${p} encaixou uma carta de monstro em ${eqDef.nome}.`);
  gastarAcao(next, p);
  return next;
};

export interface PassarMercadoPayload {
  type: 'passarMercado';
}

export const passarMercado = (state: EmperiumState, ctx: GameContext) => {
  if (state.step !== 'mercado') return INVALID_MOVE;
  const p = ctx.actor;
  if (jogadorDoMercado(state) !== p) return INVALID_MOVE;
  const next = clone(state);
  next.clans[p]!.acoesRestantes = 0;
  avancarMercado(next);
  return next;
};

/* ─────────────────────────────────────────────────────────────────────────
 * Comprometimento simultaneo (off-turn)
 * ───────────────────────────────────────────────────────────────────────── */

export interface ConfirmarPayload {
  type: 'confirmarComprometimento';
  commitments: Commitment[];
}

function validarComprometimento(
  state: EmperiumState,
  p: PlayerId,
  commitments: readonly Commitment[],
): boolean {
  const clan = state.clans[p];
  if (!clan) return false;
  // No maximo 4 salas — uma Ordem cada, e cada Ordem so uma vez por rodada.
  if (commitments.length > ALL_ORDERS.length) return false;

  const permitidas = new Set(allowedSlots(state, p));
  const ordensUsadas = new Set<string>();
  const usados = new Set<string>();

  for (const c of commitments) {
    if (!state.slots.includes(c.slot)) return false;
    if (!permitidas.has(c.slot)) return false;
    if (ordensUsadas.has(c.ordem)) return false;
    if (!clan.ordensDisponiveis.includes(c.ordem)) return false;
    ordensUsadas.add(c.ordem);
    if (c.charInstIds.length === 0) return false;

    const room = state.rooms[c.slot];
    const tile = room ? TILE_BY_ID.get(room.tileId) : undefined;
    // Cerco ignora o limite da sala.
    const limite = tile?.limite ?? 0;
    if (limite > 0 && c.ordem !== 'cerco' && c.charInstIds.length > limite) return false;

    for (const id of c.charInstIds) {
      if (usados.has(id)) return false;
      usados.add(id);
      const inst = clan.chars[id];
      if (!inst || inst.local !== 'reserva') return false;
    }
    if (c.consumivel && !clan.consumiveis.includes(c.consumivel)) return false;
  }
  return true;
}

/**
 * Move off-turn: qualquer jogador confirma a qualquer momento. Quando o ultimo
 * confirma, a resolucao roda inteira e a rodada avanca.
 */
export const confirmarComprometimento = (
  state: EmperiumState,
  ctx: GameContext,
  payload: ConfirmarPayload,
) => {
  if (state.step !== 'comprometimento') return INVALID_MOVE;
  const p = ctx.actor;
  if (state.confirmados.includes(p)) return INVALID_MOVE;
  const commitments = payload.commitments ?? [];
  if (!validarComprometimento(state, p, commitments)) return INVALID_MOVE;

  const next = clone(state);
  next.commitments[p] = commitments;
  next.confirmados.push(p);

  // Labirinto cobra 1 zeny por personagem comprometido.
  const clan = next.clans[p]!;
  for (const c of commitments) {
    const room = next.rooms[c.slot];
    const tile = room ? TILE_BY_ID.get(room.tileId) : undefined;
    if (tile?.effect === 'pedagio-sem-alcance') {
      clan.zeny = Math.max(0, clan.zeny - c.charInstIds.length);
    }
    if (c.ordem) clan.ordensDisponiveis = clan.ordensDisponiveis.filter((o) => o !== c.ordem);
    if (c.consumivel) {
      const i = clan.consumiveis.indexOf(c.consumivel);
      if (i >= 0) clan.consumiveis.splice(i, 1);
    }
    if (c.pagarCarrocerada) clan.zeny = Math.max(0, clan.zeny - 3);
    for (const id of c.charInstIds) {
      const inst = clan.chars[id];
      if (inst) inst.local = 'comprometido';
    }
  }

  if (next.confirmados.length >= next.order.length) {
    resolverRodada(next, ctx);
  }
  return next;
};

/* ─────────────────────────────────────────────────────────────────────────
 * Resolucao
 * ───────────────────────────────────────────────────────────────────────── */

/** Para onde vai um personagem que sofreu baixa nesta sala. */
function destinoDaBaixa(state: EmperiumState, slot: RoomSlot, p: PlayerId, instId: string): 'reserva' | 'enfermaria' {
  const room = state.rooms[slot];
  const tile = room ? TILE_BY_ID.get(room.tileId) : undefined;
  if (tile?.effect === 'cripta' || tile?.effect === 'sem-baixa') return 'reserva';
  const clan = state.clans[p];
  const inst = clan?.chars[instId];
  if (!inst) return 'enfermaria';
  const def = CHARACTER_BY_ID.get(inst.defId);
  // Superaprendiz Anjo da Guarda volta a Reserva em vez da Enfermaria.
  if (def?.id === 'sup-anjo') return 'reserva';
  for (const eqId of inst.equips) {
    const eq = clan?.equips[eqId];
    const eqDef = eq ? EQUIP_BY_ID.get(eq.defId) : undefined;
    if (eqDef?.special === 'baixa-vai-reserva') return 'reserva';
  }
  return 'enfermaria';
}

function aplicarBaixa(state: EmperiumState, slot: RoomSlot, p: PlayerId, instId: string): void {
  const clan = state.clans[p];
  const inst = clan?.chars[instId];
  if (!clan || !inst) return;
  const destino = destinoDaBaixa(state, slot, p, instId);
  inst.local = destino;
  if (destino === 'enfermaria') inst.voltaNaRodada = state.round + 1;
}

/** Resolve todas as salas, aplica baixas, controle e espolios. */
export function resolverRodada(state: EmperiumState, ctx: GameContext): void {
  state.step = 'resolucao';
  const resolucoes: RoomResolution[] = [];

  // Emboscada resolve antes de tudo, depois do portao para dentro.
  const ordem: RoomSlot[] = [];
  const comEmboscada = new Set<RoomSlot>();
  for (const [p, cs] of Object.entries(state.commitments)) {
    for (const c of cs) if (c.ordem === 'emboscada') comEmboscada.add(c.slot);
    void p;
  }
  for (const s of RESOLUTION_ORDER) {
    if (state.slots.includes(s) && comEmboscada.has(s)) ordem.push(s);
  }
  for (const s of RESOLUTION_ORDER) {
    if (state.slots.includes(s) && !comEmboscada.has(s)) ordem.push(s);
  }

  for (const slot of ordem) {
    const inputs: RoomInput[] = [];
    for (const p of state.order) {
      const c = (state.commitments[p] ?? []).find((x) => x.slot === slot);
      if (c) inputs.push({ playerId: p, commitment: c });
    }
    if (inputs.length === 0) continue;

    const res = slot === 'emperium' ? resolveEmperium(state, inputs) : resolveRoom(state, slot, inputs);
    resolucoes.push(res);

    // Marca as salas visitadas (para RAJADA) antes de mover ninguem.
    for (const input of inputs) {
      const clan = state.clans[input.playerId];
      if (!clan) continue;
      for (const id of input.commitment.charInstIds) {
        const inst = clan.chars[id];
        if (inst && !inst.salasVisitadas.includes(slot)) inst.salasVisitadas.push(slot);
      }
    }

    // Espolio: o vencedor pega 1 equipamento de um caido inimigo.
    const vencedor = res.faccoes.find((f) => f.venceu)?.playerId ?? null;
    if (vencedor) {
      let melhor: { dono: PlayerId; eqId: string; poder: number } | null = null;
      for (const f of res.faccoes) {
        if (!f.playerId || f.playerId === vencedor) continue;
        const dono = state.clans[f.playerId];
        if (!dono) continue;
        for (const instId of f.baixas) {
          for (const eqId of dono.chars[instId]?.equips ?? []) {
            const eq = dono.equips[eqId];
            const eqDef = eq ? EQUIP_BY_ID.get(eq.defId) : undefined;
            const poder = (eqDef?.poder ?? 0) + (eq?.refino ?? 0);
            if (!melhor || poder > melhor.poder) melhor = { dono: f.playerId, eqId, poder };
          }
        }
      }
      if (melhor) {
        const origem = state.clans[melhor.dono]!;
        const destino = state.clans[vencedor]!;
        const eq = origem.equips[melhor.eqId]!;
        if (eq.portador) {
          const port = origem.chars[eq.portador];
          if (port) port.equips = port.equips.filter((id) => id !== eq.instId);
        }
        delete origem.equips[melhor.eqId];
        eq.portador = undefined;
        destino.equips[eq.instId] = eq;
        state.log.push(`${vencedor} pilhou um equipamento de ${melhor.dono} em ${slot}.`);
      }

      // PILHAR: zeny para quem venceu.
      const fac = res.faccoes.find((f) => f.playerId === vencedor);
      if (fac) {
        const clan = state.clans[vencedor]!;
        const commit = (state.commitments[vencedor] ?? []).find((x) => x.slot === slot);
        for (const id of commit?.charInstIds ?? []) {
          const def = CHARACTER_BY_ID.get(clan.chars[id]?.defId ?? '');
          const pilhar = def?.keywords.find((k) => k.kw === 'pilhar');
          if (pilhar) clan.zeny += pilhar.x ?? 0;
        }
      }
    }

    // Baixas.
    for (const f of res.faccoes) {
      if (!f.playerId) continue;
      for (const instId of f.baixas) aplicarBaixa(state, slot, f.playerId, instId);
    }

    // ESGOTAR: vai para a Enfermaria tendo vencido ou perdido.
    for (const input of inputs) {
      const clan = state.clans[input.playerId];
      if (!clan) continue;
      for (const id of input.commitment.charInstIds) {
        const inst = clan.chars[id];
        if (!inst || inst.local === 'enfermaria') continue;
        const def = CHARACTER_BY_ID.get(inst.defId);
        if (def?.keywords.some((k) => k.kw === 'esgotar')) {
          inst.local = 'enfermaria';
          inst.voltaNaRodada = state.round + 1;
        }
      }
    }

    // Controle da sala.
    if (slot !== 'emperium') {
      const room = state.rooms[slot];
      if (room) room.controlador = res.controlador;
    }

    // Quebra do Emperium.
    if (res.emperiumQuebrado) {
      for (const [pid, cubos] of Object.entries(res.danoPorJogador ?? {})) {
        state.emperiumCubos[pid] = (state.emperiumCubos[pid] ?? 0) + cubos;
      }
      for (const [pid, cubos] of Object.entries(state.emperiumCubos)) {
        const clan = state.clans[pid];
        if (clan) clan.gloria += cubos;
      }
      if (res.novoDono) {
        state.clans[res.novoDono]!.gloria += GLORIA_BREAK_BONUS;
        state.castleOwnerId = res.novoDono;
        state.log.push(`${res.novoDono} QUEBROU O EMPERIUM e tomou o castelo!`);
      }
      state.emperiumCubos = {};
      // Todos que estavam na Sala do Emperium vao para a Enfermaria.
      for (const input of inputs) {
        const clan = state.clans[input.playerId];
        if (!clan) continue;
        for (const id of input.commitment.charInstIds) {
          const inst = clan.chars[id];
          if (!inst) continue;
          inst.local = 'enfermaria';
          inst.voltaNaRodada = state.round + 1;
        }
      }
    } else if (res.danoPorJogador) {
      for (const [pid, cubos] of Object.entries(res.danoPorJogador)) {
        state.emperiumCubos[pid] = (state.emperiumCubos[pid] ?? 0) + cubos;
      }
    }
  }

  // Sobreviventes voltam a Reserva.
  for (const p of state.order) {
    const clan = state.clans[p];
    if (!clan) continue;
    for (const inst of Object.values(clan.chars)) {
      if (inst.local === 'comprometido') inst.local = 'reserva';
    }
  }

  state.ultimaResolucao = resolucoes;
  fimDeRodada(state, ctx);
}

/** Fase 5: renda de salas, Gloria, Enfermaria, avanco da trilha. */
export function fimDeRodada(state: EmperiumState, ctx: GameContext): void {
  const ehFinal = state.round >= TOTAL_ROUNDS;

  // Renda e efeitos das salas controladas.
  for (const slot of state.slots) {
    const room = state.rooms[slot];
    if (!room?.controlador) continue;
    const tile = TILE_BY_ID.get(room.tileId);
    const clan = state.clans[room.controlador];
    if (!clan || !tile) continue;
    if (tile.effect === 'renda4') clan.zeny += 4;
    if (tile.effect === 'forja-gratis') {
      const alvo = Object.values(clan.equips).find((e) => e.refino < REFINO_MAX);
      if (alvo) alvo.refino += 1;
    }
    if (tile.effect === 'capela') {
      const doente = Object.values(clan.chars).find((c) => c.local === 'enfermaria');
      if (doente) {
        doente.local = 'reserva';
        doente.voltaNaRodada = undefined;
      }
    }
  }

  // RESTAURAR das cartas comprometidas nesta rodada.
  for (const p of state.order) {
    const clan = state.clans[p];
    if (!clan) continue;
    let restaurar = 0;
    for (const c of state.commitments[p] ?? []) {
      for (const id of c.charInstIds) {
        const def = CHARACTER_BY_ID.get(clan.chars[id]?.defId ?? '');
        const r = def?.keywords.find((k) => k.kw === 'restaurar');
        if (r) restaurar += r.x ?? 0;
      }
    }
    for (let i = 0; i < restaurar; i++) {
      const doente = Object.values(clan.chars).find((c) => c.local === 'enfermaria');
      if (!doente) break;
      doente.local = 'reserva';
      doente.voltaNaRodada = undefined;
    }
  }

  // Gloria do dono do castelo.
  const dono = state.clans[state.castleOwnerId];
  if (dono) {
    const ganho = ehFinal ? GLORIA_HOLD_FINAL : GLORIA_HOLD;
    dono.gloria += ganho;
    state.log.push(`${state.castleOwnerId} segurou o castelo: +${ganho} de Gloria.`);
  }

  if (ehFinal) {
    state.step = 'fim';
    state.finished = true;
    const ranking = [...state.order].sort(
      (a, b) => (state.clans[b]?.gloria ?? 0) - (state.clans[a]?.gloria ?? 0),
    );
    const topo = state.clans[ranking[0]!]?.gloria ?? 0;
    const empatados = ranking.filter((p) => (state.clans[p]?.gloria ?? 0) === topo);
    // Empate vai para quem estiver com o castelo.
    state.winnerId = empatados.includes(state.castleOwnerId) ? state.castleOwnerId : ranking[0];
    return;
  }

  // Enfermaria: volta na rodada seguinte.
  state.round += 1;
  for (const p of state.order) {
    const clan = state.clans[p];
    if (!clan) continue;
    for (const inst of Object.values(clan.chars)) {
      if (inst.local === 'enfermaria' && (inst.voltaNaRodada ?? 0) <= state.round) {
        inst.local = 'reserva';
        inst.voltaNaRodada = undefined;
      }
    }
  }

  iniciarRodada(state, ctx);
}

export type EmperiumMovePayload =
  | RecrutarPayload
  | EquiparPayload
  | RefinarPayload
  | ComprarConsumivelPayload
  | ComprarCartaMonstroPayload
  | PassarMercadoPayload
  | ConfirmarPayload;
