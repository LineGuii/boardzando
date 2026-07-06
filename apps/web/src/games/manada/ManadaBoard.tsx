import { useEffect, useRef, useState } from 'react';
import { useGame } from '../../net/store';
import { GameChat } from '../../shell/GameChat';
import { isMuted, playMoo, playMooWin, setMuted } from '../../shell/sfx';
import './manada.css';

interface ManadaAnswer {
  raw: string;
  norm: string;
}
interface ManadaLastRound {
  themeText: string;
  answers: Record<string, ManadaAnswer>;
  majorityNorm?: string;
  cowWinners: string[];
  tieAtTop: boolean;
  pinkCowTo?: string;
  bumpedTargetTo?: number;
}
interface ManadaView {
  options: { targetCows: number };
  roundIndex: number;
  step: 'answer' | 'reveal';
  theme: string;
  cowboyId: string;
  answered: string[];
  myAnswer?: string;
  cows: Record<string, number>;
  pinkCowHolder?: string;
  target: number;
  lastRound?: ManadaLastRound;
  winnerId?: string;
  finished?: boolean;
}

export function ManadaBoard(): JSX.Element {
  const view = useGame((s) => s.view) as ManadaView | undefined;
  const session = useGame((s) => s.session);
  const room = useGame((s) => s.room);
  const socket = useGame((s) => s.socket);

  const [answer, setAnswer] = useState('');
  const [muted, setMutedState] = useState(isMuted());

  // som ao revelar: muu-win se EU ganhei vaca, muu simples caso contrário
  const prevStep = useRef<'answer' | 'reveal' | null>(null);
  useEffect(() => {
    if (!view || !session) return;
    if (prevStep.current !== 'reveal' && view.step === 'reveal' && view.lastRound) {
      if (view.lastRound.cowWinners.includes(session.playerId)) playMooWin();
      else playMoo();
    }
    prevStep.current = view.step;
  }, [view, session]);

  // limpa o campo a cada nova rodada
  useEffect(() => {
    setAnswer('');
  }, [view?.roundIndex]);

  if (!view || !session || !room) return <p>Aguardando estado...</p>;
  const me = session.playerId;

  const emit = (type: string, data: unknown): void => {
    socket?.emit('game:move', { roomId: session.roomId, type, data }, () => {});
  };
  const toggleMute = (): void => {
    const m = !muted;
    setMuted(m);
    setMutedState(m);
  };

  const nameOf = (pid: string): string =>
    room.players.find((p) => p.id === pid)?.name ?? pid.slice(0, 4);
  const colorOf = (pid: string): string =>
    room.players.find((p) => p.id === pid)?.color ?? '#8a5a2b';

  const iAnswered = view.answered.includes(me);
  const cowboyName = nameOf(view.cowboyId);
  const iAmCowboy = view.cowboyId === me;

  const submit = (): void => {
    const t = answer.trim();
    if (t.length === 0 || t.length > 40) return;
    playMoo();
    emit('submitAnswer', { text: t });
  };
  const next = (): void => emit('nextRound', {});

  return (
    <div className="manada-root">
      {/* cabeçalho tema-vaca */}
      <div className="manada-header">
        <div className="manada-title">
          <span className="manada-cow" role="img" aria-label="Vaca">
            🐄
          </span>
          <div>
            <div className="manada-eyebrow">Efeito Manada · Rodada {view.roundIndex + 1}</div>
            <div className="manada-cowboy">
              <span className="manada-hat" aria-label="Vaqueiro da rodada">
                🤠
              </span>
              Vaqueiro: <b>{cowboyName}</b> {iAmCowboy ? '(você)' : ''}
            </div>
          </div>
        </div>
        <button
          type="button"
          className="manada-mute"
          onClick={toggleMute}
          title={muted ? 'Sons desligados' : 'Sons ligados'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>

      {/* carta de tema */}
      <div className="manada-theme-card">
        <span className="manada-theme-label">Pensem como a manada:</span>
        <span className="manada-theme-text">{view.theme}</span>
      </div>

      {/* fase de resposta */}
      {view.step === 'answer' && (
        <div className="manada-answer-zone">
          {iAnswered ? (
            <div className="manada-answered-box">
              <span className="manada-answered-mark">✍️</span>
              Sua resposta: <b>{view.myAnswer}</b>
              <div className="manada-answered-hint">Aguardando a manada… muuu!</div>
            </div>
          ) : (
            <div className="manada-answer-row">
              <input
                className="manada-input"
                type="text"
                maxLength={40}
                placeholder="escreva sua resposta em segredo…"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                autoFocus
              />
              <button
                type="button"
                className="manada-submit"
                onClick={submit}
                disabled={answer.trim().length === 0}
              >
                🐄 Responder
              </button>
            </div>
          )}
          <div className="manada-answered-badges">
            {room.players.map((p) => {
              const done = view.answered.includes(p.id);
              return (
                <span key={p.id} className={`manada-badge ${done ? 'done' : ''}`}>
                  <span className="manada-badge-dot" style={{ background: colorOf(p.id) }} />
                  {nameOf(p.id)} {done ? '✓' : '…'}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* fase de revelação */}
      {view.step === 'reveal' && view.lastRound && (
        <RevealPanel lr={view.lastRound} me={me} nameOf={nameOf} colorOf={colorOf} onNext={next} />
      )}

      {/* PLACAR: a cerca do curral com as manadas */}
      <FenceScoreboard
        players={room.players.map((p) => ({ id: p.id, color: colorOf(p.id) }))}
        view={view}
        me={me}
        nameOf={nameOf}
      />

      <GameChat />
    </div>
  );
}

// ---------------- Reveal ----------------

function RevealPanel({
  lr,
  me,
  nameOf,
  colorOf,
  onNext,
}: {
  lr: ManadaLastRound;
  me: string;
  nameOf: (pid: string) => string;
  colorOf: (pid: string) => string;
  onNext: () => void;
}): JSX.Element {
  // agrupa respostas por valor normalizado, maioria primeiro
  const groups = new Map<string, { norm: string; raw: string; players: string[] }>();
  for (const [pid, a] of Object.entries(lr.answers)) {
    const key = a.norm || `∅${pid}`; // vazias ficam isoladas
    const g = groups.get(key) ?? { norm: a.norm, raw: a.raw, players: [] };
    g.players.push(pid);
    groups.set(key, g);
  }
  const ordered = [...groups.values()].sort((a, b) => b.players.length - a.players.length);

  return (
    <div className="manada-reveal">
      <div className="manada-reveal-head">
        {lr.tieAtTop ? (
          <span className="manada-reveal-verdict tie">
            🤷 Empate de maioria — ninguém ganhou vaca nesta rodada!
          </span>
        ) : (
          <span className="manada-reveal-verdict win">
            🐄 A manada disse <b>“{lr.answers[lr.cowWinners[0]!]?.raw}”</b>!
          </span>
        )}
        {lr.pinkCowTo && (
          <span className="manada-reveal-pink">
            🐄💗 <b>{nameOf(lr.pinkCowTo)}</b> ficou sozinho e levou a Vaca Rosa!
          </span>
        )}
        {lr.bumpedTargetTo && (
          <span className="manada-reveal-bump">
            Empate no topo do placar — o alvo subiu para {lr.bumpedTargetTo} vacas!
          </span>
        )}
      </div>

      <div className="manada-groups">
        {ordered.map((g, i) => {
          const isMajority = !lr.tieAtTop && g.norm === lr.majorityNorm;
          return (
            <div key={i} className={`manada-group ${isMajority ? 'majority' : ''}`}>
              <div className="manada-group-answer">
                {g.raw || <i>(em branco)</i>}
                {isMajority && <span className="manada-group-cow">🐄 +1</span>}
              </div>
              <div className="manada-group-players">
                {g.players.map((pid) => (
                  <span key={pid} className="manada-group-player">
                    <span className="manada-badge-dot" style={{ background: colorOf(pid) }} />
                    {nameOf(pid)} {pid === me ? '(você)' : ''}
                    {pid === lr.pinkCowTo && ' 💗'}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <button className="manada-next" onClick={onNext}>
        ▶ Próxima rodada
      </button>
    </div>
  );
}

// ---------------- Placar / Cerca ----------------

function FenceScoreboard({
  players,
  view,
  me,
  nameOf,
}: {
  players: Array<{ id: string; color: string }>;
  view: ManadaView;
  me: string;
  nameOf: (pid: string) => string;
}): JSX.Element {
  const ranked = [...players].sort((a, b) => (view.cows[b.id] ?? 0) - (view.cows[a.id] ?? 0));
  return (
    <div className="manada-fence">
      <div className="manada-fence-rail" aria-hidden />
      <div className="manada-fence-title">
        🐄 Curral · alvo: {view.target} vacas
      </div>
      <ul className="manada-herds">
        {ranked.map((p) => {
          const cows = view.cows[p.id] ?? 0;
          const hasPink = view.pinkCowHolder === p.id;
          const isMe = p.id === me;
          const isCowboy = view.cowboyId === p.id;
          const won = view.winnerId === p.id;
          return (
            <li key={p.id} className={`manada-herd ${isMe ? 'mine' : ''} ${won ? 'won' : ''}`}>
              <div className="manada-herd-name">
                <span className="manada-badge-dot" style={{ background: p.color }} />
                {isCowboy && <span className="manada-hat-sm" title="Vaqueiro">🤠</span>}
                {nameOf(p.id)} {isMe ? '(você)' : ''}
                {won && ' 🏆'}
                <span className="manada-herd-count">
                  {cows}/{view.target}
                </span>
              </div>
              <div className="manada-herd-tokens">
                <CowTokens count={cows} />
                {hasPink && (
                  <span className="manada-pinkcow" title="Vaca Rosa: não pode vencer!">
                    <span className="manada-pinkcow-face">🐄</span>
                    <span className="manada-pinkcow-tag">não pode vencer 🚫</span>
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Fichas de vaca: como no físico, fichas de 3 vacas + fichas de 1 vaca. */
function CowTokens({ count }: { count: number }): JSX.Element {
  const threes = Math.floor(count / 3);
  const ones = count % 3;
  if (count === 0) return <span className="manada-no-cows">curral vazio</span>;
  return (
    <span className="manada-tokens">
      {Array.from({ length: threes }).map((_, i) => (
        <span key={`t3-${i}`} className="manada-token three" title="Ficha de 3 vacas">
          <span className="manada-token-cow">🐄</span>
          <span className="manada-token-num">3</span>
        </span>
      ))}
      {Array.from({ length: ones }).map((_, i) => (
        <span key={`t1-${i}`} className="manada-token one" title="Ficha de 1 vaca">
          <span className="manada-token-cow">🐄</span>
          <span className="manada-token-num">1</span>
        </span>
      ))}
    </span>
  );
}
