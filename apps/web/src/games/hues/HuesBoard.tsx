import { useState } from 'react';
import type { HuesCoord, HuesOptions } from '@boardzando/contracts';
import { cellColor } from '@boardzando/contracts';
import { useGame } from '../../net/store';
import { HuesGrid, coordLabel } from './HuesGrid';
import './hues.css';

interface HuesLastRoundView {
  target: HuesCoord;
  cueGiver: string;
  pointsThisRound: Record<string, number>;
  cueGiverPoints: number;
  cue1?: string;
  cue2?: string;
}

interface HuesView {
  options: HuesOptions;
  step: 'pick' | 'cue1' | 'guess1' | 'cue2' | 'guess2' | 'reveal';
  cardOptions?: HuesCoord[];
  target?: HuesCoord;
  cue1?: string;
  cue2?: string;
  guesses: Record<string, HuesCoord[]>;
  scores: Record<string, number>;
  cueGiverCount: Record<string, number>;
  targetRounds: number;
  lastRound?: HuesLastRoundView;
}

/** Cor visual de um cone do jogador X — derivada do seu id para ficar estavel. */
function coneColorFor(playerId: string): string {
  let h = 0;
  for (let i = 0; i < playerId.length; i++) h = (h * 31 + playerId.charCodeAt(i)) % 360;
  return `hsl(${h} 70% 45%)`;
}


export function HuesBoard(): JSX.Element {
  const view = useGame((s) => s.view) as HuesView | undefined;
  const session = useGame((s) => s.session);
  const room = useGame((s) => s.room);
  const currentPlayer = useGame((s) => s.currentPlayer);
  const socket = useGame((s) => s.socket);

  if (!view || !session || !room) return <p>Aguardando estado...</p>;

  const me = session.playerId;
  const isCueGiver = me === currentPlayer;
  const cueGiverName =
    room.players.find((p) => p.id === currentPlayer)?.name ?? '???';

  // monta a lista de cones para o grid
  const conesForGrid = Object.entries(view.guesses).flatMap(([pid, list]) =>
    list.map((coord) => ({
      coord,
      color: coneColorFor(pid),
      initial: (room.players.find((p) => p.id === pid)?.name ?? '?')[0]!.toUpperCase(),
    })),
  );

  const inGuessPhase = view.step === 'guess1' || view.step === 'guess2';
  const myConeCount = view.guesses[me]?.length ?? 0;
  const expectedMyCones = view.step === 'guess1' ? 1 : view.step === 'guess2' ? 2 : 0;
  const canClick = inGuessPhase && !isCueGiver && myConeCount < expectedMyCones;

  const handlePick = (coord: HuesCoord): void => {
    if (!canClick) return;
    socket?.emit(
      'game:move',
      { roomId: session.roomId, type: 'placeCone', data: { col: coord.col, row: coord.row } },
      () => {},
    );
  };

  return (
    <div className="hues-room">
      <div className="hues-main">
        <StepBanner view={view} cueGiverName={cueGiverName} isCueGiver={isCueGiver} />

        {/* === Painel do cue-giver === */}
        {isCueGiver && view.step === 'pick' && view.cardOptions && (
          <CueGiverPick options={view.cardOptions} />
        )}
        {isCueGiver && (view.step === 'cue1' || view.step === 'cue2') && (
          <CueGiverCueInput step={view.step} target={view.target} />
        )}

        {/* === Painel do palpitador === */}
        {!isCueGiver && inGuessPhase && (
          <GuesserBanner
            cueGiverName={cueGiverName}
            step={view.step as 'guess1' | 'guess2'}
            cue1={view.cue1}
            cue2={view.cue2}
            canClick={canClick}
            myConeCount={myConeCount}
            expectedMyCones={expectedMyCones}
          />
        )}

        {view.step === 'reveal' && (
          <RevealPanel
            view={view}
            isCueGiver={isCueGiver}
            playerNameOf={(pid) => room.players.find((p) => p.id === pid)?.name ?? pid}
          />
        )}

        <div style={{ marginTop: 12 }}>
          <HuesGrid
            cones={conesForGrid}
            clickable={canClick}
            onPick={handlePick}
            revealedTarget={view.step === 'reveal' ? view.target : undefined}
          />
        </div>
      </div>

      <Scoreboard
        view={view}
        currentPlayer={currentPlayer ?? ''}
        playerList={room.players.map((p) => ({ id: p.id, name: p.name }))}
      />
    </div>
  );
}

// ============================================================
// SUBCOMPONENTES
// ============================================================

function StepBanner({
  view,
  cueGiverName,
  isCueGiver,
}: {
  view: HuesView;
  cueGiverName: string;
  isCueGiver: boolean;
}): JSX.Element {
  const totalRoundsPlayed = Object.values(view.cueGiverCount).reduce((a, b) => a + b, 0);
  const text = (() => {
    switch (view.step) {
      case 'pick':
        return isCueGiver ? 'Escolha uma das 4 cores' : `${cueGiverName} esta escolhendo a cor`;
      case 'cue1':
        return isCueGiver ? 'De uma dica de 1 palavra' : `${cueGiverName} esta pensando na dica`;
      case 'guess1':
        return isCueGiver ? 'Aguarde os palpites (1 cone cada)' : 'Coloque seu 1o cone';
      case 'cue2':
        return isCueGiver ? 'De uma dica de 2 palavras' : `${cueGiverName} esta pensando na 2a dica`;
      case 'guess2':
        return isCueGiver ? 'Aguarde os palpites (2o cone)' : 'Coloque seu 2o cone';
      case 'reveal':
        return isCueGiver ? 'Resultado! Clique em "Proxima rodada"' : 'Resultado!';
    }
  })();
  return (
    <div className="hues-step-banner">
      <span>
        <b>{text}</b>
      </span>
      <span>
        Rodada {totalRoundsPlayed + (view.step === 'reveal' ? 0 : 1)} / {view.targetRounds}
      </span>
    </div>
  );
}

function CueGiverPick({ options }: { options: HuesCoord[] }): JSX.Element {
  const session = useGame((s) => s.session)!;
  const socket = useGame((s) => s.socket);
  const send = (index: number): void =>
    void socket?.emit(
      'game:move',
      { roomId: session.roomId, type: 'selectColor', data: { index } },
      () => {},
    );
  return (
    <div>
      <p className="hues-cue-hint">
        Voce ve estas 4 cores; os outros nao. Escolha uma para descrever.
      </p>
      <div className="hues-card-options">
        {options.map((c, i) => (
          <button
            key={i}
            type="button"
            className="hues-card-swatch"
            style={{ background: cellColor(c.col, c.row) }}
            onClick={() => send(i)}
          >
            <span className="coord">{coordLabel(c)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function CueGiverCueInput({
  step,
  target,
}: {
  step: 'cue1' | 'cue2';
  target?: HuesCoord;
}): JSX.Element {
  const session = useGame((s) => s.session)!;
  const socket = useGame((s) => s.socket);
  const lastError = useGame((s) => s.lastError);
  const [text, setText] = useState('');
  const expectedWords = step === 'cue1' ? 1 : 2;
  const words = text.trim().split(/\s+/).filter(Boolean);

  const submit = (): void => {
    if (words.length !== expectedWords) return;
    socket?.emit(
      'game:move',
      { roomId: session.roomId, type: 'submitCue', data: { text: text.trim() } },
      () => {},
    );
    setText('');
  };

  return (
    <div>
      <div className="hues-cue-row">
        {target && (
          <div
            className="hues-target-badge"
            title="Sua cor secreta — só você vê"
          >
            <div
              className="hues-target-badge-swatch"
              style={{ background: cellColor(target.col, target.row) }}
            />
            <div className="hues-target-badge-meta">
              <span className="hues-target-badge-coord">{coordLabel(target)}</span>
              <span className="hues-target-badge-label">sua cor</span>
            </div>
          </div>
        )}
        <div className="hues-cue-input">
          <input
            type="text"
            placeholder={
              step === 'cue1' ? 'Dica de 1 palavra...' : 'Dica de 2 palavras...'
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            maxLength={80}
          />
          <button
            type="button"
            onClick={submit}
            disabled={words.length !== expectedWords}
          >
            Enviar
          </button>
        </div>
      </div>
      <p className="hues-cue-hint">
        {words.length}/{expectedWords} palavra(s). Não use nomes de cor nem
        &quot;claro&quot;/&quot;escuro&quot;.
      </p>
      {lastError?.code === 'INVALID_MOVE' && (
        <p className="hues-cue-hint error">
          Dica rejeitada: palavra proibida ou quantidade de palavras errada.
        </p>
      )}
    </div>
  );
}

function GuesserBanner({
  cueGiverName,
  step,
  cue1,
  cue2,
  canClick,
  myConeCount,
  expectedMyCones,
}: {
  cueGiverName: string;
  step: 'guess1' | 'guess2';
  cue1?: string;
  cue2?: string;
  canClick: boolean;
  myConeCount: number;
  expectedMyCones: number;
}): JSX.Element {
  const dica = step === 'guess1' ? cue1 : `${cue1 ?? '???'} + ${cue2 ?? '???'}`;
  return (
    <div className={`hues-guess-panel ${canClick ? '' : 'locked'}`}>
      Dica de <b>{cueGiverName}</b>: <b>{dica}</b>
      <br />
      {canClick
        ? `Clique no tabuleiro para colocar seu ${myConeCount === 0 ? 'cone' : `${myConeCount + 1}o cone`}.`
        : `Você já colocou ${expectedMyCones}/${expectedMyCones} cones. Aguardando os outros...`}
    </div>
  );
}

function RevealPanel({
  view,
  isCueGiver,
  playerNameOf,
}: {
  view: HuesView;
  isCueGiver: boolean;
  playerNameOf: (pid: string) => string;
}): JSX.Element {
  const session = useGame((s) => s.session)!;
  const socket = useGame((s) => s.socket);
  const lr = view.lastRound;

  const next = (): void => {
    socket?.emit(
      'game:move',
      { roomId: session.roomId, type: 'finalizeRound', data: {} },
      () => {},
    );
  };

  if (!lr && view.target) {
    // ainda nao calculado server-side (so o cue-giver vera depois do click)
    return (
      <div className="hues-guess-panel">
        Alvo revelado: <b>{coordLabel(view.target)}</b>.
        {isCueGiver && (
          <button
            type="button"
            onClick={next}
            style={{ marginLeft: 8, padding: '4px 12px', borderRadius: 6 }}
          >
            Calcular pontos &amp; proxima rodada
          </button>
        )}
      </div>
    );
  }

  if (!lr) {
    return <div className="hues-guess-panel">Calculando resultado...</div>;
  }

  return (
    <div className="hues-guess-panel">
      <div style={{ marginBottom: 6 }}>
        Alvo: <b>{coordLabel(lr.target)}</b>.{' '}
        {lr.cue1 && (
          <>
            Dicas: <b>{lr.cue1}</b> / <b>{lr.cue2}</b>.
          </>
        )}
      </div>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        <li>
          <b>{playerNameOf(lr.cueGiver)}</b> (cue-giver): +{lr.cueGiverPoints}
        </li>
        {Object.entries(lr.pointsThisRound).map(([pid, pts]) => (
          <li key={pid}>
            {playerNameOf(pid)}: +{pts}
          </li>
        ))}
      </ul>
      {isCueGiver && (
        <button
          type="button"
          onClick={next}
          style={{
            marginTop: 8,
            padding: '6px 14px',
            border: 0,
            borderRadius: 8,
            background: '#2d932d',
            color: 'white',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Proxima rodada ▶
        </button>
      )}
    </div>
  );
}

function Scoreboard({
  view,
  currentPlayer,
  playerList,
}: {
  view: HuesView;
  currentPlayer: string;
  playerList: { id: string; name: string }[];
}): JSX.Element {
  return (
    <aside className="hues-scoreboard">
      <h3>Placar</h3>
      {playerList.map((p) => {
        const isCue = p.id === currentPlayer;
        const delta = view.lastRound
          ? (view.lastRound.cueGiver === p.id
              ? view.lastRound.cueGiverPoints
              : view.lastRound.pointsThisRound[p.id] ?? 0)
          : 0;
        return (
          <div
            key={p.id}
            className={`hues-score-row ${isCue ? 'cue-giver' : ''}`}
            title={`${view.cueGiverCount[p.id] ?? 0} vezes como cue-giver`}
          >
            <span className="hues-score-name">
              <span
                className="hues-score-dot"
                style={{ background: coneColorFor(p.id) }}
              />
              {p.name}
              {isCue && <span style={{ fontSize: 11, color: '#b48000' }}> ★</span>}
            </span>
            <span className="hues-score-points">
              {view.scores[p.id] ?? 0}
              {view.step === 'reveal' && delta > 0 && (
                <span className="hues-score-delta">+{delta}</span>
              )}
            </span>
          </div>
        );
      })}
    </aside>
  );
}
