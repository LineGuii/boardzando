import type { PlayerId } from '@boardzando/contracts';
import type { RoomSlot } from './emperium.rooms';

/**
 * Estado de Guerra do Emperium. Serializavel: sem classes, sem funcoes.
 * Ver `docs/emperium/01-design-v0.1.md` secao 16 para a estrutura da rodada.
 */

/** As fases de uma rodada. `renda` e `fimRodada` sao instantaneas (hooks). */
export type Step = 'mercado' | 'comprometimento' | 'resolucao' | 'fim';

/** As quatro Ordens. Cada uma so pode ser usada uma vez por rodada. */
export type OrderId = 'investida' | 'cerco' | 'emboscada' | 'resguardo';

export const ALL_ORDERS: readonly OrderId[] = ['investida', 'cerco', 'emboscada', 'resguardo'];

export type CharLocation = 'reserva' | 'enfermaria' | 'comprometido';

export interface CharInstance {
  readonly instId: string;
  /** CharacterDef.id em emperium.cards.ts */
  readonly defId: string;
  /**
   * TranscendenceDef.id, se este personagem ja evoluiu. A carta base continua
   * sendo `defId` — a Transcendencia e empilhada por cima e SOMA Poder e
   * palavras-chave. Uma vez so, e nunca substitui a identidade do personagem.
   */
  transcendencia?: string;
  /** instIds de EquipInstance anexados. */
  equips: string[];
  local: CharLocation;
  /** Rodada em que volta da Enfermaria para a Reserva. */
  voltaNaRodada?: number;
  /** Salas em que ja combateu — RAJADA so vale na primeira vez em cada sala. */
  salasVisitadas: RoomSlot[];
}

export interface EquipInstance {
  readonly instId: string;
  /** EquipDef.id em emperium.cards.ts */
  readonly defId: string;
  /** 0..3. Cada nivel vale +1 de Poder. */
  refino: number;
  /** MonsterCardDef.ids encaixados. Limitado por EquipDef.encaixes. */
  encaixadas: string[];
  /** instId do CharInstance portador. undefined = solto na area do cla. */
  portador?: string;
}

export interface Clan {
  readonly playerId: PlayerId;
  zeny: number;
  gloria: number;
  chars: Record<string, CharInstance>;
  equips: Record<string, EquipInstance>;
  /** ConsumableDef.ids na mao. */
  consumiveis: string[];
  /** Acoes de mercado restantes nesta rodada. */
  acoesRestantes: number;
  /** Ordens ainda nao usadas nesta rodada. */
  ordensDisponiveis: OrderId[];
}

/** Um comprometimento: quem vai para qual sala, com que Ordem. */
export interface Commitment {
  slot: RoomSlot;
  charInstIds: string[];
  ordem: OrderId;
  /** ConsumableDef.id jogado de brucos nesta sala. */
  consumivel?: string;
  /**
   * Salas de Marcha Forcada, gravadas na confirmacao. Fica no comprometimento
   * (e nao e recalculado na resolucao) porque o controle das salas muda
   * conforme elas resolvem — a distancia que vale e a do momento em que voce
   * declarou a investida.
   */
  marcha?: number;
}

export interface RoomState {
  readonly slot: RoomSlot;
  /** RoomTileDef.id */
  readonly tileId: string;
  controlador: PlayerId | null;
  /** Poder da guarnicao fixa da sala (Salao dos Guardioes) — 0 se nao houver. */
  guarnicaoFixa: number;
  /** Guardioes que o defensor posicionou aqui. */
  guardioesDefensor: number;
}

/** Resultado de uma faccao numa sala, para o log e para a UI. */
export interface FactionResult {
  playerId: PlayerId | null; // null = guarnicao / Cla Fantasma
  poderBruto: number;
  poderFinal: number;
  ordem: OrderId | null;
  baixas: string[];
  venceu: boolean;
  /** Salas de Marcha Forcada percorridas; 0 = entrou pela linha de frente. */
  marcha: number;
}

export interface RoomResolution {
  slot: RoomSlot;
  tileId: string;
  faccoes: FactionResult[];
  controlador: PlayerId | null;
  /** Quem controlava a sala ANTES desta resolucao. */
  controladorAnterior: PlayerId | null;
  /** Nenhuma faccao comprometeu aqui: a sala e reportada, mas nada aconteceu. */
  semDisputa: boolean;
  /** Uma unica faccao entrou: tomada sem resistencia. */
  semResistencia: boolean;
  /** Frase pronta para o log e para a legenda do confronto. */
  resumo: string;
  /** So na Sala do Emperium. */
  escudo?: number;
  danoPorJogador?: Record<PlayerId, number>;
  emperiumQuebrado?: boolean;
  novoDono?: PlayerId;
}

export interface EmperiumState {
  /** v0.1 implementa o Modo 3 (Cerco). Modos 1 e 2 sao deltas futuros. */
  readonly modo: 'cerco';
  round: number;
  step: Step;

  /** Ordem da mesa, estavel. */
  readonly order: readonly PlayerId[];
  readonly defenderId: PlayerId;
  castleOwnerId: PlayerId;

  readonly scaling: { durabilidade: number; guardioes: number; linear: boolean };
  /** Salas em jogo (5 no castelo linear de 3 jogadores, 7 no losango). */
  readonly slots: readonly RoomSlot[];
  readonly adjacency: Readonly<Record<string, readonly RoomSlot[]>>;
  rooms: Record<string, RoomState>;

  clans: Record<PlayerId, Clan>;

  // ── Mercado ────────────────────────────────────────────────────────────
  /** CharacterDef.ids virados na fileira de recrutamento (5). */
  fileiraRecrutamento: string[];
  /** EquipDef.ids virados na fileira de equipamento (4). */
  fileiraEquip: string[];
  deckRecrutamento: string[];
  deckEquip: string[];
  deckMonstros: string[];
  deckConsumiveis: string[];
  /** Ordem inversa de Gloria, recalculada no inicio de cada rodada. */
  mercadoOrdem: PlayerId[];
  mercadoIndex: number;
  /** true quando o Deck II ja foi embaralhado (rodada 3). */
  altarAberto: boolean;

  // ── Comprometimento ────────────────────────────────────────────────────
  commitments: Record<PlayerId, Commitment[]>;
  confirmados: PlayerId[];

  // ── Emperium ───────────────────────────────────────────────────────────
  emperiumCubos: Record<PlayerId, number>;
  emperiumDurabilidade: number;

  // ── Meta ───────────────────────────────────────────────────────────────
  log: string[];
  ultimaResolucao: RoomResolution[] | null;
  finished: boolean;
  winnerId?: PlayerId;
  nextInstId: number;
}

/* ─────────────────────────────────────────────────────────────────────────
 * Helpers puros de leitura
 * ───────────────────────────────────────────────────────────────────────── */

export function clanOf(state: EmperiumState, p: PlayerId): Clan | undefined {
  return state.clans[p];
}

export function isDefender(state: EmperiumState, p: PlayerId): boolean {
  return state.castleOwnerId === p;
}

/** Penalidade de Poder por sala de distancia numa Marcha Forcada. */
export const MARCHA_PENALIDADE = 2;

/**
 * Distancia de infiltracao de cada sala para `p`, em salas.
 *
 * 0 = a sala esta na sua linha de frente (o Portao, o que voce controla e o
 * que faz fronteira com isso): entrada normal, sem custo.
 *
 * >0 = **Marcha Forcada**. Voce pode comprometer em QUALQUER sala do castelo a
 * qualquer momento, mas chega disperso e sem folego: -2 de Poder por sala de
 * distancia. E o que impede a rodada 1 de ter um destino legal so — sem isso o
 * Portao e a unica opcao de todo mundo, o defensor nao tem nada para adivinhar
 * e o jogo demora tres rodadas para comecar.
 */
export function slotDistances(state: EmperiumState, p: PlayerId): Record<string, number> {
  const dist: Record<string, number> = {};

  // O dono do castelo se move livremente dentro do proprio castelo.
  if (isDefender(state, p)) {
    for (const s of state.slots) dist[s] = 0;
    return dist;
  }

  const fronteira = new Set<RoomSlot>(['portao']);
  for (const slot of state.slots) {
    const room = state.rooms[slot];
    if (!room) continue;
    if (room.controlador === p) {
      fronteira.add(slot);
      for (const adj of state.adjacency[slot] ?? []) fronteira.add(adj);
    }
    // Portal Runico e uma entrada franca por definicao.
    if (room.tileId === 'sala-portal') fronteira.add(slot);
  }

  const fila: RoomSlot[] = [];
  for (const s of fronteira) {
    if (!state.slots.includes(s)) continue;
    dist[s] = 0;
    fila.push(s);
  }
  while (fila.length > 0) {
    const atual = fila.shift()!;
    for (const adj of state.adjacency[atual] ?? []) {
      if (!state.slots.includes(adj) || dist[adj] !== undefined) continue;
      dist[adj] = (dist[atual] ?? 0) + 1;
      fila.push(adj);
    }
  }
  return dist;
}

/** Toda sala do castelo e alcancavel; o que varia e o preco em Poder. */
export function allowedSlots(state: EmperiumState, p: PlayerId): RoomSlot[] {
  const dist = slotDistances(state, p);
  return state.slots.filter((s) => dist[s] !== undefined);
}

export function totalCommittedChars(commitments: readonly Commitment[]): number {
  return commitments.reduce((n, c) => n + c.charInstIds.length, 0);
}
