import type { PlayerId } from '@boardzando/contracts';
import {
  CHARACTER_BY_ID,
  EQUIP_BY_ID,
  MONSTER_BY_ID,
  TRANSCENDENCIA_BY_ID,
  type CharacterDef,
  type Combo,
  type KeywordName,
  type Marca,
  type Papel,
  type TranscendenceDef,
} from './emperium.cards';
import {
  SHIELD_BY_ROUND,
  TILE_BY_ID,
  type RoomSlot,
} from './emperium.rooms';
import { MARCHA_PENALIDADE } from './emperium.state';
import type {
  Clan,
  Commitment,
  EmperiumState,
  FactionResult,
  OrderId,
  RoomResolution,
} from './emperium.state';

/**
 * Motor de resolucao de sala. Puro: recebe estado + comprometimentos e devolve
 * o resultado; quem aplica as mutacoes e `emperium.moves.ts`.
 *
 * Ver `docs/emperium/01-design-v0.1.md` secoes 8 e 9.
 */

/** Modificador de Poder de cada Ordem. Emboscada depende de exclusividade. */
const ORDER_POWER: Record<OrderId, number> = {
  investida: 3,
  cerco: -1,
  emboscada: 2,
  resguardo: -2,
};

interface CharCompute {
  instId: string;
  def: CharacterDef;
  /** A evolucao comprada no Altar, se houver. */
  trans?: TranscendenceDef;
  /** Poder do personagem + evolucao + equipamento + refino, antes das keywords. */
  poderBase: number;
  keywords: Map<KeywordName, number>;
  monsterSpecials: Set<string>;
  equipSpecials: Set<string>;
  transSpecials: Set<string>;
  imuneAnular: boolean;
  ghostring: boolean;
  /** Nao pode sofrer baixa (Corpo de Aco Supremo / Teimosia Absurda). */
  imortal: boolean;
  /** Poder de carta + evolucao — usado para calcular baixas. */
  poderCarta: number;
  /**
   * Quanto de Poder cada palavra-chave ja colocou em poderBruto. E o que o
   * ANULAR precisa devolver: sem isso ele apagaria um ELO ja somado e o numero
   * na mesa nao mudaria.
   */
  bonusAplicado: Map<KeywordName, number>;
}

/** Agrega as keywords do personagem + equipamentos + cartas de monstro. */
function computeChar(state: EmperiumState, clan: Clan, instId: string): CharCompute | null {
  const inst = clan.chars[instId];
  if (!inst) return null;
  const def = CHARACTER_BY_ID.get(inst.defId);
  if (!def) return null;

  const keywords = new Map<KeywordName, number>();
  const addKw = (kw: KeywordName, x?: number) => {
    keywords.set(kw, (keywords.get(kw) ?? 0) + (x ?? 1));
  };
  for (const k of def.keywords) addKw(k.kw, k.x);

  let poder = def.poder;
  const monsterSpecials = new Set<string>();
  const equipSpecials = new Set<string>();
  const transSpecials = new Set<string>();

  // Transcendencia: evolucao empilhada sobre a carta base. Soma, nao substitui —
  // e por isso que qual base virou Arquimago continua importando na rodada 6.
  const trans = inst.transcendencia ? TRANSCENDENCIA_BY_ID.get(inst.transcendencia) : undefined;
  if (trans) {
    poder += trans.poderBonus;
    for (const k of trans.keywords) addKw(k.kw, k.x);
    if (trans.special) transSpecials.add(trans.special);
  }

  for (const eqId of inst.equips) {
    const eq = clan.equips[eqId];
    if (!eq) continue;
    const eqDef = EQUIP_BY_ID.get(eq.defId);
    if (!eqDef) continue;
    poder += eqDef.poder + eq.refino;
    for (const k of eqDef.keywords) addKw(k.kw, k.x);
    if (eqDef.special) equipSpecials.add(eqDef.special);
    for (const mcId of eq.encaixadas) {
      const mc = MONSTER_BY_ID.get(mcId);
      if (!mc) continue;
      for (const k of mc.keywords) addKw(k.kw, k.x);
      if (mc.special) monsterSpecials.add(mc.special);
    }
  }

  // Machado de Guerra: -1 se o portador tiver Escudar.
  if (equipSpecials.has('penalidade-escudar') && keywords.has('proteger')) poder -= 1;

  const ghostring = monsterSpecials.has('ghostring');
  if (ghostring) poder = Math.floor(poder / 2);

  return {
    instId,
    def,
    trans,
    poderBase: poder,
    // Baixas contam o investimento total: a carta base mais a evolucao.
    poderCarta: def.poder + (trans?.poderBonus ?? 0),
    keywords,
    monsterSpecials,
    equipSpecials,
    transSpecials,
    imuneAnular: monsterSpecials.has('imune-anular') || equipSpecials.has('imune-anular'),
    ghostring,
    imortal: transSpecials.has('imortal'),
    bonusAplicado: new Map<KeywordName, number>(),
  };
}

interface Faction {
  playerId: PlayerId | null;
  chars: CharCompute[];
  ordem: OrderId | null;
  consumivel?: string;
  /** Poder antes de Muralha. */
  poderBruto: number;
  muralha: number;
  perfurar: number;
  poderFinal: number;
  temAnular: number;
  /** Poder que ignora Muralha por Marc / Frasco de Acido. */
  imuneMuralha: number;
  /** Salas de Marcha Forcada percorridas. */
  marcha: number;
  /** Poder efetivamente perdido para a marcha, ja descontado o MOVER das
   *  palavras-chave. O combo de MOVER nao pode devolver mais do que isto. */
  penalidadeMarcha: number;
  /** Sofreu uma Emboscada: perdeu o bonus da propria Ordem. */
  emboscado?: boolean;
  /** Bonus vindo da Ordem, separado porque a marca PRESO o remove. */
  bonusOrdem: number;
  /** O combo declarado por esta cla nesta sala, se acendeu. */
  comboAtivo?: Combo;
  /** Os ESPECIAIS do grupo, que disparam sem declaracao. */
  especiais: Combo[];
  /** Marcas que esta cla esta sofrendo. */
  marcas: Set<Marca>;
  /** Efeitos de combo aplicados a esta cla. */
  protegePapel?: Papel;
  cancelaEsgotar: boolean;
  troco: boolean;
  perfurarTotal: boolean;
}

/**
 * O combo acende? Precisa do companheiro exigido na mesma sala — e o portador
 * nao conta como o proprio companheiro.
 */
function comboAcende(portador: CharCompute, chars: readonly CharCompute[], c: Combo): boolean {
  if (c.exige.tipo === 'nenhum') return true;
  return chars.some((o) => {
    if (o.instId === portador.instId) return false;
    if (c.exige.tipo === 'classe') return o.def.classe === c.exige.valor;
    if (c.exige.tipo === 'papel') return o.def.papel === c.exige.valor;
    return false;
  });
}

/** O combo do personagem: a evolucao substitui o da base quando traz um. */
function comboDe(c: CharCompute): Combo | undefined {
  return c.trans?.combo ?? c.def.combo;
}

/**
 * Aplica as regras da sala e as keywords que dependem de contagem (ELO, SOLO,
 * RAJADA) ao conjunto de personagens de uma cla.
 */
function factionPower(
  state: EmperiumState,
  slot: RoomSlot,
  playerId: PlayerId | null,
  chars: CharCompute[],
  ordem: OrderId | null,
  emboscadaExclusiva: boolean,
  consumivel: string | undefined,
  marcha: number,
): Faction {
  const room = state.rooms[slot];
  const tile = room ? TILE_BY_ID.get(room.tileId) : undefined;
  const effect = tile?.effect ?? 'nenhum';
  const n = chars.length;

  let total = 0;
  let muralha = 0;
  let perfurar = 0;
  let temAnular = 0;
  let imuneMuralha = 0;

  const ehDefensor = playerId !== null && state.castleOwnerId === playerId;

  for (const c of chars) {
    let p = c.poderBase;
    const has = (k: KeywordName) => c.keywords.has(k);
    const val = (k: KeywordName) => c.keywords.get(k) ?? 0;

    // Alcance nao funciona no Labirinto.
    const alcanceAtivo = has('alcance') && effect !== 'pedagio-sem-alcance';

    // Regras de sala.
    if (effect === 'bonus-alcance' && alcanceAtivo) {
      p += 1;
      c.bonusAplicado.set('alcance', 1);
    }
    if (effect === 'terraco') {
      if (c.def.papel === 'arcano') p *= 2;
      if (c.def.papel === 'vanguarda') p -= 2;
    }

    // ELO X: +X por cada OUTRO personagem seu na sala.
    if (has('elo')) {
      const ganho = val('elo') * Math.max(0, n - 1);
      p += ganho;
      c.bonusAplicado.set('elo', ganho);
    }
    // SOLO X: +X se for o unico personagem seu na sala.
    if (has('solo') && n === 1) {
      p += val('solo');
      c.bonusAplicado.set('solo', val('solo'));
    }
    // BERSERK X: +X de Poder, pago com a propria pele — ver pickCasualties.
    if (has('berserk')) {
      p += val('berserk');
      c.bonusAplicado.set('berserk', val('berserk'));
    }
    // MALDICAO X: -X, pura perda. E por isso que ela e a melhor isca do jogo:
    // o ANULAR inimigo que a cancelar esta DEVOLVENDO Poder ao dono.
    if (has('maldicao')) {
      p -= val('maldicao');
      // Negativo de proposito: se alguem anular a Maldicao, o Poder volta.
      c.bonusAplicado.set('maldicao', -val('maldicao'));
    }
    // RAJADA X: so na primeira rodada deste personagem nesta sala.
    if (has('rajada')) {
      const inst = playerId ? state.clans[playerId]?.chars[c.instId] : undefined;
      if (!inst || !inst.salasVisitadas.includes(slot)) {
        p += val('rajada');
        c.bonusAplicado.set('rajada', val('rajada'));
      }
    }

    // Cartas de monstro condicionais.
    if (c.monsterSpecials.has('bonus-atacante') && !ehDefensor) p += 2;
    if (c.monsterSpecials.has('bonus-defensor') && ehDefensor) p += 2;
    if (c.monsterSpecials.has('imune-muralha')) imuneMuralha += p;

    // Selo do Emperium.
    if (c.equipSpecials.has('poder-emperium') && slot === 'emperium') p += 2;

    muralha += val('muralha');
    perfurar += val('perfurar');
    if (c.keywords.has('anular')) temAnular += val('anular');

    total += p;
  }

  // Ensemble: agora que Bardo e Odalisca sao classes separadas, o dueto exige
  // um de CADA na sala — como no jogo original. Cada musico presente da +5.
  const bardos = chars.filter((c) => c.def.classe === 'Bardo');
  const odaliscas = chars.filter((c) => c.def.classe === 'Odalisca');
  if (
    chars.some((c) => c.transSpecials.has('ensemble')) &&
    bardos.length >= 1 &&
    odaliscas.length >= 1
  ) {
    total += 5 * (bardos.length + odaliscas.length);
  }

  // Marionete: dobra o Poder base de outro personagem seu na sala, max +6.
  if (chars.some((c) => c.transSpecials.has('marionete'))) {
    const alvos = chars.filter((c) => !c.transSpecials.has('marionete'));
    if (alvos.length > 0) {
      const melhor = Math.max(...alvos.map((c) => c.poderBase));
      total += Math.min(6, melhor);
    }
  }

  // Salao do Trono: o dono do castelo tem +2.
  if (slot === 'trono' && ehDefensor) total += 2;

  // Guardioes do defensor e guarnicao fixa da sala.
  if (ehDefensor && room) total += room.guardioesDefensor * 3;

  // Consumiveis que entram no calculo.
  if (consumivel === 'co-acido') {
    total += 3;
    imuneMuralha += 3;
  }
  if (consumivel === 'co-convocacao') total += 3;

  // Ordem — guardada separada porque a marca PRESO a remove depois.
  let bonusOrdem = 0;
  if (ordem) {
    if (ordem === 'emboscada') bonusOrdem = emboscadaExclusiva ? 2 : -2;
    else bonusOrdem = ORDER_POWER[ordem];
  }
  total += bonusOrdem;

  // MOVER X: ignora X salas de Marcha Forcada. Vale para o cla inteiro na sala,
  // e o MAIOR X manda — dois personagens com MOVER nao somam.
  //
  // Antes disso os efeitos de mobilidade anulavam a marcha INTEIRA, sem teto:
  // quem tivesse um Salto chegava de graca em qualquer sala do castelo. Com
  // MOVER o alcance passa a ser um numero que da para balancear.
  const mover = chars.reduce((m, c) => Math.max(m, c.keywords.get('mover') ?? 0), 0);
  const salasPagas = Math.max(0, marcha - mover);
  const penalidadeMarcha = MARCHA_PENALIDADE * salasPagas;
  total -= penalidadeMarcha;

  return {
    playerId,
    chars,
    ordem,
    consumivel,
    poderBruto: total,
    muralha,
    perfurar,
    poderFinal: total,
    temAnular,
    imuneMuralha,
    marcha,
    penalidadeMarcha,
    bonusOrdem,
    especiais: [],
    marcas: new Set<Marca>(),
    cancelaEsgotar: false,
    troco: false,
    perfurarTotal: false,
  };
}

/**
 * Dispara o combo declarado de cada cla e aplica marcas nos inimigos.
 *
 * So UM combo por cla por sala, escolhido no comprometimento. Marcas sempre
 * caem na maior cla inimiga — o design deixa a escolha ao jogador, mas a
 * versao digital automatiza no alvo obvio para nao travar a resolucao pedindo
 * alvo a cada efeito.
 */
function applyCombos(factions: Faction[], zenyDe: (p: PlayerId) => number): void {
  for (const f of factions) {
    // O COMBO declarado mais TODOS os ESPECIAIS do grupo.
    for (const c of [...(f.comboAtivo ? [f.comboAtivo] : []), ...f.especiais]) {
    const e = c.efeito;
    switch (e.tipo) {
      case 'poder':
        f.poderBruto += e.x;
        break;
      case 'poder-por-zeny':
        if (f.playerId) f.poderBruto += Math.floor(zenyDe(f.playerId) / e.cada);
        break;
      case 'perfurar-total':
        f.perfurarTotal = true;
        break;
      case 'cobrir-papel':
        f.protegePapel = e.papel;
        break;
      case 'rajada-papel':
        f.poderBruto += e.x * f.chars.filter((ch) => ch.def.papel === e.papel).length;
        break;
      case 'cancela-esgotar':
        f.cancelaEsgotar = true;
        break;
      case 'mover': {
        // O combo concede MOVER X ao cla. Devolve no maximo o que a marcha
        // realmente cobrou — senao um cla com MOVER de palavra-chave E de combo
        // ganharia Poder do nada numa sala perto.
        const devolve = Math.min(f.penalidadeMarcha, MARCHA_PENALIDADE * e.x);
        f.poderBruto += devolve;
        f.penalidadeMarcha -= devolve;
        break;
      }
      case 'troco':
        f.troco = true;
        break;
      case 'marca': {
        const alvo = maiorInimiga(factions, f);
        if (alvo) alvo.marcas.add(e.marca);
        // Demonstracao Acida marca EXPOSTO e PRESO de uma vez.
        if (alvo && e.marca === 'exposto' && c.texto.includes('PRESA')) alvo.marcas.add('preso');
        break;
      }
      case 'rapto':
        // Resolvido antes, na montagem das clas.
        break;
    }
    }
  }

  // Consequencias das marcas.
  for (const f of factions) {
    if (f.marcas.has('exposto')) f.muralha = 0;
    if (f.marcas.has('preso') && f.bonusOrdem > 0) {
      // So o bonus POSITIVO, pelo mesmo motivo da Emboscada: prender quem
      // estava se resguardando devolvia o -2 dele: marcar o inimigo o
      // deixava mais forte.
      f.poderBruto -= f.bonusOrdem;
      f.bonusOrdem = 0;
    }
  }
}

function maiorInimiga(factions: readonly Faction[], eu: Faction): Faction | null {
  let melhor: Faction | null = null;
  for (const o of factions) {
    if (o === eu) continue;
    if (!melhor || o.poderBruto > melhor.poderBruto) melhor = o;
  }
  return melhor;
}

/**
 * ANULAR cancela automaticamente a maior Muralha inimiga da sala. O design
 * deixa a escolha ao jogador; a versao digital automatiza no uso mais
 * impactante para nao travar a resolucao pedindo alvo. Angeling e Manto Elfico
 * tornam o portador imune.
 */
/**
 * Palavras-chave que o ANULAR pode cancelar.
 *
 * Fora da lista: **anular** (nao se anula um Anular), **oculto** (quem ja foi
 * revelado nao tem o que cancelar, e quem nao foi nao esta na conta),
 * **imitar** (resolve antes e ja copiou) e **mover** (a marcha ja aconteceu:
 * cancelar o passo depois de dado nao desfaz o caminho).
 *
 * As palavras-chave RUINS estao dentro de proposito: sao elas que fazem o
 * Anular poder dar errado.
 */
export const ANULAVEIS: readonly KeywordName[] = [
  'muralha',
  'perfurar',
  'rajada',
  'elo',
  'solo',
  'proteger',
  'devocao',
  'restaurar',
  'pilhar',
  // As RUINS entram: e o que torna o Anular uma decisao em vez de um acerto.
  // Cancelar uma delas AJUDA o inimigo, e escolher e obrigatorio.
  'esgotar',
  'fragil',
  'berserk',
  'maldicao',
];

/**
 * ANULAR cancela a palavra-chave que VOCE apontou, num personagem inimigo que
 * VOCE nomeou — declarado junto do comprometimento, de brucos.
 *
 * Deixou de ser automatico de proposito. Enquanto a regra era "cancela a maior
 * da sala", o Anular era um acerto garantido e sem decisao: bastava trazer um.
 * Agora ele e uma APOSTA, e a aposta e feita no escuro, porque o
 * comprometimento inimigo e secreto — voce nomeia alguem do elenco dele
 * (que e publico) e torce para que aquela pessoa esteja mesmo nesta sala.
 *
 * Errou o alvo, o Anular se perde. E como as palavras-chave RUINS tambem sao
 * anulaveis, acertar tambem pode ser um erro: cancelar a MALDICAO 4 do inimigo
 * devolve 4 de Poder a ele. Escolher continua sendo obrigatorio.
 */
function applyAnular(factions: Faction[], alvos: readonly AnularDeclarado[]): void {
  for (const d of alvos) {
    const minha = factions.find((f) => f.playerId === d.playerId);
    if (!minha || minha.temAnular <= 0) continue;

    // O alvo precisa estar NESTA sala, num cla que nao seja o seu.
    let alvoF: Faction | undefined;
    let alvoC: CharCompute | undefined;
    for (const outra of factions) {
      if (outra === minha) continue;
      const c = outra.chars.find((x) => x.instId === d.alvoInstId);
      if (c) {
        alvoF = outra;
        alvoC = c;
        break;
      }
    }
    // Nao veio, ou e imune: o Anular foi gasto a toa. E o preco do palpite.
    if (!alvoF || !alvoC || alvoC.imuneAnular) continue;
    if (!ANULAVEIS.includes(d.keyword)) continue;

    const x = alvoC.keywords.get(d.keyword);
    if (x === undefined || x <= 0) continue;

    alvoC.keywords.delete(d.keyword);
    if (d.keyword === 'muralha') alvoF.muralha = Math.max(0, alvoF.muralha - x);
    if (d.keyword === 'perfurar') alvoF.perfurar = Math.max(0, alvoF.perfurar - x);
    // Devolve o que a palavra-chave ja tinha somado. Para as RUINS o valor
    // gravado e negativo, entao cancelar uma Maldicao DEVOLVE Poder ao alvo —
    // que e exatamente a armadilha.
    const jaSomado = alvoC.bonusAplicado.get(d.keyword) ?? 0;
    if (jaSomado !== 0) {
      alvoF.poderBruto -= jaSomado;
      alvoC.bonusAplicado.delete(d.keyword);
    }
  }
}

/**
 * IMITAR X: copia ate X palavras-chave de UM personagem inimigo revelado na
 * sala — o de maior Poder de carta, que e o alvo que um jogador escolheria.
 *
 * Resolve ANTES do Anular de proposito: o imitador copia o que ainda esta de
 * pe, e so depois o Anular corta.
 */
function applyImitar(factions: Faction[]): void {
  for (const f of factions) {
    for (const c of f.chars) {
      const quantas = c.keywords.get('imitar');
      if (quantas === undefined) continue;

      let alvo: CharCompute | null = null;
      for (const outra of factions) {
        if (outra === f) continue;
        for (const o of outra.chars) {
          if (o.keywords.size === 0) continue;
          if (!alvo || o.poderCarta > alvo.poderCarta) alvo = o;
        }
      }
      if (!alvo) continue;

      const copiaveis = [...alvo.keywords.entries()]
        .filter(([k]) => k !== 'imitar')
        .sort((a, b) => b[1] - a[1])
        .slice(0, Math.max(1, quantas));

      for (const [k, x] of copiaveis) {
        c.keywords.set(k, (c.keywords.get(k) ?? 0) + x);
        if (k === 'muralha') f.muralha += x;
        if (k === 'perfurar') f.perfurar += x;
      }
    }
  }
}

/** Cada Muralha X reduz o total de CADA cla inimiga em X; Perfurar devolve. */
function applyMuralha(factions: Faction[]): void {
  for (const f of factions) {
    let reducao = 0;
    for (const outra of factions) {
      if (outra === f) continue;
      reducao += outra.muralha;
    }
    // Proteção de Solo: a facção atravessa qualquer Muralha.
    const efetiva = f.perfurarTotal ? 0 : Math.max(0, reducao - f.perfurar);
    // Poder marcado como imune a Muralha nao pode ser reduzido.
    const reduzivel = Math.max(0, f.poderBruto - f.imuneMuralha);
    f.poderFinal = f.poderBruto - Math.min(efetiva, reduzivel);
  }
}

/**
 * Escolhe quem cai numa cla derrotada. DEVOCAO primeiro, depois PROTEGER,
 * depois os de menor Poder de carta — minimiza a perda, que e o que um jogador
 * faria. Teto de baixas: metade dos personagens, arredondado para cima.
 */
function pickCasualties(f: Faction, margem: number, round: number): string[] {
  if (margem <= 0) return [];
  const teto = Math.ceil(f.chars.length / 2);

  // PRESO tira o PROTEGER do alvo: travado, ele nao consegue cobrir ninguem.
  const preso = f.marcas.has('preso');
  const ehProtetor = (c: CharCompute) => !preso && c.keywords.has('proteger');
  // BERSERK nao pode ser coberto: ele vai na frente de TODO mundo, inclusive
  // de quem estava se oferecendo para levar no lugar dele.
  const ehBerserk = (c: CharCompute) => c.keywords.has('berserk');
  // FRAGIL cai antes do resto — mas DEPOIS de quem se poe na frente. Quem
  // trouxe um tanque consegue proteger o fragil, e essa e a graca: o defeito
  // tem contra-jogo em vez de ser so uma penalidade.
  const ehFragil = (c: CharCompute) => c.keywords.has('fragil');
  // DEVOCAO X: ele se joga na frente. Cada baixa que ele leva vale por X, entao
  // um Paladino com DEVOCAO 2 sozinho absorve o que derrubaria dois dos seus.
  // PRESO tambem o trava: quem nao se move nao cobre ninguem.
  const devocaoDe = (c: CharCompute) => (preso ? 0 : (c.keywords.get('devocao') ?? 0));

  // ALCANCE: quem ataca de longe so sofre baixa se nao houver ninguem com
  // PROTEGER vivo no cla. Esta regra estava no manual desde a v0.1 e NUNCA
  // tinha sido implementada — ALCANCE so valia como bonus no Patio Aberto.
  const temProtetorVivo = f.chars.some(
    (c) => (ehProtetor(c) || devocaoDe(c) > 0) && !c.ghostring && !c.imortal,
  );

  const elegiveis = f.chars.filter((c) => {
    if (c.ghostring) return false; // Ghostring nao pode sofrer baixa.
    if (c.imortal) return false; // Corpo de Aco Supremo / Teimosia Absurda.
    if (c.def.special === 'teimoso' && round === 1) return false;
    // Combo COBRIR: o tanque provocando enquanto o bruxo conjura.
    if (f.protegePapel && c.def.papel === f.protegePapel) return false;
    // ALCANCE protegido por quem esta na frente.
    // ALCANCE protegido por quem esta na frente. O proprio protetor e o devoto
    // nao se protegem; o BERSERK tambem nao, porque ele cai primeiro de todos.
    if (
      c.keywords.has('alcance') &&
      temProtetorVivo &&
      !ehProtetor(c) &&
      devocaoDe(c) === 0 &&
      !ehBerserk(c)
    )
      return false;
    return true;
  });

  // Protetores caem primeiro. Se o cla estiver PRESO eles nao cobrem ninguem e
  // entram na fila normal, pelo Poder de carta como todo mundo.
  // A ESCADA DE BAIXAS, de cima para baixo:
  //   BERSERK  — ninguem o cobre, nem quem quer
  //   DEVOCAO  — se poe na frente e absorve por X
  //   PROTEGER — cai antes dos demais
  //   FRAGIL   — o elo fraco, se ninguem estiver na frente
  //   o resto  — por Poder de carta crescente
  const berserkers = elegiveis.filter(ehBerserk);
  const devotos = elegiveis.filter((c) => !ehBerserk(c) && devocaoDe(c) > 0);
  const protetores = elegiveis.filter(
    (c) => !ehBerserk(c) && devocaoDe(c) === 0 && ehProtetor(c),
  );
  const frageis = elegiveis.filter(
    (c) => !ehBerserk(c) && devocaoDe(c) === 0 && !ehProtetor(c) && ehFragil(c),
  );
  const resto = elegiveis
    .filter((c) => !ehBerserk(c) && devocaoDe(c) === 0 && !ehProtetor(c) && !ehFragil(c))
    .sort((a, b) => {
      // Amuleto de Ferro: nunca e a primeira baixa.
      const aAmu = a.equipSpecials.has('nunca-primeira-baixa') ? 1 : 0;
      const bAmu = b.equipSpecials.has('nunca-primeira-baixa') ? 1 : 0;
      if (aAmu !== bAmu) return aAmu - bAmu;
      return a.poderCarta - b.poderCarta;
    });

  const fila = [...berserkers, ...devotos, ...protetores, ...frageis, ...resto];
  const caidos: string[] = [];
  let acumulado = 0;
  for (const c of fila) {
    if (caidos.length >= teto) break;
    if (acumulado >= margem) break;
    // Thara Frog / Manto de Ninfa: ignora a primeira baixa da sala.
    if (
      caidos.length === 0 &&
      (c.monsterSpecials.has('ignora-primeira-baixa') ||
        c.equipSpecials.has('ignora-primeira-baixa'))
    ) {
      continue;
    }
    caidos.push(c.instId);
    acumulado += Math.max(1, c.poderCarta) * Math.max(1, devocaoDe(c));
  }
  return caidos;
}

export interface RoomInput {
  playerId: PlayerId;
  commitment: Commitment;
}

/** Um ANULAR apontado: quem anula, em quem, e qual palavra-chave. */
interface AnularDeclarado {
  playerId: PlayerId;
  alvoInstId: string;
  keyword: KeywordName;
}

/**
 * O COMBO declarado no comprometimento, se o portador esta la e ele acende.
 *
 * ESPECIAL (`exige.tipo === 'nenhum'`) NAO entra aqui: ele dispara sozinho,
 * sem declaracao, e nao gasta o combo da sala. Ver `especiaisDe`.
 */
function comboDeclarado(chars: readonly CharCompute[], declarado?: string): Combo | undefined {
  if (!declarado) return undefined;
  const portador = chars.find((c) => c.instId === declarado);
  if (!portador) return undefined;
  const c = comboDe(portador);
  if (!c || c.exige.tipo === 'nenhum') return undefined;
  if (!comboAcende(portador, chars, c)) return undefined;
  return c;
}

/**
 * Os ESPECIAIS do grupo: efeitos que nao pedem companheiro nenhum, entao nao
 * ha o que declarar — disparam como a forja do Ferreiro, so por estarem la.
 *
 * Chamar aquilo de "combo" era estranho: nao se combina com ninguem. Em troca
 * de nao precisar de declaracao, o ESPECIAL e sempre o mesmo efeito — nao ha
 * escolha, e essa e a diferenca dele para o COMBO.
 */
function especiaisDe(chars: readonly CharCompute[]): Combo[] {
  const out: Combo[] = [];
  for (const c of chars) {
    const combo = comboDe(c);
    if (combo && combo.exige.tipo === 'nenhum') out.push(combo);
  }
  return out;
}

/**
 * RAPTO: arranca 1 personagem da maior cla inimiga da sala; ele volta a
 * Reserva do dono sem sofrer baixa. E o Rapto do Arruaceiro criando o 1 contra
 * 1 — o alvo escolhido e o de maior Poder de carta, que e o que um jogador
 * faria. No maximo um rapto por sala: o caos precisa de teto.
 */
function aplicarRaptos(grupos: { input: RoomInput; chars: CharCompute[] }[]): string[] {
  // O RAPTO vem do COMBO declarado ou de um ESPECIAL, que dispara sozinho.
  const raptores = grupos.filter((g) => {
    const declarado = comboDeclarado(g.chars, g.input.commitment.combo);
    if (declarado?.efeito.tipo === 'rapto') return true;
    return especiaisDe(g.chars).some((c) => c.efeito.tipo === 'rapto');
  });
  if (raptores.length === 0) return [];

  // Empate de raptores: ninguem rapta. Duas emboscadas se cancelam.
  if (raptores.length > 1) return [];
  const raptor = raptores[0]!;

  let alvo: { g: (typeof grupos)[number]; c: CharCompute } | null = null;
  for (const g of grupos) {
    if (g === raptor) continue;
    for (const c of g.chars) {
      if (!alvo || c.poderCarta > alvo.c.poderCarta) alvo = { g, c };
    }
  }
  if (!alvo) return [];
  alvo.g.chars = alvo.g.chars.filter((c) => c.instId !== alvo!.c.instId);
  return [alvo.c.instId];
}

/** O personagem carrega OCULTO depois de evolucao, equipamento e cartas? */
export function temOculto(state: EmperiumState, playerId: PlayerId, instId: string): boolean {
  const clan = state.clans[playerId];
  if (!clan) return false;
  const c = computeChar(state, clan, instId);
  return c !== null && c.keywords.has('oculto');
}

/** Quem, nesta sala, enxerga infiltrado: o falcao, os oculos, o Horong. */
function temOlhoParaOcultos(state: EmperiumState, playerId: PlayerId, c: Commitment): boolean {
  const clan = state.clans[playerId];
  if (!clan) return false;
  const chars = c.charInstIds
    .map((id) => computeChar(state, clan, id))
    .filter((x): x is CharCompute => x !== null);
  for (const ch of chars) {
    if (ch.equipSpecials.has('revela-oculto')) return true;
    if (ch.transSpecials.has('revela-oculto')) return true;
    if (ch.monsterSpecials.has('revela-ocultos')) return true;
    // O combo que marca REVELADO tambem conta: se ele vai acender nesta sala,
    // ninguem sai daqui pela sombra.
    const combo = comboDe(ch);
    if (
      combo &&
      c.combo === ch.instId &&
      combo.efeito.tipo === 'marca' &&
      combo.efeito.marca === 'revelado' &&
      comboAcende(ch, chars, combo)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Executa as infiltracoes de OCULTO antes de qualquer sala resolver: quem nao
 * foi revelado escorrega para a sala adjacente declarada e luta la, de graca.
 *
 * Muta `state.commitments`. Devolve as linhas de log.
 */
export function aplicarInfiltracoes(state: EmperiumState): string[] {
  const linhas: string[] = [];
  for (const playerId of state.order) {
    const meus = state.commitments[playerId];
    if (!meus) continue;
    for (const c of meus) {
      const inf = c.infiltrar;
      if (!inf) continue;
      if (!c.charInstIds.includes(inf.charInstId)) continue;
      if (!temOculto(state, playerId, inf.charInstId)) continue;

      // Revelado pelo inimigo que esta na MESMA sala de origem: fica e luta ali.
      const revelado = state.order.some((outro) => {
        if (outro === playerId) return false;
        const dele = (state.commitments[outro] ?? []).find((x) => x.slot === c.slot);
        return dele !== undefined && temOlhoParaOcultos(state, outro, dele);
      });
      const nome = CHARACTER_BY_ID.get(state.clans[playerId]?.chars[inf.charInstId]?.defId ?? '')?.nome;
      if (revelado) {
        linhas.push(`${nome ?? 'Um oculto'} foi REVELADO e ficou preso na sala de origem.`);
        continue;
      }

      c.charInstIds = c.charInstIds.filter((id) => id !== inf.charInstId);
      if (c.combo === inf.charInstId) c.combo = undefined;
      const existente = meus.find((x) => x.slot === inf.destino);
      if (existente) {
        existente.charInstIds.push(inf.charInstId);
      } else {
        meus.push({
          slot: inf.destino,
          charInstIds: [inf.charInstId],
          ordem: c.ordem,
          semOrdem: true,
          marcha: 0,
        });
      }
      const destinoNome = TILE_BY_ID.get(state.rooms[inf.destino]?.tileId ?? '')?.nome ?? inf.destino;
      linhas.push(`${nome ?? 'Um oculto'} infiltrou-se em ${destinoNome} sem pagar marcha.`);
    }
    // Grupos que ficaram vazios (o unico personagem infiltrou) saem da conta.
    state.commitments[playerId] = meus.filter((x) => x.charInstIds.length > 0);
  }
  return linhas;
}

/**
 * Resolve uma sala comum (nao-Emperium). Devolve o resultado; nao muta estado.
 */
export function resolveRoom(
  state: EmperiumState,
  slot: RoomSlot,
  inputs: readonly RoomInput[],
): RoomResolution {
  const room = state.rooms[slot];
  const tile = room ? TILE_BY_ID.get(room.tileId) : undefined;
  const effect = tile?.effect ?? 'nenhum';

  const emboscadores = inputs.filter(
    (i) => i.commitment.ordem === 'emboscada' && !i.commitment.semOrdem,
  ).length;

  // Pass 0 — monta os grupos e resolve o RAPTO antes de somar qualquer Poder:
  // arrancar alguem muda o calculo de quem ficou (ELO, SOLO), entao tem que
  // acontecer primeiro.
  const grupos: { input: RoomInput; chars: CharCompute[] }[] = [];
  for (const input of inputs) {
    // Asa de Borboleta: retira todos os personagens da sala antes de resolver.
    if (input.commitment.consumivel === 'co-borboleta') continue;
    const clan = state.clans[input.playerId];
    if (!clan) continue;
    const chars = input.commitment.charInstIds
      .map((id) => computeChar(state, clan, id))
      .filter((c): c is CharCompute => c !== null);
    if (chars.length === 0) continue;
    grupos.push({ input, chars });
  }

  const raptados = aplicarRaptos(grupos);

  // Pass 1 — agora sim, o Poder de cada cla.
  const factions: Faction[] = [];
  for (const g of grupos) {
    if (g.chars.length === 0) continue;
    const f = factionPower(
      state,
      slot,
      g.input.playerId,
      g.chars,
      g.input.commitment.semOrdem ? null : g.input.commitment.ordem,
      emboscadores === 1,
      g.input.commitment.consumivel,
      g.input.commitment.marcha ?? 0,
    );
    f.comboAtivo = comboDeclarado(g.chars, g.input.commitment.combo);
    f.especiais = especiaisDe(g.chars);
    factions.push(f);
  }

  // Guarnicao fixa da sala (Salao dos Guardioes) combate todas as clas.
  const guarnicao = room?.guarnicaoFixa ?? 0;
  if (guarnicao > 0) {
    factions.push({
      playerId: null,
      chars: [],
      ordem: null,
      poderBruto: guarnicao,
      muralha: 0,
      perfurar: 0,
      poderFinal: guarnicao,
      temAnular: 0,
      imuneMuralha: 0,
      marcha: 0,
      penalidadeMarcha: 0,
      bonusOrdem: 0,
      especiais: [],
      marcas: new Set<Marca>(),
      cancelaEsgotar: false,
      troco: false,
      perfurarTotal: false,
    });
  }

  // EMBOSCADA: e AQUI que "resolver antes" vira vantagem de verdade. Voce bateu
  // antes de o inimigo formar, entao ninguem mais nesta sala recebe o bonus da
  // propria Ordem. Sem isso, resolver primeiro nao tinha consequencia nenhuma —
  // a sala resolvia mais cedo e nada mudava.
  for (const emboscador of factions) {
    if (emboscador.ordem !== 'emboscada') continue;
    for (const outro of factions) {
      // So o bonus POSITIVO. Emboscar impede o inimigo de atacar, nao desfaz a
      // decisao dele de recuar — devolver o -2 do Resguardo premiaria quem se
      // escondeu, que e o contrario do que a Emboscada deveria fazer.
      if (outro === emboscador || outro.bonusOrdem <= 0) continue;
      outro.poderBruto -= outro.bonusOrdem;
      outro.bonusOrdem = 0;
      outro.emboscado = true;
    }
  }

  // Pass 2 — combos e marcas, ANTES de Anular e Muralha: EXPOSTO zera a
  // Muralha do alvo e PRESO tira o bonus da Ordem dele.
  applyCombos(factions, (p) => state.clans[p]?.zeny ?? 0);
  // IMITAR antes de ANULAR: copia o que ainda esta de pe, depois o Anular corta.
  applyImitar(factions);
  // Os ANULAR apontados por cada cla nesta sala, na ordem de jogo.
  const anulares: AnularDeclarado[] = [];
  for (const g of grupos) {
    for (const d of g.input.commitment.anulares ?? []) {
      anulares.push({
        playerId: g.input.playerId,
        alvoInstId: d.alvoInstId,
        keyword: d.keyword as KeywordName,
      });
    }
  }
  applyAnular(factions, anulares);
  applyMuralha(factions);

  const maior = factions.reduce((m, f) => Math.max(m, f.poderFinal), -Infinity);
  const noTopo = factions.filter((f) => f.poderFinal === maior);
  const empate = noTopo.length > 1;
  const vencedora = empate ? null : (noTopo[0] ?? null);

  const resultados: FactionResult[] = factions.map((f) => {
    let baixas: string[] = [];
    if (empate && f.poderFinal === maior) {
      // Empate no topo: ninguem controla, todos os empatados sofrem 1 baixa.
      baixas = pickCasualties(f, 1, state.round);
    } else if (vencedora && f !== vencedora) {
      const margem = vencedora.poderFinal - f.poderFinal;
      baixas = pickCasualties(f, margem, state.round);
    }
    // Resguardo cancela todas as baixas; Ponte sobre o Fosso tambem nao mata.
    if (f.ordem === 'resguardo') baixas = [];
    // Pocao Branca cancela 1 baixa.
    if (f.consumivel === 'co-pocao' && baixas.length > 0) baixas = baixas.slice(1);

    return {
      playerId: f.playerId,
      poderBruto: f.poderBruto,
      poderFinal: f.poderFinal,
      ordem: f.ordem,
      baixas,
      venceu: vencedora === f,
      marcha: f.marcha,
      emboscado: f.emboscado === true,
      combo: f.comboAtivo?.texto,
      marcas: [...f.marcas],
      cancelaEsgotar: f.cancelaEsgotar,
    };
  });

  // Investida: se perder a sala, sofre 1 baixa extra.
  for (let i = 0; i < factions.length; i++) {
    const f = factions[i]!;
    const r = resultados[i]!;
    if (f.ordem === 'investida' && !r.venceu) {
      const jaCaidos = new Set(r.baixas);
      const extra = f.chars.find((c) => !jaCaidos.has(c.instId) && !c.ghostring);
      if (extra) r.baixas = [...r.baixas, extra.instId];
    }
  }

  // Troco (Reflect Shield): quem perdeu com esse combo leva o vencedor junto.
  const idxVencedora = factions.findIndex((f) => f === vencedora);
  if (idxVencedora >= 0 && factions.some((f, i) => f.troco && !resultados[i]!.venceu)) {
    const rv = resultados[idxVencedora]!;
    const jaCaidos = new Set(rv.baixas);
    const extra = factions[idxVencedora]!.chars.find(
      (c) => !jaCaidos.has(c.instId) && !c.ghostring && !c.imortal,
    );
    if (extra) rv.baixas = [...rv.baixas, extra.instId];
  }

  // Ninguem controla o Salao dos Guardioes enquanto a guarnicao estiver viva.
  const controlador =
    effect === 'guarnicao6' && vencedora?.playerId === null
      ? null
      : (vencedora?.playerId ?? null);

  const jogadoras = resultados.filter((f) => f.playerId !== null);
  const semResistencia = jogadoras.length === 1 && guarnicao === 0;

  return {
    slot,
    tileId: room?.tileId ?? '',
    clas: resultados,
    controlador,
    controladorAnterior: room?.controlador ?? null,
    semDisputa: false,
    semResistencia,
    raptados,
    resumo: resumoDeSala(resultados, controlador, empate, semResistencia),
  };
}

/** Monta a frase que vai para o log e para a legenda do confronto. */
function resumoDeSala(
  resultados: readonly FactionResult[],
  controlador: PlayerId | null,
  empate: boolean,
  semResistencia: boolean,
): string {
  const partes = resultados.map((f) => {
    const quem = f.playerId ?? 'a guarnicao';
    if (f.ordem === 'resguardo') return `${quem} resguardou-se`;
    const baixas = f.baixas.length > 0 ? ` (${f.baixas.length} baixa${f.baixas.length > 1 ? 's' : ''})` : '';
    const marcha = f.marcha > 0 ? ` [marcha -${MARCHA_PENALIDADE * f.marcha}]` : '';
    return `${quem} ${f.poderFinal}${marcha}${baixas}`;
  });
  const corpo = partes.join(' · ');
  if (empate) return `${corpo} — empate no topo, ninguem controla`;
  if (semResistencia) return `${corpo} — tomada sem resistencia`;
  if (controlador) return `${corpo} — ${controlador} controla`;
  return corpo;
}

/**
 * Resolve a Sala do Emperium. O escudo do defensor absorve os atacantes em
 * ORDEM CRESCENTE de Poder — mandar sobras e dano zero (design secao 9).
 */
export function resolveEmperium(
  state: EmperiumState,
  inputs: readonly RoomInput[],
): RoomResolution {
  const defensor = state.castleOwnerId;
  const emboscadores = inputs.filter((i) => i.commitment.ordem === 'emboscada').length;

  let escudoDefensor = 0;
  const atacantes: Faction[] = [];
  const todas: Faction[] = [];

  for (const input of inputs) {
    if (input.commitment.consumivel === 'co-borboleta') continue;
    const clan = state.clans[input.playerId];
    if (!clan) continue;
    const chars = input.commitment.charInstIds
      .map((id) => computeChar(state, clan, id))
      .filter((c): c is CharCompute => c !== null);
    if (chars.length === 0) continue;
    const f = factionPower(
      state,
      'emperium',
      input.playerId,
      chars,
      input.commitment.ordem,
      emboscadores === 1,
      input.commitment.consumivel,
      input.commitment.marcha ?? 0,
    );
    todas.push(f);
    if (input.playerId === defensor) escudoDefensor += Math.max(0, f.poderBruto);
    else atacantes.push(f);
  }

  const escudoBase = SHIELD_BY_ROUND[state.round - 1] ?? 2;
  let escudo = escudoDefensor + escudoBase;

  // Absorcao crescente: o menor atacante primeiro.
  const ordenados = [...atacantes].sort((a, b) => a.poderBruto - b.poderBruto);
  const dano: Record<PlayerId, number> = {};
  const bloqueados = new Set<PlayerId>();

  for (const f of ordenados) {
    if (!f.playerId) continue;
    const p = Math.max(0, f.poderBruto);
    if (escudo >= p) {
      escudo -= p;
      bloqueados.add(f.playerId);
      dano[f.playerId] = 0;
    } else {
      const passou = p - escudo;
      escudo = 0;
      dano[f.playerId] = (dano[f.playerId] ?? 0) + passou;
    }
  }

  const danoTotal = Object.values(dano).reduce((a, b) => a + b, 0);

  const resultados: FactionResult[] = todas.map((f) => {
    const ehDef = f.playerId === defensor;
    let baixas: string[] = [];
    if (ehDef) {
      // O defensor sofre 1 baixa se qualquer dano passar.
      if (danoTotal > 0) baixas = pickCasualties(f, 1, state.round);
    } else if (f.playerId && bloqueados.has(f.playerId)) {
      // Atacantes totalmente absorvidos sofrem 1 baixa.
      baixas = pickCasualties(f, 1, state.round);
    }
    if (f.ordem === 'resguardo') baixas = [];
    if (f.consumivel === 'co-pocao' && baixas.length > 0) baixas = baixas.slice(1);
    return {
      playerId: f.playerId,
      poderBruto: f.poderBruto,
      poderFinal: f.poderBruto,
      ordem: f.ordem,
      baixas,
      venceu: false,
      marcha: f.marcha,
      emboscado: f.emboscado === true,
      combo: f.comboAtivo?.texto,
      marcas: [...f.marcas],
      cancelaEsgotar: f.cancelaEsgotar,
    };
  });

  // Acumula os cubos e verifica a quebra.
  const cubosDepois: Record<PlayerId, number> = { ...state.emperiumCubos };
  for (const [pid, d] of Object.entries(dano)) {
    cubosDepois[pid] = (cubosDepois[pid] ?? 0) + d;
  }
  const totalCubos = Object.values(cubosDepois).reduce((a, b) => a + b, 0);
  const quebrou = totalCubos >= state.emperiumDurabilidade;

  let novoDono: PlayerId | undefined;
  if (quebrou) {
    // Quem colocou mais cubos NESTA rodada toma o castelo. Empate: maior Poder.
    let melhor: { pid: PlayerId; d: number; poder: number } | null = null;
    for (const [pid, d] of Object.entries(dano)) {
      if (d <= 0) continue;
      const poder = todas.find((f) => f.playerId === pid)?.poderBruto ?? 0;
      if (!melhor || d > melhor.d || (d === melhor.d && poder > melhor.poder)) {
        melhor = { pid, d, poder };
      }
    }
    novoDono = melhor?.pid;
  }

  const partes = resultados.map((f) => {
    const quem = f.playerId ?? 'a guarnicao';
    if (f.playerId === defensor) return `${quem} escuda com ${f.poderBruto}`;
    if (f.ordem === 'resguardo') return `${quem} resguardou-se`;
    const d = f.playerId ? (dano[f.playerId] ?? 0) : 0;
    return d > 0 ? `${quem} crava ${d}` : `${quem} foi absorvido`;
  });
  const resumo =
    `escudo ${escudoDefensor + escudoBase} · ${partes.join(' · ')}` +
    (quebrou && novoDono ? ` — EMPERIUM QUEBRADO, ${novoDono} toma o castelo` : '');

  return {
    slot: 'emperium',
    tileId: 'sala-emperium',
    clas: resultados,
    controlador: null,
    controladorAnterior: null,
    semDisputa: false,
    semResistencia: false,
    raptados: [],
    resumo,
    escudo: escudoDefensor + escudoBase,
    danoPorJogador: dano,
    emperiumQuebrado: quebrou,
    novoDono,
  };
}
