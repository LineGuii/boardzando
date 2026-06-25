import type {
  BackEntry,
  CatalogEntry,
  Placeable,
  PlayerId,
  RandomAPI,
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

interface PropertyDef {
  name: string;
  group: string;
  color: string;
}

const PROPERTIES: PropertyDef[] = [
  { name: 'Mediterranean Ave', group: 'brown', color: '#955436' },
  { name: 'Baltic Ave', group: 'brown', color: '#955436' },
  { name: 'Oriental Ave', group: 'lightblue', color: '#aae0fa' },
  { name: 'Vermont Ave', group: 'lightblue', color: '#aae0fa' },
  { name: 'Connecticut Ave', group: 'lightblue', color: '#aae0fa' },
  { name: 'St. Charles Pl', group: 'pink', color: '#d93a96' },
  { name: 'States Ave', group: 'pink', color: '#d93a96' },
  { name: 'Virginia Ave', group: 'pink', color: '#d93a96' },
  { name: 'St. James Pl', group: 'orange', color: '#f7941d' },
  { name: 'Tennessee Ave', group: 'orange', color: '#f7941d' },
  { name: 'New York Ave', group: 'orange', color: '#f7941d' },
  { name: 'Kentucky Ave', group: 'red', color: '#ed1b24' },
  { name: 'Indiana Ave', group: 'red', color: '#ed1b24' },
  { name: 'Illinois Ave', group: 'red', color: '#ed1b24' },
  { name: 'Atlantic Ave', group: 'yellow', color: '#fef200' },
  { name: 'Ventnor Ave', group: 'yellow', color: '#fef200' },
  { name: 'Marvin Gardens', group: 'yellow', color: '#fef200' },
  { name: 'Pacific Ave', group: 'green', color: '#1fb25a' },
  { name: 'North Carolina Ave', group: 'green', color: '#1fb25a' },
  { name: 'Pennsylvania Ave', group: 'green', color: '#1fb25a' },
  { name: 'Park Place', group: 'darkblue', color: '#0072bb' },
  { name: 'Boardwalk', group: 'darkblue', color: '#0072bb' },
  { name: 'Reading Railroad', group: 'railroad', color: '#111' },
  { name: 'Pennsylvania RR', group: 'railroad', color: '#111' },
  { name: 'B. & O. Railroad', group: 'railroad', color: '#111' },
  { name: 'Short Line', group: 'railroad', color: '#111' },
  { name: 'Electric Company', group: 'utility', color: '#f0e68c' },
  { name: 'Water Works', group: 'utility', color: '#9fd3ff' },
];

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
      front: { label: p.name, sub: p.group.toUpperCase(), color: p.color, textColor: '#fff' },
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

  // linha de dinheiro (banco) no topo
  MONEY.forEach((m, i) => {
    const x = 0.05 + i * 0.13;
    pile(`money-${m.value}`, m.count, x, 0.06, true);
  });

  // decks no centro: Sorte e Cofre viradas para baixo, num stack por deck.
  {
    const chanceStack = 'stk-deck-chance';
    CHANCE_CARDS.forEach((_t, i) => {
      const p = makePlaceable(`chance-${i}`, 0.32, 0.42, false);
      p.stackId = chanceStack;
      p.stackOrder = i;
      place(p);
    });
    const chestStack = 'stk-deck-chest';
    CHEST_CARDS.forEach((_t, i) => {
      const p = makePlaceable(`chest-${i}`, 0.46, 0.42, false);
      p.stackId = chestStack;
      p.stackOrder = i;
      place(p);
    });
    // titulos de propriedade (virados para cima, empilhados)
    const deedStack = 'stk-deck-deed';
    PROPERTIES.forEach((_p, i) => {
      const p = makePlaceable(`deed-${i}`, 0.60, 0.42, true);
      p.stackId = deedStack;
      p.stackOrder = i;
      place(p);
    });
  }

  // casas e hoteis
  pile('house', HOUSES, 0.74, 0.42, true);
  pile('hotel', HOTELS, 0.86, 0.42, true);

  // peoes em linha embaixo
  TOKENS.forEach((_e, i) => {
    place(makePlaceable(`token-${i}`, 0.06 + i * 0.06, 0.74, true));
  });

  // dois dados
  place(makePlaceable('die', 0.62, 0.74, true));
  place(makePlaceable('die', 0.68, 0.74, true));

  return {
    kind: 'sandbox',
    allowHand: true,
    catalog,
    backs,
    placeables,
    zCounter: counter + 1000,
  };
}
