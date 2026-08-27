/**
 * Catalogo estatico de Guerra do Emperium.
 *
 * - 26 variacoes base (13 classes x 2), o baralho de recrutamento;
 * - 39 Transcendencias (13 classes x 3), evolucoes compradas no Altar para um
 *   personagem que voce ja tem — nao sao personagens novos;
 * - equipamentos, cartas de monstro e consumiveis.
 *
 * Base x caminho da 6 desfechos por classe, 78 no total. Ver
 * `docs/emperium/01-design-v0.1.md` secoes 11 e 12. Este arquivo e a fonte
 * unica desses numeros — nada aqui e calculado em runtime.
 */

/** Define que equipamento a carta aceita. Nao tem efeito mecanico proprio. */
export type Papel = 'vanguarda' | 'arcano' | 'agil' | 'suporte';

/**
 * Mantido em 1 para todas as cartas base. A antiga distincao Deck I/Deck II
 * morreu quando a Transcendencia virou evolucao em vez de segundo baralho.
 */
export type Deck = 1;

/** As 14 palavras-chave. Toda carta compoe a partir desta lista. */
export type KeywordName =
  | 'alcance'
  | 'proteger'
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
  | 'imitar'
  /** Ignora X salas de Marcha Forcada. Vale para o cla inteiro na sala. */
  | 'mover';

/** Palavra-chave com seu valor X (ausente quando a keyword nao usa X). */
export interface Keyword {
  readonly kw: KeywordName;
  readonly x?: number;
}

/**
 * Como cada palavra-chave e IMPRESSA. Os ids sao sem acento porque sao chaves
 * de codigo; o jogador nunca deve ver "DEVOCAO" numa carta.
 */
export const KEYWORD_LABEL: Readonly<Record<KeywordName, string>> = {
  alcance: 'ALCANCE',
  proteger: 'PROTEGER',
  muralha: 'MURALHA',
  perfurar: 'PERFURAR',
  rajada: 'RAJADA',
  elo: 'ELO',
  solo: 'SOLO',
  oculto: 'OCULTO',
  devocao: 'DEVOÇÃO',
  anular: 'ANULAR',
  restaurar: 'RESTAURAR',
  pilhar: 'PILHAR',
  esgotar: 'ESGOTAR',
  imitar: 'IMITAR',
  mover: 'MOVER',
};

/** Texto pronto de uma palavra-chave, com o X quando houver. */
export function rotuloKeyword(k: Keyword): string {
  return k.x === undefined ? KEYWORD_LABEL[k.kw] : `${KEYWORD_LABEL[k.kw]} ${k.x}`;
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
  readonly special?: 'forja' | 'teimoso' | 'revela-oculto';
  /**
   * A linha que faz este personagem enxergar os outros. Nem toda carta tem —
   * cartas simples devem continuar simples.
   */
  readonly combo?: Combo;
}

const kw = (name: KeywordName, x?: number): Keyword => (x === undefined ? { kw: name } : { kw: name, x });

/* ─────────────────────────────────────────────────────────────────────────
 * COMBOS — o que faz os personagens agirem como um cla
 *
 * As palavras-chave sozinhas sao aritmetica DENTRO da propria cla: ELO soma
 * por aliado, MURALHA subtrai do inimigo. Nenhuma delas pergunta QUEM esta do
 * seu lado — so quantos. Por isso um Monge ao lado de um Sábio valia o mesmo
 * que um Monge ao lado de outro Monge.
 *
 * Um Combo e uma linha extra que **nomeia outro personagem**: "COMBO Bruxo:
 * seu Bruxo ignora Muralha". Isso e o que transforma a Reserva num cla, e e
 * de proposito que nao passa por equipamento nenhum.
 *
 * Freio: **so UM combo dispara por cla por sala**, declarado no
 * comprometimento. Juntar cinco personagens nao acumula cinco combos — senao
 * a mesa volta a empilhar todo mundo numa sala so.
 * ───────────────────────────────────────────────────────────────────────── */

/** Marcas aplicadas a uma cla inimiga. Conjunto fechado, so tres. */
export type Marca =
  /** Perde toda a Muralha. O fogo grego quebrando a armadura. */
  | 'exposto'
  /** Perde o bonus da Ordem e nao pode usar Escudar. Travar o alvo. */
  | 'preso'
  /** Perde Oculto: entra na revelacao normal. O falcao achando o Mercenário. */
  | 'revelado';

/** O que precisa estar na mesma sala para o combo acender. */
export type ComboExige =
  | { readonly tipo: 'classe'; readonly valor: string }
  | { readonly tipo: 'papel'; readonly valor: Papel }
  /** Sempre ativo — nao depende de companhia. */
  | { readonly tipo: 'nenhum' };

export type ComboEfeito =
  | { readonly tipo: 'poder'; readonly x: number }
  /** +1 de Poder a cada N zeny no bolso. O Mestre-Ferreiro rico. */
  | { readonly tipo: 'poder-por-zeny'; readonly cada: number }
  /** A cla ignora toda a Muralha inimiga. Proteção de Solo abrindo caminho. */
  | { readonly tipo: 'perfurar-total' }
  /** Personagens deste Papel nao sofrem baixa. Provocar enquanto o bruxo conjura. */
  | { readonly tipo: 'cobrir-papel'; readonly papel: Papel }
  | { readonly tipo: 'rajada-papel'; readonly papel: Papel; readonly x: number }
  /** Ninguem seu vai para a Enfermaria por Esgotar. O SP de volta pro segundo Asura. */
  | { readonly tipo: 'cancela-esgotar' }
  /** Ignora X salas de Marcha Forcada. Buffs de velocidade. */
  | { readonly tipo: 'mover'; readonly x: number }
  /** Marca a cla inimiga de maior Poder. */
  | { readonly tipo: 'marca'; readonly marca: Marca }
  /** Arranca 1 personagem da maior cla inimiga; ele volta a Reserva do dono. */
  | { readonly tipo: 'rapto' }
  /** Se voce perder, a cla vencedora tambem sofre 1 baixa. Reflect Shield. */
  | { readonly tipo: 'troco' };

export interface Combo {
  readonly exige: ComboExige;
  /** Texto curto impresso na carta. */
  readonly texto: string;
  readonly efeito: ComboEfeito;
}

const combo = (exige: ComboExige, texto: string, efeito: ComboEfeito): Combo => ({
  exige,
  texto,
  efeito,
});
const comClasse = (classe: string, texto: string, efeito: ComboEfeito): Combo =>
  combo({ tipo: 'classe', valor: classe }, texto, efeito);
const comPapel = (papel: Papel, texto: string, efeito: ComboEfeito): Combo =>
  combo({ tipo: 'papel', valor: papel }, texto, efeito);
const sozinho = (texto: string, efeito: ComboEfeito): Combo =>
  combo({ tipo: 'nenhum' }, texto, efeito);

/* ─────────────────────────────────────────────────────────────────────────
 * Deck I — Classico
 * ───────────────────────────────────────────────────────────────────────── */

export const DECK_I: readonly CharacterDef[] = [
  { id: 'cav-bb', nome: 'Cavaleiro Bola de Boliche', classe: 'Cavaleiro', deck: 1, custo: 6, poder: 4, papel: 'vanguarda', slots: 2, keywords: [kw('elo', 1)], build: 'Bowling Bash' , combo: comClasse('Templário', 'COMBO Templário: o maior clã inimigo fica PRESO.', { tipo: 'marca', marca: 'preso' })},
  { id: 'cav-lanca', nome: 'Cavaleiro Lanceiro', classe: 'Cavaleiro', deck: 1, custo: 5, poder: 3, papel: 'vanguarda', slots: 1, keywords: [kw('perfurar', 2)], build: 'Pierce montado' },
  { id: 'cav-provocador', nome: 'Cavaleiro Provocador', classe: 'Cavaleiro', deck: 1, custo: 5, poder: 2, papel: 'vanguarda', slots: 2, keywords: [kw('proteger')], build: 'Provoke' , combo: comPapel('arcano', 'COMBO Arcano: o maior clã inimigo fica EXPOSTO — ele veio atrás de você.', { tipo: 'marca', marca: 'exposto' })},

  { id: 'tem-escudeiro', nome: 'Templário Escudeiro', classe: 'Templário', deck: 1, custo: 5, poder: 2, papel: 'vanguarda', slots: 2, keywords: [kw('proteger')], build: 'Tanque de escudo' },
  { id: 'tem-redentor', nome: 'Templário Redentor', classe: 'Templário', deck: 1, custo: 6, poder: 2, papel: 'vanguarda', slots: 2, keywords: [kw('devocao', 2)], build: 'Sacrifice' , combo: comClasse('Sacerdote', 'COMBO Sacerdote: seus Vanguardas não sofrem baixa nesta sala.', { tipo: 'cobrir-papel', papel: 'vanguarda' })},
  { id: 'tem-defensor', nome: 'Templário Defensor', classe: 'Templário', deck: 1, custo: 6, poder: 3, papel: 'vanguarda', slots: 1, keywords: [kw('muralha', 1)], build: 'Defender' , combo: comPapel('arcano', 'COMBO Arcano: seus Arcanos não sofrem baixa nesta sala.', { tipo: 'cobrir-papel', papel: 'arcano' })},

  { id: 'bru-tempestade', nome: 'Bruxo Tempestade', classe: 'Bruxo', deck: 1, custo: 7, poder: 3, papel: 'arcano', slots: 1, keywords: [kw('muralha', 2), kw('alcance')], build: 'Storm Gust' },
  { id: 'bru-jupitel', nome: 'Bruxo Jupitel', classe: 'Bruxo', deck: 1, custo: 5, poder: 4, papel: 'arcano', slots: 1, keywords: [kw('alcance')], build: 'Jupitel / Napalm' },

  { id: 'bru-conjurador', nome: 'Bruxo Conjurador', classe: 'Bruxo', deck: 1, custo: 7, poder: 2, papel: 'arcano', slots: 1, keywords: [kw('muralha', 1)], build: 'Precast' , combo: comClasse('Bardo', 'COMBO Bardo: +5 de Poder — a canção sustenta a conjuração.', { tipo: 'poder', x: 5 })},

  { id: 'sab-solo', nome: 'Sábio Proteção de Solo', classe: 'Sábio', deck: 1, custo: 6, poder: 2, papel: 'arcano', slots: 1, keywords: [kw('anular')], build: 'Land Protection' , combo: comClasse('Bruxo', 'COMBO Bruxo: seus personagens ignoram toda a Muralha inimiga.', { tipo: 'perfurar-total' })},
  { id: 'sab-encantador', nome: 'Sábio Encantador', classe: 'Sábio', deck: 1, custo: 5, poder: 2, papel: 'arcano', slots: 2, keywords: [kw('elo', 1)], build: 'Endow' },

  { id: 'sab-petrificador', nome: 'Sábio Petrificador', classe: 'Sábio', deck: 1, custo: 6, poder: 3, papel: 'arcano', slots: 1, keywords: [kw('muralha', 1)], build: 'Stone Curse' , combo: sozinho('COMBO: o maior clã inimigo fica PRESO.', { tipo: 'marca', marca: 'preso' })},

  { id: 'mer-sonico', nome: 'Mercenário Golpe Sônico', classe: 'Mercenário', deck: 1, custo: 6, poder: 3, papel: 'agil', slots: 1, keywords: [kw('rajada', 3)], build: 'Sonic Blow' , combo: comClasse('Alquimista', 'COMBO Alquimista: +4 de Poder — ele entra pela brecha.', { tipo: 'poder', x: 4 })},
  { id: 'mer-furtivo', nome: 'Mercenário Furtivo', classe: 'Mercenário', deck: 1, custo: 7, poder: 2, papel: 'agil', slots: 1, keywords: [kw('oculto')], build: 'Cloaking' },

  { id: 'mer-katar', nome: 'Mercenário Katar', classe: 'Mercenário', deck: 1, custo: 6, poder: 4, papel: 'agil', slots: 1, keywords: [kw('perfurar', 2)], build: 'Katar crítico' },

  { id: 'arr-gatuno', nome: 'Arruaceiro Gatuno', classe: 'Arruaceiro', deck: 1, custo: 5, poder: 2, papel: 'agil', slots: 1, keywords: [kw('pilhar', 2)], build: 'Steal' , combo: comPapel('agil', 'COMBO Agil: RAPTO — arranque 1 inimigo da sala.', { tipo: 'rapto' })},
  { id: 'arr-saqueador', nome: 'Arruaceiro Saqueador', classe: 'Arruaceiro', deck: 1, custo: 6, poder: 3, papel: 'agil', slots: 1, keywords: [kw('anular')], build: 'Strip' },

  { id: 'arr-batedor', nome: 'Arruaceiro Batedor', classe: 'Arruaceiro', deck: 1, custo: 5, poder: 3, papel: 'agil', slots: 1, keywords: [kw('rajada', 2)], build: 'Back Stab' },

  { id: 'fer-forjador', nome: 'Ferreiro Forjador', classe: 'Ferreiro', deck: 1, custo: 5, poder: 2, papel: 'vanguarda', slots: 2, keywords: [], build: 'Forja', special: 'forja' },
  { id: 'fer-mercador', nome: 'Ferreiro Mercador', classe: 'Ferreiro', deck: 1, custo: 4, poder: 1, papel: 'vanguarda', slots: 1, keywords: [kw('pilhar', 3)], build: 'Overcharge' , combo: sozinho('COMBO: +1 de Poder a cada 5 zeny no seu bolso.', { tipo: 'poder-por-zeny', cada: 5 })},

  { id: 'fer-perfeicao', nome: 'Ferreiro Perfeição de Armas', classe: 'Ferreiro', deck: 1, custo: 6, poder: 2, papel: 'vanguarda', slots: 2, keywords: [kw('perfurar', 2)], build: 'Weapon Perfection' , combo: comPapel('vanguarda', 'COMBO Vanguarda: seus personagens ignoram toda a Muralha inimiga.', { tipo: 'perfurar-total' })},

  { id: 'alq-homunculo', nome: 'Alquimista Homúnculo', classe: 'Alquimista', deck: 1, custo: 6, poder: 2, papel: 'suporte', slots: 1, keywords: [kw('elo', 1)], build: 'Bio-ethics' },
  { id: 'alq-boticario', nome: 'Alquimista Boticário', classe: 'Alquimista', deck: 1, custo: 5, poder: 1, papel: 'suporte', slots: 1, keywords: [kw('restaurar', 1)], build: 'Potion Pitcher' , combo: sozinho('COMBO: o maior clã inimigo fica EXPOSTO.', { tipo: 'marca', marca: 'exposto' })},

  { id: 'alq-fogogrego', nome: 'Alquimista Fogo Grego', classe: 'Alquimista', deck: 1, custo: 6, poder: 3, papel: 'suporte', slots: 1, keywords: [kw('perfurar', 2)], build: 'Fogo grego' , combo: comPapel('arcano', 'COMBO Arcano: +4 de Poder — o fogo pega no que o mago acendeu.', { tipo: 'poder', x: 4 })},

  { id: 'sac-suporte', nome: 'Sacerdote Suporte', classe: 'Sacerdote', deck: 1, custo: 6, poder: 1, papel: 'suporte', slots: 1, keywords: [kw('elo', 2)], build: 'Full Support' , combo: comPapel('vanguarda', 'COMBO Vanguarda: seu clã ganha MOVER 1.', { tipo: 'mover', x: 1 })},
  { id: 'sac-pneuma', nome: 'Sacerdote Pneuma', classe: 'Sacerdote', deck: 1, custo: 6, poder: 2, papel: 'suporte', slots: 1, keywords: [kw('muralha', 2)], build: 'Pneuma / Safety Wall' },

  { id: 'sac-batalha', nome: 'Sacerdote de Batalha', classe: 'Sacerdote', deck: 1, custo: 5, poder: 3, papel: 'suporte', slots: 2, keywords: [kw('solo', 2)], build: 'Battle Priest' },

  { id: 'mon-combo', nome: 'Monge Combo', classe: 'Monge', deck: 1, custo: 6, poder: 4, papel: 'vanguarda', slots: 1, keywords: [], build: 'Chain Combo' },
  { id: 'mon-aco', nome: 'Monge Corpo de Aço', classe: 'Monge', deck: 1, custo: 5, poder: 0, papel: 'vanguarda', slots: 2, keywords: [kw('proteger'), kw('esgotar')], build: 'Steel Body' , combo: sozinho('COMBO: o maior clã inimigo fica PRESO.', { tipo: 'marca', marca: 'preso' })},

  { id: 'mon-dilema', nome: 'Monge Dilema', classe: 'Monge', deck: 1, custo: 6, poder: 2, papel: 'vanguarda', slots: 1, keywords: [kw('perfurar', 3)], build: 'Investigate' },

  { id: 'cac-armadilheiro', nome: 'Caçador Armadilheiro', classe: 'Caçador', deck: 1, custo: 6, poder: 2, papel: 'agil', slots: 1, keywords: [kw('muralha', 2)], build: 'Trapper' , combo: sozinho('COMBO: o maior clã inimigo fica REVELADO.', { tipo: 'marca', marca: 'revelado' })},
  { id: 'cac-tiroduplo', nome: 'Caçador Tiro Duplo', classe: 'Caçador', deck: 1, custo: 6, poder: 4, papel: 'agil', slots: 1, keywords: [kw('alcance')], build: 'Double Strafe' },

  { id: 'cac-falcoeiro', nome: 'Caçador Falcoeiro', classe: 'Caçador', deck: 1, custo: 6, poder: 2, papel: 'agil', slots: 1, keywords: [kw('alcance')], build: 'Falcão / Blitz Beat', special: 'revela-oculto' },

  { id: 'bar-cancao', nome: 'Bardo Canção', classe: 'Bardo', deck: 1, custo: 5, poder: 1, papel: 'suporte', slots: 1, keywords: [kw('elo', 2)], build: 'Canções de grupo' , combo: comPapel('arcano', 'COMBO Arcano: seus Arcanos ganham +3 de Poder.', { tipo: 'rajada-papel', papel: 'arcano', x: 3 })},
  { id: 'bar-idun', nome: 'Bardo Maçã de Idun', classe: 'Bardo', deck: 1, custo: 5, poder: 1, papel: 'suporte', slots: 1, keywords: [kw('restaurar', 1)], build: 'Apple of Idun' },
  { id: 'bar-flecha', nome: 'Bardo Flecha Musical', classe: 'Bardo', deck: 1, custo: 6, poder: 4, papel: 'agil', slots: 1, keywords: [kw('alcance')], build: 'Musical Strike' },

  { id: 'oda-dancalenta', nome: 'Odalisca Dança Lenta', classe: 'Odalisca', deck: 1, custo: 6, poder: 2, papel: 'suporte', slots: 1, keywords: [kw('muralha', 2)], build: 'Slow Grace' , combo: comClasse('Bardo', 'COMBO Bardo: +4 de Poder — o dueto.', { tipo: 'poder', x: 4 })},
  { id: 'oda-adaga', nome: 'Odalisca Dança das Adagas', classe: 'Odalisca', deck: 1, custo: 6, poder: 4, papel: 'agil', slots: 1, keywords: [kw('rajada', 2)], build: 'Throw Arrow' },
  { id: 'oda-servico', nome: 'Odalisca Serviço para Você', classe: 'Odalisca', deck: 1, custo: 6, poder: 1, papel: 'suporte', slots: 1, keywords: [kw('devocao', 2)], build: 'Service For You' , combo: comClasse('Monge', 'COMBO Monge: ninguém seu vai à Enfermaria por Esgotar.', { tipo: 'cancela-esgotar' })},

  { id: 'sup-teimoso', nome: 'Superaprendiz Teimoso', classe: 'Superaprendiz', deck: 1, custo: 3, poder: 1, papel: 'agil', slots: 3, keywords: [], build: 'Sobrevivência teimosa', special: 'teimoso' },
  { id: 'sup-sorte', nome: 'Superaprendiz Sortudo', classe: 'Superaprendiz', deck: 1, custo: 4, poder: 1, papel: 'agil', slots: 1, keywords: [kw('solo', 3)], build: 'Sorte de principiante' },
  { id: 'sup-improvisado', nome: 'Superaprendiz Improvisado', classe: 'Superaprendiz', deck: 1, custo: 4, poder: 2, papel: 'suporte', slots: 2, keywords: [kw('imitar', 2)], build: 'Faz de tudo' },
];

/* ─────────────────────────────────────────────────────────────────────────
 * ALTAR DA TRANSCENDENCIA
 *
 * Transcendencia NAO e um personagem que voce contrata: e uma evolucao que
 * voce compra PARA UM PERSONAGEM QUE JA E SEU. A carta e empilhada sobre a
 * carta base, que continua na mesa com seu equipamento e sua historia — o
 * Poder e as palavras-chave SOMAM.
 *
 * Por que assim: na v0.1 a Transcendencia era um segundo baralho de
 * personagens, entao comprar um Arquimago aposentava o seu Bruxo em vez de
 * faze-lo crescer. Voce nao se apegava a ninguem. Aqui o veterano que sobreviveu
 * a quatro rodadas e o que vira Arquimago, e perde-lo custa os 7z do recrutamento
 * mais os 10z da evolucao.
 *
 * O Altar tambem e um mercado DIFERENTE do recrutamento: nao e uma fileira
 * sorteada e disputada, e uma tabela de precos fixa, sempre visivel e sempre
 * disponivel a partir da rodada 3. Recrutar e oportunismo; transcender e plano.
 * ───────────────────────────────────────────────────────────────────────── */

export interface TranscendenceDef {
  readonly id: string;
  /** Nome completo, ex.: "Lorde dos Cavaleiros — Espiral". */
  readonly nome: string;
  /** Precisa bater com CharacterDef.classe: so transcende quem e da classe. */
  readonly classe: string;
  /** A forma transcendente, ex.: "Lorde dos Cavaleiros". */
  readonly forma: string;
  readonly custo: number;
  /** Somado ao Poder da carta base. */
  readonly poderBonus: number;
  /** Somadas as palavras-chave da carta base. */
  readonly keywords: readonly Keyword[];
  readonly build: string;
  /** Slots de equipamento que a evolucao CONCEDE a carta base. */
  readonly slotsBonus?: number;
  readonly special?:
    | 'forja-suprema'
    | 'ensemble'
    | 'marionete'
    | 'imortal'
    | 'revela-oculto';
  /**
   * A evolucao pode trazer um combo novo — ou substituir o da base por uma
   * versao maior. E onde moram as jogadas mirabolantes.
   */
  readonly combo?: Combo;
}

/** 14 classes x 3 caminhos = 42 evolucoes. */
export const TRANSCENDENCIAS: readonly TranscendenceDef[] = [
  // Cavaleiro
  { id: 'tr-cav-espiral', nome: 'Lorde dos Cavaleiros — Espiral', classe: 'Cavaleiro', forma: 'Lorde dos Cavaleiros', custo: 11, poderBonus: 3, keywords: [kw('perfurar', 4)], build: 'Spiral Pierce' },
  { id: 'tr-cav-berserk', nome: 'Lorde dos Cavaleiros — Fúria Berserk', classe: 'Cavaleiro', forma: 'Lorde dos Cavaleiros', custo: 12, poderBonus: 5, keywords: [kw('esgotar')], build: 'Berserk' },
  { id: 'tr-cav-montaria', nome: 'Lorde dos Cavaleiros — Montaria', classe: 'Cavaleiro', forma: 'Lorde dos Cavaleiros', custo: 13, poderBonus: 2, keywords: [kw('mover', 4)], build: 'Peco-Peco de guerra' },

  // Templário
  { id: 'tr-tem-devocao', nome: 'Paladino — Devoção', classe: 'Templário', forma: 'Paladino', custo: 11, poderBonus: 2, keywords: [kw('devocao', 2)], build: 'Devotion' , combo: comPapel('vanguarda', 'COMBO Vanguarda: se você perder, o vencedor também sofre 1 baixa.', { tipo: 'troco' })},
  { id: 'tr-tem-corrente', nome: 'Paladino — Corrente de Escudo', classe: 'Templário', forma: 'Paladino', custo: 11, poderBonus: 4, keywords: [kw('proteger')], build: 'Shield Chain' , combo: comPapel('arcano', 'COMBO Arcano: seus Arcanos não sofrem baixa nesta sala.', { tipo: 'cobrir-papel', papel: 'arcano' })},
  { id: 'tr-tem-sacrificio', nome: 'Paladino — Sacrifício', classe: 'Templário', forma: 'Paladino', custo: 10, poderBonus: 3, keywords: [kw('rajada', 3), kw('esgotar')], build: 'Sacrifice' },

  // Bruxo
  { id: 'tr-bru-nevasca', nome: 'Arquimago — Nevasca', classe: 'Bruxo', forma: 'Arquimago', custo: 11, poderBonus: 2, keywords: [kw('muralha', 2)], build: 'Storm Gust ampliado' },
  { id: 'tr-bru-meteoros', nome: 'Arquimago — Chuva de Meteoros', classe: 'Bruxo', forma: 'Arquimago', custo: 13, poderBonus: 5, keywords: [kw('rajada', 3)], build: 'Meteor Storm' },
  { id: 'tr-bru-ganbantein', nome: 'Arquimago — Ganbantein', classe: 'Bruxo', forma: 'Arquimago', custo: 9, poderBonus: 1, keywords: [kw('anular')], build: 'Ganbantein' , combo: comClasse('Sábio', 'COMBO Sábio: seus personagens ignoram toda a Muralha inimiga.', { tipo: 'perfurar-total' })},

  // Sábio
  { id: 'tr-sab-dissonancia', nome: 'Professor — Dissonância', classe: 'Sábio', forma: 'Professor', custo: 10, poderBonus: 2, keywords: [kw('anular')], build: 'Dispell' , combo: sozinho('COMBO: o maior clã inimigo fica PRESO.', { tipo: 'marca', marca: 'preso' })},
  { id: 'tr-sab-duplocast', nome: 'Professor — Duplo Cast', classe: 'Sábio', forma: 'Professor', custo: 11, poderBonus: 4, keywords: [], build: 'Double Casting' },
  { id: 'tr-sab-memorizar', nome: 'Professor — Memorizar', classe: 'Sábio', forma: 'Professor', custo: 10, poderBonus: 2, keywords: [kw('imitar')], build: 'Memorize' , combo: comClasse('Monge', 'COMBO Monge: ninguém seu vai à Enfermaria por Esgotar.', { tipo: 'cancela-esgotar' })},

  // Mercenário
  { id: 'tr-mer-rompealma', nome: 'Algoz — Rompe-Alma', classe: 'Mercenário', forma: 'Algoz', custo: 12, poderBonus: 5, keywords: [kw('rajada', 2)], build: 'Soul Breaker' },
  { id: 'tr-mer-presa', nome: 'Algoz — Presa Sombria', classe: 'Mercenário', forma: 'Algoz', custo: 10, poderBonus: 2, keywords: [kw('oculto')], build: 'Grimtooth' },
  { id: 'tr-mer-veneno', nome: 'Algoz — Veneno Mortal', classe: 'Mercenário', forma: 'Algoz', custo: 11, poderBonus: 3, keywords: [kw('perfurar', 3)], build: 'Enchant Deadly Poison' },

  // Arruaceiro
  { id: 'tr-arr-despojar', nome: 'Desordeiro — Despojar Total', classe: 'Arruaceiro', forma: 'Desordeiro', custo: 10, poderBonus: 2, keywords: [kw('anular'), kw('pilhar', 3)], build: 'Full Strip' },
  { id: 'tr-arr-plagio', nome: 'Desordeiro — Plágio', classe: 'Arruaceiro', forma: 'Desordeiro', custo: 10, poderBonus: 2, keywords: [kw('imitar')], build: 'Plagiarism' },
  { id: 'tr-arr-silenciosa', nome: 'Desordeiro — Marcha Silenciosa', classe: 'Arruaceiro', forma: 'Desordeiro', custo: 12, poderBonus: 2, keywords: [kw('oculto'), kw('mover', 2)], build: 'Chase Walk' , combo: sozinho('COMBO: RAPTO — arranque 1 inimigo da sala.', { tipo: 'rapto' })},

  // Ferreiro
  { id: 'tr-fer-carrocerada', nome: 'Mestre-Ferreiro — Carrocerada', classe: 'Ferreiro', forma: 'Mestre-Ferreiro', custo: 11, poderBonus: 4, keywords: [], build: 'Cart Termination' , combo: sozinho('COMBO: +1 de Poder a cada 3 zeny no seu bolso.', { tipo: 'poder-por-zeny', cada: 3 })},
  { id: 'tr-fer-fundicao', nome: 'Mestre-Ferreiro — Fundição Suprema', classe: 'Ferreiro', forma: 'Mestre-Ferreiro', custo: 9, poderBonus: 1, keywords: [], build: 'Forja lendária', special: 'forja-suprema' },
  { id: 'tr-fer-adrenalina', nome: 'Mestre-Ferreiro — Adrenalina Suprema', classe: 'Ferreiro', forma: 'Mestre-Ferreiro', custo: 10, poderBonus: 2, keywords: [kw('elo', 2)], build: 'Adrenaline Rush' },

  // Alquimista
  { id: 'tr-alq-acida', nome: 'Criador — Demonstração Ácida', classe: 'Alquimista', forma: 'Criador', custo: 12, poderBonus: 4, keywords: [kw('perfurar', 4)], build: 'Acid Demonstration' , combo: sozinho('COMBO: o maior clã inimigo fica EXPOSTO e PRESO.', { tipo: 'marca', marca: 'exposto' })},
  { id: 'tr-alq-homunculo', nome: 'Criador — Homúnculo Superior', classe: 'Alquimista', forma: 'Criador', custo: 11, poderBonus: 3, keywords: [kw('elo', 2)], build: 'Homunculus S' , combo: sozinho('COMBO: +3 de Poder — o homúnculo luta junto.', { tipo: 'poder', x: 3 })},
  { id: 'tr-alq-esferas', nome: 'Criador — Bomba de Esferas', classe: 'Alquimista', forma: 'Criador', custo: 10, poderBonus: 1, keywords: [kw('muralha', 3)], build: 'Sphere Mine' },

  // Sacerdote
  { id: 'tr-sac-assumptio', nome: 'Sumo Sacerdote — Assumptio', classe: 'Sacerdote', forma: 'Sumo Sacerdote', custo: 11, poderBonus: 2, keywords: [kw('devocao', 2)], build: 'Assumptio' },
  { id: 'tr-sac-ressurreicao', nome: 'Sumo Sacerdote — Ressurreição', classe: 'Sacerdote', forma: 'Sumo Sacerdote', custo: 10, poderBonus: 1, keywords: [kw('restaurar', 2)], build: 'Resurrection' },
  { id: 'tr-sac-julgamento', nome: 'Sumo Sacerdote — Julgamento', classe: 'Sacerdote', forma: 'Sumo Sacerdote', custo: 12, poderBonus: 5, keywords: [], build: 'Magnus Exorcismus' },

  // Monge
  { id: 'tr-mon-asura', nome: 'Mestre — Punho de Asura', classe: 'Monge', forma: 'Mestre', custo: 14, poderBonus: 7, keywords: [kw('esgotar')], build: 'Asura Strike' },
  { id: 'tr-mon-salto', nome: 'Mestre — Salto', classe: 'Monge', forma: 'Mestre', custo: 11, poderBonus: 3, keywords: [kw('mover', 2)], build: 'Body Relocation' },
  { id: 'tr-mon-aco', nome: 'Mestre — Corpo de Aço Supremo', classe: 'Monge', forma: 'Mestre', custo: 10, poderBonus: 1, keywords: [kw('proteger')], build: 'Steel Body', special: 'imortal' },

  // Caçador
  { id: 'tr-cac-flechas', nome: 'Atirador de Elite — Chuva de Flechas', classe: 'Caçador', forma: 'Atirador de Elite', custo: 12, poderBonus: 5, keywords: [kw('alcance')], build: 'Arrow Storm' },
  { id: 'tr-cac-armadilha', nome: 'Atirador de Elite — Armadilha Suprema', classe: 'Caçador', forma: 'Atirador de Elite', custo: 10, poderBonus: 2, keywords: [kw('muralha', 3)], build: 'Trap Research' },
  { id: 'tr-cac-falcao', nome: 'Atirador de Elite — Olho de Falcão', classe: 'Caçador', forma: 'Atirador de Elite', custo: 10, poderBonus: 2, keywords: [kw('anular')], build: 'Falcon Assault', special: 'revela-oculto' , combo: sozinho('COMBO: o maior clã inimigo fica REVELADO.', { tipo: 'marca', marca: 'revelado' })},

  // Bardo — o Ensemble mora aqui, e so acende com uma Odalisca do lado.
  { id: 'tr-bar-ensemble', nome: 'Menestrel — Ensemble', classe: 'Bardo', forma: 'Menestrel', custo: 9, poderBonus: 2, keywords: [], build: 'Ensemble', special: 'ensemble' },
  { id: 'tr-bar-cancao', nome: 'Menestrel — Canção Longa', classe: 'Bardo', forma: 'Menestrel', custo: 10, poderBonus: 2, keywords: [kw('elo', 2)], build: 'Longing for Freedom' , combo: comPapel('vanguarda', 'COMBO Vanguarda: seu clã ganha MOVER 1.', { tipo: 'mover', x: 1 })},
  { id: 'tr-bar-vulcao', nome: 'Menestrel — Vulcão de Flechas', classe: 'Bardo', forma: 'Menestrel', custo: 12, poderBonus: 5, keywords: [kw('alcance')], build: 'Arrow Vulcan' },

  // Odalisca
  { id: 'tr-oda-marionete', nome: 'Cigana — Marionete', classe: 'Odalisca', forma: 'Cigana', custo: 11, poderBonus: 0, keywords: [], build: 'Marionette Control', special: 'marionete' },
  { id: 'tr-oda-tarot', nome: 'Cigana — Tarô do Destino', classe: 'Odalisca', forma: 'Cigana', custo: 11, poderBonus: 2, keywords: [kw('anular')], build: 'Tarot Card of Fate' , combo: sozinho('COMBO: o maior clã inimigo fica EXPOSTO.', { tipo: 'marca', marca: 'exposto' })},
  { id: 'tr-oda-ritmo', nome: 'Cigana — Ritmo Hipnótico', classe: 'Odalisca', forma: 'Cigana', custo: 10, poderBonus: 2, keywords: [kw('muralha', 3)], build: 'Slow Grace ampliado' },

  // Superaprendiz — nao transcende. So insiste, e fica barato.
  { id: 'tr-sup-teimosia', nome: 'Superaprendiz — Teimosia Absurda', classe: 'Superaprendiz', forma: 'Superaprendiz', custo: 8, poderBonus: 1, keywords: [], build: 'Guardian Angel', slotsBonus: 1, special: 'imortal' },
  { id: 'tr-sup-sobrecarga', nome: 'Superaprendiz — Sobrecarga', classe: 'Superaprendiz', forma: 'Superaprendiz', custo: 9, poderBonus: 4, keywords: [kw('esgotar')], build: 'Sobrecarga' },
  { id: 'tr-sup-imitacao', nome: 'Superaprendiz — Imitação Descarada', classe: 'Superaprendiz', forma: 'Superaprendiz', custo: 7, poderBonus: 2, keywords: [kw('imitar', 2)], build: 'Cópia de tudo' },
];

export const TRANSCENDENCIA_BY_ID: ReadonlyMap<string, TranscendenceDef> = new Map(
  TRANSCENDENCIAS.map((t) => [t.id, t]),
);

/** Os 3 caminhos abertos a um personagem desta classe. */
export function caminhosDaClasse(classe: string): readonly TranscendenceDef[] {
  return TRANSCENDENCIAS.filter((t) => t.classe === classe);
}

/** Rodada em que o Altar abre. */
export const ALTAR_RODADA = 3;


export const ALL_CHARACTERS: readonly CharacterDef[] = DECK_I;

/**
 * Baralho de recrutamento: duas copias de cada variacao base. Com um baralho
 * unico de 26 a fileira secava antes da rodada 6, e dois cla poderem contratar
 * o mesmo build e normal — o que os diferencia e o equipamento e a evolucao.
 */
export function buildRecruitDeck(): string[] {
  return DECK_I.flatMap((c) => [c.id, c.id]);
}

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
    | 'revela-oculto'
    | 'poder-emperium'
    | 'penalidade-escudar';
}

export const EQUIPMENT: readonly EquipDef[] = [
  // Armas
  { id: 'eq-bastarda', nome: 'Espada Bastarda', kind: 'arma', papeis: ['vanguarda'], custo: 5, poder: 2, keywords: [], encaixes: 1 },
  { id: 'eq-lanca', nome: 'Lança de Cavalaria', kind: 'arma', papeis: ['vanguarda'], custo: 6, poder: 2, keywords: [kw('perfurar', 1)], encaixes: 1 },
  { id: 'eq-machado', nome: 'Machado de Guerra', kind: 'arma', papeis: ['vanguarda'], custo: 7, poder: 4, keywords: [], encaixes: 1, special: 'penalidade-escudar' },
  { id: 'eq-cajado', nome: 'Cajado da Tempestade', kind: 'arma', papeis: ['arcano'], custo: 6, poder: 3, keywords: [], encaixes: 1 },
  { id: 'eq-grimorio', nome: 'Grimório', kind: 'arma', papeis: ['arcano'], custo: 5, poder: 1, keywords: [kw('muralha', 1)], encaixes: 1 },
  { id: 'eq-varinha', nome: 'Varinha de Anulação', kind: 'arma', papeis: ['arcano'], custo: 7, poder: 1, keywords: [kw('anular')], encaixes: 0 },
  { id: 'eq-adaga', nome: 'Adaga Gêmea', kind: 'arma', papeis: ['agil'], custo: 5, poder: 2, keywords: [kw('rajada', 1)], encaixes: 1 },
  { id: 'eq-arco', nome: 'Arco Composto', kind: 'arma', papeis: ['agil'], custo: 6, poder: 3, keywords: [], encaixes: 1, exige: 'alcance' },
  { id: 'eq-katar', nome: 'Katar Sombria', kind: 'arma', papeis: ['agil'], custo: 7, poder: 3, keywords: [], encaixes: 1 },
  { id: 'eq-alaude', nome: 'Alaúde', kind: 'arma', papeis: ['suporte'], custo: 5, poder: 1, keywords: [kw('elo', 1)], encaixes: 1 },
  { id: 'eq-chicote', nome: 'Chicote de Seda', kind: 'arma', papeis: ['suporte'], custo: 5, poder: 2, keywords: [], encaixes: 1 },
  { id: 'eq-maca', nome: 'Maça Sagrada', kind: 'arma', papeis: ['suporte'], custo: 6, poder: 2, keywords: [kw('restaurar', 1)], encaixes: 0 },

  // Armaduras
  { id: 'eq-cota', nome: 'Cota de Malha', kind: 'armadura', papeis: [], custo: 4, poder: 1, keywords: [], encaixes: 1 },
  { id: 'eq-completa', nome: 'Armadura Completa', kind: 'armadura', papeis: ['vanguarda'], custo: 7, poder: 2, keywords: [kw('proteger')], encaixes: 1 },
  { id: 'eq-ninfa', nome: 'Manto de Ninfa', kind: 'armadura', papeis: ['arcano', 'suporte'], custo: 6, poder: 0, keywords: [], encaixes: 1, special: 'ignora-primeira-baixa' },
  { id: 'eq-sombras', nome: 'Traje de Sombras', kind: 'armadura', papeis: ['agil'], custo: 6, poder: 1, keywords: [kw('oculto')], encaixes: 0 },
  { id: 'eq-escudo', nome: 'Escudo Sagrado', kind: 'armadura', papeis: ['vanguarda'], custo: 5, poder: 0, keywords: [kw('muralha', 1)], encaixes: 1 },
  { id: 'eq-botas', nome: 'Botas de Fuga', kind: 'armadura', papeis: [], custo: 4, poder: 0, keywords: [], encaixes: 0, special: 'baixa-vai-reserva' },
  { id: 'eq-elfico', nome: 'Manto Élfico', kind: 'armadura', papeis: [], custo: 5, poder: 1, keywords: [], encaixes: 0, special: 'imune-anular' },
  { id: 'eq-sabio', nome: 'Vestes do Sábio', kind: 'armadura', papeis: ['arcano'], custo: 6, poder: 1, keywords: [kw('perfurar', 2)], encaixes: 1 },
  { id: 'eq-runico', nome: 'Peitoral Rúnico', kind: 'armadura', papeis: ['vanguarda'], custo: 8, poder: 3, keywords: [], encaixes: 1 },
  { id: 'eq-tunica', nome: 'Túnica Simples', kind: 'armadura', papeis: [], custo: 3, poder: 1, keywords: [], encaixes: 2 },

  // Acessorios
  { id: 'eq-anelmercador', nome: 'Anel do Mercador', kind: 'acessorio', papeis: [], custo: 5, poder: 0, keywords: [], encaixes: 0, special: 'renda2' },
  { id: 'eq-broche', nome: 'Broche do Guildmaster', kind: 'acessorio', papeis: [], custo: 6, poder: 0, keywords: [], encaixes: 0, special: 'acao-extra' },
  { id: 'eq-amuleto', nome: 'Amuleto de Ferro', kind: 'acessorio', papeis: [], custo: 4, poder: 0, keywords: [], encaixes: 0, special: 'nunca-primeira-baixa' },
  { id: 'eq-talisma', nome: 'Talismã do Vento', kind: 'acessorio', papeis: [], custo: 4, poder: 0, keywords: [kw('mover', 1)], encaixes: 0 },
  { id: 'eq-oculos', nome: 'Oculos do Caçador', kind: 'acessorio', papeis: [], custo: 5, poder: 0, keywords: [], encaixes: 0, special: 'revela-oculto' },
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
  /** O texto impresso na carta. O jogador nunca deve ver o id do special. */
  readonly texto?: string;
  readonly poder: number;
  readonly keywords: readonly Keyword[];
  readonly special?:
    | 'ignora-primeira-baixa'
    | 'bonus-defensor'
    | 'bonus-atacante'
    | 'imune-muralha'
    | 'imune-anular'
    | 'ghostring'
    | 'poring'
    | 'revela-ocultos';
}

export const MONSTER_CARDS: readonly MonsterCardDef[] = [
  { id: 'mc-thara', nome: 'Thara Frog', poder: 0, keywords: [], special: 'ignora-primeira-baixa', texto: "Ignora a primeira baixa causada por personagem inimigo." },
  { id: 'mc-raydric', nome: 'Raydric', poder: 0, keywords: [], special: 'bonus-defensor', texto: "+2 de Poder quando você é o dono do castelo." },
  { id: 'mc-hydra', nome: 'Hydra', poder: 0, keywords: [], special: 'bonus-atacante', texto: "+2 de Poder quando você é atacante." },
  { id: 'mc-marc', nome: 'Marc', poder: 0, keywords: [], special: 'imune-muralha', texto: "Imune a Muralha." },
  { id: 'mc-angeling', nome: 'Angeling', poder: 0, keywords: [], special: 'imune-anular', texto: "Imune a Anular." },
  { id: 'mc-ghostring', nome: 'Ghostring', poder: 0, keywords: [], special: 'ghostring', texto: "Não pode sofrer baixa. Poder reduzido à metade." },
  { id: 'mc-poring', nome: 'Poring', poder: 0, keywords: [], special: 'poring', texto: "+3 zeny sempre que este personagem vence uma sala." },
  { id: 'mc-baphomet', nome: 'Baphomet', poder: 0, keywords: [kw('elo', 1)], texto: "Elo 1." },
  { id: 'mc-doppel', nome: 'Doppelganger', poder: 0, keywords: [kw('rajada', 2)], texto: "Rajada 2." },
  { id: 'mc-horong', nome: 'Horong', poder: 0, keywords: [], special: 'revela-ocultos', texto: 'Revela todos os inimigos ocultos desta sala.' },
  { id: 'mc-orcheroi', nome: 'Orc Herói', poder: 0, keywords: [kw('perfurar', 2)], texto: "Perfurar 2." },
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
  { id: 'co-pocao', nome: 'Poção Branca', efeito: 'Cancele 1 baixa sua nesta sala.', naSala: true },
  { id: 'co-mosca', nome: 'Asa de Mosca', efeito: 'Mova 1 personagem seu para uma sala adjacente antes de revelar.', naSala: true },
  { id: 'co-borboleta', nome: 'Asa de Borboleta', efeito: 'Retire o grupo do seu clã desta sala. Sem baixas, sem controle.', naSala: true },
  { id: 'co-yggdrasil', nome: 'Folha de Yggdrasil', efeito: 'Traga 1 personagem da Enfermaria direto para esta sala.', naSala: true },
  { id: 'co-acido', nome: 'Frasco de Ácido', efeito: '+3 de Poder nesta sala, ignorando Muralha.', naSala: true },
  { id: 'co-convocacao', nome: 'Pergaminho de Convocação', efeito: 'Um Guardião Poder 3 luta por você nesta sala, nesta rodada.', naSala: true },
  { id: 'co-pedra', nome: 'Elunium', efeito: 'Refino automático, sem rolar.', naSala: false },
  { id: 'co-fumaca', nome: 'Fumaça', efeito: 'Seus personagens nesta sala ficam Oculto.', naSala: true },
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

/* ─────────────────────────────────────────────────────────────────────────
 * OPCOES DA PARTIDA — quem defende o castelo
 *
 * Defender e o papel mais dificil e mais assimetrico do jogo: um contra
 * todos, com renda maior e o Salao do Trono a favor. Sortear e o padrao
 * porque e o mais justo com uma mesa que ainda esta aprendendo, mas quem ja
 * conhece o jogo costuma querer decidir — o veterano defendendo contra tres
 * novatos, ou o anfitriao assumindo o papel que exige mais atencao.
 * ───────────────────────────────────────────────────────────────────────── */

export type DonoDoCasteloModo = 'sorteio' | 'anfitriao' | 'escolhido';

export interface EmperiumOptions {
  /**
   * Como o dono do castelo e definido no comeco da partida.
   *
   * - `sorteio`: a fortaleza cai para quem o destino escolher.
   * - `anfitriao`: quem abriu a sala defende.
   * - `escolhido`: o anfitriao aponta o defensor em `donoDoCasteloId`.
   */
  donoDoCastelo: DonoDoCasteloModo;
  /** So vale com `donoDoCastelo: 'escolhido'`. Um playerId da sala. */
  donoDoCasteloId?: string;
}

export const EMPERIUM_DEFAULT_OPTIONS: EmperiumOptions = {
  donoDoCastelo: 'sorteio',
};

export const DONO_MODO_ROTULO: Readonly<Record<DonoDoCasteloModo, string>> = {
  sorteio: 'Sorteio',
  anfitriao: 'Quem abriu a sala',
  escolhido: 'Eu escolho',
};

/* ─────────────────────────────────────────────────────────────────────────
 * GLOSSARIO — o que cada palavra-chave e cada marca faz
 *
 * Fica nos contratos, e nao no tabuleiro, porque a mesma frase precisa valer
 * no jogo, no manual e no catalogo de cartas. Texto de regra duplicado em tres
 * lugares e texto de regra que diverge.
 * ───────────────────────────────────────────────────────────────────────── */

export const KEYWORD_DESC: Readonly<Record<KeywordName, string>> = {
  alcance:
    'Ataca de longe: só sofre baixa se você não tiver nenhum personagem com PROTEGER (ou DEVOÇÃO) vivo nesta sala.',
  proteger: 'Absorve as baixas do seu clã antes de qualquer outro personagem seu.',
  muralha:
    'Reduz em X o Poder Total de CADA clã inimigo desta sala. Acumula: duas Muralhas 2 do seu clã viram 4 em cima de cada inimigo.',
  perfurar: 'X pontos do Poder deste personagem ignoram a Muralha inimiga.',
  rajada: '+X de Poder, só na primeira rodada em que este personagem entra nesta sala.',
  elo: '+X de Poder para cada OUTRO personagem seu nesta sala.',
  solo: '+X de Poder se este for o seu único personagem nesta sala.',
  oculto:
    'Na revelação, se o seu clã não estiver REVELADO, ele escorrega para uma sala vizinha sem pagar Marcha Forçada — e luta lá sem Ordem nenhuma.',
  devocao:
    'Ele se joga na frente: cada baixa que ele leva conta por X, e os outros ficam de pé. Cai antes até do PROTEGER.',
  anular:
    'Cancela a MAIOR palavra-chave inimiga da sala, qualquer que seja. Não se anula um ANULAR.',
  restaurar: 'No fim da rodada, mova X personagens da Enfermaria para a Reserva.',
  pilhar: 'Se vencer a sala, ganhe X zeny. Com X ≥ 3, ganhe também 1 equipamento caído.',
  esgotar: 'Depois de resolver, vai para a Enfermaria — tendo vencido ou perdido.',
  imitar:
    'Copia até X palavras-chave do inimigo de maior Poder de carta nesta sala. Resolve ANTES do ANULAR, então copia o que ainda está de pé.',
  mover: 'Encurta a Marcha Forçada em até X salas — você paga só o que passar disso.',
};

export const MARCA_LABEL: Readonly<Record<Marca, string>> = {
  exposto: 'EXPOSTO',
  preso: 'PRESO',
  revelado: 'REVELADO',
};

export const MARCA_DESC: Readonly<Record<Marca, string>> = {
  exposto:
    'O clã marcado perde TODA a Muralha, não importa quantos personagens a carregavam. É o remédio contra uma parede empilhada — o ANULAR só corta a de um.',
  preso:
    'O clã marcado perde o bônus positivo da Ordem e não consegue usar PROTEGER nem DEVOÇÃO: travado, ninguém cobre ninguém. Quem se resguardou não ganha nada com isso — o −2 dele não é devolvido.',
  revelado:
    'O clã marcado perde OCULTO: o infiltrado fica preso na sala de origem e briga onde estava.',
};
