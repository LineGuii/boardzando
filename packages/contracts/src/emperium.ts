/**
 * Catalogo estatico de Guerra do Emperium: 52 personagens (13 classes x 4
 * variacoes), equipamentos, cartas de monstro e consumiveis.
 *
 * Ver `docs/emperium/01-design-v0.1.md` secoes 11 e 12. Este arquivo e a fonte
 * unica desses numeros — nada aqui e calculado em runtime.
 */

/** Define que equipamento a carta aceita. Nao tem efeito mecanico proprio. */
export type Papel = 'vanguarda' | 'arcano' | 'agil' | 'suporte';

/** Deck I = Classico (rodada 1+). Deck II = Transcendente (rodada 3+). */
export type Deck = 1 | 2;

/** As 14 palavras-chave. Toda carta compoe a partir desta lista. */
export type KeywordName =
  | 'alcance'
  | 'escudar'
  | 'muralha'
  | 'perfurar'
  | 'rajada'
  | 'elo'
  | 'solo'
  | 'oculto'
  | 'devocao'
  | 'anular'
  | 'restaurar'
  | 'pilhar'
  | 'esgotar'
  | 'imitar';

/** Palavra-chave com seu valor X (ausente quando a keyword nao usa X). */
export interface Keyword {
  readonly kw: KeywordName;
  readonly x?: number;
}

export interface CharacterDef {
  readonly id: string;
  readonly nome: string;
  readonly classe: string;
  readonly deck: Deck;
  readonly custo: number;
  readonly poder: number;
  readonly papel: Papel;
  readonly slots: number;
  readonly keywords: readonly Keyword[];
  /** O build do Ragnarok que a variacao representa. So flavor. */
  readonly build: string;
  /**
   * Efeitos que nao entram no calculo de combate (economia/posicionamento).
   * Mantidos fora das keywords para nao inflar a gramatica. Ver design 17.6.
   */
  readonly special?: 'forja' | 'carrocerada' | 'salto' | 'ensemble' | 'marionete' | 'teimoso';
}

const kw = (name: KeywordName, x?: number): Keyword => (x === undefined ? { kw: name } : { kw: name, x });

/* ─────────────────────────────────────────────────────────────────────────
 * Deck I — Classico
 * ───────────────────────────────────────────────────────────────────────── */

export const DECK_I: readonly CharacterDef[] = [
  { id: 'cav-bb', nome: 'Cavaleiro Bola de Boliche', classe: 'Cavaleiro', deck: 1, custo: 6, poder: 4, papel: 'vanguarda', slots: 2, keywords: [kw('elo', 1)], build: 'Bowling Bash' },
  { id: 'cav-lanca', nome: 'Cavaleiro Lanceiro', classe: 'Cavaleiro', deck: 1, custo: 5, poder: 3, papel: 'vanguarda', slots: 1, keywords: [kw('perfurar', 2)], build: 'Pierce montado' },

  { id: 'tem-escudeiro', nome: 'Templario Escudeiro', classe: 'Templario', deck: 1, custo: 5, poder: 2, papel: 'vanguarda', slots: 2, keywords: [kw('escudar')], build: 'Tanque de escudo' },
  { id: 'tem-defensor', nome: 'Templario Defensor', classe: 'Templario', deck: 1, custo: 6, poder: 3, papel: 'vanguarda', slots: 1, keywords: [kw('muralha', 1)], build: 'Defender' },

  { id: 'bru-tempestade', nome: 'Bruxo Tempestade', classe: 'Bruxo', deck: 1, custo: 7, poder: 3, papel: 'arcano', slots: 1, keywords: [kw('muralha', 2), kw('alcance')], build: 'Storm Gust' },
  { id: 'bru-jupitel', nome: 'Bruxo Jupitel', classe: 'Bruxo', deck: 1, custo: 5, poder: 4, papel: 'arcano', slots: 1, keywords: [kw('alcance')], build: 'Jupitel / Napalm' },

  { id: 'sab-solo', nome: 'Sabio Protecao de Solo', classe: 'Sabio', deck: 1, custo: 6, poder: 2, papel: 'arcano', slots: 1, keywords: [kw('anular')], build: 'Land Protection' },
  { id: 'sab-encantador', nome: 'Sabio Encantador', classe: 'Sabio', deck: 1, custo: 5, poder: 2, papel: 'arcano', slots: 2, keywords: [kw('elo', 1)], build: 'Endow' },

  { id: 'mer-sonico', nome: 'Mercenario Golpe Sonico', classe: 'Mercenario', deck: 1, custo: 6, poder: 3, papel: 'agil', slots: 1, keywords: [kw('rajada', 3)], build: 'Sonic Blow' },
  { id: 'mer-furtivo', nome: 'Mercenario Furtivo', classe: 'Mercenario', deck: 1, custo: 7, poder: 2, papel: 'agil', slots: 1, keywords: [kw('oculto')], build: 'Cloaking' },

  { id: 'arr-gatuno', nome: 'Arruaceiro Gatuno', classe: 'Arruaceiro', deck: 1, custo: 5, poder: 2, papel: 'agil', slots: 1, keywords: [kw('pilhar', 2)], build: 'Steal' },
  { id: 'arr-saqueador', nome: 'Arruaceiro Saqueador', classe: 'Arruaceiro', deck: 1, custo: 6, poder: 3, papel: 'agil', slots: 1, keywords: [kw('anular')], build: 'Strip' },

  { id: 'fer-forjador', nome: 'Ferreiro Forjador', classe: 'Ferreiro', deck: 1, custo: 5, poder: 2, papel: 'vanguarda', slots: 2, keywords: [], build: 'Forja', special: 'forja' },
  { id: 'fer-mercador', nome: 'Ferreiro Mercador', classe: 'Ferreiro', deck: 1, custo: 4, poder: 1, papel: 'vanguarda', slots: 1, keywords: [kw('pilhar', 3)], build: 'Overcharge' },

  { id: 'alq-homunculo', nome: 'Alquimista Homunculo', classe: 'Alquimista', deck: 1, custo: 6, poder: 2, papel: 'suporte', slots: 1, keywords: [kw('elo', 1)], build: 'Bio-ethics' },
  { id: 'alq-boticario', nome: 'Alquimista Boticario', classe: 'Alquimista', deck: 1, custo: 5, poder: 1, papel: 'suporte', slots: 1, keywords: [kw('restaurar', 1)], build: 'Potion Pitcher' },

  { id: 'sac-suporte', nome: 'Sacerdote Suporte', classe: 'Sacerdote', deck: 1, custo: 6, poder: 1, papel: 'suporte', slots: 1, keywords: [kw('elo', 2)], build: 'Full Support' },
  { id: 'sac-pneuma', nome: 'Sacerdote Pneuma', classe: 'Sacerdote', deck: 1, custo: 6, poder: 2, papel: 'suporte', slots: 1, keywords: [kw('muralha', 2)], build: 'Pneuma / Safety Wall' },

  { id: 'mon-combo', nome: 'Monge Combo', classe: 'Monge', deck: 1, custo: 6, poder: 4, papel: 'vanguarda', slots: 1, keywords: [], build: 'Chain Combo' },
  { id: 'mon-aco', nome: 'Monge Corpo de Aco', classe: 'Monge', deck: 1, custo: 5, poder: 0, papel: 'vanguarda', slots: 2, keywords: [kw('escudar'), kw('esgotar')], build: 'Steel Body' },

  { id: 'cac-armadilheiro', nome: 'Cacador Armadilheiro', classe: 'Cacador', deck: 1, custo: 6, poder: 2, papel: 'agil', slots: 1, keywords: [kw('muralha', 2)], build: 'Trapper' },
  { id: 'cac-tiroduplo', nome: 'Cacador Tiro Duplo', classe: 'Cacador', deck: 1, custo: 6, poder: 4, papel: 'agil', slots: 1, keywords: [kw('alcance')], build: 'Double Strafe' },

  { id: 'bar-cancao', nome: 'Bardo Cancao', classe: 'Bardo/Odalisca', deck: 1, custo: 5, poder: 1, papel: 'suporte', slots: 1, keywords: [kw('elo', 2)], build: 'Cancoes de grupo' },
  { id: 'bar-dancalenta', nome: 'Odalisca Danca Lenta', classe: 'Bardo/Odalisca', deck: 1, custo: 6, poder: 2, papel: 'suporte', slots: 1, keywords: [kw('muralha', 2)], build: 'Slow Grace' },

  { id: 'sup-teimoso', nome: 'Superaprendiz Teimoso', classe: 'Superaprendiz', deck: 1, custo: 3, poder: 2, papel: 'agil', slots: 1, keywords: [], build: 'Sobrevivencia', special: 'teimoso' },
  { id: 'sup-improvisado', nome: 'Superaprendiz Improvisado', classe: 'Superaprendiz', deck: 1, custo: 4, poder: 2, papel: 'suporte', slots: 2, keywords: [kw('imitar')], build: 'Faz de tudo' },
];

/* ─────────────────────────────────────────────────────────────────────────
 * Deck II — Transcendente (entra no mercado a partir da rodada 3)
 * ───────────────────────────────────────────────────────────────────────── */

export const DECK_II: readonly CharacterDef[] = [
  { id: 'lor-espiral', nome: 'Lorde dos Cavaleiros — Espiral', classe: 'Cavaleiro', deck: 2, custo: 11, poder: 6, papel: 'vanguarda', slots: 2, keywords: [kw('perfurar', 4)], build: 'Spiral Pierce' },
  { id: 'lor-berserk', nome: 'Lorde dos Cavaleiros — Berserk', classe: 'Cavaleiro', deck: 2, custo: 10, poder: 8, papel: 'vanguarda', slots: 1, keywords: [kw('esgotar')], build: 'Two-Hand Quicken' },

  { id: 'pal-devocao', nome: 'Paladino — Devocao', classe: 'Templario', deck: 2, custo: 12, poder: 4, papel: 'vanguarda', slots: 2, keywords: [kw('devocao'), kw('escudar')], build: 'Devotion' },
  { id: 'pal-grandecruz', nome: 'Paladino — Grande Cruz', classe: 'Templario', deck: 2, custo: 11, poder: 6, papel: 'vanguarda', slots: 1, keywords: [kw('rajada', 3), kw('esgotar')], build: 'Grand Cross / Sacrifice' },

  { id: 'arq-meteoros', nome: 'Arquimago — Chuva de Meteoros', classe: 'Bruxo', deck: 2, custo: 13, poder: 7, papel: 'arcano', slots: 1, keywords: [kw('alcance'), kw('rajada', 3)], build: 'Meteor Storm' },
  { id: 'arq-nevasca', nome: 'Arquimago — Nevasca', classe: 'Bruxo', deck: 2, custo: 12, poder: 4, papel: 'arcano', slots: 2, keywords: [kw('muralha', 4), kw('alcance')], build: 'Storm Gust precast' },

  { id: 'pro-dissonancia', nome: 'Professor — Dissonancia', classe: 'Sabio', deck: 2, custo: 11, poder: 4, papel: 'arcano', slots: 1, keywords: [kw('anular', 2)], build: 'Dispell / Ganbantein' },
  { id: 'pro-duplocast', nome: 'Professor — Duplo Cast', classe: 'Sabio', deck: 2, custo: 10, poder: 6, papel: 'arcano', slots: 1, keywords: [kw('alcance'), kw('perfurar', 2)], build: 'Double Casting' },

  { id: 'alg-rompealma', nome: 'Algoz — Rompe-Alma', classe: 'Mercenario', deck: 2, custo: 12, poder: 7, papel: 'agil', slots: 1, keywords: [kw('alcance'), kw('rajada', 4)], build: 'Soul Breaker' },
  { id: 'alg-presa', nome: 'Algoz — Presa Sombria', classe: 'Mercenario', deck: 2, custo: 11, poder: 4, papel: 'agil', slots: 2, keywords: [kw('oculto'), kw('solo', 4)], build: 'Grimtooth' },

  { id: 'des-despojar', nome: 'Desordeiro — Despojar', classe: 'Arruaceiro', deck: 2, custo: 10, poder: 4, papel: 'agil', slots: 1, keywords: [kw('anular'), kw('pilhar', 3)], build: 'Full Strip / Gank' },
  { id: 'des-plagio', nome: 'Desordeiro — Plagio', classe: 'Arruaceiro', deck: 2, custo: 11, poder: 3, papel: 'agil', slots: 2, keywords: [kw('imitar')], build: 'Plagiarism' },

  { id: 'mes-carrocerada', nome: 'Mestre-Ferreiro — Carrocerada', classe: 'Ferreiro', deck: 2, custo: 11, poder: 5, papel: 'vanguarda', slots: 2, keywords: [], build: 'Cart Termination', special: 'carrocerada' },
  { id: 'mes-adrenalina', nome: 'Mestre-Ferreiro — Adrenalina', classe: 'Ferreiro', deck: 2, custo: 10, poder: 3, papel: 'vanguarda', slots: 1, keywords: [kw('elo', 2)], build: 'Adrenaline Rush' },

  { id: 'cri-acida', nome: 'Criador — Demonstracao Acida', classe: 'Alquimista', deck: 2, custo: 12, poder: 6, papel: 'suporte', slots: 1, keywords: [kw('perfurar', 6)], build: 'Acid Demonstration' },
  { id: 'cri-esfera', nome: 'Criador — Esfera Marinha', classe: 'Alquimista', deck: 2, custo: 10, poder: 2, papel: 'suporte', slots: 2, keywords: [kw('muralha', 3)], build: 'Sphere Mine' },

  { id: 'sum-ressurreicao', nome: 'Sumo Sacerdote — Ressurreicao', classe: 'Sacerdote', deck: 2, custo: 11, poder: 3, papel: 'suporte', slots: 1, keywords: [kw('restaurar', 2)], build: 'Resurrection' },
  { id: 'sum-assumptio', nome: 'Sumo Sacerdote — Assumptio', classe: 'Sacerdote', deck: 2, custo: 12, poder: 3, papel: 'suporte', slots: 2, keywords: [kw('devocao'), kw('elo', 2)], build: 'Assumptio' },

  { id: 'mesq-asura', nome: 'Mestre — Punho de Asura', classe: 'Monge', deck: 2, custo: 12, poder: 10, papel: 'vanguarda', slots: 1, keywords: [kw('esgotar'), kw('solo', 2)], build: 'Asura Strike' },
  { id: 'mesq-salto', nome: 'Mestre — Salto', classe: 'Monge', deck: 2, custo: 10, poder: 5, papel: 'vanguarda', slots: 1, keywords: [], build: 'Body Relocation', special: 'salto' },

  { id: 'ati-flechas', nome: 'Atirador de Elite — Chuva de Flechas', classe: 'Cacador', deck: 2, custo: 12, poder: 7, papel: 'agil', slots: 1, keywords: [kw('alcance'), kw('perfurar', 2)], build: 'Arrow Storm' },
  { id: 'ati-falcao', nome: 'Atirador de Elite — Falcao', classe: 'Cacador', deck: 2, custo: 10, poder: 3, papel: 'agil', slots: 2, keywords: [kw('alcance'), kw('anular')], build: 'Blitz Beat / Detecting' },

  { id: 'men-ensemble', nome: 'Menestrel/Cigana — Ensemble', classe: 'Bardo/Odalisca', deck: 2, custo: 9, poder: 2, papel: 'suporte', slots: 1, keywords: [], build: 'Ensemble', special: 'ensemble' },
  { id: 'men-marionete', nome: 'Menestrel/Cigana — Marionete', classe: 'Bardo/Odalisca', deck: 2, custo: 11, poder: 0, papel: 'suporte', slots: 2, keywords: [], build: 'Marionette Control', special: 'marionete' },

  { id: 'sup-anjo', nome: 'Superaprendiz Anjo da Guarda', classe: 'Superaprendiz', deck: 2, custo: 9, poder: 4, papel: 'agil', slots: 2, keywords: [], build: 'Guardian Angel' },
  { id: 'sup-sobrecarga', nome: 'Superaprendiz Sobrecarga', classe: 'Superaprendiz', deck: 2, custo: 10, poder: 3, papel: 'agil', slots: 1, keywords: [kw('imitar'), kw('esgotar')], build: 'O improvavel' },
];

export const ALL_CHARACTERS: readonly CharacterDef[] = [...DECK_I, ...DECK_II];

export const CHARACTER_BY_ID: ReadonlyMap<string, CharacterDef> = new Map(
  ALL_CHARACTERS.map((c) => [c.id, c]),
);

/* ─────────────────────────────────────────────────────────────────────────
 * Equipamento
 * ───────────────────────────────────────────────────────────────────────── */

export type EquipSlotKind = 'arma' | 'armadura' | 'acessorio';

export interface EquipDef {
  readonly id: string;
  readonly nome: string;
  readonly kind: EquipSlotKind;
  /** Papeis que podem equipar. Vazio = qualquer um. */
  readonly papeis: readonly Papel[];
  readonly custo: number;
  readonly poder: number;
  readonly keywords: readonly Keyword[];
  /** Quantos encaixes de carta de monstro o equipamento tem. */
  readonly encaixes: number;
  /** Exige que o portador ja tenha esta keyword. */
  readonly exige?: KeywordName;
  /** Efeitos fora do calculo de combate. */
  readonly special?:
    | 'ignora-primeira-baixa'
    | 'baixa-vai-reserva'
    | 'imune-anular'
    | 'renda2'
    | 'acao-extra'
    | 'nunca-primeira-baixa'
    | 'ignora-posicionamento'
    | 'revela-oculto'
    | 'poder-emperium'
    | 'penalidade-escudar';
}

export const EQUIPMENT: readonly EquipDef[] = [
  // Armas
  { id: 'eq-bastarda', nome: 'Espada Bastarda', kind: 'arma', papeis: ['vanguarda'], custo: 5, poder: 2, keywords: [], encaixes: 1 },
  { id: 'eq-lanca', nome: 'Lanca de Cavalaria', kind: 'arma', papeis: ['vanguarda'], custo: 6, poder: 2, keywords: [kw('perfurar', 1)], encaixes: 1 },
  { id: 'eq-machado', nome: 'Machado de Guerra', kind: 'arma', papeis: ['vanguarda'], custo: 7, poder: 4, keywords: [], encaixes: 1, special: 'penalidade-escudar' },
  { id: 'eq-cajado', nome: 'Cajado da Tempestade', kind: 'arma', papeis: ['arcano'], custo: 6, poder: 3, keywords: [], encaixes: 1 },
  { id: 'eq-grimorio', nome: 'Grimorio', kind: 'arma', papeis: ['arcano'], custo: 5, poder: 1, keywords: [kw('muralha', 1)], encaixes: 1 },
  { id: 'eq-varinha', nome: 'Varinha de Anulacao', kind: 'arma', papeis: ['arcano'], custo: 7, poder: 1, keywords: [kw('anular')], encaixes: 0 },
  { id: 'eq-adaga', nome: 'Adaga Gemea', kind: 'arma', papeis: ['agil'], custo: 5, poder: 2, keywords: [kw('rajada', 1)], encaixes: 1 },
  { id: 'eq-arco', nome: 'Arco Composto', kind: 'arma', papeis: ['agil'], custo: 6, poder: 3, keywords: [], encaixes: 1, exige: 'alcance' },
  { id: 'eq-katar', nome: 'Katar Sombria', kind: 'arma', papeis: ['agil'], custo: 7, poder: 3, keywords: [], encaixes: 1 },
  { id: 'eq-alaude', nome: 'Alaude', kind: 'arma', papeis: ['suporte'], custo: 5, poder: 1, keywords: [kw('elo', 1)], encaixes: 1 },
  { id: 'eq-chicote', nome: 'Chicote de Seda', kind: 'arma', papeis: ['suporte'], custo: 5, poder: 2, keywords: [], encaixes: 1 },
  { id: 'eq-maca', nome: 'Maca Sagrada', kind: 'arma', papeis: ['suporte'], custo: 6, poder: 2, keywords: [kw('restaurar', 1)], encaixes: 0 },

  // Armaduras
  { id: 'eq-cota', nome: 'Cota de Malha', kind: 'armadura', papeis: [], custo: 4, poder: 1, keywords: [], encaixes: 1 },
  { id: 'eq-completa', nome: 'Armadura Completa', kind: 'armadura', papeis: ['vanguarda'], custo: 7, poder: 2, keywords: [kw('escudar')], encaixes: 1 },
  { id: 'eq-ninfa', nome: 'Manto de Ninfa', kind: 'armadura', papeis: ['arcano', 'suporte'], custo: 6, poder: 0, keywords: [], encaixes: 1, special: 'ignora-primeira-baixa' },
  { id: 'eq-sombras', nome: 'Traje de Sombras', kind: 'armadura', papeis: ['agil'], custo: 6, poder: 1, keywords: [kw('oculto')], encaixes: 0 },
  { id: 'eq-escudo', nome: 'Escudo Sagrado', kind: 'armadura', papeis: ['vanguarda'], custo: 5, poder: 0, keywords: [kw('muralha', 1)], encaixes: 1 },
  { id: 'eq-botas', nome: 'Botas de Fuga', kind: 'armadura', papeis: [], custo: 4, poder: 0, keywords: [], encaixes: 0, special: 'baixa-vai-reserva' },
  { id: 'eq-elfico', nome: 'Manto Elfico', kind: 'armadura', papeis: [], custo: 5, poder: 1, keywords: [], encaixes: 0, special: 'imune-anular' },
  { id: 'eq-sabio', nome: 'Vestes do Sabio', kind: 'armadura', papeis: ['arcano'], custo: 6, poder: 1, keywords: [kw('perfurar', 2)], encaixes: 1 },
  { id: 'eq-runico', nome: 'Peitoral Runico', kind: 'armadura', papeis: ['vanguarda'], custo: 8, poder: 3, keywords: [], encaixes: 1 },
  { id: 'eq-tunica', nome: 'Tunica Simples', kind: 'armadura', papeis: [], custo: 3, poder: 1, keywords: [], encaixes: 2 },

  // Acessorios
  { id: 'eq-anelmercador', nome: 'Anel do Mercador', kind: 'acessorio', papeis: [], custo: 5, poder: 0, keywords: [], encaixes: 0, special: 'renda2' },
  { id: 'eq-broche', nome: 'Broche do Guildmaster', kind: 'acessorio', papeis: [], custo: 6, poder: 0, keywords: [], encaixes: 0, special: 'acao-extra' },
  { id: 'eq-amuleto', nome: 'Amuleto de Ferro', kind: 'acessorio', papeis: [], custo: 4, poder: 0, keywords: [], encaixes: 0, special: 'nunca-primeira-baixa' },
  { id: 'eq-talisma', nome: 'Talisma do Vento', kind: 'acessorio', papeis: [], custo: 4, poder: 0, keywords: [], encaixes: 0, special: 'ignora-posicionamento' },
  { id: 'eq-oculos', nome: 'Oculos do Cacador', kind: 'acessorio', papeis: [], custo: 5, poder: 0, keywords: [], encaixes: 0, special: 'revela-oculto' },
  { id: 'eq-colar', nome: 'Colar de Zeny', kind: 'acessorio', papeis: [], custo: 3, poder: 0, keywords: [kw('pilhar', 2)], encaixes: 0 },
  { id: 'eq-selo', nome: 'Selo do Emperium', kind: 'acessorio', papeis: [], custo: 8, poder: 0, keywords: [], encaixes: 0, special: 'poder-emperium' },
  { id: 'eq-pergaminho', nome: 'Pergaminho Antigo', kind: 'acessorio', papeis: [], custo: 5, poder: 0, keywords: [kw('imitar')], encaixes: 0 },
];

export const EQUIP_BY_ID: ReadonlyMap<string, EquipDef> = new Map(EQUIPMENT.map((e) => [e.id, e]));

/* ─────────────────────────────────────────────────────────────────────────
 * Cartas de monstro — encaixam nos slots dos equipamentos
 * ───────────────────────────────────────────────────────────────────────── */

export interface MonsterCardDef {
  readonly id: string;
  readonly nome: string;
  readonly poder: number;
  readonly keywords: readonly Keyword[];
  readonly special?:
    | 'ignora-primeira-baixa'
    | 'bonus-defensor'
    | 'bonus-atacante'
    | 'imune-muralha'
    | 'imune-anular'
    | 'ghostring'
    | 'poring';
}

export const MONSTER_CARDS: readonly MonsterCardDef[] = [
  { id: 'mc-thara', nome: 'Thara Frog', poder: 0, keywords: [], special: 'ignora-primeira-baixa' },
  { id: 'mc-raydric', nome: 'Raydric', poder: 0, keywords: [], special: 'bonus-defensor' },
  { id: 'mc-hydra', nome: 'Hydra', poder: 0, keywords: [], special: 'bonus-atacante' },
  { id: 'mc-marc', nome: 'Marc', poder: 0, keywords: [], special: 'imune-muralha' },
  { id: 'mc-angeling', nome: 'Angeling', poder: 0, keywords: [], special: 'imune-anular' },
  { id: 'mc-ghostring', nome: 'Ghostring', poder: 0, keywords: [], special: 'ghostring' },
  { id: 'mc-poring', nome: 'Poring', poder: 0, keywords: [], special: 'poring' },
  { id: 'mc-baphomet', nome: 'Baphomet', poder: 0, keywords: [kw('elo', 1)] },
  { id: 'mc-doppel', nome: 'Doppelganger', poder: 0, keywords: [kw('rajada', 2)] },
  { id: 'mc-orcheroi', nome: 'Orc Heroi', poder: 0, keywords: [kw('perfurar', 2)] },
];

export const MONSTER_BY_ID: ReadonlyMap<string, MonsterCardDef> = new Map(
  MONSTER_CARDS.map((m) => [m.id, m]),
);

/** Duas copias de cada carta de monstro (design secao 3: 20 cartas). */
export function buildMonsterDeck(): string[] {
  return MONSTER_CARDS.flatMap((m) => [m.id, m.id]);
}

/* ─────────────────────────────────────────────────────────────────────────
 * Consumiveis
 * ───────────────────────────────────────────────────────────────────────── */

export type ConsumableId =
  | 'co-pocao'
  | 'co-mosca'
  | 'co-borboleta'
  | 'co-yggdrasil'
  | 'co-acido'
  | 'co-convocacao'
  | 'co-pedra'
  | 'co-fumaca';

export interface ConsumableDef {
  readonly id: ConsumableId;
  readonly nome: string;
  readonly efeito: string;
  /** Se true, e jogado junto do comprometimento e revelado na resolucao. */
  readonly naSala: boolean;
}

export const CONSUMABLES: readonly ConsumableDef[] = [
  { id: 'co-pocao', nome: 'Pocao Branca', efeito: 'Cancele 1 baixa sua nesta sala.', naSala: true },
  { id: 'co-mosca', nome: 'Asa de Mosca', efeito: 'Mova 1 personagem seu para uma sala adjacente antes de revelar.', naSala: true },
  { id: 'co-borboleta', nome: 'Asa de Borboleta', efeito: 'Retire todos os seus personagens desta sala. Sem baixas, sem controle.', naSala: true },
  { id: 'co-yggdrasil', nome: 'Folha de Yggdrasil', efeito: 'Traga 1 personagem da Enfermaria direto para esta sala.', naSala: true },
  { id: 'co-acido', nome: 'Frasco de Acido', efeito: '+3 de Poder nesta sala, ignorando Muralha.', naSala: true },
  { id: 'co-convocacao', nome: 'Pergaminho de Convocacao', efeito: 'Um Guardiao Poder 3 luta por voce nesta sala, nesta rodada.', naSala: true },
  { id: 'co-pedra', nome: 'Pedra do Ferreiro', efeito: 'Refino automatico, sem rolar.', naSala: false },
  { id: 'co-fumaca', nome: 'Fumaca', efeito: 'Seus personagens nesta sala ficam Oculto.', naSala: true },
];

export const CONSUMABLE_BY_ID: ReadonlyMap<string, ConsumableDef> = new Map(
  CONSUMABLES.map((c) => [c.id, c]),
);

/** Tres copias de cada consumivel (design secao 3: 24 cartas). */
export function buildConsumableDeck(): string[] {
  return CONSUMABLES.flatMap((c) => [c.id, c.id, c.id]);
}

/** Duas copias de cada equipamento — o mercado precisa repor a rodada inteira. */
export function buildEquipmentDeck(): string[] {
  return EQUIPMENT.flatMap((e) => [e.id, e.id]);
}
