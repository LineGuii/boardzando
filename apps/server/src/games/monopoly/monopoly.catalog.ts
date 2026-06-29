import type {
  BackEntry,
  BoardSpace,
  CatalogEntry,
  Placeable,
  PlayerId,
  RandomAPI,
  SandboxBoard,
  SandboxState,
} from '@boardzando/contracts';

/**
 * Catalogo e layout inicial do Monopoly (conjunto oficial completo). Apenas
 * pecas — sem regras. Tudo comeca na mesa, sem dono; os decks comecam virados.
 *
 * As contagens ficam em UM lugar (constantes abaixo) para ajuste facil.
 */

// ---------- contagens oficiais ----------

const MONEY: { value: number; count: number; color: string; textColor: string }[] = [
  { value: 1, count: 40, color: '#f5efe0', textColor: '#333' },
  { value: 5, count: 40, color: '#ff9ec7', textColor: '#333' },
  { value: 10, count: 40, color: '#fff27a', textColor: '#333' },
  { value: 20, count: 50, color: '#8fe3b0', textColor: '#0a3d1f' },
  { value: 50, count: 30, color: '#6fb8ff', textColor: '#08305c' },
  { value: 100, count: 20, color: '#9be0c8', textColor: '#08402c' },
  { value: 500, count: 20, color: '#e0a96d', textColor: '#3d2406' },
];

const HOUSES = 32;
const HOTELS = 12;

const TOKENS = ['🎩', '🚗', '🐕', '🚢', '👢', '🧵', '🐈', '🛒'];

const GROUP_COLOR: Record<string, string> = {
  brown: '#955436',
  lightblue: '#aae0fa',
  pink: '#d93a96',
  orange: '#f7941d',
  red: '#ed1b24',
  yellow: '#fef200',
  green: '#1fb25a',
  darkblue: '#0072bb',
  railroad: '#2b2b2b',
  utility: '#8a9bb0',
};

interface PropertyDef {
  name: string;
  group: string;
  color: string;
  /** Casa do tabuleiro (0..39) onde esta propriedade fica. */
  boardIndex: number;
  /** Preco cosmetico. */
  price: number;
  emoji?: string;
}

/**
 * As 28 propriedades com CIDADES BRASILEIRAS (22 cidades + 4 aeroportos +
 * 2 concessionarias), em ordem de tabuleiro. `deed-i` mapeia 1:1 com este
 * array e tambem alimenta as casas do tabuleiro.
 */
const PROPERTIES: PropertyDef[] = [
  { name: 'Boa Vista', group: 'brown', color: GROUP_COLOR.brown!, boardIndex: 1, price: 60 },
  { name: 'Macapá', group: 'brown', color: GROUP_COLOR.brown!, boardIndex: 3, price: 60 },
  { name: 'Santos Dumont', group: 'railroad', color: GROUP_COLOR.railroad!, boardIndex: 5, price: 200, emoji: '✈️' },
  { name: 'Rio Branco', group: 'lightblue', color: GROUP_COLOR.lightblue!, boardIndex: 6, price: 100 },
  { name: 'Porto Velho', group: 'lightblue', color: GROUP_COLOR.lightblue!, boardIndex: 8, price: 100 },
  { name: 'Palmas', group: 'lightblue', color: GROUP_COLOR.lightblue!, boardIndex: 9, price: 120 },
  { name: 'Teresina', group: 'pink', color: GROUP_COLOR.pink!, boardIndex: 11, price: 140 },
  { name: 'Cia. de Energia', group: 'utility', color: GROUP_COLOR.utility!, boardIndex: 12, price: 150, emoji: '⚡' },
  { name: 'Aracaju', group: 'pink', color: GROUP_COLOR.pink!, boardIndex: 13, price: 140 },
  { name: 'João Pessoa', group: 'pink', color: GROUP_COLOR.pink!, boardIndex: 14, price: 160 },
  { name: 'Congonhas', group: 'railroad', color: GROUP_COLOR.railroad!, boardIndex: 15, price: 200, emoji: '✈️' },
  { name: 'Natal', group: 'orange', color: GROUP_COLOR.orange!, boardIndex: 16, price: 180 },
  { name: 'Maceió', group: 'orange', color: GROUP_COLOR.orange!, boardIndex: 18, price: 180 },
  { name: 'Campo Grande', group: 'orange', color: GROUP_COLOR.orange!, boardIndex: 19, price: 200 },
  { name: 'Cuiabá', group: 'red', color: GROUP_COLOR.red!, boardIndex: 21, price: 220 },
  { name: 'Vitória', group: 'red', color: GROUP_COLOR.red!, boardIndex: 23, price: 220 },
  { name: 'Florianópolis', group: 'red', color: GROUP_COLOR.red!, boardIndex: 24, price: 240 },
  { name: 'Brasília Intl.', group: 'railroad', color: GROUP_COLOR.railroad!, boardIndex: 25, price: 200, emoji: '✈️' },
  { name: 'Belém', group: 'yellow', color: GROUP_COLOR.yellow!, boardIndex: 26, price: 260 },
  { name: 'Goiânia', group: 'yellow', color: GROUP_COLOR.yellow!, boardIndex: 27, price: 260 },
  { name: 'Cia. de Água', group: 'utility', color: GROUP_COLOR.utility!, boardIndex: 28, price: 150, emoji: '💧' },
  { name: 'Manaus', group: 'yellow', color: GROUP_COLOR.yellow!, boardIndex: 29, price: 280 },
  { name: 'Recife', group: 'green', color: GROUP_COLOR.green!, boardIndex: 31, price: 300 },
  { name: 'Fortaleza', group: 'green', color: GROUP_COLOR.green!, boardIndex: 32, price: 300 },
  { name: 'Salvador', group: 'green', color: GROUP_COLOR.green!, boardIndex: 34, price: 320 },
  { name: 'Guarulhos', group: 'railroad', color: GROUP_COLOR.railroad!, boardIndex: 35, price: 200, emoji: '✈️' },
  { name: 'Rio de Janeiro', group: 'darkblue', color: GROUP_COLOR.darkblue!, boardIndex: 37, price: 350 },
  { name: 'São Paulo', group: 'darkblue', color: GROUP_COLOR.darkblue!, boardIndex: 39, price: 400 },
];

/** Casas especiais (nao-propriedade) do tabuleiro perimetral de 40 casas. */
const SPECIAL_SPACES: BoardSpace[] = [
  { index: 0, name: 'Ponto de Partida', type: 'go', emoji: '➡️' },
  { index: 2, name: 'Cofre', type: 'chest', emoji: '🎁' },
  { index: 4, name: 'Imposto de Renda', type: 'tax', price: 200, emoji: '💸' },
  { index: 7, name: 'Sorte', type: 'chance', emoji: '❓' },
  { index: 10, name: 'Prisão / Visita', type: 'jail', emoji: '🔒' },
  { index: 17, name: 'Cofre', type: 'chest', emoji: '🎁' },
  { index: 20, name: 'Estacionamento', type: 'parking', emoji: '🅿️' },
  { index: 22, name: 'Sorte', type: 'chance', emoji: '❓' },
  { index: 30, name: 'Vá para a Prisão', type: 'gotojail', emoji: '👮' },
  { index: 33, name: 'Cofre', type: 'chest', emoji: '🎁' },
  { index: 36, name: 'Sorte', type: 'chance', emoji: '❓' },
  { index: 38, name: 'Imposto de Luxo', type: 'tax', price: 100, emoji: '💎' },
];

/** Monta as 40 casas do tabuleiro a partir das propriedades + especiais. */
function buildBoard(): SandboxBoard {
  const spaces: BoardSpace[] = [...SPECIAL_SPACES];
  for (const p of PROPERTIES) {
    const type: BoardSpace['type'] =
      p.group === 'railroad' ? 'railroad' : p.group === 'utility' ? 'utility' : 'property';
    spaces.push({
      index: p.boardIndex,
      name: p.name,
      type,
      color: p.color,
      price: p.price,
      emoji: p.emoji,
    });
  }
  spaces.sort((a, b) => a.index - b.index);
  return { kind: 'perimeter', size: 11, spaces };
}

// 16 cartas Sorte e 16 Cofre da Comunidade (acoes canonicas curtas).
const CHANCE_CARDS = [
  'Avance ate o Ponto de Partida',
  'Avance ate Illinois Ave',
  'Avance ate St. Charles Place',
  'Avance ate a ferrovia mais proxima',
  'Avance ate a utilidade mais proxima',
  'Banco paga dividendo de $50',
  'Saia da Prisao gratis',
  'Volte 3 casas',
  'Va para a Prisao',
  'Reformas: $25/casa, $100/hotel',
  'Multa de excesso: $15',
  'Viaje ate Reading Railroad',
  'Avance ate Boardwalk',
  'Pague taxa: $50 a cada jogador',
  'Sua aplicacao vence: receba $150',
  'Receba $100',
];

const CHEST_CARDS = [
  'Avance ate o Ponto de Partida',
  'Erro do banco a seu favor: $200',
  'Honorarios medicos: $50',
  'Venda de acoes: $50',
  'Saia da Prisao gratis',
  'Va para a Prisao',
  'Feriado: receba $100',
  'Imposto de renda devolvido: $20',
  'Aniversario: receba $10 de cada',
  'Apolice de seguro vence: $100',
  'Pague hospital: $100',
  'Pague escola: $50',
  'Servico de consultoria: $25',
  'Concurso de beleza: $10',
  'Heranca: $100',
  'Receba $25 por servicos',
];

// ---------- catalogo + versos ----------

/** Texto legivel sobre a cor do grupo (claro -> texto escuro). */
function readableText(group: string): string {
  return group === 'yellow' || group === 'lightblue' || group === 'utility' ? '#111' : '#fff';
}

function buildBacks(): Record<string, BackEntry> {
  const backs: BackEntry[] = [
    { backId: 'back-chance', face: { label: '?', color: '#f7941d', textColor: '#fff' } },
    { backId: 'back-chest', face: { label: 'Cofre', color: '#1f6dd9', textColor: '#fff' } },
    { backId: 'back-deed', face: { label: 'TITULO', color: '#e8e2d0', textColor: '#333' } },
    { backId: 'back-money', face: { label: '$', color: '#2e7d4f', textColor: '#fff' } },
    { backId: 'back-generic', face: { label: '?', color: '#555', textColor: '#fff' } },
  ];
  const map: Record<string, BackEntry> = {};
  for (const b of backs) map[b.backId] = b;
  return map;
}

function buildCatalog(): Record<string, CatalogEntry> {
  const cat: Record<string, CatalogEntry> = {};
  const add = (e: CatalogEntry): void => {
    cat[e.typeId] = e;
  };

  // dinheiro
  for (const m of MONEY) {
    add({
      typeId: `money-${m.value}`,
      category: 'money',
      stackGroup: `money-${m.value}`,
      front: { label: `$${m.value}`, color: m.color, textColor: m.textColor },
      backId: 'back-money',
      canHold: true,
      w: 1.6,
      h: 0.9,
    });
  }

  // cartas Sorte
  CHANCE_CARDS.forEach((text, i) => {
    add({
      typeId: `chance-${i}`,
      category: 'card',
      stackGroup: 'deck-chance',
      front: { label: 'Sorte', sub: text, color: '#ffd9a8', textColor: '#3d2406' },
      backId: 'back-chance',
      canHold: true,
      w: 1.1,
      h: 1.6,
    });
  });

  // cartas Cofre da Comunidade
  CHEST_CARDS.forEach((text, i) => {
    add({
      typeId: `chest-${i}`,
      category: 'card',
      stackGroup: 'deck-chest',
      front: { label: 'Cofre', sub: text, color: '#cfe2ff', textColor: '#08305c' },
      backId: 'back-chest',
      canHold: true,
      w: 1.1,
      h: 1.6,
    });
  });

  // titulos de propriedade (cor = grupo da propriedade)
  PROPERTIES.forEach((p, i) => {
    add({
      typeId: `deed-${i}`,
      category: 'card',
      stackGroup: 'deck-deed',
      front: {
        label: `${p.emoji ? p.emoji + ' ' : ''}${p.name}`,
        sub: `$${p.price}`,
        color: p.color,
        textColor: readableText(p.group),
      },
      backId: 'back-deed',
      canHold: true,
      w: 1.1,
      h: 1.6,
    });
  });

  // casas / hoteis
  add({
    typeId: 'house',
    category: 'house',
    stackGroup: 'house',
    front: { emoji: '🏠', color: '#1fb25a', textColor: '#fff' },
    backId: 'back-generic',
    canHold: true,
    w: 0.7,
    h: 0.7,
  });
  add({
    typeId: 'hotel',
    category: 'hotel',
    stackGroup: 'hotel',
    front: { emoji: '🏨', color: '#ed1b24', textColor: '#fff' },
    backId: 'back-generic',
    canHold: true,
    w: 0.8,
    h: 0.7,
  });

  // peoes
  TOKENS.forEach((emoji, i) => {
    add({
      typeId: `token-${i}`,
      category: 'token',
      stackGroup: `token-${i}`,
      front: { emoji, color: '#ddd', textColor: '#111' },
      backId: 'back-generic',
      canHold: true,
      w: 0.7,
      h: 0.7,
    });
  });

  // dados
  add({
    typeId: 'die',
    category: 'die',
    stackGroup: 'die',
    front: { label: '🎲', color: '#fff', textColor: '#111' },
    backId: 'back-generic',
    canHold: true,
    w: 0.7,
    h: 0.7,
    dieFaces: 6,
  });

  return cat;
}

// ---------- layout inicial ----------

let counter = 0;
function makePlaceable(typeId: string, x: number, y: number, faceUp: boolean): Placeable {
  return { id: `pl-${counter++}`, typeId, x, y, z: counter, faceUp };
}

/**
 * Constroi o estado inicial do sandbox de Monopoly: catalogo + todas as pecas
 * dispostas em pilhas organizadas (banco, decks, etc.). Decks viram para baixo;
 * dinheiro/casas/hoteis/dados/titulos para cima.
 */
export function buildMonopolySandbox(_rng: RandomAPI, _players: PlayerId[]): SandboxState {
  counter = 0;
  const catalog = buildCatalog();
  const backs = buildBacks();
  const placeables: Record<string, Placeable> = {};

  const place = (p: Placeable): void => {
    placeables[p.id] = p;
  };
  /** empilha `count` pecas do tipo na mesma posicao (vira uma pilha). */
  const pile = (typeId: string, count: number, x: number, y: number, faceUp: boolean): void => {
    const stackId = `stk-${typeId}`;
    for (let i = 0; i < count; i++) {
      const p = makePlaceable(typeId, x, y, faceUp);
      if (count > 1) {
        p.stackId = stackId;
        p.stackOrder = i;
      }
      place(p);
    }
  };

  // Tudo comeca na AREA CENTRAL do tabuleiro (a borda e ocupada pelas casas).
  // linha de dinheiro (banco)
  MONEY.forEach((m, i) => {
    const x = 0.14 + i * 0.1;
    pile(`money-${m.value}`, m.count, x, 0.15, true);
  });

  // decks no centro: Sorte e Cofre viradas para baixo, num stack por deck.
  {
    const chanceStack = 'stk-deck-chance';
    CHANCE_CARDS.forEach((_t, i) => {
      const p = makePlaceable(`chance-${i}`, 0.32, 0.4, false);
      p.stackId = chanceStack;
      p.stackOrder = i;
      place(p);
    });
    const chestStack = 'stk-deck-chest';
    CHEST_CARDS.forEach((_t, i) => {
      const p = makePlaceable(`chest-${i}`, 0.45, 0.4, false);
      p.stackId = chestStack;
      p.stackOrder = i;
      place(p);
    });
    // titulos de propriedade (virados para cima, empilhados)
    const deedStack = 'stk-deck-deed';
    PROPERTIES.forEach((_p, i) => {
      const p = makePlaceable(`deed-${i}`, 0.58, 0.4, true);
      p.stackId = deedStack;
      p.stackOrder = i;
      place(p);
    });
  }

  // casas e hoteis
  pile('house', HOUSES, 0.7, 0.4, true);
  pile('hotel', HOTELS, 0.8, 0.4, true);

  // peoes em linha no centro
  TOKENS.forEach((_e, i) => {
    place(makePlaceable(`token-${i}`, 0.16 + i * 0.05, 0.6, true));
  });

  // dois dados
  place(makePlaceable('die', 0.6, 0.6, true));
  place(makePlaceable('die', 0.66, 0.6, true));

  return {
    kind: 'sandbox',
    allowHand: true,
    catalog,
    backs,
    board: buildBoard(),
    placeables,
    zCounter: counter + 1000,
  };
}
