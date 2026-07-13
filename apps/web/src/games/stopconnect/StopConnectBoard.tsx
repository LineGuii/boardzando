import { useEffect, useRef, useState } from 'react';
import { useGame } from '../../net/store';
import { GameChat } from '../../shell/GameChat';
import { isMuted, playError, playPlace, playSuccess, playWin, setMuted } from '../../shell/sfx';
import './stopconnect.css';

type TileKind = 'letter' | 'theme';
type Verdict = 'approve' | 'reject';
type Step = 'place' | 'answer' | 'judging' | 'reveal';

interface LetterTileV {
  letter: string;
  value: number;
}
interface BoardTileV {
  id: string;
  kind: TileKind;
  col: number;
  row: number;
  letter?: string;
  value?: number;
  theme?: string;
  placedBy?: string;
}
interface PendingV {
  placedTileId: string;
  placedKind: TileKind;
  col: number;
  row: number;
  connectedTileIds: string[];
  answers: string[];
  votes: Record<string, Verdict>;
  voteCount: number;
  approved?: boolean;
  points?: number;
}
interface Cell {
  col: number;
  row: number;
}
interface StopConnectView {
  options: { targetScore: number };
  order: string[];
  turnPlayerId: string;
  tiles: Record<string, BoardTileV>;
  cells: Record<string, string>;
  scores: Record<string, number>;
  step: Step;
  pending?: PendingV;
  myHand?: { letter: LetterTileV; theme: string };
  handCounts: Record<string, number>;
  placeable?: { letter: Cell[]; theme: Cell[] };
  letterCount: number;
  themeCount: number;
  lastTurnBy?: string;
  finalTurnsRemaining?: number;
  lastEvent?: string;
  targetScore: number;
  winnerId?: string;
  finished?: boolean;
}

const TILE = 66; // px

export function StopConnectBoard(): JSX.Element {
  const view = useGame((s) => s.view) as StopConnectView | undefined;
  const session = useGame((s) => s.session);
  const room = useGame((s) => s.room);
  const socket = useGame((s) => s.socket);

  const [selType, setSelType] = useState<TileKind | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [muted, setMutedState] = useState(isMuted());

  // som ao revelar o veredito
  const prevStep = useRef<Step | null>(null);
  useEffect(() => {
    if (!view) return;
    if (prevStep.current !== 'reveal' && view.step === 'reveal' && view.pending) {
      if (view.pending.approved) playSuccess();
      else playError();
    }
    prevStep.current = view.step;
  }, [view]);

  // som de vitória
  const wonRef = useRef(false);
  useEffect(() => {
    if (view?.finished && !wonRef.current) {
      wonRef.current = true;
      playWin();
    }
  }, [view?.finished]);

  // reinicia os campos de resposta quando entra no passo 'answer'
  const needAnswers = view?.pending?.connectedTileIds.length ?? 0;
  useEffect(() => {
    if (view?.step === 'answer') {
      setAnswers(Array.from({ length: needAnswers }, () => ''));
    }
  }, [view?.step, view?.pending?.placedTileId, needAnswers]);

  // limpa a seleção de peça quando sai do passo 'place'
  useEffect(() => {
    if (view?.step !== 'place') setSelType(null);
  }, [view?.step]);

  if (!view || !session || !room) return <p>Aguardando estado...</p>;
  const me = session.playerId;
  const isMyTurn = view.turnPlayerId === me;

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

  const tiles = Object.values(view.tiles);
  const placeCandidates =
    isMyTurn && view.step === 'place' && selType && view.placeable ? view.placeable[selType] : [];

  const doPlace = (cell: Cell): void => {
    if (!selType) return;
    playPlace();
    emit('place', { tileType: selType, col: cell.col, row: cell.row });
    setSelType(null);
  };
  const submitAnswers = (): void => {
    const clean = answers.map((a) => a.trim());
    if (clean.some((a) => a.length === 0)) return;
    emit('submitAnswers', { answers: clean });
  };
  const judge = (verdict: Verdict): void => emit('judge', { verdict });
  const endTurn = (): void => emit('endTurn', {});

  const p = view.pending;
  const iVoted = p ? p.votes[me] : undefined;
  const numJudges = view.order.length - 1;

  return (
    <div className="sc-root">
      {/* cabeçalho */}
      <div className="sc-header">
        <div className="sc-logo">
          Stop<span>Connect</span>
        </div>
        <div className="sc-meta">
          <span className="sc-chip">🎯 alvo {view.targetScore}</span>
          <span className="sc-chip">🔤 {view.letterCount} · 💬 {view.themeCount}</span>
          <button
            type="button"
            className="sc-mute"
            onClick={toggleMute}
            title={muted ? 'Sons desligados' : 'Sons ligados'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </div>

      {view.lastTurnBy && !view.finished && (
        <div className="sc-lastturn">
          ⏳ Último turno! <b>{nameOf(view.lastTurnBy)}</b> atingiu o alvo — os demais têm
          uma última jogada.
        </div>
      )}

      <div className="sc-turnline">
        {view.step === 'place' && (
          <>
            {isMyTurn ? (
              <b>Sua vez — coloque uma peça</b>
            ) : (
              <>
                Vez de <b>{nameOf(view.turnPlayerId)}</b>
              </>
            )}
          </>
        )}
        {view.step === 'answer' && (
          <>{isMyTurn ? <b>Diga suas respostas</b> : <>{nameOf(view.turnPlayerId)} está respondendo…</>}</>
        )}
        {view.step === 'judging' && (
          <>Julgamento da jogada de <b>{nameOf(view.turnPlayerId)}</b> ({p?.voteCount ?? 0}/{numJudges})</>
        )}
        {view.step === 'reveal' && (
          <>{p?.approved ? '✅ Aprovado!' : '❌ Rejeitado!'} {p?.approved ? `+${p?.points}` : '+0'} pontos</>
        )}
      </div>

      {/* tabuleiro */}
      <Board
        tiles={tiles}
        candidates={placeCandidates}
        pending={p}
        step={view.step}
        onPlace={doPlace}
      />

      {/* mão do jogador da vez */}
      {isMyTurn && view.step === 'place' && view.myHand && (
        <div className="sc-hand">
          <div className="sc-hand-label">Sua mão — escolha uma peça e um lugar:</div>
          <div className="sc-hand-tiles">
            <button
              type="button"
              className={`sc-tile letter ${selType === 'letter' ? 'sel' : ''}`}
              onClick={() => setSelType('letter')}
            >
              <span className="sc-tile-letter">{view.myHand.letter.letter}</span>
              <span className="sc-tile-value">{view.myHand.letter.value}</span>
            </button>
            <button
              type="button"
              className={`sc-tile theme ${selType === 'theme' ? 'sel' : ''}`}
              onClick={() => setSelType('theme')}
            >
              <span className="sc-tile-theme">{view.myHand.theme}</span>
            </button>
          </div>
          {selType && (
            <div className="sc-hand-hint">
              {placeCandidates.length > 0
                ? `Clique numa célula destacada para colocar ${selType === 'letter' ? 'a Letra' : 'o Tema'}.`
                : 'Nenhum lugar válido para essa peça — tente a outra.'}
            </div>
          )}
        </div>
      )}

      {/* passo de respostas (jogador da vez) */}
      {isMyTurn && view.step === 'answer' && p && (
        <AnswerPanel view={view} pending={p} answers={answers} setAnswers={setAnswers} onSubmit={submitAnswers} />
      )}

      {/* passo de julgamento */}
      {view.step === 'judging' && p && (
        <JudgePanel
          view={view}
          pending={p}
          isPlacer={isMyTurn}
          iVoted={iVoted}
          onJudge={judge}
          nameOf={nameOf}
          colorOf={colorOf}
        />
      )}

      {/* passo de revelação */}
      {view.step === 'reveal' && p && (
        <RevealPanel view={view} pending={p} isPlacer={isMyTurn} onContinue={endTurn} nameOf={nameOf} />
      )}

      {/* placar */}
      <Scoreboard view={view} me={me} nameOf={nameOf} colorOf={colorOf} />

      <GameChat />
    </div>
  );
}

// ---------------- Tabuleiro ----------------

function Board({
  tiles,
  candidates,
  pending,
  step,
  onPlace,
}: {
  tiles: BoardTileV[];
  candidates: Cell[];
  pending?: PendingV;
  step: Step;
  onPlace: (cell: Cell) => void;
}): JSX.Element {
  const cols = tiles.map((t) => t.col).concat(candidates.map((c) => c.col));
  const rows = tiles.map((t) => t.row).concat(candidates.map((c) => c.row));
  const minCol = Math.min(...cols) - 1;
  const maxCol = Math.max(...cols) + 1;
  const minRow = Math.min(...rows) - 1;
  const maxRow = Math.max(...rows) + 1;
  const width = maxCol - minCol + 1;
  const height = maxRow - minRow + 1;

  const connected = new Set(pending?.connectedTileIds ?? []);
  const highlightPlaced = step !== 'place' ? pending?.placedTileId : undefined;

  return (
    <div className="sc-board-wrap">
      <div
        className="sc-board"
        style={{
          gridTemplateColumns: `repeat(${width}, ${TILE}px)`,
          gridTemplateRows: `repeat(${height}, ${TILE}px)`,
        }}
      >
        {tiles.map((t) => (
          <div
            key={t.id}
            className={`sc-btile ${t.kind} ${t.id === highlightPlaced ? 'placed' : ''} ${
              connected.has(t.id) ? 'connected' : ''
            }`}
            style={{ gridColumn: t.col - minCol + 1, gridRow: t.row - minRow + 1 }}
          >
            {t.kind === 'letter' ? (
              <>
                <span className="sc-btile-letter">{t.letter}</span>
                <span className="sc-btile-value">{t.value}</span>
              </>
            ) : (
              <span className="sc-btile-theme">{t.theme}</span>
            )}
          </div>
        ))}
        {candidates.map((c) => (
          <button
            key={`ghost-${c.col},${c.row}`}
            type="button"
            className="sc-ghost"
            style={{ gridColumn: c.col - minCol + 1, gridRow: c.row - minRow + 1 }}
            onClick={() => onPlace(c)}
            title="Colocar aqui"
          >
            +
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------- Respostas ----------------

function AnswerPanel({
  view,
  pending,
  answers,
  setAnswers,
  onSubmit,
}: {
  view: StopConnectView;
  pending: PendingV;
  answers: string[];
  setAnswers: (a: string[]) => void;
  onSubmit: () => void;
}): JSX.Element {
  const placed = view.tiles[pending.placedTileId];
  const connectedTiles = pending.connectedTileIds.map((id) => view.tiles[id]).filter(Boolean) as BoardTileV[];
  const ready = answers.length === connectedTiles.length && answers.every((a) => a.trim().length > 0);

  return (
    <div className="sc-answer">
      <div className="sc-answer-head">
        Diga uma resposta para <b>cada peça conectada</b> ({connectedTiles.length}):
      </div>
      <div className="sc-answer-rows">
        {connectedTiles.map((t, i) => {
          const prompt =
            placed?.kind === 'theme'
              ? `Tema "${placed.theme}" começando com ${t.letter}`
              : `Tema "${t.theme}" começando com ${placed?.letter}`;
          return (
            <div key={t.id} className="sc-answer-row">
              <span className="sc-answer-prompt">{prompt}</span>
              <input
                className="sc-answer-input"
                type="text"
                maxLength={40}
                value={answers[i] ?? ''}
                placeholder="sua resposta…"
                onChange={(e) => {
                  const copy = [...answers];
                  copy[i] = e.target.value;
                  setAnswers(copy);
                }}
                onKeyDown={(e) => e.key === 'Enter' && ready && onSubmit()}
                autoFocus={i === 0}
              />
            </div>
          );
        })}
      </div>
      <button type="button" className="sc-primary" onClick={onSubmit} disabled={!ready}>
        Enviar para julgamento
      </button>
    </div>
  );
}

// ---------------- Julgamento ----------------

function JudgePanel({
  view,
  pending,
  isPlacer,
  iVoted,
  onJudge,
  nameOf,
  colorOf,
}: {
  view: StopConnectView;
  pending: PendingV;
  isPlacer: boolean;
  iVoted?: Verdict;
  onJudge: (v: Verdict) => void;
  nameOf: (pid: string) => string;
  colorOf: (pid: string) => string;
}): JSX.Element {
  const placed = view.tiles[pending.placedTileId];
  const connectedTiles = pending.connectedTileIds.map((id) => view.tiles[id]).filter(Boolean) as BoardTileV[];
  const judges = view.order.filter((pid) => pid !== view.turnPlayerId);

  return (
    <div className="sc-judge">
      <div className="sc-judge-answers">
        {connectedTiles.map((t, i) => {
          const label =
            placed?.kind === 'theme'
              ? `${placed.theme} · ${t.letter}`
              : `${t.theme} · ${placed?.letter}`;
          return (
            <div key={t.id} className="sc-judge-answer">
              <span className="sc-judge-label">{label}</span>
              <span className="sc-judge-value">“{pending.answers[i]}”</span>
            </div>
          );
        })}
      </div>

      {isPlacer || iVoted ? (
        <div className="sc-judge-wait">
          {iVoted ? (
            <>Você votou <b>{iVoted === 'approve' ? 'aprovar' : 'rejeitar'}</b>. </>
          ) : null}
          Aguardando os juízes… ({pending.voteCount}/{judges.length})
        </div>
      ) : (
        <div className="sc-judge-actions">
          <div className="sc-judge-q">As respostas são válidas?</div>
          <div className="sc-judge-btns">
            <button type="button" className="sc-approve" onClick={() => onJudge('approve')}>
              ✅ Aprovar
            </button>
            <button type="button" className="sc-reject" onClick={() => onJudge('reject')}>
              ❌ Rejeitar
            </button>
          </div>
        </div>
      )}

      <div className="sc-judge-votes">
        {judges.map((pid) => {
          const v = pending.votes[pid];
          return (
            <span key={pid} className={`sc-vote ${v ?? 'pending'}`}>
              <span className="sc-dot" style={{ background: colorOf(pid) }} />
              {nameOf(pid)} {v === 'approve' ? '✅' : v === 'reject' ? '❌' : '…'}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ---------------- Revelação ----------------

function RevealPanel({
  view,
  pending,
  isPlacer,
  onContinue,
  nameOf,
}: {
  view: StopConnectView;
  pending: PendingV;
  isPlacer: boolean;
  onContinue: () => void;
  nameOf: (pid: string) => string;
}): JSX.Element {
  return (
    <div className={`sc-reveal ${pending.approved ? 'ok' : 'no'}`}>
      <div className="sc-reveal-verdict">
        {pending.approved ? (
          <>✅ Aprovado! <b>{nameOf(view.turnPlayerId)}</b> fez <b>+{pending.points}</b> ponto(s).</>
        ) : (
          <>❌ Rejeitado! <b>{nameOf(view.turnPlayerId)}</b> não pontuou.</>
        )}
      </div>
      {isPlacer ? (
        <button type="button" className="sc-primary" onClick={onContinue}>
          ▶ Continuar
        </button>
      ) : (
        <div className="sc-reveal-wait">Aguardando {nameOf(view.turnPlayerId)} continuar…</div>
      )}
    </div>
  );
}

// ---------------- Placar ----------------

function Scoreboard({
  view,
  me,
  nameOf,
  colorOf,
}: {
  view: StopConnectView;
  me: string;
  nameOf: (pid: string) => string;
  colorOf: (pid: string) => string;
}): JSX.Element {
  const ranked = [...view.order].sort((a, b) => (view.scores[b] ?? 0) - (view.scores[a] ?? 0));
  return (
    <div className="sc-scoreboard">
      <div className="sc-scoreboard-title">🏆 Placar · alvo {view.targetScore}</div>
      <ul className="sc-scores">
        {ranked.map((pid) => {
          const isMe = pid === me;
          const isTurn = pid === view.turnPlayerId;
          const won = view.winnerId === pid;
          return (
            <li key={pid} className={`sc-score-row ${isMe ? 'mine' : ''} ${isTurn ? 'turn' : ''}`}>
              <span className="sc-dot" style={{ background: colorOf(pid) }} />
              <span className="sc-score-name">
                {nameOf(pid)} {isMe ? '(você)' : ''} {won ? '🏆' : ''}
              </span>
              <span className="sc-score-points">{view.scores[pid] ?? 0}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
