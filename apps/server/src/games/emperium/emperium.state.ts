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
  /** Mestre-Ferreiro Carrocerada: pagar 3 zeny por +4 de Poder nesta sala. */
  pagarCarrocerada?: boolean;
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
  deckIILiberado: boolean;

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

/** Salas onde `p` pode comprometer: portao sempre + adjacentes ao que controla. */
export function allowedSlots(state: EmperiumState, p: PlayerId): RoomSlot[] {
  // O dono do castelo ignora a regra de posicionamento (design secao 7).
  if (isDefender(state, p)) return [...state.slots];

  const allowed = new Set<RoomSlot>(['portao']);
  for (const slot of state.slots) {
    const room = state.rooms[slot];
    if (!room) continue;
    if (room.controlador === p) {
      allowed.add(slot);
      for (const adj of state.adjacency[slot] ?? []) allowed.add(adj);
    }
    // Portal Runico ignora a regra de posicionamento.
    if (room.tileId === 'sala-portal') allowed.add(slot);
  }
  // Sala do Emperium exige ter controlado o Salao do Trono.
  if (state.rooms['trono']?.controlador !== p) allowed.delete('emperium');
  return [...allowed].filter((s) => state.slots.includes(s));
}

export function totalCommittedChars(commitments: readonly Commitment[]): number {
  return commitments.reduce((n, c) => n + c.charInstIds.length, 0);
}
