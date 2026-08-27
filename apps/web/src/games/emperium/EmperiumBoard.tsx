import { useEffect, useMemo, useState } from 'react';
import {
  CHARACTER_BY_ID,
  CONSUMABLE_BY_ID,
  EQUIP_BY_ID,
  KEYWORD_DESC,
  KEYWORD_LABEL,
  MARCA_DESC,
  MARCA_LABEL,
  MONSTER_BY_ID,
  TRANSCENDENCIA_BY_ID,
  caminhosDaClasse,
  rotuloKeyword,
  type CharacterDef,
  type Keyword,
  type KeywordName,
  type Marca,
} from '@boardzando/contracts';
import { useGame } from '../../net/store';
import {
  FAMILIA_ROTULO,
  IconeChave,
  IconeTermo,
  Termo,
  familiaDe,
  type FamiliaChave,
} from './termos';
import { GameChat } from '../../shell/GameChat';
import './emperium.css';

/* ── Tipos da view (espelham EmperiumGame.playerView) ────────────────────── */

type RoomSlot = 'portao' | 'b1' | 'b2' | 'c1' | 'c2' | 'trono' | 'emperium';
type Step = 'mercado' | 'comprometimento' | 'resolucao' | 'fim';
type OrderId = 'investida' | 'cerco' | 'emboscada' | 'resguardo';

interface CharInstanceV {
  instId: string;
  defId: string;
  /** TranscendenceDef.id, se o personagem ja evoluiu no Altar. */
  transcendencia?: string;
  equips: string[];
  local: 'reserva' | 'enfermaria' | 'comprometido';
  voltaNaRodada?: number;
}
interface EquipInstanceV {
  instId: string;
  defId: string;
  refino: number;
  encaixadas: string[];
  portador?: string;
}
interface ClanV {
  playerId: string;
  zeny: number;
  gloria: number;
  chars: Record<string, CharInstanceV>;
  equips: Record<string, EquipInstanceV>;
  acoesRestantes: number;
  ordensDisponiveis?: OrderId[];
  ordensRestantes: number;
  consumiveis?: string[];
  consumiveisCount: number;
}
interface RoomV {
  slot: RoomSlot;
  tileId: string;
  controlador: string | null;
  guarnicaoFixa: number;
  guardioesDefensor: number;
}
interface CommitmentV {
  slot: RoomSlot;
  charInstIds: string[];
  ordem: OrderId;
  combo?: string;
  consumivel?: string;
  anulares?: { charInstId: string; alvoInstId: string; keyword: string }[];
}
interface FactionResultV {
  playerId: string | null;
  poderBruto: number;
  poderFinal: number;
  ordem: OrderId | null;
  baixas: string[];
  venceu: boolean;
  marcha: number;
  combo?: string;
  marcas: ('exposto' | 'preso' | 'revelado')[];
  cancelaEsgotar: boolean;
}
interface RoomResolutionV {
  slot: RoomSlot;
  tileId: string;
  clas: FactionResultV[];
  controlador: string | null;
  controladorAnterior: string | null;
  semDisputa: boolean;
  semResistencia: boolean;
  resumo: string;
  escudo?: number;
  danoPorJogador?: Record<string, number>;
  emperiumQuebrado?: boolean;
  novoDono?: string;
}
interface EmperiumView {
  round: number;
  step: Step;
  order: string[];
  defenderId: string;
  castleOwnerId: string;
  slots: RoomSlot[];
  rooms: Record<string, RoomV>;
  clans: Record<string, ClanV>;
  fileiraRecrutamento: string[];
  fileiraEquip: string[];
  altarAberto: boolean;
  jogadorDoMercado: string | null;
  meusComprometimentos: CommitmentV[];
  /** Os montes de bruços dos OUTROS clãs: sala e quantidade, nada mais. */
  montes?: Record<string, { slot: RoomSlot; quantidade: number }[]>;
  confirmados: string[];
  salasPermitidas: RoomSlot[];
  distanciaMarcha: Record<string, number>;
  marchaPenalidade: number;
  emperiumCubos: Record<string, number>;
  emperiumDurabilidade: number;
  escudoBase: number;
  ultimaResolucao: RoomResolutionV[] | null;
  log: string[];
  finished: boolean;
  winnerId?: string;
}

/* ── Rótulos ─────────────────────────────────────────────────────────────── */

/**
 * As categorias de sala.
 *
 * Sao SEIS, e nao quinze: uma cor por ficha daria um arco-iris em que nenhuma
 * cor significa nada. Agrupadas por aquilo que a sala muda no seu turno, a cor
 * vira informacao — voce bate o olho no castelo e ve onde se briga, onde se
 * ganha dinheiro e por onde se anda.
 */
type CategoriaSala = 'espinha' | 'batalha' | 'resgate' | 'economia' | 'passagem' | 'vigilancia';

const CATEGORIA_INFO: Record<CategoriaSala, { rotulo: string; oQueMuda: string }> = {
  espinha: { rotulo: 'Espinha', oQueMuda: 'as três salas fixas — o caminho que todo castelo tem' },
  batalha: { rotulo: 'Batalha', oQueMuda: 'muda como o combate resolve aqui' },
  resgate: { rotulo: 'Resgate', oQueMuda: 'muda o que acontece com quem cai' },
  economia: { rotulo: 'Economia', oQueMuda: 'paga quem controla, no fim da rodada' },
  passagem: { rotulo: 'Passagem', oQueMuda: 'muda o preço de chegar até aqui' },
  vigilancia: { rotulo: 'Vigilância', oQueMuda: 'enxerga ou barra quem entra' },
};

interface TileInfo {
  nome: string;
  regra: string;
  cat: CategoriaSala;
  /** Personagens por clã. 0 = sem limite. Espelha `RoomTileDef.limite`. */
  limite: number;
}

/** Espelha `emperium.rooms.ts` — nome, regra impressa e categoria de cor. */
const TILE_INFO: Record<string, TileInfo> = {
  'sala-portao': {
    nome: 'Portão Principal',
    regra: 'Todo mundo sempre pode entrar por aqui.',
    cat: 'espinha',
    limite: 3,
  },
  'sala-trono': { nome: 'Salão do Trono', regra: 'O dono do castelo tem +2 aqui.', cat: 'espinha', limite: 4 },
  'sala-emperium': { nome: 'Sala do Emperium', regra: 'O cristal. Mande tudo: o assalto final não tem teto.', cat: 'espinha', limite: 0 },
  'sala-corredor': { nome: 'Corredor Estreito', regra: 'A sala que pune número bruto.', cat: 'batalha', limite: 2 },
  'sala-patio': { nome: 'Pátio Aberto', regra: 'Personagens com Alcance têm +1 de Poder.', cat: 'batalha', limite: 4 },
  'sala-terraco': { nome: 'Terraço', regra: 'Arcano tem Poder dobrado. Vanguarda tem −2 de Poder.', cat: 'batalha', limite: 3 },
  'sala-ponte': { nome: 'Ponte sobre o Fosso', regra: 'Clãs derrotados não sofrem baixa: voltam à Reserva.', cat: 'resgate', limite: 3 },
  'sala-cripta': { nome: 'Cripta', regra: 'Baixas aqui vão para a Reserva, não para a Enfermaria.', cat: 'resgate', limite: 3 },
  'sala-armazem': { nome: 'Armazém', regra: 'Quem controla ganha 4 zeny no fim da rodada.', cat: 'economia', limite: 3 },
  'sala-forja': { nome: 'Forja', regra: 'Quem controla faz 1 refino grátis e sem risco.', cat: 'economia', limite: 3 },
  'sala-capela': { nome: 'Capela', regra: 'Quem controla tira 1 personagem da Enfermaria.', cat: 'economia', limite: 3 },
  'sala-labirinto': { nome: 'Labirinto', regra: 'Custa 1 zeny por personagem. Alcance não funciona.', cat: 'passagem', limite: 3 },
  'sala-portal': { nome: 'Portal Rúnico', regra: 'Ignore a Marcha Forçada para comprometer aqui.', cat: 'passagem', limite: 3 },
  'sala-vigia': {
    nome: 'Torre de Vigia',
    regra: 'Quem controla espia os comprometimentos de 1 sala adjacente.',
    cat: 'vigilancia',
    limite: 3,
  },
  'sala-guardioes': {
    nome: 'Salão dos Guardiões',
    regra: 'Guarnição de Poder 6 contra todos. Ninguém controla enquanto viva.',
    cat: 'vigilancia',
    limite: 3,
  },
};

const infoDaSala = (tileId: string): TileInfo =>
  TILE_INFO[tileId] ?? { nome: tileId, regra: '', cat: 'espinha', limite: 3 };

const ORDEM_INFO: Record<OrderId, { nome: string; efeito: string }> = {
  investida: { nome: 'Investida', efeito: '+3 Poder. Se perder, 1 baixa extra.' },
  cerco: { nome: 'Cerco', efeito: 'Ignora o limite da sala. −1 Poder.' },
  emboscada: { nome: 'Emboscada', efeito: 'Resolve antes. +2 se for a única; −2 se houver outra.' },
  resguardo: { nome: 'Resguardo', efeito: '−2 Poder. Sem baixas. +3 zeny.' },
};

const kwLabel = (k: Keyword): string => rotuloKeyword(k);

/** Espelha ANULAVEIS do motor. As RUINS estao dentro: anula-las ajuda o alvo. */
const RUINS_UI: readonly string[] = ['esgotar', 'fragil', 'berserk', 'maldicao'];

const ANULAVEIS_UI: readonly string[] = [
  'muralha',
  'perfurar',
  'rajada',
  'elo',
  'solo',
  'proteger',
  'devocao',
  'restaurar',
  'pilhar',
  'esgotar',
  'fragil',
  'berserk',
  'maldicao',
];

/* ── Os dois conceitos visuais ───────────────────────────────────────────── */

/**
 * Duas leituras do mesmo mundo, para escolher uma e descartar a outra.
 *
 * "Pergaminho" é a carta de guilda: pergaminho envelhecido, tinta sépia, ouro
 * folheado e granada — a paleta das janelas do Ragnarok clássico e de um
 * documento medieval. "Cerco" é o castelo à noite: pedra ameixa quase preta,
 * tocha, brasa e o brilho frio do Emperium.
 *
 * As duas guardam o ciano do cristal, que é a identidade do jogo, e as duas
 * puxam ouro para a Glória e vermelho para o sangue.
 */
type Tema = 'pergaminho' | 'cerco';

const TEMAS: Record<Tema, { nome: string; descricao: string }> = {
  pergaminho: {
    nome: 'Pergaminho',
    descricao: 'Carta de guilda: pergaminho, tinta sépia, ouro folheado e granada',
  },
  cerco: {
    nome: 'Cerco',
    descricao: 'O castelo à noite: pedra escura, tocha, brasa e o brilho do cristal',
  },
};

const TEMA_PADRAO: Tema = 'cerco';
const TEMA_CHAVE = 'emperium:tema';

function lerTema(): Tema {
  try {
    const v = window.localStorage.getItem(TEMA_CHAVE);
    if (v === 'pergaminho' || v === 'cerco') return v;
  } catch {
    /* sem localStorage (modo privado): usa o padrão */
  }
  return TEMA_PADRAO;
}

/* ── Glossário ───────────────────────────────────────────────────────────── */

/**
 * As 15 palavras-chave e as 3 marcas, com o que cada uma faz.
 *
 * Comeca fechado: quem ja sabe nao precisa ver isso toda rodada. Mas fica a um
 * clique de distancia dentro do proprio tabuleiro, porque a alternativa e
 * abrir o manual num segundo monitor — e ninguem faz isso no meio de uma
 * partida. O texto vem dos contratos, o mesmo que o manual usa.
 */
function Glossario(): JSX.Element {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');

  const alvo = busca.trim().toLowerCase();
  const casa = (rotulo: string, desc: string) =>
    alvo === '' || rotulo.toLowerCase().includes(alvo) || desc.toLowerCase().includes(alvo);

  const kws = (Object.keys(KEYWORD_LABEL) as KeywordName[]).filter((k) =>
    casa(KEYWORD_LABEL[k], KEYWORD_DESC[k]),
  );
  const marcas = (Object.keys(MARCA_LABEL) as Marca[]).filter((m) =>
    casa(MARCA_LABEL[m], MARCA_DESC[m]),
  );

  return (
    <section className={`emp-glossario ${aberto ? 'aberto' : ''}`}>
      <button
        type="button"
        className="emp-gloss-toggle"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
      >
        <span className="emp-gloss-seta" aria-hidden="true">
          {aberto ? '▾' : '▸'}
        </span>
        <span className="emp-gloss-titulo">📜 Glossário — palavras-chave e marcas</span>
        <span className="emp-gloss-contagem">15 + 3</span>
      </button>

      {aberto && (
        <div className="emp-gloss-corpo">
          <input
            className="emp-gloss-busca"
            placeholder="Filtrar por nome ou efeito…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />

          <p className="emp-gloss-nota">
            O <b>X</b> é o número impresso na carta: <b>MURALHA 2</b> reduz 2. Palavras-chave
            do mesmo <Termo nome="cla" /> <b>somam</b>.
          </p>

          {/* A cor do chip é da FAMÍLIA, não da palavra: quinze cores seriam o
              mesmo arco-íris que evitamos nas salas. O ícone é que identifica. */}
          <ul className="emp-familias">
            {(Object.keys(FAMILIA_ROTULO) as FamiliaChave[]).map((f) => (
              <li key={f} data-familia={f}>
                <span className="emp-familia-cor" aria-hidden="true" />
                {FAMILIA_ROTULO[f]}
              </li>
            ))}
          </ul>

          {kws.length > 0 && (
            <>
              <h4>Palavras-chave</h4>
              <dl className="emp-gloss-lista">
                {kws.map((k) => (
                  <div key={k} data-familia={familiaDe(k)}>
                    <dt>
                      <IconeChave nome={k} tam={12} />
                      {KEYWORD_LABEL[k]}
                    </dt>
                    <dd>{KEYWORD_DESC[k]}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}

          {marcas.length > 0 && (
            <>
              <h4>Marcas</h4>
              <p className="emp-gloss-nota">
                <Termo nome="marca" texto="Marcas" /> vêm de{' '}
                <Termo nome="combo" texto="combos" /> e caem sempre sobre o clã inimigo de maior{' '}
                <Termo nome="poder" /> da <Termo nome="sala" />. Duram só aquela sala, naquela
                rodada.
              </p>
              <dl className="emp-gloss-lista marcas">
                {marcas.map((m) => (
                  <div key={m} data-familia="marca">
                    <dt>
                      <IconeChave nome={m} tam={12} />
                      {MARCA_LABEL[m]}
                    </dt>
                    <dd>{MARCA_DESC[m]}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}

          {kws.length === 0 && marcas.length === 0 && (
            <p className="emp-vazio">Nada com “{busca}”.</p>
          )}
        </div>
      )}
    </section>
  );
}

/* ── Carta de personagem ─────────────────────────────────────────────────── */

function CharCard({
  def,
  inst,
  clan,
  selecionado,
  onClick,
  compacto,
  detalhado,
  onZoom,
}: {
  def: CharacterDef;
  inst?: CharInstanceV;
  clan?: ClanV;
  selecionado?: boolean;
  onClick?: () => void;
  compacto?: boolean;
  /** Abre as cartas de monstro encaixadas pelo nome, em vez de só contá-las. */
  detalhado?: boolean;
  /** Amplia a carta. Vira lupa no canto quando a carta já tem outro clique. */
  onZoom?: () => void;
}) {
  const equipsPoder =
    inst && clan
      ? inst.equips.reduce((n, id) => {
          const eq = clan.equips[id];
          const eqDef = eq ? EQUIP_BY_ID.get(eq.defId) : undefined;
          return n + (eqDef?.poder ?? 0) + (eq?.refino ?? 0);
        }, 0)
      : 0;

  const trans = inst?.transcendencia ? TRANSCENDENCIA_BY_ID.get(inst.transcendencia) : undefined;

  // Sem outra acao, a propria carta amplia — é o gesto óbvio no celular.
  // Com acao (selecionar no comprometimento), a lupa fica num canto para não
  // roubar o toque de quem está montando a investida.
  const acao = onClick ?? onZoom;
  const precisaLupa = Boolean(onZoom) && Boolean(onClick);

  return (
    <button
      type="button"
      className={`emp-card ${selecionado ? 'sel' : ''} ${compacto ? 'compacto' : ''} ${
        trans ? 'transcendido' : ''
      } ${detalhado ? 'detalhado' : ''}`}
      data-papel={def.papel}
      onClick={acao}
      disabled={!acao}
    >
      <span className="emp-card-band" />
      {precisaLupa && (
        <span
          className="emp-card-lupa"
          role="button"
          tabIndex={0}
          aria-label={`Ampliar ${def.nome}`}
          title="Ampliar"
          onClick={(e) => {
            e.stopPropagation();
            onZoom?.();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              onZoom?.();
            }
          }}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <circle cx="7" cy="7" r="4.6" />
            <path d="M10.4 10.4 14 14M7 4.8v4.4M4.8 7h4.4" />
          </svg>
        </span>
      )}
      {trans && <span className="emp-card-forma">{trans.forma}</span>}
      <span className="emp-card-nome">{def.nome}</span>
      <span className="emp-card-cls">{def.classe}</span>
      <span className="emp-card-stats">
        <span className="emp-stat">
          <em>Custo</em>
          <b>{def.custo}z</b>
        </span>
        <span className="emp-stat pow">
          <em>Poder</em>
          <b>
            {def.poder}
            {trans && trans.poderBonus > 0 && <i className="asc">+{trans.poderBonus}</i>}
            {equipsPoder > 0 && <i className="plus">+{equipsPoder}</i>}
          </b>
        </span>
        <span className="emp-slots">{'◇'.repeat(def.slots)}</span>
      </span>
      {(def.keywords.length > 0 || (trans?.keywords.length ?? 0) > 0) && (
        <span className="emp-kws">
          {def.keywords.map((k) => (
            <span key={k.kw} className="emp-chip" data-familia={familiaDe(k.kw)}>
              <IconeChave nome={k.kw} />
              {kwLabel(k)}
            </span>
          ))}
          {trans?.keywords.map((k) => (
            <span
              key={`tr-${k.kw}`}
              className="emp-chip asc"
              data-familia={familiaDe(k.kw)}
              title="Ganha na Transcendência"
            >
              <IconeChave nome={k.kw} />
              {kwLabel(k)}
            </span>
          ))}
        </span>
      )}
      {inst && inst.equips.length > 0 && clan && (
        <span className="emp-equips">
          {inst.equips.map((id) => {
            const eq = clan.equips[id];
            const eqDef = eq ? EQUIP_BY_ID.get(eq.defId) : undefined;
            if (!eqDef || !eq) return null;
            return (
              <span key={id} className="emp-equip">
                {eqDef.nome}
                {eq.refino > 0 && <b> +{eq.refino}</b>}
                {eq.encaixadas.length > 0 &&
                  (detalhado ? (
                    <i>
                      {' '}
                      ◈{' '}
                      {eq.encaixadas
                        .map((mc) => MONSTER_BY_ID.get(mc)?.nome ?? mc)
                        .join(', ')}
                    </i>
                  ) : (
                    <i> ◈{eq.encaixadas.length}</i>
                  ))}
              </span>
            );
          })}
        </span>
      )}
      {(trans?.combo ?? def.combo) && (
        <span className="emp-card-combo">{(trans?.combo ?? def.combo)!.texto}</span>
      )}
      {!compacto && <span className="emp-card-build">{trans ? trans.build : def.build}</span>}
    </button>
  );
}

/* ── Carta ampliada ──────────────────────────────────────────────────────── */

/**
 * A carta em tamanho de leitura, sobre um véu.
 *
 * No desktop a carta já cresce sozinha ao passar o mouse (ver `.emp-card` no
 * CSS), o que resolve a leitura rápida sem clique nenhum. Mas hover não existe
 * no celular, então lá o toque abre isto — com botão de fechar, véu clicável e
 * Esc, porque um jogador que abriu por engano precisa de mais de uma saída.
 */
function CartaAmpliada({
  inst,
  clan,
  onFechar,
}: {
  inst: CharInstanceV;
  clan: ClanV;
  onFechar: () => void;
}): JSX.Element | null {
  const def = CHARACTER_BY_ID.get(inst.defId);
  if (!def) return null;

  return (
    <div
      className="emp-zoom-veu"
      role="dialog"
      aria-modal="true"
      aria-label={`${def.nome}, ampliada`}
      onClick={onFechar}
    >
      <div className="emp-zoom-palco" onClick={(e) => e.stopPropagation()}>
        <CharCard def={def} inst={inst} clan={clan} detalhado />
        <button type="button" className="emp-btn ghost emp-zoom-fechar" onClick={onFechar} autoFocus>
          Fechar
        </button>
      </div>
    </div>
  );
}

/* ── Confronto de sala ───────────────────────────────────────────────────── */

/**
 * Desenha uma sala resolvida como um enfrentamento: os lados avancam para o
 * centro, batem, e o resultado fica de pe (vencedor brilhando, derrotados
 * recuados). Quem jogou Resguardo nao entra na linha do choque — fica de fora,
 * apagado, que e exatamente o que a Ordem faz na regra.
 */
function Confronto({
  res,
  indice,
  nomeDe,
  tileNome,
}: {
  res: RoomResolutionV;
  indice: number;
  nomeDe: (id: string | null) => string;
  tileNome: string;
}) {
  const fora = res.clas.filter((f) => f.ordem === 'resguardo');
  const lutando = res.clas.filter((f) => f.ordem !== 'resguardo');
  const ehEmperium = res.slot === 'emperium';
  const danoTotal = Object.values(res.danoPorJogador ?? {}).reduce((n, d) => n + d, 0);

  return (
    <div className="emp-confronto" style={{ '--i': indice } as React.CSSProperties}>
      <div className="emp-conf-cab">
        <span className="emp-conf-sala">{tileNome}</span>
        {res.escudo !== undefined && <span className="emp-conf-escudo">escudo {res.escudo}</span>}
      </div>

      {/* Bater no cristal precisa PARECER que bateu: o escudo absorve em
          silencio, o dano racha, e a quebra estilhaca. */}
      {ehEmperium && !res.semDisputa && (
        <div
          className={`emp-cristal ${res.emperiumQuebrado ? 'quebrou' : danoTotal > 0 ? 'rachou' : 'absorveu'}`}
        >
          <span className="emp-cristal-corpo" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="emp-cristal-txt">
            {res.emperiumQuebrado
              ? 'o Emperium estilhaçou'
              : danoTotal > 0
                ? `${danoTotal} de dano no cristal`
                : 'o escudo absorveu tudo'}
          </span>
        </div>
      )}

      {res.semDisputa ? (
        <div className="emp-conf-vazia">
          Ninguém veio.
          {res.controlador && <> Controle segue com <b>{nomeDe(res.controlador)}</b>.</>}
        </div>
      ) : (
        <div className={`emp-clash ${lutando.length > 1 ? 'duelo' : 'solo'}`}>
          {lutando.map((f, i) => {
            const dano = f.playerId ? (res.danoPorJogador?.[f.playerId] ?? 0) : 0;
            const bloqueado = ehEmperium && f.playerId !== null && dano === 0 && !f.venceu;
            return (
              <div
                key={f.playerId ?? `guarnicao-${i}`}
                className={`emp-lutador ${f.venceu ? 'venceu' : ''} ${
                  lutando.length > 1 && !f.venceu ? 'perdeu' : ''
                }`}
                style={{ '--dir': i % 2 === 0 ? -1 : 1 } as React.CSSProperties}
              >
                <span className="emp-lut-nome">
                  {f.playerId === null ? 'Guarnição' : nomeDe(f.playerId)}
                </span>
                {f.combo && (
                  <span className="emp-lut-combo" title={f.combo}>
                    <IconeTermo nome="combo" tam={11} />{' '}
                    {f.combo.replace(/^COMBO[^:]*:\s*/, '')}
                  </span>
                )}
                <span className="emp-lut-poder">
                  {f.poderFinal !== f.poderBruto ? (
                    <>
                      <s>{f.poderBruto}</s> {f.poderFinal}
                    </>
                  ) : (
                    f.poderFinal
                  )}
                </span>
                <span className="emp-lut-tags">
                  {f.ordem && <span className="emp-lut-ordem">{ORDEM_INFO[f.ordem].nome}</span>}
                  {f.marcha > 0 && (
                    <span className="emp-lut-marcha" title="Chegou por Marcha Forçada">
                      marcha −{f.marcha * 2}
                    </span>
                  )}
                  {f.marcas?.map((m) => (
                    <span key={m} className="emp-lut-marca">
                      <IconeChave nome={m} /> {m}
                    </span>
                  ))}
                  {f.baixas.length > 0 && (
                    <span className="emp-lut-baixa">
                      <IconeTermo nome="baixa" tam={11} /> {f.baixas.length}{' '}
                      {f.baixas.length === 1 ? 'baixa' : 'baixas'}
                    </span>
                  )}
                  {ehEmperium && dano > 0 && <span className="emp-lut-dano">{dano} de dano</span>}
                  {bloqueado && <span className="emp-lut-bloq">absorvido</span>}
                </span>
              </div>
            );
          })}
          {lutando.length > 1 && <span className="emp-impacto" aria-hidden="true" />}
        </div>
      )}

      {fora.length > 0 && (
        <div className="emp-fora">
          <span className="emp-fora-rot">fora do combate</span>
          {fora.map((f) => (
            <span key={f.playerId ?? 'g'} className="emp-fora-clan">
              {nomeDe(f.playerId)} resguardou-se
            </span>
          ))}
        </div>
      )}

      {res.semResistencia && !res.semDisputa && (
        <div className="emp-conf-nota">Tomada sem resistência.</div>
      )}
      {res.emperiumQuebrado && (
        <div className="emp-quebrou">
          Emperium quebrado — {nomeDe(res.novoDono ?? null)} tomou o castelo
        </div>
      )}
    </div>
  );
}

/* ── Tabuleiro ───────────────────────────────────────────────────────────── */

export function EmperiumBoard() {
  const view = useGame((s) => s.view) as EmperiumView | undefined;
  const session = useGame((s) => s.session);
  const room = useGame((s) => s.room);
  const socket = useGame((s) => s.socket);

  const [tema, setTema] = useState<Tema>(lerTema);
  /** playerId do clã com o elenco aberto. Um por vez: dois abertos empurram
   *  o castelo para fora da tela, que é o que o painel existe para evitar. */
  const [elencoAberto, setElencoAberto] = useState<string | null>(null);
  /** A carta ampliada. Ver <CartaAmpliada>. */
  const [zoom, setZoom] = useState<{ inst: CharInstanceV; clan: ClanV } | null>(null);

  // Esc fecha a carta ampliada — é o que a tecla faz em qualquer diálogo.
  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoom(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoom]);

  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [slotAlvo, setSlotAlvo] = useState<RoomSlot | ''>('');
  const [ordemAlvo, setOrdemAlvo] = useState<OrderId | ''>('');
  const [rascunho, setRascunho] = useState<CommitmentV[]>([]);
  const [charParaEquipar, setCharParaEquipar] = useState<string>('');
  /** Trocar esta chave remonta os confrontos e roda a animacao de novo. */
  const [replay, setReplay] = useState(0);
  const [guardiaoDe, setGuardiaoDe] = useState<string>('');
  const [guardiaoPara, setGuardiaoPara] = useState<string>('');
  const [altarAlvo, setAltarAlvo] = useState<string>('');
  const [comboAlvo, setComboAlvo] = useState<string>('');
  /** A mira de cada ANULAR selecionado: instId do meu -> alvo + palavra-chave. */
  const [miras, setMiras] = useState<Record<string, { alvoInstId: string; keyword: string }>>({});

  const nomeDe = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const p of room?.players ?? []) mapa.set(p.id, p.name ?? p.id);
    return (id: string | null) => (id ? (mapa.get(id) ?? id) : '—');
  }, [room?.players]);

  if (!view || !session) return <p>Aguardando estado...</p>;

  const me = session.playerId;
  const meuClan = view.clans[me];
  const minhaVezMercado = view.jogadorDoMercado === me;
  const jaConfirmei = view.confirmados.includes(me);

  const emit = (type: string, data: unknown): void => {
    socket?.emit('game:move', { roomId: session.roomId, type, data }, () => {});
  };

  /** O servidor grava playerIds no log; aqui viram nomes legiveis. */
  const humanizar = (msg: string): string =>
    view.order.reduce((s, pid) => s.split(pid).join(nomeDe(pid)), msg);

  /* ── Comprometimento: rascunho local ── */
  const usadosNoRascunho = new Set(rascunho.flatMap((c) => c.charInstIds));
  const ordensUsadas = new Set(rascunho.map((c) => c.ordem));
  const disponiveis = Object.values(meuClan?.chars ?? {}).filter(
    (c) => c.local === 'reserva' && !usadosNoRascunho.has(c.instId),
  );

  /**
   * Os combos dos personagens selecionados, com a informacao de se acendem
   * dado quem mais foi selecionado. A evolucao substitui o combo da base.
   */
  const combosDisponiveis = selecionados.flatMap((instId) => {
    const inst = meuClan?.chars[instId];
    const def = inst ? CHARACTER_BY_ID.get(inst.defId) : undefined;
    if (!inst || !def) return [];
    const trans = inst.transcendencia ? TRANSCENDENCIA_BY_ID.get(inst.transcendencia) : undefined;
    const combo = trans?.combo ?? def.combo;
    if (!combo) return [];
    // ESPECIAL nao se declara: ele dispara so por o personagem estar na sala.
    if (combo.exige.tipo === 'nenhum') return [];
    const exige = combo.exige;
    const acende =
      selecionados.some((outroId) => {
        if (outroId === instId) return false;
        const o = meuClan?.chars[outroId];
        const od = o ? CHARACTER_BY_ID.get(o.defId) : undefined;
        if (!od) return false;
        return exige.tipo === 'classe' ? od.classe === exige.valor : od.papel === exige.valor;
      });
    return [{ instId, def, combo, acende }];
  });

  /**
   * Os ANULAR entre os selecionados. Cada um TEM de apontar um alvo: um
   * personagem de outro clã e uma palavra-chave dele. O elenco alheio é
   * público, mas o comprometimento não — então você aponta no escuro, e o
   * Anular se perde se aquela pessoa não vier para esta sala.
   */
  const anularadores = selecionados.flatMap((instId) => {
    const inst = meuClan?.chars[instId];
    const def = inst ? CHARACTER_BY_ID.get(inst.defId) : undefined;
    if (!inst || !def) return [];
    const tr = inst.transcendencia ? TRANSCENDENCIA_BY_ID.get(inst.transcendencia) : undefined;
    const tem =
      def.keywords.some((k) => k.kw === 'anular') ||
      (tr?.keywords.some((k) => k.kw === 'anular') ?? false);
    return tem ? [{ instId, def }] : [];
  });

  /** Todo alvo possível: personagem inimigo + cada palavra-chave anulável dele. */
  const alvosDeAnular = view.order.flatMap((outro) => {
    if (outro === me) return [];
    const clan = view.clans[outro];
    if (!clan) return [];
    return Object.values(clan.chars).flatMap((inst) => {
      const def = CHARACTER_BY_ID.get(inst.defId);
      if (!def) return [];
      const tr = inst.transcendencia ? TRANSCENDENCIA_BY_ID.get(inst.transcendencia) : undefined;
      const kws = new Map<string, number | undefined>();
      for (const k of [...def.keywords, ...(tr?.keywords ?? [])]) kws.set(k.kw, k.x);
      for (const eqId of inst.equips) {
        const eq = clan.equips[eqId];
        const eqDef = eq ? EQUIP_BY_ID.get(eq.defId) : undefined;
        for (const k of eqDef?.keywords ?? []) kws.set(k.kw, k.x);
      }
      return [...kws.entries()]
        .filter(([k]) => ANULAVEIS_UI.includes(k))
        .map(([k, x]) => ({
          dono: outro,
          alvoInstId: inst.instId,
          nome: def.nome,
          keyword: k,
          rotulo: x === undefined ? KEYWORD_LABEL[k as KeywordName] : `${KEYWORD_LABEL[k as KeywordName]} ${x}`,
        }));
    });
  });

  /** Falta apontar algum ANULAR? Enquanto faltar, a investida não entra. */
  const anularSemMira = anularadores.some((a) => !miras[a.instId]);

  /** Os ESPECIAIS dos selecionados: disparam sem declaração, todos juntos. */
  const especiaisAtivos = selecionados.flatMap((instId) => {
    const inst = meuClan?.chars[instId];
    const def = inst ? CHARACTER_BY_ID.get(inst.defId) : undefined;
    if (!inst || !def) return [];
    const tr = inst.transcendencia ? TRANSCENDENCIA_BY_ID.get(inst.transcendencia) : undefined;
    const combo = tr?.combo ?? def.combo;
    if (!combo || combo.exige.tipo !== 'nenhum') return [];
    return [{ instId, def, combo }];
  });

  const adicionarAoRascunho = () => {
    if (!slotAlvo || !ordemAlvo || selecionados.length === 0) return;
    setRascunho([
      ...rascunho,
      {
        slot: slotAlvo,
        charInstIds: selecionados,
        ordem: ordemAlvo,
        combo: comboAlvo || undefined,
        anulares: anularadores.map((a) => ({
          charInstId: a.instId,
          alvoInstId: miras[a.instId]!.alvoInstId,
          keyword: miras[a.instId]!.keyword,
        })),
      },
    ]);
    setSelecionados([]);
    setSlotAlvo('');
    setOrdemAlvo('');
    setComboAlvo('');
  };

  const confirmar = () => {
    emit('confirmarComprometimento', {
      type: 'confirmarComprometimento',
      commitments: rascunho,
    });
    setRascunho([]);
    setSelecionados([]);
  };

  const totalCubos = Object.values(view.emperiumCubos).reduce((a, b) => a + b, 0);

  const trocarTema = (t: Tema) => {
    setTema(t);
    try {
      window.localStorage.setItem(TEMA_CHAVE, t);
    } catch {
      /* preferência não persiste, mas a partida continua */
    }
  };

  /**
   * O limite da sala mirada e o que ele significa para a selecao atual.
   *
   * O limite existia so no servidor: voce montava cinco personagens, mirava o
   * Corredor, clicava em confirmar e o move voltava recusado sem explicacao.
   * Agora a conta aparece antes.
   */
  const limiteDoAlvo = slotAlvo ? infoDaSala(view.rooms[slotAlvo]!.tileId).limite : 0;
  const cercoLevanta = ordemAlvo === 'cerco';
  const estouraLimite =
    limiteDoAlvo > 0 && !cercoLevanta && selecionados.length > limiteDoAlvo;

  /** Quem largou monte de bruços nesta sala, e com quantas cartas. */
  const montesDaSala = (slot: RoomSlot) => {
    const out: { playerId: string; quantidade: number }[] = [];
    for (const [playerId, montes] of Object.entries(view.montes ?? {})) {
      const m = montes.find((x) => x.slot === slot);
      if (m && m.quantidade > 0) out.push({ playerId, quantidade: m.quantidade });
    }
    return out;
  };

  /* ── Layout do castelo ── */
  const linear = !view.slots.includes('c1');
  const fileiras: RoomSlot[][] = linear
    ? [['emperium'], ['trono'], ['b2'], ['b1'], ['portao']]
    : [['emperium'], ['trono'], ['b2', 'c2'], ['b1', 'c1'], ['portao']];

  return (
    <div className="emp-board" data-tema={tema}>
      {/* ── Cabeçalho ── */}
      <header className="emp-header">
        <div className="emp-round">
          <em><IconeTermo nome="rodada" />Rodada</em>
          <b>
            {view.round}
            <span>/6</span>
          </b>
        </div>
        <div className="emp-fase">
          <em>Fase</em>
          <b>
            {view.step === 'mercado' && 'Mercado'}
            {view.step === 'comprometimento' && 'Comprometimento'}
            {view.step === 'resolucao' && 'Resolução'}
            {view.step === 'fim' && 'Fim de jogo'}
          </b>
        </div>
        <div className="emp-emperium">
          <em><IconeTermo nome="emperium" />Emperium</em>
          <div className="emp-durab">
            <div
              className="emp-durab-fill"
              style={{ width: `${Math.min(100, (totalCubos / view.emperiumDurabilidade) * 100)}%` }}
            />
            <span>
              {totalCubos} / {view.emperiumDurabilidade}
            </span>
          </div>
        </div>
        <div className="emp-escudo">
          <em>Escudo base</em>
          <b>{view.escudoBase}</b>
        </div>
        {view.altarAberto && (
          <span className="emp-trans">
            <IconeTermo nome="altar" /> Altar aberto
          </span>
        )}

        {/* Os dois conceitos visuais, lado a lado para comparar em partida. */}
        <div className="emp-temas" role="group" aria-label="Conceito visual">
          {(Object.keys(TEMAS) as Tema[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`emp-tema-btn ${tema === t ? 'ativo' : ''}`}
              onClick={() => trocarTema(t)}
              title={TEMAS[t].descricao}
              aria-pressed={tema === t}
            >
              {TEMAS[t].nome}
            </button>
          ))}
        </div>
      </header>

      {/* ── Clãs ── */}
      <section className="emp-clans">
        {view.order.map((p) => {
          const c = view.clans[p]!;
          const reserva = Object.values(c.chars).filter((x) => x.local === 'reserva').length;
          const enfermaria = Object.values(c.chars).filter((x) => x.local === 'enfermaria').length;
          return (
            <div
              key={p}
              className={`emp-clan ${p === view.castleOwnerId ? 'dono' : ''} ${p === me ? 'eu' : ''}`}
            >
              <div className="emp-clan-nome">
                {nomeDe(p)}
                {p === view.castleOwnerId && <span className="emp-tag">dono do castelo</span>}
                {view.step === 'comprometimento' && view.confirmados.includes(p) && (
                  <span className="emp-tag ok">pronto</span>
                )}
              </div>
              <div className="emp-clan-stats">
                <span>
                  <em><IconeTermo nome="gloria" />Glória</em>
                  <b>{c.gloria}</b>
                </span>
                <span>
                  <em><IconeTermo nome="zeny" />Zeny</em>
                  <b>{c.zeny}z</b>
                </span>
                <span>
                  <em><IconeTermo nome="reserva" />Reserva</em>
                  <b>{reserva}</b>
                </span>
                <span>
                  <em><IconeTermo nome="enfermaria" />Enfermaria</em>
                  <b>{enfermaria}</b>
                </span>
                <span>
                  <em><IconeTermo nome="ordem" />Ordens</em>
                  <b>{c.ordensRestantes}</b>
                </span>
              </div>

              {/* A reserva de TODOS fica a mostra: quem esta de pe no clã alheio
                  e informacao publica, e e a leitura que decide onde atacar.
                  So o comprometimento e segredo. */}
              <button
                type="button"
                className="emp-elenco-toggle"
                onClick={() => setElencoAberto((v) => (v === p ? null : p))}
                aria-expanded={elencoAberto === p}
              >
                <span aria-hidden="true">{elencoAberto === p ? '▾' : '▸'}</span>
                {elencoAberto === p ? 'fechar o elenco' : 'ver o elenco completo'}
              </button>

              <ul className="emp-reserva-mini">
                {Object.values(c.chars).map((inst) => {
                  const def = CHARACTER_BY_ID.get(inst.defId);
                  if (!def) return null;
                  const tr = inst.transcendencia
                    ? TRANSCENDENCIA_BY_ID.get(inst.transcendencia)
                    : undefined;
                  const poder = def.poder + (tr?.poderBonus ?? 0);
                  const titulo = tr ? `${def.nome} · ${tr.nome}` : def.nome;
                  return (
                    <li
                      key={inst.instId}
                      data-papel={def.papel}
                      data-local={inst.local}
                      title={`${titulo} — Poder ${poder}${
                        inst.local === 'enfermaria' ? ' · na Enfermaria' : ''
                      }${inst.local === 'comprometido' ? ' · comprometido' : ''}`}
                    >
                      <span className="emp-rm-nome">{def.classe}</span>
                      <span className="emp-rm-poder">{poder}</span>
                      {tr && <span className="emp-rm-evo" aria-hidden="true" />}
                    </li>
                  );
                })}
                {Object.keys(c.chars).length === 0 && (
                  <li className="emp-rm-vazio">nenhum recrutado</li>
                )}
              </ul>

              {/* Reserva e Enfermaria na MESMA lista: são o mesmo elenco, e
                  separá-los em duas abas obrigava a ir e voltar para contar
                  quem estará de pé na rodada seguinte. Quem está na
                  Enfermaria entra deitado, como carta virada na mesa. */}
              {elencoAberto === p && (
                <div className="emp-elenco">
                  {Object.values(c.chars).map((inst) => {
                    const def = CHARACTER_BY_ID.get(inst.defId);
                    if (!def) return null;
                    return (
                      <div
                        key={inst.instId}
                        className="emp-elenco-slot"
                        data-local={inst.local}
                      >
                        <CharCard
                          def={def}
                          inst={inst}
                          clan={c}
                          detalhado
                          onZoom={() => setZoom({ inst, clan: c })}
                        />
                        <span className="emp-elenco-estado">
                          {inst.local === 'enfermaria' && (
                            <>
                              <IconeTermo nome="enfermaria" tam={11} /> Enfermaria
                              {inst.voltaNaRodada ? ` · volta na ${inst.voltaNaRodada}` : ''}
                            </>
                          )}
                          {inst.local === 'comprometido' && (
                            <>
                              <IconeTermo nome="ordem" tam={11} /> comprometido
                            </>
                          )}
                          {inst.local === 'reserva' && (
                            <>
                              <IconeTermo nome="reserva" tam={11} /> de pé
                            </>
                          )}
                        </span>
                      </div>
                    );
                  })}
                  {Object.keys(c.chars).length === 0 && (
                    <p className="emp-vazio">Nenhum personagem recrutado ainda.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* ── Castelo ── */}
      <section className="emp-castelo">
        <div className="emp-secao-aba">
          <IconeTermo nome="sala" tam={11} /> Castelo
        </div>
        {/* Duas colunas: as salas ocupam a largura que precisam e a legenda
            preenche a faixa vazia à direita, em vez de empurrar tudo para baixo. */}
        <div className="emp-castelo-grid">
        <div className="emp-fileiras">
        {fileiras.map((fileira, i) => (
          <div key={i} className="emp-fileira">
            {fileira
              .filter((s) => view.slots.includes(s))
              .map((slot) => {
                const r = view.rooms[slot]!;
                const permitida = view.salasPermitidas.includes(slot);
                const dist = view.distanciaMarcha?.[slot] ?? 0;
                const custoMarcha = dist * (view.marchaPenalidade ?? 2);
                const meuCommit = rascunho.find((c) => c.slot === slot);
                const info = infoDaSala(r.tileId);
                // O Emperium racha conforme os cubos entram: 0 a 4 estagios.
                const rachadura =
                  slot === 'emperium' && view.emperiumDurabilidade > 0
                    ? Math.min(4, Math.floor((totalCubos / view.emperiumDurabilidade) * 5))
                    : 0;
                return (
                  <div
                    key={slot}
                    data-cat={info.cat}
                    data-rachadura={rachadura || undefined}
                    className={`emp-sala ${slot === 'emperium' ? 'emperium' : ''} ${
                      permitida ? 'permitida' : ''
                    } ${dist > 0 ? 'marcha' : ''} ${slotAlvo === slot ? 'alvo' : ''}`}
                  >
                    <div className="emp-sala-cat">{CATEGORIA_INFO[info.cat].rotulo}</div>
                    <div className="emp-sala-nome">{info.nome}</div>
                    <div
                      className="emp-sala-limite"
                      title="Quantos personagens cada clã pode comprometer aqui. O Cerco ignora o limite."
                    >
                      {info.limite > 0 ? `máx. ${info.limite} por clã` : 'sem limite'}
                    </div>
                    {info.regra && <div className="emp-sala-regra">{info.regra}</div>}
                    {custoMarcha > 0 ? (
                      <div className="emp-sala-marcha" title={`Marcha Forçada: ${dist} sala(s) além da sua linha de frente`}>
                        marcha −{custoMarcha}
                      </div>
                    ) : (
                      <div className="emp-sala-frente">linha de frente</div>
                    )}
                    <div className="emp-sala-dono">
                      {slot === 'emperium' ? (
                        <span className="emp-cubos">
                          {view.order
                            .filter((p) => (view.emperiumCubos[p] ?? 0) > 0)
                            .map((p) => (
                              <span key={p}>
                                {nomeDe(p)} {view.emperiumCubos[p]}
                              </span>
                            ))}
                          {totalCubos === 0 && 'intacto'}
                        </span>
                      ) : (
                        <>controle: {nomeDe(r.controlador)}</>
                      )}
                    </div>
                    {(r.guardioesDefensor > 0 || r.guarnicaoFixa > 0) && (
                      <div className="emp-sala-guarda">
                        {r.guardioesDefensor > 0 && (
                          <>
                            <IconeTermo nome="guardiao" tam={11} /> {r.guardioesDefensor}{' '}
                            {r.guardioesDefensor === 1 ? 'guardião' : 'guardiões'}
                          </>
                        )}
                        {r.guarnicaoFixa > 0 && ` guarnição ${r.guarnicaoFixa}`}
                      </div>
                    )}
                    {meuCommit && (
                      <div className="emp-sala-commit">
                        {meuCommit.charInstIds.length} un. · {ORDEM_INFO[meuCommit.ordem].nome}
                      </div>
                    )}

                    {/* Os montes de bruços dos rivais, como na mesa: dá para
                        contar as cartas e ver a sala, e mais nada. */}
                    {montesDaSala(slot).length > 0 && (
                      <div className="emp-montes">
                        {montesDaSala(slot).map(({ playerId, quantidade }) => (
                          <span
                            key={playerId}
                            className="emp-monte"
                            title={`${nomeDe(playerId)} comprometeu ${quantidade} de bruços aqui`}
                          >
                            <span className="emp-monte-cartas" aria-hidden="true">
                              {Array.from({ length: Math.min(quantidade, 5) }, (_, k) => (
                                <i key={k} />
                              ))}
                            </span>
                            {nomeDe(playerId)} {quantidade}
                          </span>
                        ))}
                      </div>
                    )}
                    {view.step === 'comprometimento' && !jaConfirmei && permitida && (
                      <button
                        type="button"
                        className="emp-mini"
                        onClick={() => setSlotAlvo(slot)}
                        disabled={!!meuCommit}
                      >
                        {meuCommit ? 'comprometida' : 'mirar aqui'}
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        ))}
        </div>

        {/* A cor da sala e uma legenda de verdade, entao ela vem escrita. */}
        <aside className="emp-legenda-painel">
          <h4>As salas por categoria</h4>
          <ul className="emp-legenda">
            {(Object.keys(CATEGORIA_INFO) as CategoriaSala[]).map((cat) => (
              <li key={cat} data-cat={cat}>
                <span className="emp-legenda-cor" aria-hidden="true" />
                <b>{CATEGORIA_INFO[cat].rotulo}</b>
                <em>{CATEGORIA_INFO[cat].oQueMuda}</em>
              </li>
            ))}
          </ul>
          <p className="emp-legenda-nota">
            A cor diz o que a sala muda no seu turno — não que sala é. Seis grupos, não
            quinze fichas.
          </p>
        </aside>
        </div>
      </section>

      {/* ── Fase: Mercado ── */}
      {view.step === 'mercado' && (
        <section className="emp-painel mercado">
          <div className="emp-secao-aba">
            <IconeTermo nome="zeny" tam={11} /> Mercado
          </div>
          <h3>
            Mercado — {minhaVezMercado ? 'sua vez' : `vez de ${nomeDe(view.jogadorDoMercado)}`}
            {minhaVezMercado && (
              <span className="emp-acoes">{meuClan?.acoesRestantes} ações restantes</span>
            )}
          </h3>

          <h4>Fileira de recrutamento</h4>
          <div className="emp-fileira-cartas">
            {view.fileiraRecrutamento.map((defId, i) => {
              const def = CHARACTER_BY_ID.get(defId);
              if (!def) return null;
              const podePagar = (meuClan?.zeny ?? 0) >= def.custo;
              return (
                <CharCard
                  key={`${defId}-${i}`}
                  def={def}
                  onClick={
                    minhaVezMercado && podePagar
                      ? () => emit('recrutar', { type: 'recrutar', indice: i })
                      : undefined
                  }
                />
              );
            })}
          </div>

          <h4>Fileira de equipamento</h4>
          <div className="emp-equip-row">
            {view.fileiraEquip.map((defId, i) => {
              const def = EQUIP_BY_ID.get(defId);
              if (!def) return null;
              return (
                <div key={`${defId}-${i}`} className="emp-equip-card">
                  <b>{def.nome}</b>
                  <span className="emp-equip-meta">
                    {def.kind} · {def.custo}z · +{def.poder}
                    {def.encaixes > 0 && ` · ${'◈'.repeat(def.encaixes)}`}
                  </span>
                  {def.papeis.length > 0 && (
                    <span className="emp-equip-papel">{def.papeis.join(' / ')}</span>
                  )}
                  {def.keywords.map((k) => (
                    <span key={k.kw} className="emp-chip">
                      {kwLabel(k)}
                    </span>
                  ))}
                  {minhaVezMercado && (
                    <div className="emp-equip-acao">
                      <select
                        value={charParaEquipar}
                        onChange={(e) => setCharParaEquipar(e.target.value)}
                      >
                        <option value="">equipar em...</option>
                        {Object.values(meuClan?.chars ?? {}).map((c) => {
                          const cd = CHARACTER_BY_ID.get(c.defId);
                          if (!cd || c.equips.length >= cd.slots) return null;
                          if (def.papeis.length > 0 && !def.papeis.includes(cd.papel)) return null;
                          return (
                            <option key={c.instId} value={c.instId}>
                              {cd.nome}
                            </option>
                          );
                        })}
                      </select>
                      <button
                        type="button"
                        className="emp-mini"
                        disabled={!charParaEquipar || (meuClan?.zeny ?? 0) < def.custo}
                        onClick={() =>
                          emit('equipar', {
                            type: 'equipar',
                            indice: i,
                            charInstId: charParaEquipar,
                          })
                        }
                      >
                        comprar
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── O Altar: mercado de preço fixo, sempre visível ── */}
          {view.altarAberto && (
            <>
              <h4>Altar da Transcendência</h4>
              <p className="emp-dica">
                Aqui você não contrata ninguém: você <b>evolui quem já é seu</b>. A carta é
                empilhada sobre o personagem — Poder e palavras-chave <b>somam</b>, e o equipamento
                continua com ele. Uma vez por personagem. Evoluir alguém que caiu o traz de volta
                da Enfermaria na hora.
              </p>
              <div className="emp-altar">
                <select
                  className="emp-altar-alvo"
                  value={altarAlvo}
                  onChange={(e) => setAltarAlvo(e.target.value)}
                >
                  <option value="">escolha um personagem seu...</option>
                  {Object.values(meuClan?.chars ?? {})
                    .filter((c) => !c.transcendencia && c.local !== 'comprometido')
                    .map((c) => {
                      const d = CHARACTER_BY_ID.get(c.defId);
                      return (
                        <option key={c.instId} value={c.instId}>
                          {d?.nome}
                          {c.local === 'enfermaria' ? ' (na Enfermaria)' : ''}
                        </option>
                      );
                    })}
                </select>

                {altarAlvo &&
                  (() => {
                    const alvo = meuClan?.chars[altarAlvo];
                    const alvoDef = alvo ? CHARACTER_BY_ID.get(alvo.defId) : undefined;
                    if (!alvoDef) return null;
                    return (
                      <div className="emp-caminhos">
                        {caminhosDaClasse(alvoDef.classe).map((t) => {
                          const podePagar = (meuClan?.zeny ?? 0) >= t.custo;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              className="emp-caminho"
                              disabled={!minhaVezMercado || !podePagar}
                              onClick={() =>
                                emit('transcender', {
                                  type: 'transcender',
                                  charInstId: altarAlvo,
                                  transId: t.id,
                                })
                              }
                            >
                              <span className="emp-caminho-nome">{t.nome}</span>
                              <span className="emp-caminho-ganho">
                                {t.poderBonus > 0 && <b>+{t.poderBonus} Poder</b>}
                                {t.keywords.map((k) => (
                                  <span
                                    key={k.kw}
                                    className="emp-chip asc"
                                    data-familia={familiaDe(k.kw)}
                                  >
                                    <IconeChave nome={k.kw} />
                                    {kwLabel(k)}
                                  </span>
                                ))}
                              </span>
                              <span className="emp-caminho-custo">{t.custo}z</span>
                              <span className="emp-caminho-build">{t.build}</span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
              </div>
            </>
          )}

          {minhaVezMercado && (
            <div className="emp-mercado-acoes">
              <button
                type="button"
                className="emp-btn"
                onClick={() => emit('comprarConsumivel', { type: 'comprarConsumivel' })}
                disabled={(meuClan?.zeny ?? 0) < 4}
              >
                Comprar consumível (4z)
              </button>
              {Object.values(meuClan?.equips ?? {})
                .filter((e) => e.refino < 3)
                .slice(0, 4)
                .map((e) => {
                  const d = EQUIP_BY_ID.get(e.defId);
                  return (
                    <button
                      key={e.instId}
                      type="button"
                      className="emp-btn"
                      disabled={(meuClan?.zeny ?? 0) < 3}
                      onClick={() => emit('refinar', { type: 'refinar', equipInstId: e.instId })}
                    >
                      Refinar {d?.nome} +{e.refino} (3z)
                    </button>
                  );
                })}
              {view.castleOwnerId === me && (
                <span className="emp-guardiao">
                  <em>Mover Guardião</em>
                  <select value={guardiaoDe} onChange={(e) => setGuardiaoDe(e.target.value)}>
                    <option value="">de...</option>
                    {view.slots
                      .filter((s) => (view.rooms[s]?.guardioesDefensor ?? 0) > 0)
                      .map((s) => (
                        <option key={s} value={s}>
                          {infoDaSala(view.rooms[s]!.tileId).nome} ({view.rooms[s]!.guardioesDefensor})
                        </option>
                      ))}
                  </select>
                  <select value={guardiaoPara} onChange={(e) => setGuardiaoPara(e.target.value)}>
                    <option value="">para...</option>
                    {view.slots
                      .filter((s) => s !== guardiaoDe)
                      .map((s) => (
                        <option key={s} value={s}>
                          {infoDaSala(view.rooms[s]!.tileId).nome}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    className="emp-mini"
                    disabled={!guardiaoDe || !guardiaoPara}
                    onClick={() =>
                      emit('reposicionarGuardiao', {
                        type: 'reposicionarGuardiao',
                        de: guardiaoDe,
                        para: guardiaoPara,
                      })
                    }
                  >
                    mover
                  </button>
                </span>
              )}
              <button
                type="button"
                className="emp-btn ghost"
                onClick={() => emit('passarMercado', { type: 'passarMercado' })}
              >
                Passar a vez
              </button>
            </div>
          )}
        </section>
      )}

      {/* ── Fase: Comprometimento ── */}
      {view.step === 'comprometimento' && (
        <section className="emp-painel reserva">
          <div className="emp-secao-aba">
            <IconeTermo nome="reserva" tam={11} /> Reserva e comprometimento
          </div>
          <h3>
            Comprometimento — {jaConfirmei ? 'aguardando os outros clãs' : 'monte sua investida'}
            <span className="emp-acoes">
              {view.confirmados.length}/{view.order.length} prontos
            </span>
          </h3>

          {!jaConfirmei && (
            <>
              <p className="emp-dica">
                Escolha personagens da <Termo nome="reserva" />, uma <Termo nome="sala" /> e uma{' '}
                <Termo nome="ordem" />. Você tem 4 Ordens e cada uma
                só vale uma vez por rodada — comprometer em quatro salas significa gastar Resguardo
                onde você queria Investida.
              </p>
              <p className="emp-dica">
                <b>Toda sala do castelo é alcançável.</b> Ir além da sua linha de frente é uma{' '}
                <Termo nome="marcha" />: −{view.marchaPenalidade ?? 2} de <Termo nome="poder" />
                por sala de distância. Tomar uma sala aproxima a linha e barateia a próxima. — <i>O grupo se desorganizou para ir o mais rápido possível marchando para frente</i>
              </p>

              <h4>
                <IconeTermo nome="reserva" /> Sua Reserva
              </h4>
              <div className="emp-fileira-cartas">
                {disponiveis.map((c) => {
                  const def = CHARACTER_BY_ID.get(c.defId);
                  if (!def) return null;
                  return (
                    <CharCard
                      key={c.instId}
                      def={def}
                      inst={c}
                      clan={meuClan}
                      compacto
                      onZoom={() => meuClan && setZoom({ inst: c, clan: meuClan })}
                      selecionado={selecionados.includes(c.instId)}
                      onClick={() =>
                        setSelecionados((s) =>
                          s.includes(c.instId)
                            ? s.filter((x) => x !== c.instId)
                            : [...s, c.instId],
                        )
                      }
                    />
                  );
                })}
                {disponiveis.length === 0 && <p className="emp-vazio">Reserva vazia.</p>}
              </div>

              <div className="emp-montagem">
                <div>
                  <em><IconeTermo nome="sala" />Sala</em>
                  <b>{slotAlvo ? (infoDaSala(view.rooms[slotAlvo]!.tileId).nome) : '—'}</b>
                </div>
                <div>
                  <em><IconeTermo nome="marcha" />Marcha</em>
                  <b className={slotAlvo && (view.distanciaMarcha?.[slotAlvo] ?? 0) > 0 ? 'penal' : ''}>
                    {!slotAlvo
                      ? '—'
                      : (view.distanciaMarcha[slotAlvo] ?? 0) === 0
                        ? 'sem custo'
                        : `−${(view.distanciaMarcha[slotAlvo] ?? 0) * (view.marchaPenalidade ?? 2)} de Poder`}
                  </b>
                </div>
                <div>
                  <em>Selecionados</em>
                  <b className={estouraLimite ? 'penal' : ''}>{selecionados.length}</b>
                </div>
                <div>
                  <em>Cabem aqui</em>
                  <b
                    className={estouraLimite ? 'penal' : ''}
                    title="Personagens por clã nesta sala. O Cerco ignora o limite."
                  >
                    {!slotAlvo
                      ? '—'
                      : limiteDoAlvo === 0
                        ? 'sem limite'
                        : cercoLevanta
                          ? `${limiteDoAlvo} · Cerco ignora`
                          : `${selecionados.length}/${limiteDoAlvo}`}
                  </b>
                </div>
                <div className="emp-ordens">
                  {(['investida', 'cerco', 'emboscada', 'resguardo'] as OrderId[]).map((o) => (
                    <button
                      key={o}
                      type="button"
                      className={`emp-ordem ${ordemAlvo === o ? 'sel' : ''}`}
                      disabled={ordensUsadas.has(o)}
                      title={ORDEM_INFO[o].efeito}
                      onClick={() => setOrdemAlvo(o)}
                    >
                      {ORDEM_INFO[o].nome}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="emp-btn"
                  disabled={
                    !slotAlvo ||
                    !ordemAlvo ||
                    selecionados.length === 0 ||
                    estouraLimite ||
                    anularSemMira
                  }
                  title={
                    estouraLimite
                      ? `${infoDaSala(view.rooms[slotAlvo as RoomSlot]!.tileId).nome} comporta ${limiteDoAlvo} por clã. Tire ${selecionados.length - limiteDoAlvo} ou use a Ordem Cerco.`
                      : undefined
                  }
                  onClick={adicionarAoRascunho}
                >
                  Adicionar investida
                </button>
              </div>

              {estouraLimite && (
                <p className="emp-dica alerta">
                  <b>
                    {infoDaSala(view.rooms[slotAlvo as RoomSlot]!.tileId).nome} comporta{' '}
                    {limiteDoAlvo} por clã
                  </b>{' '}
                  e você selecionou {selecionados.length}. Tire{' '}
                  {selecionados.length - limiteDoAlvo}, ou mande sob a Ordem{' '}
                  <b>Cerco</b> — é a única <Termo nome="ordem" texto="Ordem" /> que ignora o
                  limite, ao custo de −1 de <Termo nome="poder" />.
                </p>
              )}

              {/* ANULAR aponta, e apontar é obrigatório. */}
              {anularadores.length > 0 && (
                <div className="emp-miras">
                  <span className="emp-combos-rot">
                    <IconeChave nome="anular" /> Mire cada ANULAR — obrigatório
                  </span>
                  <p className="emp-dica">
                    Você nomeia alguém do elenco inimigo (que é público) e uma palavra-chave
                    dele. <b>Se essa pessoa não vier para esta sala, o Anular se perde.</b> E
                    cuidado: cancelar uma palavra-chave <b>ruim</b> devolve Poder ao inimigo.
                  </p>
                  {anularadores.map((a) => (
                    <div key={a.instId} className="emp-mira">
                      <b>{a.def.nome}</b>
                      <select
                        className="emp-select"
                        value={
                          miras[a.instId]
                            ? `${miras[a.instId]!.alvoInstId}|${miras[a.instId]!.keyword}`
                            : ''
                        }
                        onChange={(e) => {
                          const [alvoInstId, keyword] = e.target.value.split('|');
                          setMiras((m) =>
                            alvoInstId && keyword
                              ? { ...m, [a.instId]: { alvoInstId, keyword } }
                              : Object.fromEntries(
                                  Object.entries(m).filter(([k]) => k !== a.instId),
                                ),
                          );
                        }}
                      >
                        <option value="">— escolha o alvo —</option>
                        {alvosDeAnular.map((alvo) => (
                          <option
                            key={`${alvo.alvoInstId}|${alvo.keyword}`}
                            value={`${alvo.alvoInstId}|${alvo.keyword}`}
                          >
                            {nomeDe(alvo.dono)} · {alvo.nome} — {alvo.rotulo}
                            {RUINS_UI.includes(alvo.keyword) ? ' (ruim para ele!)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                  {alvosDeAnular.length === 0 && (
                    <p className="emp-vazio">
                      Nenhum inimigo tem palavra-chave anulável ainda.
                    </p>
                  )}
                </div>
              )}

              {/* ESPECIAL não se declara: mostra o que vai acontecer sozinho. */}
              {especiaisAtivos.length > 0 && (
                <div className="emp-especiais">
                  <span className="emp-combos-rot">
                    Especiais — disparam sozinhos, sem declarar
                  </span>
                  <div className="emp-especiais-lista">
                    {especiaisAtivos.map(({ instId, def, combo }) => (
                      <span key={instId} className="emp-especial-item">
                        <b>{def.nome}</b>
                        <span>{combo.texto.replace(/^ESPECIAL:\s*/, '')}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Só UM combo dispara por sala — você declara qual. */}
              {combosDisponiveis.length > 0 && (
                <div className="emp-combos">
                  <span className="emp-combos-rot">
                    <IconeTermo nome="combo" /> Combo desta investida — só um dispara
                  </span>
                  <div className="emp-combos-lista">
                    <button
                      type="button"
                      className={`emp-combo-op ${comboAlvo === '' ? 'sel' : ''}`}
                      onClick={() => setComboAlvo('')}
                    >
                      nenhum
                    </button>
                    {combosDisponiveis.map(({ instId, def, combo, acende }) => (
                      <button
                        key={instId}
                        type="button"
                        className={`emp-combo-op ${comboAlvo === instId ? 'sel' : ''} ${
                          acende ? '' : 'apagado'
                        }`}
                        onClick={() => setComboAlvo(instId)}
                        title={
                          acende
                            ? combo.texto
                            : `${combo.texto} — falta o companheiro exigido nesta investida`
                        }
                      >
                        <b>{def.nome}</b>
                        <span>{combo.texto}</span>
                        {!acende && <i>não acende</i>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {rascunho.length > 0 && (
                <div className="emp-rascunho">
                  {rascunho.map((c, i) => (
                    <div key={i} className="emp-rascunho-item">
                      <b>{infoDaSala(view.rooms[c.slot]!.tileId).nome}</b>
                      <span>
                        {c.charInstIds.length} un. · {ORDEM_INFO[c.ordem].nome}
                      </span>
                      <button
                        type="button"
                        className="emp-mini"
                        onClick={() => setRascunho(rascunho.filter((_, j) => j !== i))}
                      >
                        remover
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button type="button" className="emp-btn confirmar" onClick={confirmar}>
                Confirmar comprometimento
                {rascunho.length === 0 && ' (não enviar ninguém)'}
              </button>
            </>
          )}
        </section>
      )}

      {/* ── Última resolução ── */}
      {view.ultimaResolucao && view.ultimaResolucao.length > 0 && (
        <section className="emp-painel resolucao">
          <div className="emp-secao-aba">
            <IconeTermo nome="poder" tam={11} /> Resolução
          </div>
          <h3>
            O portão se abriu
            <button
              type="button"
              className="emp-mini"
              onClick={() => setReplay((n) => n + 1)}
              title="Rever a resolução desta rodada"
            >
              ↻ rever
            </button>
          </h3>
          <div className="emp-confrontos" key={replay}>
            {view.ultimaResolucao.map((r, i) => (
              <Confronto
                key={`${r.slot}-${replay}`}
                res={r}
                indice={i}
                nomeDe={nomeDe}
                tileNome={infoDaSala(r.tileId).nome}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Consumíveis e log ── */}
      {(meuClan?.consumiveis?.length ?? 0) > 0 && (
        <section className="emp-painel">
          <h4>Seus consumíveis</h4>
          <div className="emp-consumiveis">
            {meuClan!.consumiveis!.map((id, i) => {
              const d = CONSUMABLE_BY_ID.get(id);
              return (
                <span key={`${id}-${i}`} className="emp-consumivel" title={d?.efeito}>
                  {d?.nome ?? id}
                </span>
              );
            })}
          </div>
        </section>
      )}

      {zoom && (
        <CartaAmpliada inst={zoom.inst} clan={zoom.clan} onFechar={() => setZoom(null)} />
      )}

      <Glossario />

      <section className="emp-log">
        {view.log.slice(-14).map((l, i) => (
          <div key={i} className={l.startsWith('—') ? 'marco' : undefined}>
            {humanizar(l)}
          </div>
        ))}
      </section>

      <GameChat />
    </div>
  );
}
