import { useState } from 'react';
import { useGame } from '../../net/store';
import './perch.css';

interface PerchLoc {
  id: string;
  defId: string;
  name: string;
  emoji: string;
  points: [number, number, number];
  col: number;
  row: number;
}
interface PerchView {
  round: number;
  maxRounds: number;
  step: 'perch' | 'done';
  turnOrder: string[];
  flockOf: Record<string, string>;
  flockHex: Record<string, string>;
  homestead: PerchLoc[];
  birdsAt: Record<string, Record<string, number>>;
  scores: Record<string, number>;
  lastScored?: Record<string, Record<string, number>>;
  supply: Record<string, number>;
  myHand: string[];
  handCounts: Record<string, number>;
  bagCount: number;
  winnerId?: string;
  finished?: boolean;
}

/** Chirp curtinho via Web Audio (sem arquivo). */
function playChirp(): void {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const c = new Ctor();
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(900, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1500, c.currentTime + 0.08);
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.linearRampToValueAtTime(0.15, c.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.14);
    osc.connect(g);
    g.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + 0.16);
    setTimeout(() => void c.close(), 300);
  } catch {
    /* silencioso */
  }
}

/** Controlador de um Local = maioria isolada (empate no topo = ninguém). */
function controllerOf(counts: Record<string, number>): string | undefined {
  let max = 0;
  let leaders: string[] = [];
  for (const [f, n] of Object.entries(counts)) {
    if (n <= 0) continue;
    if (n > max) {
      max = n;
      leaders = [f];
    } else if (n === max) leaders.push(f);
  }
  return leaders.length === 1 ? leaders[0] : undefined;
}

export function PerchBoard(): JSX.Element {
  const view = useGame((s) => s.view) as PerchView | undefined;
  const session = useGame((s) => s.session);
  const room = useGame((s) => s.room);
  const socket = useGame((s) => s.socket);
  const currentPlayer = useGame((s) => s.currentPlayer);

  const [selected, setSelected] = useState<number | null>(null);

  if (!view || !session || !room) return <p>Aguardando estado...</p>;
  const me = session.playerId;

  const nameOf = (pid: string): string =>
    room.players.find((p) => p.id === pid)?.name ?? pid.slice(0, 4);
  const hex = (flock: string): string => view.flockHex[flock] ?? '#888';
  const myFlock = view.flockOf[me];

  const place = (locationId: string): void => {
    if (selected === null || currentPlayer !== me) return;
    socket?.emit('game:move', { roomId: session.roomId, type: 'placeBird', data: { locationId, birdIndex: selected } }, () => {});
    playChirp();
    setSelected(null);
  };

  // agrupa a homestead em colunas
  const cols = Math.max(...view.homestead.map((l) => l.col)) + 1;
  const columns: PerchLoc[][] = Array.from({ length: cols }, () => []);
  for (const l of view.homestead) columns[l.col]!.push(l);
  for (const c of columns) c.sort((a, b) => a.row - b.row);

  return (
    <div className="perch-root">
      {/* cabeçalho */}
      <div className="perch-header">
        <div className="perch-title">
          <span className="perch-logo">🐦</span>
          <div>
            <div className="perch-eyebrow">Perch — batalha das aves</div>
            <div className="perch-round">Rodada {view.round}/{view.maxRounds}</div>
          </div>
        </div>
        <div className="perch-turnorder">
          {view.turnOrder.map((pid, i) => (
            <span
              key={pid}
              className={`perch-turn-chip ${pid === currentPlayer ? 'current' : ''}`}
              title={`${i + 1}º na ordem`}
            >
              <span className="perch-dot" style={{ background: hex(view.flockOf[pid]!) }} />
              {nameOf(pid)}
            </span>
          ))}
        </div>
      </div>

      {/* homestead */}
      <div className="perch-homestead" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {columns.map((col, ci) => (
          <div key={ci} className="perch-column">
            {col.map((loc) => {
              const counts = view.birdsAt[loc.id] ?? {};
              const controller = controllerOf(counts);
              const scored = view.lastScored?.[loc.id];
              const canPlace = selected !== null && currentPlayer === me;
              return (
                <button
                  key={loc.id}
                  type="button"
                  className={`perch-loc ${canPlace ? 'placeable' : ''}`}
                  onClick={() => place(loc.id)}
                  disabled={!canPlace}
                >
                  <div className="perch-loc-head">
                    <span className="perch-loc-emoji">{loc.emoji}</span>
                    <span className="perch-loc-name">{loc.name}</span>
                  </div>
                  <div className="perch-loc-points" title="Pontos ao 1º / 2º / 3º">
                    {loc.points.map((p, i) => (
                      <span key={i} className={`perch-pts perch-pts-${i + 1}`}>
                        {i + 1}º <b>{p}</b>
                      </span>
                    ))}
                  </div>
                  <div className="perch-loc-birds">
                    {Object.entries(counts)
                      .filter(([, n]) => n > 0)
                      .sort((a, b) => b[1] - a[1])
                      .map(([flock, n]) => (
                        <span
                          key={flock}
                          className={`perch-birdchip ${controller === flock ? 'controls' : ''}`}
                          style={{ background: hex(flock) }}
                          title={`${n} ave(s)`}
                        >
                          {controller === flock ? '👑' : '🐦'} {n}
                          {scored && scored[flock] ? (
                            <span className="perch-award">+{scored[flock]}</span>
                          ) : null}
                        </span>
                      ))}
                    {Object.values(counts).every((n) => !n) && (
                      <span className="perch-loc-empty">vazio</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* minha mão */}
      <div className="perch-hand">
        <div className="perch-hand-label">
          Suas aves para colocar {currentPlayer === me ? '— selecione e clique num Local' : '(aguarde sua vez)'}
        </div>
        <div className="perch-hand-birds">
          {view.myHand.length === 0 && <span className="perch-loc-empty">— mão vazia —</span>}
          {view.myHand.map((flock, i) => (
            <button
              key={i}
              type="button"
              className={`perch-handbird ${selected === i ? 'selected' : ''}`}
              style={{ background: hex(flock), borderColor: hex(flock) }}
              onClick={() => setSelected(selected === i ? null : i)}
              title={flock === myFlock ? 'Sua cor' : 'Ave de outro bando'}
            >
              🐦
              {flock !== myFlock && <span className="perch-foreign">alheia</span>}
            </button>
          ))}
        </div>
      </div>

      {/* placar */}
      <div className="perch-scoreboard">
        <div className="perch-scoreboard-title">Placar</div>
        <ul className="perch-scores">
          {[...room.players]
            .sort((a, b) => (view.scores[b.id] ?? 0) - (view.scores[a.id] ?? 0))
            .map((p) => (
              <li key={p.id} className={`perch-score-row ${p.id === me ? 'mine' : ''}`}>
                <span className="perch-dot" style={{ background: hex(view.flockOf[p.id]!) }} />
                <span className="perch-score-name">
                  {nameOf(p.id)} {p.id === me ? '(você)' : ''}
                </span>
                <span className="perch-score-hand" title="aves restantes na mão">
                  ✋ {view.handCounts[p.id] ?? 0}
                </span>
                <span className="perch-score-points">{view.scores[p.id] ?? 0}</span>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}
