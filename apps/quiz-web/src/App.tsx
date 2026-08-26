import { useEffect, useState, type JSX } from 'react';
import { AVATAR_COLORS, randomAvatarColor, type RoomSummary } from '@boardzando/contracts';
import { api } from './net/api';
import { clearSession, loadSession, saveSession } from './net/session';
import { connectSocket } from './net/socket';
import { syncClock } from './net/clockSync';
import { useQuiz } from './net/store';
import { MusicDoodles } from './shell/MusicDoodles';
import { ErrorAlert } from './shell/ErrorAlert';
import { QuestionScreen } from './game/QuestionScreen';
import { RankingBoard } from './game/RankingBoard';
import { FinalReveal } from './game/FinalReveal';
import { AdminPanel } from './admin/AdminPanel';
import { isMuted, setMuted } from './audio/quizAudio';
import './shell/shell.css';
import './game/quiz.css';

/** Roteamento simples baseado em URL: `?admin` ativa o painel de host. */
function isAdminRoute(): boolean {
  try {
    const u = new URL(window.location.href);
    return u.searchParams.has('admin') || u.pathname.startsWith('/admin');
  } catch { return false; }
}

export function App(): JSX.Element {
  const session = useQuiz((s) => s.session);
  const [resuming, setResuming] = useState(true);
  const [resumeError, setResumeError] = useState<string | undefined>();

  // Tenta retomar sessao existente no localStorage
  useEffect(() => {
    const saved = loadSession();
    const url = new URL(window.location.href);
    const wantRoom = url.searchParams.get('room');
    if (!saved) {
      setResuming(false);
      return;
    }
    if (wantRoom && wantRoom !== saved.roomId) {
      // link para outra sala — descarta o resume
      setResuming(false);
      return;
    }
    const sock = connectSocket(saved.token);
    let done = false;
    const timeout = setTimeout(() => {
      if (done) return;
      done = true;
      sock.disconnect();
      clearSession();
      setResumeError('Nao consegui reconectar.');
      setResuming(false);
    }, 5000);
    sock.once('connect', () => {
      done = true;
      clearTimeout(timeout);
      const s = { roomId: saved.roomId, playerId: saved.playerId };
      useQuiz.getState().setSocket(sock, s);
      void syncClock(sock, saved.roomId).then((off) => useQuiz.getState().setClockOffset(off));
      setResuming(false);
    });
    sock.once('connect_error', () => {
      done = true;
      clearTimeout(timeout);
      clearSession();
      setResumeError('Sessao expirada.');
      setResuming(false);
    });
  }, []);

  if (resuming) return <div className="q-splash">Reconectando...</div>;

  // Se ja tem sessao de sala aberta, sempre renderiza a sala — mesmo que a
  // URL tenha ?admin (evita perder uma partida em andamento por acidente).
  const showAdmin = isAdminRoute() && !session;

  return (
    <div className="q-bg">
      <MusicDoodles />
      <MuteButton />
      {session
        ? <RoomPage />
        : showAdmin
          ? <AdminPanel />
          : <Lobby initialError={resumeError} />}
    </div>
  );
}

function MuteButton(): JSX.Element {
  const [muted, setLocal] = useState(isMuted());
  return (
    <button
      className="q-mute"
      onClick={() => { const v = !muted; setMuted(v); setLocal(v); }}
      aria-label="mutar"
    >
      {muted ? '🔇 Mudo' : '🔊 Som'}
    </button>
  );
}

// ==========================================================
// LOBBY (criar / entrar)
// ==========================================================

/**
 * Lobby publico — SO permite entrar em uma sala. Criar sala virou operacao
 * de host autorizado e vive em /?admin (AdminPanel).
 */
function Lobby(props: { initialError?: string }): JSX.Element {
  const url = new URL(window.location.href);
  const wantRoom = url.searchParams.get('room') ?? '';
  const [name, setName] = useState<string>(() => localStorage.getItem('quiz:name') ?? '');
  const [color, setColor] = useState<string>(randomAvatarColor());
  const [password, setPassword] = useState('');
  const [roomId, setRoomId] = useState(wantRoom);
  const [error, setError] = useState<string | undefined>(props.initialError);
  const [busy, setBusy] = useState(false);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);

  useEffect(() => { localStorage.setItem('quiz:name', name); }, [name]);

  useEffect(() => {
    void api.listRooms().then(setRooms).catch(() => setRooms([]));
    const id = window.setInterval(() => {
      void api.listRooms().then(setRooms).catch(() => { /* ignore */ });
    }, 4000);
    return () => window.clearInterval(id);
  }, []);

  const submit = async (): Promise<void> => {
    setError(undefined);
    if (name.trim().length < 2) { setError('Escolha um nome (2+ caracteres).'); return; }
    if (roomId.trim().length < 4) { setError('Cole o codigo da sala ou clique numa da lista.'); return; }
    setBusy(true);
    try {
      const res = await api.joinRoom(roomId.trim(), name.trim(), password || undefined, color);
      saveSession({ roomId: res.roomId, playerId: res.playerId, token: res.token });
      const sock = connectSocket(res.token);
      sock.once('connect', () => {
        useQuiz.getState().setSocket(sock, { roomId: res.roomId, playerId: res.playerId });
        try {
          const u = new URL(window.location.href);
          u.searchParams.set('room', res.roomId);
          window.history.replaceState(null, '', u.toString());
        } catch { /* SSR */ }
        void syncClock(sock, res.roomId).then((off) => useQuiz.getState().setClockOffset(off));
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="q-container">
      <div className="q-hero">
        <h1>Music Quiz</h1>
        <p className="tagline">Adivinhe a musica. Mais rapido = mais pontos.</p>
      </div>

      <div className="q-card">
        <h2>Entrar em sala</h2>

        {error && <ErrorAlert error={{ code: 'INVALID_MOVE', message: error }} onClose={() => setError(undefined)} />}

        <label className="q-label">Seu nome</label>
        <div className="q-avatar-row">
          <ColorPicker color={color} onChange={setColor} name={name} />
          <input
            className="q-input"
            placeholder="Como voce quer ser chamado?"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
          />
        </div>

        <label className="q-label">Salas abertas</label>
        <div className="q-room-list">
          {rooms.length === 0 ? (
            <div className="q-room-empty">Nenhuma sala aberta. Aguarde um host criar.</div>
          ) : rooms.map((r) => (
            <div
              key={r.roomId}
              className="q-room-item"
              onClick={() => setRoomId(r.roomId)}
            >
              <div>
                <div className="who">🎤 {r.hostName}</div>
                <div className="meta">{r.playerCount} jogador(es)</div>
              </div>
              <span className="q-btn small">Selecionar</span>
            </div>
          ))}
        </div>

        <label className="q-label">Codigo da sala</label>
        <input
          className="q-input"
          placeholder="cole o codigo aqui"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          maxLength={64}
        />

        <label className="q-label">Senha (se houver)</label>
        <input
          className="q-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          maxLength={64}
        />

        <button className="q-btn" onClick={submit} disabled={busy}>
          {busy ? 'Aguarde...' : 'Entrar'}
        </button>
      </div>

      <div style={{ textAlign: 'center', marginTop: 10 }}>
        <a href="/?admin" style={{ color: '#7b88b8', fontSize: 12, textDecoration: 'none' }}>
          Sou host →
        </a>
      </div>
    </div>
  );
}

function ColorPicker(props: { color: string; onChange: (c: string) => void; name: string }): JSX.Element {
  const [open, setOpen] = useState(false);
  const initial = props.name[0]?.toUpperCase() ?? '?';
  return (
    <div style={{ position: 'relative' }}>
      <div
        className="q-avatar"
        style={{ background: props.color }}
        onClick={() => setOpen((o) => !o)}
      >
        {initial}
      </div>
      {open && (
        <div className="q-avatar-picker">
          {AVATAR_COLORS.map((c) => (
            <button
              key={c}
              style={{ background: c }}
              className={c === props.color ? 'selected' : ''}
              onClick={() => { props.onChange(c); setOpen(false); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ==========================================================
// ROOM PAGE
// ==========================================================

function RoomPage(): JSX.Element {
  const room = useQuiz((s) => s.room);
  const session = useQuiz((s) => s.session);
  const socket = useQuiz((s) => s.socket);
  const phase = useQuiz((s) => s.phase);
  const question = useQuiz((s) => s.question);
  const reveal = useQuiz((s) => s.reveal);
  const final = useQuiz((s) => s.final);
  const clockOffset = useQuiz((s) => s.clockOffset);
  const lastError = useQuiz((s) => s.lastError);
  const clearError = useQuiz((s) => s.clearError);
  const setMyAnswer = useQuiz((s) => s.setMyAnswer);
  const myAnswer = useQuiz((s) => s.myAnswer);

  // Reset myAnswer quando a pergunta muda
  useEffect(() => {
    if (question) setMyAnswer(undefined as unknown as number);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.index]);

  if (!room || !session) {
    return <div className="q-splash">Carregando sala...</div>;
  }

  const isHost = room.hostId === session.playerId;
  const options = (room.lastGameOptions ?? {}) as {
    audioMode?: 'remote' | 'presenter';
    hostIsPlayer?: boolean;
  };
  const audioMode = options.audioMode ?? 'remote';
  const hostIsPlayer = options.hostIsPlayer ?? true;
  const isPresenter = isHost && !hostIsPlayer;

  const leave = (): void => {
    try { socket?.disconnect(); } catch { /* ignore */ }
    clearSession();
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete('room');
      window.history.replaceState(null, '', u.toString());
    } catch { /* ignore */ }
    useQuiz.getState().reset();
  };

  const startGame = (): void => {
    if (!socket) return;
    const raw = localStorage.getItem('quiz:pending-options');
    let opts: unknown = { rounds: 10, audioMode: 'remote', hostIsPlayer: true };
    if (raw) { try { opts = JSON.parse(raw); } catch { /* ignore */ } }
    socket.emit('room:start', { roomId: session.roomId, gameOptions: opts }, () => { /* ack */ });
  };

  const restart = (): void => {
    if (!socket) return;
    const raw = localStorage.getItem('quiz:pending-options');
    let opts: unknown = { rounds: 10, audioMode, hostIsPlayer };
    if (raw) { try { opts = JSON.parse(raw); } catch { /* ignore */ } }
    socket.emit('room:start', { roomId: session.roomId, gameOptions: opts }, () => { /* ack */ });
  };

  const skipReveal = (): void => {
    if (!socket) return;
    socket.emit('quiz:next', { roomId: session.roomId }, () => { /* ack */ });
  };

  const togglePauseReveal = (paused: boolean): void => {
    if (!socket) return;
    socket.emit('quiz:pause', { roomId: session.roomId, paused }, () => { /* ack */ });
  };

  // Nao-jogadores (presenters) nao contam para "esperando responder"
  const nonPresenters = room.players.filter(
    (p) => !(p.id === room.hostId && !hostIsPlayer),
  );
  const waitingCount = phase === 'playing'
    ? Math.max(0, nonPresenters.length - (myAnswer !== undefined ? 1 : 0))
    : 0;
  // (Contagem real do "responderam" so o server sabe; UI usa o que sabemos localmente)
  const totalPlayers = nonPresenters.length;

  // ---- Sala em lobby ----
  if (!phase || phase === 'lobby') {
    return (
      <div className="q-container">
        <RoomHeader room={room} isHost={isHost} onLeave={leave} />
        <ErrorAlert error={lastError} onClose={clearError} />
        <div className="q-card">
          <h2>👥 Sala de espera</h2>
          <PlayerList players={room.players} hostId={room.hostId} hostIsPlayer={hostIsPlayer} />
          {isHost ? (
            <>
              <p className="q-help" style={{ marginTop: 12 }}>
                Voce e o host. Quando todos entrarem, inicie a partida.
              </p>
              <button className="q-btn" onClick={startGame}>
                Iniciar partida
              </button>
            </>
          ) : (
            <p className="q-help" style={{ marginTop: 12, textAlign: 'center' }}>
              Aguardando o host iniciar...
            </p>
          )}
        </div>
      </div>
    );
  }

  // ---- Preloading ----
  if (phase === 'preloading') {
    return (
      <div className="q-container">
        <ErrorAlert error={lastError} onClose={clearError} />
        <div className="q-question">
          <div className="q-preload">
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              Carregando pergunta {(question?.index ?? 0) + 1}...
            </div>
            <div className="beat">
              <span /><span /><span /><span /><span />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Playing ----
  if (phase === 'playing' && question) {
    return (
      <div className="q-container">
        <ErrorAlert error={lastError} onClose={clearError} />
        <QuestionScreen
          question={question}
          isPresenter={isPresenter}
          audioMode={audioMode}
          isHost={isHost}
          waitingCount={waitingCount}
          totalPlayers={totalPlayers}
        />
      </div>
    );
  }

  // ---- Reveal (ranking entre rodadas) ----
  if (phase === 'reveal' && reveal) {
    const correctText = question?.options[reveal.correctIndex] ?? '';
    return (
      <div className="q-container">
        <ErrorAlert error={lastError} onClose={clearError} />
        <RankingBoard
          reveal={reveal}
          myPlayerId={session.playerId}
          correctAnswerText={correctText}
          isHost={isHost}
          onSkip={skipReveal}
          onTogglePause={togglePauseReveal}
          clockOffset={clockOffset}
        />
      </div>
    );
  }

  // ---- Finished ----
  if (phase === 'finished' && final) {
    return (
      <div className="q-container">
        <ErrorAlert error={lastError} onClose={clearError} />
        <FinalReveal
          final={final}
          isHost={isHost}
          onRestart={restart}
          onLeave={leave}
        />
      </div>
    );
  }

  return <div className="q-splash">Aguardando...</div>;
}

function RoomHeader(props: {
  room: NonNullable<ReturnType<typeof useQuiz.getState>['room']>;
  isHost: boolean;
  onLeave: () => void;
}): JSX.Element {
  const copyLink = (): void => {
    const u = new URL(window.location.href);
    u.searchParams.set('room', props.room.roomId);
    void navigator.clipboard.writeText(u.toString()).catch(() => { /* ignore */ });
  };
  return (
    <div className="q-room-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="q-room-code">{props.room.roomId.slice(0, 8)}...</span>
        <button className="q-btn small secondary" onClick={copyLink}>Copiar link</button>
      </div>
      <button className="q-btn small danger" onClick={props.onLeave}>Sair</button>
    </div>
  );
}

function PlayerList(props: {
  players: NonNullable<ReturnType<typeof useQuiz.getState>['room']>['players'];
  hostId: string;
  hostIsPlayer: boolean;
}): JSX.Element {
  return (
    <div className="q-players">
      {props.players.map((p) => {
        const isHost = p.id === props.hostId;
        const isPresenter = isHost && !props.hostIsPlayer;
        return (
          <div key={p.id} className={`q-player-chip ${p.connected ? '' : 'disconnected'}`}>
            <span className="dot" style={{ background: p.color ?? '#334155' }}>
              {p.name[0]?.toUpperCase() ?? '?'}
            </span>
            <span>{p.name}</span>
            {isHost && <span className="host-badge">👑</span>}
            {isPresenter && <span className="presenter-badge">🎤 apresentador</span>}
          </div>
        );
      })}
    </div>
  );
}
