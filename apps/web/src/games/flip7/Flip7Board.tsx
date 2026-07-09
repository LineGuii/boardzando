import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
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
  lastEvent?: string;
  lastRound?: { gained: Record<string, number>; busted: string[]; flip7By?: string };
  targetScore: number;
  winnerId?: string;
  finished?: boolean;
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
    </div>
  );
}
