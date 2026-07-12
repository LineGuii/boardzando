import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useGame } from '../../net/store';
import './flip7.css';

type Status = 'active' | 'stayed' | 'busted' | 'frozen';
interface PlayerView {
  numbers: number[];
  modifiers: string[];
  secondChance: boolean;
  status: Status;
}
interface Flip7View {
  round: number;
  order: string[];
  players: Record<string, PlayerView>;
  totals: Record<string, number>;
  turnPlayerId: string;
  dealerId: string;
  pending?:
    | { kind: 'action'; action: 'freeze' | 'flip3'; chooser: string }
    | { kind: 'giveSecond'; chooser: string };
  deckCount: number;
  discardCount: number;
  discard: {
    numbers: number[];
    modifiers: Record<string, number>;
    actions: Record<string, number>;
    total: number;
  };
  lastEvent?: string;
  lastRound?: { gained: Record<string, number>; busted: string[]; flip7By?: string };
  lastBust?: { playerId: string; value: number; seq: number };
  roundEndSeq: number;
  targetScore: number;
  winnerId?: string;
  finished?: boolean;
}

/** Contador animado (conta de `from` até `to` com ease-out). */
function CountUp({ from, to, duration = 1100 }: { from: number; to: number; duration?: number }): JSX.Element {
  const [val, setVal] = useState(from);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number): void => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to, duration]);
  return <>{val}</>;
}

const NUM_WORDS = [
  'ZERO', 'UM', 'DOIS', 'TRÊS', 'QUATRO', 'CINCO', 'SEIS',
  'SETE', 'OITO', 'NOVE', 'DEZ', 'ONZE', 'DOZE',
];
const NUM_COLORS = [
  '#d6336c', '#1c7ed6', '#2f9e44', '#e8590c', '#7048e8', '#0ca678', '#c2255c',
  '#1098ad', '#e67700', '#5f3dc4', '#d6336c', '#1864ab', '#343a40',
];

/** Sons curtos via Web Audio (sem arquivo). */
function beep(freq: number, type: OscillatorType, dur: number, gain = 0.15, slideTo?: number): void {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const c = new Ctor();
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.linearRampToValueAtTime(gain, c.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    osc.connect(g);
    g.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + dur + 0.02);
    setTimeout(() => void c.close(), (dur + 0.1) * 1000);
  } catch {
    /* silencioso */
  }
}
const sfxFlip = (): void => beep(720, 'triangle', 0.08, 0.12, 1080);
const sfxBust = (): void => beep(200, 'sawtooth', 0.3, 0.16, 90);
const sfxFlip7 = (): void => {
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 'triangle', 0.18, 0.18), i * 90));
};

/** Uma carta de número (arte inspirada na oficial: moldura art déco + número grande). */
function NumberCard({ value, small }: { value: number; small?: boolean }): JSX.Element {
  const color = NUM_COLORS[value] ?? '#333';
  return (
    <div className={`f7-card f7-number ${small ? 'small' : ''}`} style={{ '--c': color } as CSSProperties}>
      <span className="f7-frame" aria-hidden />
      <span className="f7-fan f7-fan-tl" aria-hidden />
      <span className="f7-fan f7-fan-br" aria-hidden />
      <span className="f7-num" style={{ color }}>{value}</span>
      {!small && <span className="f7-word" style={{ color }}>{NUM_WORDS[value]}</span>}
    </div>
  );
}
function ModifierCard({ mod, small }: { mod: string; small?: boolean }): JSX.Element {
  return (
    <div className={`f7-card f7-modifier ${small ? 'small' : ''}`}>
      <span className="f7-frame light" aria-hidden />
      <span className="f7-mod">{mod === 'x2' ? '×2' : mod}</span>
      {!small && <span className="f7-mod-sub">SOMA DAS SUAS CARTAS</span>}
    </div>
  );
}
function ActionCard({ action, small }: { action: 'freeze' | 'flip3' | 'second'; small?: boolean }): JSX.Element {
  const meta = {
    freeze: { cls: 'freeze', icon: '🔒', label: 'CONGELAR', sub: 'em um jogador ativo' },
    flip3: { cls: 'flip3', icon: '🎴', label: 'VIRAR 3', sub: 'em um jogador ativo' },
    second: { cls: 'second', icon: '❤️', label: 'SEGUNDA', sub: 'CHANCE' },
  }[action];
  return (
    <div className={`f7-card f7-action ${meta.cls} ${small ? 'small' : ''}`}>
      <span className="f7-frame light" aria-hidden />
      <span className="f7-action-icon">{meta.icon}</span>
      <span className="f7-action-label">{meta.label}</span>
      {!small && <span className="f7-action-sub">{meta.sub}</span>}
    </div>
  );
}

export function Flip7Board(): JSX.Element {
  const view = useGame((s) => s.view) as Flip7View | undefined;
  const session = useGame((s) => s.session);
  const room = useGame((s) => s.room);
  const socket = useGame((s) => s.socket);
  const currentPlayer = useGame((s) => s.currentPlayer);

  // sons a cada mudança de evento
  const prevEvent = useRef<string | undefined>(undefined);
  useEffect(() => {
    const ev = view?.lastEvent;
    if (ev && ev !== prevEvent.current) {
      if (/FLIP 7/.test(ev)) sfxFlip7();
      else if (/estourou/.test(ev)) sfxBust();
      else if (/virou|pegou|guardou/.test(ev)) sfxFlip();
    }
    prevEvent.current = ev;
  }, [view?.lastEvent]);

  // ---- animação de ESTOURO (bombástica, com a carta virada) ----
  // `null` = ainda não vimos nenhum estado (baseline no mount para não repetir
  // um estouro antigo ao reconectar).
  const [bustAnim, setBustAnim] = useState<{ playerId: string; value: number } | null>(null);
  const seenBust = useRef<number | null>(null);
  useEffect(() => {
    const seq = view?.lastBust?.seq ?? 0;
    if (seenBust.current === null) {
      seenBust.current = seq; // baseline: não anima o que já aconteceu antes de entrar
      return;
    }
    const b = view?.lastBust;
    if (b && b.seq !== seenBust.current) {
      seenBust.current = b.seq;
      setBustAnim({ playerId: b.playerId, value: b.value });
      const t = window.setTimeout(() => setBustAnim(null), 2800);
      return () => window.clearTimeout(t);
    }
    // dispara uma vez por estouro (chave = seq)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.lastBust?.seq]);

  // ---- animação de FIM DE RODADA (placar somando) ----
  const [roundAnim, setRoundAnim] = useState<{
    gained: Record<string, number>;
    before: Record<string, number>;
    after: Record<string, number>;
  } | null>(null);
  const seenRound = useRef<number | null>(null);
  useEffect(() => {
    if (!view) return;
    const seq = view.roundEndSeq ?? 0;
    if (seenRound.current === null) {
      seenRound.current = seq; // baseline no mount
      return;
    }
    if (seq !== seenRound.current && view.lastRound) {
      const gained = view.lastRound.gained;
      const after = view.totals;
      const before: Record<string, number> = {};
      for (const p of view.order) before[p] = (after[p] ?? 0) - (gained[p] ?? 0);
      setRoundAnim({ gained, before, after });
      const t = window.setTimeout(() => setRoundAnim(null), 3400);
      seenRound.current = seq;
      return () => window.clearTimeout(t);
    }
    seenRound.current = seq;
    // dispara uma vez por fim de rodada (chave = roundEndSeq)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.roundEndSeq]);

  if (!view || !session || !room) return <p>Aguardando estado...</p>;
  const me = session.playerId;
  const myTurn = currentPlayer === me;

  const nameOf = (pid: string): string =>
    room.players.find((p) => p.id === pid)?.name ?? pid.slice(0, 4);
  // troca os ids de jogador por nomes nas mensagens do servidor
  const pretty = (msg?: string): string | undefined =>
    msg ? view.order.reduce((s, pid) => s.split(pid).join(nameOf(pid)), msg) : undefined;
  const emit = (type: string, data: unknown): void => {
    socket?.emit('game:move', { roomId: session.roomId, type, data }, () => {});
  };

  const pending = view.pending;
  const iChoose = pending && pending.chooser === me && myTurn;
  const actives = view.order.filter((p) => view.players[p]!.status === 'active');

  const statusLabel: Record<Status, string> = {
    active: 'jogando',
    stayed: 'parou ✋',
    busted: 'estourou 💥',
    frozen: 'congelado ❄️',
  };

  const onTarget = (targetId: string): void => {
    if (!pending) return;
    emit(pending.kind === 'giveSecond' ? 'giveSecond' : 'resolveAction', { targetId });
  };

  return (
    <div className="f7-root">
      {/* cabeçalho */}
      <div className="f7-header">
        <div className="f7-logo">FLIP<span>7</span></div>
        <div className="f7-meta">
          <span className="f7-chip">Rodada {view.round}</span>
          <span className="f7-chip">🎯 alvo {view.targetScore}</span>
          <span className="f7-chip">🂠 {view.deckCount}</span>
        </div>
      </div>

      {view.lastEvent && <div className="f7-event">{pretty(view.lastEvent)}</div>}

      {/* barra de ação pendente (escolha de alvo) */}
      {iChoose && (
        <div className="f7-pending">
          <span>
            {pending!.kind === 'giveSecond'
              ? 'Passe a Segunda Chance extra para:'
              : pending!.kind === 'action' && pending!.action === 'freeze'
                ? 'Escolha quem CONGELAR:'
                : 'Escolha quem vira 3 cartas:'}
          </span>
          <div className="f7-target-btns">
            {actives
              .filter((p) => (pending!.kind === 'giveSecond' ? p !== me && !view.players[p]!.secondChance : true))
              .map((p) => (
                <button key={p} type="button" className="f7-target-btn" onClick={() => onTarget(p)}>
                  {nameOf(p)} {p === me ? '(você)' : ''}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* mesa dos jogadores */}
      <div className="f7-players">
        {view.order.map((pid) => {
          const p = view.players[pid]!;
          const isTurn = pid === currentPlayer;
          const isMe = pid === me;
          return (
            <div key={pid} className={`f7-player status-${p.status} ${isTurn ? 'turn' : ''} ${isMe ? 'mine' : ''}`}>
              {p.status === 'frozen' && (
                <div className="f7-frost" aria-hidden>
                  <span className="f7-frost-sheen" />
                  <span className="f7-icicles" />
                  <span className="f7-frost-stamp">❄️ CONGELADO</span>
                  {['❄', '❅', '❆', '❄', '❅', '❆'].map((s, i) => (
                    <span key={i} className={`f7-flake f${i}`}>{s}</span>
                  ))}
                </div>
              )}
              <div className="f7-player-head">
                <span className="f7-player-name">
                  {nameOf(pid)} {isMe ? '(você)' : ''} {pid === view.dealerId ? '🃏' : ''}
                </span>
                <span className={`f7-player-status s-${p.status}`}>{statusLabel[p.status]}</span>
                {p.secondChance && <span className="f7-sc" title="Tem Segunda Chance">❤️</span>}
                <span className="f7-player-total">{view.totals[pid] ?? 0} pts</span>
              </div>
              <div className="f7-line">
                {p.numbers.length === 0 && p.modifiers.length === 0 && (
                  <span className="f7-empty">— sem cartas —</span>
                )}
                {p.numbers.map((n, i) => (
                  <NumberCard key={`n${i}`} value={n} small />
                ))}
                {p.modifiers.map((mod, i) => (
                  <ModifierCard key={`m${i}`} mod={mod} small />
                ))}
              </div>
              <div className="f7-line-meta">
                {p.numbers.length}/7 números
                {p.numbers.length === 7 && ' · FLIP 7! 🎉'}
              </div>
            </div>
          );
        })}
      </div>

      {/* controles do jogador da vez */}
      {myTurn && !view.finished && view.players[me]!.status === 'active' && !pending && (
        <div className="f7-controls">
          <button type="button" className="f7-hit" onClick={() => emit('hit', {})}>
            🎴 Virar carta (Hit)
          </button>
          <button type="button" className="f7-stay" onClick={() => emit('stay', {})}>
            ✋ Parar (Stay)
          </button>
        </div>
      )}
      {!myTurn && !view.finished && (
        <p className="f7-wait">Vez de <b>{nameOf(currentPlayer ?? '')}</b>…</p>
      )}

      {/* monte de descarte (para "contar cartas") */}
      <details className="f7-discard">
        <summary>
          🗑️ Monte de descarte — <b>{view.discard.total}</b> carta(s) já jogadas
        </summary>
        <p className="f7-discard-help">
          Quantas de cada carta já saíram nesta leva (o monte volta ao baralho
          quando ele acaba). Use para pesar suas chances antes de virar!
        </p>
        <div className="f7-discard-numbers">
          {view.discard.numbers.map((count, value) => {
            const total = value === 0 || value === 1 ? 1 : value;
            return (
              <div key={value} className={`f7-dtile ${count === 0 ? 'none' : ''}`}>
                <span className="f7-dtile-num" style={{ color: NUM_COLORS[value] }}>{value}</span>
                <span className="f7-dtile-count">
                  <b>{count}</b>/{total}
                </span>
              </div>
            );
          })}
        </div>
        <div className="f7-discard-others">
          <div className="f7-discard-group">
            <span className="f7-discard-glabel">Modificadores:</span>
            {(['+2', '+4', '+6', '+8', '+10', 'x2'] as const).map((mod) => (
              <span key={mod} className={`f7-dchip mod ${(view.discard.modifiers[mod] ?? 0) === 0 ? 'none' : ''}`}>
                {mod === 'x2' ? '×2' : mod} <b>{view.discard.modifiers[mod] ?? 0}</b>/1
              </span>
            ))}
          </div>
          <div className="f7-discard-group">
            <span className="f7-discard-glabel">Ações:</span>
            {([['freeze', '🔒 Congelar'], ['flip3', '🎴 Virar 3'], ['second', '❤️ 2ª Chance']] as const).map(
              ([k, label]) => (
                <span key={k} className={`f7-dchip act ${(view.discard.actions[k] ?? 0) === 0 ? 'none' : ''}`}>
                  {label} <b>{view.discard.actions[k] ?? 0}</b>/3
                </span>
              ),
            )}
          </div>
        </div>
      </details>

      {/* legenda de cartas */}
      <details className="f7-legend">
        <summary>Cartas do jogo</summary>
        <div className="f7-legend-row">
          <NumberCard value={7} />
          <ModifierCard mod="+10" />
          <ModifierCard mod="x2" />
          <ActionCard action="freeze" />
          <ActionCard action="flip3" />
          <ActionCard action="second" />
        </div>
      </details>

      {/* ---- OVERLAY: estouro (bombástico) — via portal p/ sair do TurnGate ---- */}
      {bustAnim &&
        createPortal(
          <div className="f7-bust-overlay">
            <div className="f7-bust-flash" />
            {Array.from({ length: 16 }).map((_, i) => (
              <span key={i} className={`f7-shard s${i % 8}`} style={{ '--i': i } as CSSProperties} />
            ))}
            <div className="f7-bust-inner">
              <div className="f7-bust-boom">💥</div>
              <div className="f7-bust-title">ESTOUROU!</div>
              <div className="f7-bust-card">
                <NumberCard value={bustAnim.value} />
              </div>
              <div className="f7-bust-name">
                <b>{nameOf(bustAnim.playerId)}</b> virou outro <b>{bustAnim.value}</b> 😱
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* ---- OVERLAY: fim de rodada (placar somando) ---- */}
      {roundAnim &&
        createPortal(
          <div className="f7-round-overlay">
            <div className="f7-round-panel">
              <div className="f7-round-title">📊 Fim da rodada!</div>
              <ul className="f7-round-list">
                {[...view.order]
                  .sort((a, b) => (roundAnim.after[b] ?? 0) - (roundAnim.after[a] ?? 0))
                  .map((pid) => {
                    const g = roundAnim.gained[pid] ?? 0;
                    return (
                      <li key={pid} className="f7-round-row">
                        <span className="f7-round-name">{nameOf(pid)}</span>
                        <span className={`f7-round-gain ${g === 0 ? 'zero' : ''}`}>
                          {g === 0 ? (view.lastRound?.busted.includes(pid) ? '💥 0' : '+0') : `+${g}`}
                        </span>
                        <span className="f7-round-total">
                          <CountUp from={roundAnim.before[pid] ?? 0} to={roundAnim.after[pid] ?? 0} />
                          <span className="f7-round-pts"> pts</span>
                        </span>
                      </li>
                    );
                  })}
              </ul>
              <div className="f7-round-goal">🎯 alvo: {view.targetScore}</div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
