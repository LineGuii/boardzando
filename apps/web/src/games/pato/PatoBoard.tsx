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
interface PatoBidView {
  playerId: string;
  value: number;
}
interface PatoLastRoundView {
  question: string;
  answer: number;
  unit: string;
  explanation: string;
  bids: PatoBidView[];
  callerId: string;
  lastBidderId: string;
  overshot: boolean;
  winnerId?: string;
  winningValue?: number;
}
interface PatoView {
  roundIndex: number;
  roundsTotal: number;
  step: 'bid' | 'reveal';
  currentQuestion: PatoQuestionView;
  bids: PatoBidView[];
  turnPlayerId: string;
  scores: Record<string, number>;
  lastRound?: PatoLastRoundView;
  finished?: boolean;
}

export function PatoBoard(): JSX.Element {
  const view = useGame((s) => s.view) as PatoView | undefined;
  const session = useGame((s) => s.session);
  const room = useGame((s) => s.room);
  const socket = useGame((s) => s.socket);

  const [bid, setBid] = useState('');
  const [muted, setMutedState] = useState(isMuted());

  // som ao entrar no reveal (quack-win se eu venci a rodada; quack senão)
  const prevStep = useRef<'bid' | 'reveal' | null>(null);
  useEffect(() => {
    if (!view || !session) return;
    if (prevStep.current !== 'reveal' && view.step === 'reveal' && view.lastRound) {
      if (view.lastRound.winnerId === session.playerId) playQuackWin();
      else playQuack();
    }
    prevStep.current = view.step;
  }, [view, session]);

  // limpa o campo quando a vez muda / rodada nova
  useEffect(() => {
    setBid('');
  }, [view?.turnPlayerId, view?.roundIndex]);

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

  const myTurn = view.turnPlayerId === me;
  const lastBid = view.bids[view.bids.length - 1];
  const minBid = (lastBid?.value ?? -1) + 1;
  // pode gritar quem NÃO deu o último lance (inclusive o jogador da vez, em
  // vez de subir — com 2 jogadores é o único jeito de existir desafio)
  const iAmLastBidder = lastBid?.playerId === me;
  const canCall = view.bids.length > 0 && !iAmLastBidder;

  // só inteiro puro: nada de 0.1 / 1,321 / notação estranha
  const raw = bid.trim();
  const isInteger = /^\d+$/.test(raw);
  const parsed = isInteger ? Number(raw) : NaN;
  const validBid = isInteger && Number.isSafeInteger(parsed) && parsed >= minBid;

  const submitBid = (): void => {
    if (!validBid) return;
    playQuack();
    emit('placeBid', { value: parsed });
    setBid('');
  };
  const callDuck = (): void => {
    if (!canCall) return;
    emit('callDuck', {});
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

        {view.step === 'bid' && (
          <>
            {/* escada de lances */}
            <div className="pato-ladder">
              {view.bids.length === 0 ? (
                <div className="pato-ladder-empty">
                  Ninguém falou um número ainda — {myTurn ? 'comece você!' : 'aguarde o primeiro lance.'}
                </div>
              ) : (
                <ul className="pato-bids">
                  {view.bids.map((b, i) => (
                    <li
                      key={`${i}-${b.value}`}
                      className={`pato-bid ${i === view.bids.length - 1 ? 'latest' : ''}`}
                    >
                      <span
                        className="pato-guess-dot"
                        style={{ background: colorOf(b.playerId) }}
                        aria-hidden
                      />
                      <span className="pato-bid-name">
                        {nameOf(b.playerId)} {b.playerId === me ? '(você)' : ''}
                      </span>
                      <span className="pato-bid-value">{formatNumber(b.value)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* vez + ações */}
            <div className={`pato-turn ${myTurn ? 'mine' : ''}`}>
              <span
                className="pato-guess-dot"
                style={{ background: colorOf(view.turnPlayerId) }}
                aria-hidden
              />
              {myTurn ? (
                <b>Sua vez! Diga um número inteiro {lastBid ? `maior que ${formatNumber(lastBid.value)}` : ''}</b>
              ) : (
                <>Vez de <b>{nameOf(view.turnPlayerId)}</b> dizer um número maior…</>
              )}
            </div>

            {myTurn && (
              <div className="pato-guess-row">
                <input
                  className="pato-input"
                  type="text"
                  inputMode="numeric"
                  placeholder={lastBid ? `mínimo ${formatNumber(minBid)}` : 'chute um número inteiro...'}
                  value={bid}
                  onChange={(e) => setBid(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitBid()}
                  autoFocus
                />
                <button
                  type="button"
                  className="pato-submit"
                  onClick={submitBid}
                  disabled={!validBid}
                >
                  🦆 Dar o lance
                </button>
              </div>
            )}
            {raw.length > 0 && !isInteger && myTurn && (
              <p className="pato-int-warn">Só vale número inteiro — nada de 0.1 ou 1,321 🙃</p>
            )}

            {/* NEM A PATO: para todos, MENOS quem deu o último lance. O da vez
                pode gritar EM VEZ de subir. */}
            {iAmLastBidder ? (
              <p className="pato-duck-hint">
                Você deu o último lance — não dá para gritar no próprio número. 🦆
              </p>
            ) : (
              <div className="pato-duck-zone">
                {myTurn && canCall && <div className="pato-or">— ou, em vez de subir —</div>}
                <button
                  type="button"
                  className="pato-duck-btn"
                  onClick={callDuck}
                  disabled={!canCall}
                  title={
                    !canCall
                      ? 'Espere alguém falar um número'
                      : `Acusar: "${formatNumber(lastBid!.value)}" passou da resposta!`
                  }
                >
                  🦆 NEM A PATO!
                </button>
                <p className="pato-duck-hint">
                  Acha que o último número passou da resposta? Grite e revele o resultado.
                </p>
              </div>
            )}
          </>
        )}

        {view.step === 'reveal' && view.lastRound && (
          <div className="pato-reveal">
            <div className="pato-call-banner">
              <b>{nameOf(view.lastRound.callerId)}</b> gritou <b>NEM A PATO!</b> em cima do lance de{' '}
              <b>{nameOf(view.lastRound.lastBidderId)}</b> —{' '}
              {view.lastRound.overshot ? 'e tinha razão: passou! ✅' : 'mas o lance NÃO tinha passado. ❌'}
            </div>
            <div className="pato-answer">
              <span className="pato-answer-label">Resposta:</span>
              <span className="pato-answer-value">
                {formatNumber(view.lastRound.answer)}{' '}
                <span className="pato-answer-unit">{view.lastRound.unit}</span>
              </span>
            </div>
            <p className="pato-explanation">{view.lastRound.explanation}</p>

            <ul className="pato-guesses">
              {view.lastRound.bids.map((b, i) => {
                const over = b.value > view.lastRound!.answer;
                const isWinner =
                  !over &&
                  view.lastRound!.winnerId === b.playerId &&
                  view.lastRound!.winningValue === b.value;
                return (
                  <li
                    key={`${i}-${b.value}`}
                    className={`pato-guess ${isWinner ? 'winner' : ''} ${over ? 'over' : ''}`}
                  >
                    <span
                      className="pato-guess-dot"
                      style={{ background: colorOf(b.playerId) }}
                      aria-hidden
                    />
                    <span className="pato-guess-name">
                      {nameOf(b.playerId)}
                      {isWinner && ' 🦆👑'}
                    </span>
                    <span className="pato-guess-value">{formatNumber(b.value)}</span>
                    {over ? (
                      <span className="pato-guess-over">passou! nada 🚫</span>
                    ) : (
                      <span className="pato-guess-dist">
                        Δ {formatNumber(view.lastRound!.answer - b.value)}
                      </span>
                    )}
                    {isWinner && <span className="pato-guess-gain">+1</span>}
                  </li>
                );
              })}
            </ul>
            {view.lastRound.winnerId === undefined && (
              <p className="pato-nobody">Todos os lances passaram da resposta — ninguém pontua! 🦆💨</p>
            )}

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
            .map((p) => (
              <li key={p.id} className="pato-score-row">
                <span
                  className="pato-score-dot"
                  style={{ background: p.color ?? '#f59e0b' }}
                  aria-hidden
                />
                <span className="pato-score-name">{nameOf(p.id)}</span>
                {view.step === 'bid' && p.id === view.turnPlayerId && (
                  <span className="pato-badge ok">🎤 na vez</span>
                )}
                <span className="pato-score-points">{view.scores[p.id] ?? 0}</span>
              </li>
            ))}
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
