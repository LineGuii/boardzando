import { useEffect, useRef, useState } from 'react';
import { useGame } from '../../net/store';
import { GameChat } from '../../shell/GameChat';
import {
  isMuted,
  playQuack,
  playQuackWin,
  setMuted,
} from '../../shell/sfx';
import './pato.css';

interface PatoQuestionView {
  question: string;
  unit: string;
  answer?: number;
  explanation?: string;
}
interface PatoLastRoundView {
  question: string;
  answer: number;
  unit: string;
  explanation: string;
  guesses: Record<string, number>;
  winners: string[];
  exact: boolean;
  gained: Record<string, number>;
}
interface PatoView {
  roundIndex: number;
  roundsTotal: number;
  step: 'guess' | 'reveal';
  currentQuestion: PatoQuestionView;
  guesses: Record<string, number>;
  answered: string[];
  scores: Record<string, number>;
  lastRound?: PatoLastRoundView;
  finished?: boolean;
}

export function PatoBoard(): JSX.Element {
  const view = useGame((s) => s.view) as PatoView | undefined;
  const session = useGame((s) => s.session);
  const room = useGame((s) => s.room);
  const socket = useGame((s) => s.socket);

  const [guess, setGuess] = useState('');
  const [muted, setMutedState] = useState(isMuted());

  // som ao entrar no reveal (quack — win se eu venci; error se ninguém chegou perto)
  const prevStep = useRef<'guess' | 'reveal' | null>(null);
  useEffect(() => {
    if (!view || !session) return;
    if (prevStep.current !== 'reveal' && view.step === 'reveal' && view.lastRound) {
      if (view.lastRound.winners.includes(session.playerId)) playQuackWin();
      else playQuack();
    }
    prevStep.current = view.step;
  }, [view, session]);

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
    room.players.find((p) => p.id === pid)?.color ?? '#f59e0b';

  const iAnswered = view.answered.includes(me);
  const myGuess = view.guesses[me];

  const submit = (): void => {
    const v = Number(guess.replace(',', '.'));
    if (!Number.isFinite(v)) return;
    playQuack();
    emit('submitGuess', { value: v });
    setGuess('');
  };

  const next = (): void => emit('nextRound', {});

  return (
    <div className="pato-root">
      {/* cabeçalho */}
      <div className="pato-header">
        <div className="pato-title">
          <span className="pato-duck" role="img" aria-label="Pato">
            🦆
          </span>
          <div>
            <div className="pato-eyebrow">Nem a Pato</div>
            <div className="pato-round">
              Rodada {view.roundIndex + 1}/{view.roundsTotal}
            </div>
          </div>
        </div>
        <div className="pato-meta">
          <button
            type="button"
            className="pato-mute"
            onClick={toggleMute}
            title={muted ? 'Sons desligados' : 'Sons ligados'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </div>

      {/* pergunta ou reveal */}
      <div className="pato-card">
        <div className="pato-question">{view.currentQuestion.question}</div>
        <div className="pato-unit-hint">Resposta em: <b>{view.currentQuestion.unit}</b></div>

        {view.step === 'guess' && (
          <div className="pato-guess-row">
            {iAnswered ? (
              <div className="pato-answered-box">
                Seu palpite: <b>{formatNumber(myGuess ?? 0)}</b> {view.currentQuestion.unit}
                <div className="pato-answered-hint">
                  Aguardando os outros patos responderem…
                </div>
              </div>
            ) : (
              <>
                <input
                  className="pato-input"
                  type="text"
                  inputMode="decimal"
                  placeholder="chute um número..."
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                  autoFocus
                />
                <button
                  type="button"
                  className="pato-submit"
                  onClick={submit}
                  disabled={!Number.isFinite(Number(guess.replace(',', '.')))}
                >
                  🦆 Responder
                </button>
              </>
            )}
          </div>
        )}

        {view.step === 'reveal' && view.lastRound && (
          <div className="pato-reveal">
            <div className="pato-answer">
              <span className="pato-answer-label">Resposta:</span>
              <span className="pato-answer-value">
                {formatNumber(view.lastRound.answer)}{' '}
                <span className="pato-answer-unit">{view.lastRound.unit}</span>
              </span>
            </div>
            <p className="pato-explanation">{view.lastRound.explanation}</p>

            <ul className="pato-guesses">
              {rankGuesses(view.lastRound).map(({ pid, g, d, isWinner }) => (
                <li key={pid} className={`pato-guess ${isWinner ? 'winner' : ''}`}>
                  <span
                    className="pato-guess-dot"
                    style={{ background: colorOf(pid) }}
                    aria-hidden
                  />
                  <span className="pato-guess-name">
                    {nameOf(pid)}
                    {isWinner && (view.lastRound?.exact ? ' 🦆👑' : ' 🦆')}
                  </span>
                  <span className="pato-guess-value">{formatNumber(g)}</span>
                  <span className="pato-guess-dist">Δ {formatNumber(d)}</span>
                  {view.lastRound && view.lastRound.gained[pid]! > 0 && (
                    <span className="pato-guess-gain">+{view.lastRound.gained[pid]}</span>
                  )}
                </li>
              ))}
            </ul>

            <button className="pato-next" onClick={next}>
              ▶ Próxima rodada
            </button>
          </div>
        )}
      </div>

      {/* placar */}
      <div className="pato-scoreboard">
        <div className="pato-scoreboard-title">Placar</div>
        <ul className="pato-scores">
          {room.players
            .slice()
            .sort((a, b) => (view.scores[b.id] ?? 0) - (view.scores[a.id] ?? 0))
            .map((p) => {
              const answered = view.answered.includes(p.id);
              return (
                <li key={p.id} className="pato-score-row">
                  <span
                    className="pato-score-dot"
                    style={{ background: p.color ?? '#f59e0b' }}
                    aria-hidden
                  />
                  <span className="pato-score-name">{nameOf(p.id)}</span>
                  {view.step === 'guess' && (
                    <span className={`pato-badge ${answered ? 'ok' : ''}`}>
                      {answered ? '✓ respondeu' : '…pensando'}
                    </span>
                  )}
                  <span className="pato-score-points">{view.scores[p.id] ?? 0}</span>
                </li>
              );
            })}
        </ul>
      </div>

      <GameChat />
    </div>
  );
}

// ------- helpers -------

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(1)} bi`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)} mi`;
  if (Math.abs(n) >= 10000) return n.toLocaleString('pt-BR');
  return String(n);
}

function rankGuesses(
  lr: PatoLastRoundView,
): Array<{ pid: string; g: number; d: number; isWinner: boolean }> {
  return Object.entries(lr.guesses)
    .map(([pid, g]) => ({ pid, g, d: Math.abs(g - lr.answer), isWinner: lr.winners.includes(pid) }))
    .sort((a, b) => a.d - b.d);
}
