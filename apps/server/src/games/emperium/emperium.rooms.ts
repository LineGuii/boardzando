/**
 * O castelo: 3 salas fixas + 12 fichas de ala (4 sorteadas por partida).
 * Topologia em losango — ver `docs/emperium/01-design-v0.1.md` secao 7.
 *
 *              [emperium]
 *                  |
 *               [trono]
 *              /       \
 *           [b2]       [c2]
 *            |           |
 *           [b1]       [c1]
 *              \       /
 *              [portao]
 */

export type RoomSlot = 'portao' | 'b1' | 'b2' | 'c1' | 'c2' | 'trono' | 'emperium';

export const ROOM_SLOTS: readonly RoomSlot[] = ['portao', 'b1', 'c1', 'b2', 'c2', 'trono', 'emperium'];

/** Ordem de resolucao: do portao para dentro. */
export const RESOLUTION_ORDER: readonly RoomSlot[] = ['portao', 'b1', 'c1', 'b2', 'c2', 'trono', 'emperium'];

/** Grafo nao-direcionado do castelo. */
export const ADJACENCY: Readonly<Record<RoomSlot, readonly RoomSlot[]>> = {
  portao: ['b1', 'c1'],
  b1: ['portao', 'b2'],
  b2: ['b1', 'trono'],
  c1: ['portao', 'c2'],
  c2: ['c1', 'trono'],
  trono: ['b2', 'c2', 'emperium'],
  emperium: ['trono'],
};

/** As alas usadas com 3 jogadores: castelo vira uma linha (design secao 14). */
export const LINEAR_SLOTS: readonly RoomSlot[] = ['portao', 'b1', 'b2', 'trono', 'emperium'];

export const LINEAR_ADJACENCY: Readonly<Record<string, readonly RoomSlot[]>> = {
  portao: ['b1'],
  b1: ['portao', 'b2'],
  b2: ['b1', 'trono'],
  trono: ['b2', 'emperium'],
  emperium: ['trono'],
};

export type RoomEffect =
  | 'nenhum'
  | 'limite2'
  | 'bonus-alcance'
  | 'sem-baixa'
  | 'pedagio-sem-alcance'
  | 'guarnicao6'
  | 'renda4'
  | 'forja-gratis'
  | 'capela'
  | 'vigia'
  | 'cripta'
  | 'portal'
  | 'terraco';

/**
 * Limite padrao de personagens por cla numa sala.
 *
 * Quase toda sala tem limite, e e isso que da valor a Ordem CERCO — que ignora
 * o limite. Na v0.2 so o Corredor Estreito limitava, entao o Cerco valia em uma
 * sala de sete e era uma Ordem morta nas outras seis.
 *
 * As duas excecoes sao deliberadas: o **Patio Aberto** e o **Salao do Trono**
 * nao tem limite nenhum. O Patio e a sala onde exercito grande simplesmente
 * ganha; o Trono e o ultimo degrau antes do Emperium e precisa comportar um
 * cerco de verdade dos dois lados.
 */
export const LIMITE_PADRAO = 3;

export interface RoomTileDef {
  readonly id: string;
  readonly nome: string;
  readonly regra: string;
  readonly effect: RoomEffect;
  /** Limite de personagens por cla. 0 = sem limite. */
  readonly limite: number;
}

/** As 12 fichas de ala. Quatro entram em jogo por partida. */
export const WING_TILES: readonly RoomTileDef[] = [
  { id: 'sala-corredor', nome: 'Corredor Estreito', regra: 'Limite 2 personagens por cla.', effect: 'limite2', limite: 2 },
  { id: 'sala-patio', nome: 'Patio Aberto', regra: 'Personagens com Alcance tem +1 de Poder.', effect: 'bonus-alcance', limite: 0 },
  { id: 'sala-ponte', nome: 'Ponte sobre o Fosso', regra: 'Clas derrotados nao sofrem baixa: voltam a Reserva.', effect: 'sem-baixa', limite: LIMITE_PADRAO },
  { id: 'sala-labirinto', nome: 'Labirinto', regra: 'Comprometer aqui custa 1 zeny por personagem. Alcance nao funciona.', effect: 'pedagio-sem-alcance', limite: LIMITE_PADRAO },
  { id: 'sala-guardioes', nome: 'Salao dos Guardioes', regra: 'Guarnicao de Poder 6 que combate todos os clas. Ninguem controla enquanto viva.', effect: 'guarnicao6', limite: LIMITE_PADRAO },
  { id: 'sala-armazem', nome: 'Armazem', regra: 'Quem controla ganha 4 zeny no fim da rodada.', effect: 'renda4', limite: LIMITE_PADRAO },
  { id: 'sala-forja', nome: 'Forja', regra: 'Quem controla faz 1 refino gratis e sem risco no fim da rodada.', effect: 'forja-gratis', limite: LIMITE_PADRAO },
  { id: 'sala-capela', nome: 'Capela', regra: 'Quem controla move 1 personagem da Enfermaria para a Reserva no fim da rodada.', effect: 'capela', limite: LIMITE_PADRAO },
  { id: 'sala-vigia', nome: 'Torre de Vigia', regra: 'Quem controla olha os comprometimentos ocultos de 1 sala adjacente antes da revelacao.', effect: 'vigia', limite: LIMITE_PADRAO },
  { id: 'sala-cripta', nome: 'Cripta', regra: 'Baixas aqui vao para a Reserva, nao para a Enfermaria.', effect: 'cripta', limite: LIMITE_PADRAO },
  { id: 'sala-portal', nome: 'Portal Runico', regra: 'Ignore a regra de posicionamento para comprometer aqui.', effect: 'portal', limite: LIMITE_PADRAO },
  { id: 'sala-terraco', nome: 'Terraco', regra: 'Arcano tem Poder dobrado. Vanguarda tem -2 de Poder.', effect: 'terraco', limite: LIMITE_PADRAO },
];

/** As tres salas fixas, que ancoram o aprendizado do castelo. */
export const FIXED_TILES: Readonly<Record<'portao' | 'trono' | 'emperium', RoomTileDef>> = {
  portao: {
    id: 'sala-portao',
    nome: 'Portao Principal',
    regra: 'Limite 3 por cla. Todo mundo sempre pode entrar por aqui.',
    effect: 'nenhum',
    limite: LIMITE_PADRAO,
  },
  trono: {
    id: 'sala-trono',
    nome: 'Salao do Trono',
    regra: 'Sem limite. O dono do castelo tem +2 de Poder aqui.',
    effect: 'nenhum',
    limite: 0,
  },
  emperium: {
    id: 'sala-emperium',
    nome: 'Sala do Emperium',
    regra: 'Nao se disputa controle. O escudo do defensor absorve em ordem crescente.',
    effect: 'nenhum',
    limite: 0,
  },
};

export const TILE_BY_ID: ReadonlyMap<string, RoomTileDef> = new Map(
  [...WING_TILES, ...Object.values(FIXED_TILES)].map((t) => [t.id, t]),
);

/** Escudo base do Emperium por rodada (design secao 9). Indice 0 = rodada 1. */
export const SHIELD_BY_ROUND: readonly number[] = [8, 8, 8, 6, 4, 2];

/** Durabilidade do Emperium e guardioes por numero de atacantes (design secao 14). */
export const SCALING: Readonly<Record<number, { durabilidade: number; guardioes: number; linear: boolean }>> = {
  2: { durabilidade: 10, guardioes: 2, linear: true },
  3: { durabilidade: 14, guardioes: 3, linear: false },
  4: { durabilidade: 18, guardioes: 4, linear: false },
};

export const TOTAL_ROUNDS = 6;

/** Gloria por segurar o castelo no fim de cada rodada. */
export const GLORIA_HOLD = 2;
export const GLORIA_HOLD_FINAL = 8;
export const GLORIA_BREAK_BONUS = 3;

export const RENDA_BASE = 6;
export const RENDA_CASTELO = 6;
export const ACOES_MERCADO = 3;
