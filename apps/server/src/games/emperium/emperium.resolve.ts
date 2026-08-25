import type { PlayerId } from '@boardzando/contracts';
import {
  CHARACTER_BY_ID,
  EQUIP_BY_ID,
  MONSTER_BY_ID,
  type CharacterDef,
  type KeywordName,
} from './emperium.cards';
import {
  SHIELD_BY_ROUND,
  TILE_BY_ID,
  type RoomSlot,
} from './emperium.rooms';
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
  /** Poder do personagem + equipamento + refino, antes de sala e keywords. */
  poderBase: number;
  keywords: Map<KeywordName, number>;
  monsterSpecials: Set<string>;
  equipSpecials: Set<string>;
  imuneAnular: boolean;
  ghostring: boolean;
  /** Poder base da carta pura — usado para calcular baixas. */
  poderCarta: number;
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
  if (equipSpecials.has('penalidade-escudar') && keywords.has('escudar')) poder -= 1;

  const ghostring = monsterSpecials.has('ghostring');
  if (ghostring) poder = Math.floor(poder / 2);

  return {
    instId,
    def,
    poderBase: poder,
    poderCarta: def.poder,
    keywords,
    monsterSpecials,
    equipSpecials,
    imuneAnular: monsterSpecials.has('imune-anular') || equipSpecials.has('imune-anular'),
    ghostring,
  };
}

interface Faction {
  playerId: PlayerId | null;
  chars: CharCompute[];
  ordem: OrderId | null;
  consumivel?: string;
  pagouCarrocerada: boolean;
  /** Poder antes de Muralha. */
  poderBruto: number;
  muralha: number;
  perfurar: number;
  poderFinal: number;
  temAnular: number;
  /** Poder que ignora Muralha por Marc / Frasco de Acido. */
  imuneMuralha: number;
}

/**
 * Aplica as regras da sala e as keywords que dependem de contagem (ELO, SOLO,
 * RAJADA) ao conjunto de personagens de uma faccao.
 */
function factionPower(
  state: EmperiumState,
  slot: RoomSlot,
  playerId: PlayerId | null,
  chars: CharCompute[],
  ordem: OrderId | null,
  emboscadaExclusiva: boolean,
  consumivel: string | undefined,
  pagouCarrocerada: boolean,
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
    if (effect === 'bonus-alcance' && alcanceAtivo) p += 1;
    if (effect === 'terraco') {
      if (c.def.papel === 'arcano') p *= 2;
      if (c.def.papel === 'vanguarda') p -= 2;
    }

    // ELO X: +X por cada OUTRO personagem seu na sala.
    if (has('elo')) p += val('elo') * Math.max(0, n - 1);
    // SOLO X: +X se for o unico personagem seu na sala.
    if (has('solo') && n === 1) p += val('solo');
    // RAJADA X: so na primeira rodada deste personagem nesta sala.
    if (has('rajada')) {
      const inst = playerId ? state.clans[playerId]?.chars[c.instId] : undefined;
      if (!inst || !inst.salasVisitadas.includes(slot)) p += val('rajada');
    }

    // Cartas de monstro condicionais.
    if (c.monsterSpecials.has('bonus-atacante') && !ehDefensor) p += 2;
    if (c.monsterSpecials.has('bonus-defensor') && ehDefensor) p += 2;
    if (c.monsterSpecials.has('imune-muralha')) imuneMuralha += p;

    // Selo do Emperium.
    if (c.equipSpecials.has('poder-emperium') && slot === 'emperium') p += 2;

    // Carrocerada: o Mestre-Ferreiro paga 3z por +4 de Poder.
    if (c.def.special === 'carrocerada' && pagouCarrocerada) p += 4;

    muralha += val('muralha');
    perfurar += val('perfurar');
    if (c.keywords.has('anular')) temAnular += val('anular');

    total += p;
  }

  // Ensemble: com outro Bardo/Odalisca seu na sala, ambos +5.
  const bardos = chars.filter((c) => c.def.classe === 'Bardo/Odalisca');
  if (chars.some((c) => c.def.special === 'ensemble') && bardos.length >= 2) {
    total += 5 * bardos.length;
  }

  // Marionete: dobra o Poder base de outro personagem seu na sala, max +6.
  if (chars.some((c) => c.def.special === 'marionete')) {
    const alvos = chars.filter((c) => c.def.special !== 'marionete');
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

  // Ordem.
  if (ordem) {
    if (ordem === 'emboscada') total += emboscadaExclusiva ? 2 : -2;
    else total += ORDER_POWER[ordem];
  }

  return {
    playerId,
    chars,
    ordem,
    consumivel,
    pagouCarrocerada,
    poderBruto: total,
    muralha,
    perfurar,
    poderFinal: total,
    temAnular,
    imuneMuralha,
  };
}

/**
 * ANULAR cancela automaticamente a maior Muralha inimiga da sala. O design
 * deixa a escolha ao jogador; a versao digital automatiza no uso mais
 * impactante para nao travar a resolucao pedindo alvo. Angeling e Manto Elfico
 * tornam o portador imune.
 */
function applyAnular(factions: Faction[]): void {
  for (const f of factions) {
    for (let i = 0; i < f.temAnular; i++) {
      let alvo: Faction | null = null;
      for (const outra of factions) {
        if (outra === f) continue;
        if (outra.muralha <= 0) continue;
        const todosImunes = outra.chars.every((c) => c.imuneAnular);
        if (todosImunes) continue;
        if (!alvo || outra.muralha > alvo.muralha) alvo = outra;
      }
      if (!alvo) break;
      // Cancela a maior contribuicao individual de Muralha da faccao alvo.
      let maior = 0;
      for (const c of alvo.chars) {
        if (c.imuneAnular) continue;
        maior = Math.max(maior, c.keywords.get('muralha') ?? 0);
      }
      alvo.muralha = Math.max(0, alvo.muralha - (maior || alvo.muralha));
    }
  }
}

/** Cada Muralha X reduz o total de CADA faccao inimiga em X; Perfurar devolve. */
function applyMuralha(factions: Faction[]): void {
  for (const f of factions) {
    let reducao = 0;
    for (const outra of factions) {
      if (outra === f) continue;
      reducao += outra.muralha;
    }
    const efetiva = Math.max(0, reducao - f.perfurar);
    // Poder marcado como imune a Muralha nao pode ser reduzido.
    const reduzivel = Math.max(0, f.poderBruto - f.imuneMuralha);
    f.poderFinal = f.poderBruto - Math.min(efetiva, reduzivel);
  }
}

/**
 * Escolhe quem cai numa faccao derrotada. ESCUDAR primeiro (obrigatorio),
 * depois os de menor Poder de carta — minimiza a perda, que e o que um jogador
 * faria. Teto de baixas: metade dos personagens, arredondado para cima.
 */
function pickCasualties(f: Faction, margem: number, round: number): string[] {
  if (margem <= 0) return [];
  const teto = Math.ceil(f.chars.length / 2);

  const elegiveis = f.chars.filter((c) => {
    if (c.ghostring) return false; // Ghostring nao pode sofrer baixa.
    if (c.def.special === 'teimoso' && round === 1) return false;
    return true;
  });

  const escudar = elegiveis.filter((c) => c.keywords.has('escudar'));
  const resto = elegiveis
    .filter((c) => !c.keywords.has('escudar'))
    .sort((a, b) => {
      // Amuleto de Ferro: nunca e a primeira baixa.
      const aAmu = a.equipSpecials.has('nunca-primeira-baixa') ? 1 : 0;
      const bAmu = b.equipSpecials.has('nunca-primeira-baixa') ? 1 : 0;
      if (aAmu !== bAmu) return aAmu - bAmu;
      return a.poderCarta - b.poderCarta;
    });

  const fila = [...escudar, ...resto];
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
    acumulado += Math.max(1, c.poderCarta);
  }
  return caidos;
}

export interface RoomInput {
  playerId: PlayerId;
  commitment: Commitment;
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

  const emboscadores = inputs.filter((i) => i.commitment.ordem === 'emboscada').length;

  const factions: Faction[] = [];
  for (const input of inputs) {
    // Asa de Borboleta: retira todos os personagens da sala antes de resolver.
    if (input.commitment.consumivel === 'co-borboleta') continue;
    const clan = state.clans[input.playerId];
    if (!clan) continue;
    const chars = input.commitment.charInstIds
      .map((id) => computeChar(state, clan, id))
      .filter((c): c is CharCompute => c !== null);
    if (chars.length === 0) continue;
    factions.push(
      factionPower(
        state,
        slot,
        input.playerId,
        chars,
        input.commitment.ordem,
        emboscadores === 1,
        input.commitment.consumivel,
        input.commitment.pagarCarrocerada === true,
      ),
    );
  }

  // Guarnicao fixa da sala (Salao dos Guardioes) combate todas as faccoes.
  const guarnicao = room?.guarnicaoFixa ?? 0;
  if (guarnicao > 0) {
    factions.push({
      playerId: null,
      chars: [],
      ordem: null,
      pagouCarrocerada: false,
      poderBruto: guarnicao,
      muralha: 0,
      perfurar: 0,
      poderFinal: guarnicao,
      temAnular: 0,
      imuneMuralha: 0,
    });
  }

  applyAnular(factions);
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
    faccoes: resultados,
    controlador,
    controladorAnterior: room?.controlador ?? null,
    semDisputa: false,
    semResistencia,
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
    return `${quem} ${f.poderFinal}${baixas}`;
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
      input.commitment.pagarCarrocerada === true,
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
    faccoes: resultados,
    controlador: null,
    controladorAnterior: null,
    semDisputa: false,
    semResistencia: false,
    resumo,
    escudo: escudoDefensor + escudoBase,
    danoPorJogador: dano,
    emperiumQuebrado: quebrou,
    novoDono,
  };
}
