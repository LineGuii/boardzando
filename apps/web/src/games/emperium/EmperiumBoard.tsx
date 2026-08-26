import { useMemo, useState } from 'react';
import {
  CHARACTER_BY_ID,
  CONSUMABLE_BY_ID,
  EQUIP_BY_ID,
  TRANSCENDENCIA_BY_ID,
  caminhosDaClasse,
  rotuloKeyword,
  type CharacterDef,
  type Keyword,
} from '@boardzando/contracts';
import { useGame } from '../../net/store';
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

const TILE_NOMES: Record<string, string> = {
  'sala-portao': 'Portão Principal',
  'sala-trono': 'Salão do Trono',
  'sala-emperium': 'Sala do Emperium',
  'sala-corredor': 'Corredor Estreito',
  'sala-patio': 'Pátio Aberto',
  'sala-ponte': 'Ponte sobre o Fosso',
  'sala-labirinto': 'Labirinto',
  'sala-guardioes': 'Salão dos Guardiões',
  'sala-armazem': 'Armazém',
  'sala-forja': 'Forja',
  'sala-capela': 'Capela',
  'sala-vigia': 'Torre de Vigia',
  'sala-cripta': 'Cripta',
  'sala-portal': 'Portal Rúnico',
  'sala-terraco': 'Terraço',
};

const ORDEM_INFO: Record<OrderId, { nome: string; efeito: string }> = {
  investida: { nome: 'Investida', efeito: '+3 Poder. Se perder, 1 baixa extra.' },
  cerco: { nome: 'Cerco', efeito: 'Ignora o limite da sala. −1 Poder.' },
  emboscada: { nome: 'Emboscada', efeito: 'Resolve antes. +2 se for a única; −2 se houver outra.' },
  resguardo: { nome: 'Resguardo', efeito: '−2 Poder. Sem baixas. +3 zeny.' },
};

const kwLabel = (k: Keyword): string => rotuloKeyword(k);

/* ── Carta de personagem ─────────────────────────────────────────────────── */

function CharCard({
  def,
  inst,
  clan,
  selecionado,
  onClick,
  compacto,
}: {
  def: CharacterDef;
  inst?: CharInstanceV;
  clan?: ClanV;
  selecionado?: boolean;
  onClick?: () => void;
  compacto?: boolean;
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

  return (
    <button
      type="button"
      className={`emp-card ${selecionado ? 'sel' : ''} ${compacto ? 'compacto' : ''} ${
        trans ? 'transcendido' : ''
      }`}
      data-papel={def.papel}
      onClick={onClick}
      disabled={!onClick}
    >
      <span className="emp-card-band" />
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
            <span key={k.kw} className="emp-chip">
              {kwLabel(k)}
            </span>
          ))}
          {trans?.keywords.map((k) => (
            <span key={`tr-${k.kw}`} className="emp-chip asc" title="Ganha na Transcendência">
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
                {eq.encaixadas.length > 0 && <i> ◈{eq.encaixadas.length}</i>}
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

  return (
    <div className="emp-confronto" style={{ '--i': indice } as React.CSSProperties}>
      <div className="emp-conf-cab">
        <span className="emp-conf-sala">{tileNome}</span>
        {res.escudo !== undefined && <span className="emp-conf-escudo">escudo {res.escudo}</span>}
      </div>

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
                    ⚡ {f.combo.replace(/^COMBO[^:]*:\s*/, '')}
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
                      {m}
                    </span>
                  ))}
                  {f.baixas.length > 0 && (
                    <span className="emp-lut-baixa">
                      {f.baixas.length} {f.baixas.length === 1 ? 'baixa' : 'baixas'}
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
    const exige = combo.exige;
    const acende =
      exige.tipo === 'nenhum' ||
      selecionados.some((outroId) => {
        if (outroId === instId) return false;
        const o = meuClan?.chars[outroId];
        const od = o ? CHARACTER_BY_ID.get(o.defId) : undefined;
        if (!od) return false;
        return exige.tipo === 'classe' ? od.classe === exige.valor : od.papel === exige.valor;
      });
    return [{ instId, def, combo, acende }];
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

  /* ── Layout do castelo ── */
  const linear = !view.slots.includes('c1');
  const fileiras: RoomSlot[][] = linear
    ? [['emperium'], ['trono'], ['b2'], ['b1'], ['portao']]
    : [['emperium'], ['trono'], ['b2', 'c2'], ['b1', 'c1'], ['portao']];

  return (
    <div className="emp-board">
      {/* ── Cabeçalho ── */}
      <header className="emp-header">
        <div className="emp-round">
          <em>Rodada</em>
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
          <em>Emperium</em>
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
        {view.altarAberto && <span className="emp-trans">Altar aberto</span>}
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
                  <em>Glória</em>
                  <b>{c.gloria}</b>
                </span>
                <span>
                  <em>Zeny</em>
                  <b>{c.zeny}z</b>
                </span>
                <span>
                  <em>Reserva</em>
                  <b>{reserva}</b>
                </span>
                <span>
                  <em>Enfermaria</em>
                  <b>{enfermaria}</b>
                </span>
                <span>
                  <em>Ordens</em>
                  <b>{c.ordensRestantes}</b>
                </span>
              </div>
            </div>
          );
        })}
      </section>

      {/* ── Castelo ── */}
      <section className="emp-castelo">
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
                return (
                  <div
                    key={slot}
                    className={`emp-sala ${slot === 'emperium' ? 'emperium' : ''} ${
                      permitida ? 'permitida' : ''
                    } ${dist > 0 ? 'marcha' : ''} ${slotAlvo === slot ? 'alvo' : ''}`}
                  >
                    <div className="emp-sala-nome">{TILE_NOMES[r.tileId] ?? r.tileId}</div>
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
                        {r.guardioesDefensor > 0 && `${r.guardioesDefensor} guardião(ões)`}
                        {r.guarnicaoFixa > 0 && ` guarnição ${r.guarnicaoFixa}`}
                      </div>
                    )}
                    {meuCommit && (
                      <div className="emp-sala-commit">
                        {meuCommit.charInstIds.length} un. · {ORDEM_INFO[meuCommit.ordem].nome}
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
      </section>

      {/* ── Fase: Mercado ── */}
      {view.step === 'mercado' && (
        <section className="emp-painel">
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
                                  <span key={k.kw} className="emp-chip asc">
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
                          {TILE_NOMES[view.rooms[s]!.tileId] ?? s} ({view.rooms[s]!.guardioesDefensor})
                        </option>
                      ))}
                  </select>
                  <select value={guardiaoPara} onChange={(e) => setGuardiaoPara(e.target.value)}>
                    <option value="">para...</option>
                    {view.slots
                      .filter((s) => s !== guardiaoDe)
                      .map((s) => (
                        <option key={s} value={s}>
                          {TILE_NOMES[view.rooms[s]!.tileId] ?? s}
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
        <section className="emp-painel">
          <h3>
            Comprometimento — {jaConfirmei ? 'aguardando os outros clãs' : 'monte sua investida'}
            <span className="emp-acoes">
              {view.confirmados.length}/{view.order.length} prontos
            </span>
          </h3>

          {!jaConfirmei && (
            <>
              <p className="emp-dica">
                Escolha personagens da Reserva, uma sala e uma Ordem. Você tem 4 Ordens e cada uma
                só vale uma vez por rodada — comprometer em quatro salas significa gastar Resguardo
                onde você queria Investida.
              </p>
              <p className="emp-dica">
                <b>Toda sala do castelo é alcançável.</b> Ir além da sua linha de frente é uma{' '}
                <b>Marcha Forçada</b>: você chega disperso, a −{view.marchaPenalidade ?? 2} de Poder
                por sala de distância. Tomar uma sala aproxima a linha e barateia a próxima.
              </p>

              <h4>Sua Reserva</h4>
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
                  <em>Sala</em>
                  <b>{slotAlvo ? (TILE_NOMES[view.rooms[slotAlvo]!.tileId] ?? slotAlvo) : '—'}</b>
                </div>
                <div>
                  <em>Marcha</em>
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
                  <b>{selecionados.length}</b>
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
                  disabled={!slotAlvo || !ordemAlvo || selecionados.length === 0}
                  onClick={adicionarAoRascunho}
                >
                  Adicionar investida
                </button>
              </div>

              {/* Só UM combo dispara por sala — você declara qual. */}
              {combosDisponiveis.length > 0 && (
                <div className="emp-combos">
                  <span className="emp-combos-rot">
                    Combo desta investida — só um dispara
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
                      <b>{TILE_NOMES[view.rooms[c.slot]!.tileId] ?? c.slot}</b>
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
        <section className="emp-painel">
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
                tileNome={TILE_NOMES[r.tileId] ?? r.slot}
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
