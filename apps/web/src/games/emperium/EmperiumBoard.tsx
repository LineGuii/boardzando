import { useMemo, useState } from 'react';
import {
  CHARACTER_BY_ID,
  CONSUMABLE_BY_ID,
  EQUIP_BY_ID,
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
  consumivel?: string;
  pagarCarrocerada?: boolean;
}
interface FactionResultV {
  playerId: string | null;
  poderBruto: number;
  poderFinal: number;
  ordem: OrderId | null;
  baixas: string[];
  venceu: boolean;
}
interface RoomResolutionV {
  slot: RoomSlot;
  tileId: string;
  faccoes: FactionResultV[];
  controlador: string | null;
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
  deckIILiberado: boolean;
  jogadorDoMercado: string | null;
  meusComprometimentos: CommitmentV[];
  confirmados: string[];
  salasPermitidas: RoomSlot[];
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

const kwLabel = (k: Keyword): string =>
  k.x === undefined ? k.kw.toUpperCase() : `${k.kw.toUpperCase()} ${k.x}`;

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

  return (
    <button
      type="button"
      className={`emp-card ${selecionado ? 'sel' : ''} ${compacto ? 'compacto' : ''}`}
      data-papel={def.papel}
      onClick={onClick}
      disabled={!onClick}
    >
      <span className="emp-card-band" />
      <span className="emp-card-nome">{def.nome}</span>
      <span className="emp-card-cls">
        {def.classe} · Deck {def.deck === 1 ? 'I' : 'II'}
      </span>
      <span className="emp-card-stats">
        <span className="emp-stat">
          <em>Custo</em>
          <b>{def.custo}z</b>
        </span>
        <span className="emp-stat pow">
          <em>Poder</em>
          <b>
            {def.poder}
            {equipsPoder > 0 && <i className="plus">+{equipsPoder}</i>}
          </b>
        </span>
        <span className="emp-slots">{'◇'.repeat(def.slots)}</span>
      </span>
      {def.keywords.length > 0 && (
        <span className="emp-kws">
          {def.keywords.map((k) => (
            <span key={k.kw} className="emp-chip">
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
      {!compacto && <span className="emp-card-build">{def.build}</span>}
    </button>
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

  const adicionarAoRascunho = () => {
    if (!slotAlvo || !ordemAlvo || selecionados.length === 0) return;
    setRascunho([...rascunho, { slot: slotAlvo, charInstIds: selecionados, ordem: ordemAlvo }]);
    setSelecionados([]);
    setSlotAlvo('');
    setOrdemAlvo('');
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
        {view.deckIILiberado && <span className="emp-trans">Transcendência liberada</span>}
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
                const meuCommit = rascunho.find((c) => c.slot === slot);
                return (
                  <div
                    key={slot}
                    className={`emp-sala ${slot === 'emperium' ? 'emperium' : ''} ${
                      permitida ? 'permitida' : ''
                    } ${slotAlvo === slot ? 'alvo' : ''}`}
                  >
                    <div className="emp-sala-nome">{TILE_NOMES[r.tileId] ?? r.tileId}</div>
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
          <h3>Última resolução</h3>
          <div className="emp-resolucoes">
            {view.ultimaResolucao.map((r) => (
              <div key={r.slot} className="emp-resolucao">
                <div className="emp-res-sala">
                  {TILE_NOMES[r.tileId] ?? r.slot}
                  {r.escudo !== undefined && <span> · escudo {r.escudo}</span>}
                </div>
                {r.faccoes.map((f, i) => (
                  <div key={i} className={`emp-res-fac ${f.venceu ? 'venceu' : ''}`}>
                    <span className="emp-res-nome">{nomeDe(f.playerId)}</span>
                    <span className="emp-res-poder">
                      {f.poderBruto}
                      {f.poderFinal !== f.poderBruto && <b> → {f.poderFinal}</b>}
                    </span>
                    {f.ordem && <span className="emp-res-ordem">{ORDEM_INFO[f.ordem].nome}</span>}
                    {f.baixas.length > 0 && (
                      <span className="emp-res-baixas">{f.baixas.length} baixa(s)</span>
                    )}
                    {r.danoPorJogador && f.playerId && (
                      <span className="emp-res-dano">
                        {r.danoPorJogador[f.playerId] ?? 0} de dano
                      </span>
                    )}
                  </div>
                ))}
                {r.emperiumQuebrado && (
                  <div className="emp-quebrou">
                    EMPERIUM QUEBRADO — {nomeDe(r.novoDono ?? null)} tomou o castelo
                  </div>
                )}
              </div>
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
        {view.log.slice(-8).map((l, i) => (
          <div key={i}>{humanizar(l)}</div>
        ))}
      </section>

      <GameChat />
    </div>
  );
}
