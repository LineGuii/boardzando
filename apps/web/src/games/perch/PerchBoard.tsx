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
interface CreatureView {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  move: 'adjacent' | 'range2' | 'range3' | 'anywhere';
  effect: 'removeBirds' | 'moveBird' | 'swapBirds' | 'pullBird' | 'pullAdjacent';
  n?: number;
  homeLocId?: string;
  standeeLocId?: string;
  controller?: string;
  activatedThisRound: boolean;
}
interface PerchView {
  round: number;
  maxRounds: number;
  step: 'perch' | 'done';
  turnOrder: string[];
  placedThisTurn: boolean;
  bonusThisTurn: boolean;
  adjacency: Record<string, string[]>;
  creatures: Record<string, CreatureView>;
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

const maxStepsOf = (m: CreatureView['move']): number =>
  m === 'adjacent' ? 1 : m === 'range2' ? 2 : m === 'range3' ? 3 : Infinity;

function reachable(adj: Record<string, string[]>, start: string, steps: number): Set<string> {
  if (!Number.isFinite(steps)) {
    const all = new Set(Object.keys(adj));
    all.delete(start);
    return all;
  }
  const seen = new Set([start]);
  let frontier = [start];
  for (let s = 0; s < steps; s++) {
    const next: string[] = [];
    for (const id of frontier)
      for (const nb of adj[id] ?? [])
        if (!seen.has(nb)) {
          seen.add(nb);
          next.push(nb);
        }
    frontier = next;
  }
  seen.delete(start);
  return seen;
}

/** Estado da ativação guiada de uma criatura. */
interface ActivateState {
  creatureId: string;
  dest?: string;
  targetFlock?: string;
  secondLoc?: string;
}

export function PerchBoard(): JSX.Element {
  const view = useGame((s) => s.view) as PerchView | undefined;
  const session = useGame((s) => s.session);
  const room = useGame((s) => s.room);
  const socket = useGame((s) => s.socket);
  const currentPlayer = useGame((s) => s.currentPlayer);

  const [selected, setSelected] = useState<number | null>(null);
  const [act, setAct] = useState<ActivateState | null>(null);

  if (!view || !session || !room) return <p>Aguardando estado...</p>;
  const me = session.playerId;
  const myTurn = currentPlayer === me;

  const nameOf = (pid: string): string =>
    room.players.find((p) => p.id === pid)?.name ?? pid.slice(0, 4);
  const hex = (flock: string): string => view.flockHex[flock] ?? '#888';
  const myFlock = view.flockOf[me];

  const emit = (type: string, data: unknown): void => {
    socket?.emit('game:move', { roomId: session.roomId, type, data }, () => {});
  };

  // criaturas que EU controlo e ainda posso ativar nesta vez
  const myCreatures = Object.values(view.creatures).filter(
    (c) => c.controller === me && !c.activatedThisRound && c.standeeLocId !== undefined,
  );
  const canBonus = myTurn && !view.bonusThisTurn && myCreatures.length > 0;

  const activeCreature = act ? view.creatures[act.creatureId] : undefined;
  const reachSet =
    activeCreature && activeCreature.standeeLocId
      ? reachable(view.adjacency, activeCreature.standeeLocId, maxStepsOf(activeCreature.move))
      : new Set<string>();

  const resetActions = (): void => {
    setSelected(null);
    setAct(null);
  };

  const placeBird = (locationId: string): void => {
    if (selected === null || !myTurn || view.placedThisTurn) return;
    emit('placeBird', { locationId, birdIndex: selected });
    playChirp();
    resetActions();
  };

  const finishCreature = (a: ActivateState, extra: Record<string, unknown>): void => {
    emit('activateCreature', { creatureId: a.creatureId, toLocationId: a.dest, ...extra });
    playChirp();
    resetActions();
  };

  // clique num Local: ou está no fluxo de criatura, ou coloca a ave.
  const onLocationClick = (locId: string): void => {
    if (act && activeCreature) {
      handleCreatureClick(locId);
      return;
    }
    placeBird(locId);
  };

  // máquina de estados da ativação de criatura
  const handleCreatureClick = (locId: string): void => {
    if (!act || !activeCreature) return;
    const eff = activeCreature.effect;
    if (act.dest === undefined) {
      if (!reachSet.has(locId)) return; // destino precisa ser alcançável
      // efeitos que só precisam do destino + flock resolvem o flock a seguir
      setAct({ ...act, dest: locId });
      return;
    }
    // já temos destino; o próximo clique é o Local secundário (mover/trocar/atrair)
    if ((eff === 'moveBird' || eff === 'pullAdjacent' || eff === 'swapBirds' || eff === 'pullBird') && !act.secondLoc) {
      setAct({ ...act, secondLoc: locId });
    }
  };

  const cols = Math.max(...view.homestead.map((l) => l.col)) + 1;
  const columns: PerchLoc[][] = Array.from({ length: cols }, () => []);
  for (const l of view.homestead) columns[l.col]!.push(l);
  for (const c of columns) c.sort((a, b) => a.row - b.row);

  const creatureAt = (locId: string): CreatureView[] =>
    Object.values(view.creatures).filter((c) => c.standeeLocId === locId);

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

      {/* banner do fluxo de ativação */}
      {act && activeCreature && (
        <div className="perch-actbar">
          <span>
            {activeCreature.emoji} <b>{activeCreature.name}</b>:{' '}
            {act.dest === undefined
              ? 'clique num Local destacado (destino).'
              : creatureNeedsSecond(activeCreature.effect) && !act.secondLoc
                ? 'escolha o Local secundário.'
                : 'escolha a ave-alvo abaixo.'}
          </span>
          <button type="button" className="perch-act-cancel" onClick={resetActions}>
            Cancelar
          </button>
        </div>
      )}

      {/* homestead */}
      <div className="perch-homestead" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {columns.map((col, ci) => (
          <div key={ci} className="perch-column">
            {col.map((loc) => {
              const counts = view.birdsAt[loc.id] ?? {};
              const controller = controllerOf(counts);
              const scored = view.lastScored?.[loc.id];
              const placeable = selected !== null && myTurn && !view.placedThisTurn && !act;
              const isReach = act !== null && reachSet.has(loc.id) && act.dest === undefined;
              const isDest = act?.dest === loc.id;
              const creatures = creatureAt(loc.id);
              return (
                <button
                  key={loc.id}
                  type="button"
                  className={`perch-loc ${placeable ? 'placeable' : ''} ${isReach ? 'reach' : ''} ${isDest ? 'dest' : ''}`}
                  onClick={() => onLocationClick(loc.id)}
                  disabled={!placeable && !isReach && !(act && act.dest !== undefined)}
                >
                  <div className="perch-loc-head">
                    <span className="perch-loc-emoji">{loc.emoji}</span>
                    <span className="perch-loc-name">{loc.name}</span>
                    {creatures.map((c) => (
                      <span key={c.id} className="perch-standee" title={c.name}>
                        {c.emoji}
                      </span>
                    ))}
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
                      .map(([flock, n]) => {
                        const pickable =
                          act?.dest !== undefined &&
                          activeCreature !== undefined &&
                          birdPickTarget(act, activeCreature, loc.id);
                        return (
                          <span
                            key={flock}
                            className={`perch-birdchip ${controller === flock ? 'controls' : ''} ${pickable ? 'pickable' : ''}`}
                            style={{ background: hex(flock) }}
                            title={`${n} ave(s)`}
                            onClick={
                              pickable
                                ? (e) => {
                                    e.stopPropagation();
                                    pickBird(loc.id, flock);
                                  }
                                : undefined
                            }
                          >
                            {controller === flock ? '👑' : '🐦'} {n}
                            {scored && scored[flock] ? (
                              <span className="perch-award">+{scored[flock]}</span>
                            ) : null}
                          </span>
                        );
                      })}
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

      {/* suas criaturas */}
      {Object.values(view.creatures).some((c) => c.controller === me) && (
        <div className="perch-creatures">
          <div className="perch-creatures-title">Suas criaturas 🐾</div>
          <div className="perch-creatures-row">
            {Object.values(view.creatures)
              .filter((c) => c.controller === me)
              .map((c) => (
                <div key={c.id} className={`perch-creature ${c.activatedThisRound ? 'done' : ''}`}>
                  <span className="perch-creature-emoji">{c.emoji}</span>
                  <div className="perch-creature-info">
                    <b>{c.name}</b>
                    <span className="perch-creature-desc">{c.desc}</span>
                  </div>
                  <button
                    type="button"
                    className="perch-creature-btn"
                    disabled={!canBonus || c.activatedThisRound || act !== null}
                    onClick={() => setAct({ creatureId: c.id })}
                  >
                    {c.activatedThisRound ? '✓ usada' : 'Ativar'}
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* minha mão + ações da vez */}
      <div className="perch-hand">
        <div className="perch-hand-label">
          {myTurn
            ? view.placedThisTurn
              ? 'Ave colocada. Ative uma criatura ou encerre a vez.'
              : 'Sua vez — selecione uma ave e clique num Local'
            : `Vez de ${nameOf(currentPlayer ?? '')}`}
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
              disabled={view.placedThisTurn || act !== null}
              title={flock === myFlock ? 'Sua cor' : 'Ave de outro bando'}
            >
              🐦
              {flock !== myFlock && <span className="perch-foreign">alheia</span>}
            </button>
          ))}
        </div>
        {myTurn && view.placedThisTurn && (
          <button type="button" className="perch-endturn" onClick={() => emit('endTurn', {})}>
            Encerrar vez ▶
          </button>
        )}
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

  // ---- helpers de ativação (fecham sobre `act`/`view`) ----

  function creatureNeedsSecond(effect: CreatureView['effect']): boolean {
    return effect === 'moveBird' || effect === 'pullAdjacent' || effect === 'swapBirds' || effect === 'pullBird';
  }

  /** Uma ave é clicável agora? Depende do efeito e da etapa. */
  function birdPickTarget(a: ActivateState, cr: CreatureView, locId: string): boolean {
    if (a.dest === undefined) return false;
    const eff = cr.effect;
    if (eff === 'removeBirds') return locId === a.dest; // escolhe qual bando remover no destino
    if (eff === 'moveBird') return a.secondLoc !== undefined && locId === a.dest; // move do destino
    if (eff === 'pullAdjacent' || eff === 'pullBird')
      return a.secondLoc !== undefined && locId === a.secondLoc; // pega do secundário
    if (eff === 'swapBirds') return locId === a.dest || (a.secondLoc !== undefined && locId === a.secondLoc);
    return false;
  }

  function pickBird(locId: string, flock: string): void {
    if (!act || !activeCreature) return;
    const eff = activeCreature.effect;
    if (eff === 'removeBirds') {
      finishCreature(act, { targetFlock: flock });
    } else if (eff === 'moveBird') {
      finishCreature(act, { targetFlock: flock, secondLocationId: act.secondLoc });
    } else if (eff === 'pullAdjacent' || eff === 'pullBird') {
      finishCreature(act, { targetFlock: flock, secondLocationId: act.secondLoc });
    } else if (eff === 'swapBirds') {
      if (locId === act.dest && !act.targetFlock) {
        setAct({ ...act, targetFlock: flock });
      } else if (act.secondLoc && locId === act.secondLoc && act.targetFlock) {
        finishCreature(act, {
          targetFlock: act.targetFlock,
          secondLocationId: act.secondLoc,
          secondFlock: flock,
        });
      }
    }
  }
}
