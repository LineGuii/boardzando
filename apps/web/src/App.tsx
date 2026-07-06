import { useEffect, useState } from 'react';
import type { GameSummary, RoomSummary } from '@boardzando/contracts';
import { AVATAR_COLORS, randomAvatarColor } from '@boardzando/contracts';
import { api } from './net/api';
import { clearSession, loadSession, saveSession } from './net/session';
import { connectSocket } from './net/socket';
import { useGame } from './net/store';
import { UnoBoard } from './games/uno/UnoBoard';
import { HuesBoard } from './games/hues/HuesBoard';
import { SandboxBoard } from './games/sandbox/SandboxBoard';
import { ItoBoard } from './games/ito/ItoBoard';
import { ManadaBoard } from './games/manada/ManadaBoard';
import { PatoBoard } from './games/pato/PatoBoard';
import { TurnGate } from './shell/TurnGate';
import { GameOverBanner } from './shell/GameOverBanner';
import { GameOptionsPanel } from './shell/GameOptionsPanel';
import './shell/shell.css';

/**
 * UI da CASCA: lobby de entrada (criar/entrar em sala) e cabecalho de sala.
 * Suporta deep-link via `?room=<id>` (pre-seleciona "Entrar" com o id pronto)
 * e oferece botoes para copiar o id da sala / link de convite.
 */
export function App(): JSX.Element {
  const session = useGame((s) => s.session);
  const setSocket = useGame((s) => s.setSocket);
  // Retomada de sessão: se ?room=<id> na URL bate com uma sessão salva no
  // localStorage, reconectamos automaticamente usando o token guardado.
  // Exibe um splash enquanto tenta.
  const [resuming, setResuming] = useState(() => {
    if (typeof window === 'undefined') return false;
    const saved = loadSession();
    if (!saved) return false;
    const roomFromUrl = new URLSearchParams(window.location.search).get('room');
    return !!roomFromUrl && roomFromUrl === saved.roomId;
  });
  const [resumeError, setResumeError] = useState<string | null>(null);

  useEffect(() => {
    if (!resuming || session) return;
    const saved = loadSession();
    if (!saved) {
      setResuming(false);
      return;
    }
    const socket = connectSocket(saved.token);
    let done = false;
    const onOk = (): void => {
      if (done) return;
      done = true;
      setSocket(socket, { roomId: saved.roomId, playerId: saved.playerId });
      setResuming(false);
    };
    const onErr = (err: Error): void => {
      if (done) return;
      done = true;
      try { socket.disconnect(); } catch { /* ok */ }
      clearSession();
      // remove ?room da URL — se o token era ruim, não faz sentido tentar de novo.
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('room');
        window.history.replaceState(null, '', url.toString());
      } catch { /* ignora */ }
      setResumeError(
        err.message === 'UNAUTHORIZED'
          ? 'Sua sessão expirou. Entre na sala novamente.'
          : 'Não foi possível reconectar. Entre na sala novamente.',
      );
      setResuming(false);
    };
    socket.once('connect', onOk);
    socket.once('connect_error', onErr);
    // fallback: se em 5s nada aconteceu, desiste
    const t = window.setTimeout(() => onErr(new Error('TIMEOUT')), 5000);
    return () => {
      window.clearTimeout(t);
      socket.off('connect', onOk);
      socket.off('connect_error', onErr);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resuming]);

  if (resuming) return <ResumeSplash />;
  if (session) return <RoomPage />;
  return <Lobby initialError={resumeError} />;
}

function ResumeSplash(): JSX.Element {
  return (
    <div className="shell-bg">
      <div className="shell-container" style={{ textAlign: 'center', padding: '80px 16px' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔄</div>
        <h2 style={{ margin: 0 }}>Reconectando à sala...</h2>
        <p style={{ color: '#6b5f4e', marginTop: 8 }}>
          Retomando sua sessão. Se demorar, atualize a página.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// LOBBY
// ============================================================

function Lobby({ initialError }: { initialError?: string | null } = {}): JSX.Element {
  const setSocket = useGame((s) => s.setSocket);
  const lastError = useGame((s) => s.lastError);

  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [roomId, setRoomId] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(initialError ?? null);

  const [games, setGames] = useState<GameSummary[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  // Cor do avatar: começa numa cor aleatória da paleta.
  const [color, setColor] = useState<string>(() => randomAvatarColor());

  // Pre-seleciona "Entrar" se a URL tem ?room=<id>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rid = params.get('room');
    if (rid) {
      setRoomId(rid);
      setTab('join');
    }
  }, []);

  // Carrega a lista de jogos uma vez.
  useEffect(() => {
    api
      .listGames()
      .then((gs) => {
        setGames(gs);
        if (gs.length > 0 && !selectedGameId) setSelectedGameId(gs[0]!.id);
      })
      .catch(() => {
        /* silencioso: o usuario ve quando tentar criar */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Carrega a lista de salas ao abrir a aba "Entrar".
  function refreshRooms(): void {
    setLoadingRooms(true);
    api
      .listRooms()
      .then(setRooms)
      .catch(() => setRooms([]))
      .finally(() => setLoadingRooms(false));
  }
  useEffect(() => {
    if (tab === 'join') refreshRooms();
  }, [tab]);

  async function enter(action: 'create' | 'join'): Promise<void> {
    setBusy(true);
    setErrorMsg(null);
    try {
      const res =
        action === 'create'
          ? await api.createRoom(selectedGameId || 'uno', name.trim(), password || undefined, color)
          : await api.joinRoom(roomId.trim(), name.trim(), password || undefined, color);
      // persiste sessão para reconectar em F5 / voltar pelo link
      saveSession({ roomId: res.roomId, playerId: res.playerId, token: res.token });
      const socket = connectSocket(res.token);
      setSocket(socket, { roomId: res.roomId, playerId: res.playerId });
    } catch (e) {
      setErrorMsg((e as Error).message || 'Falha ao conectar.');
    } finally {
      setBusy(false);
    }
  }

  const gameNameById = (id: string): string =>
    games.find((g) => g.id === id)?.name ?? id;

  return (
    <div className={`shell-bg shell-bg-${tab}`}>
      <ShellDoodles />
      <div className="shell-container">
        <div className="shell-hero">
          <h1>Boardzando</h1>
          <p className="shell-tagline">
            Jogue board games com seus amigos. Sem cadastro, sem fricção.
          </p>
        </div>

        <div className={`shell-card shell-card-${tab}`}>
          <div className="shell-tabs" role="tablist">
            <button
              type="button"
              className={`shell-tab ${tab === 'create' ? 'active' : ''}`}
              onClick={() => setTab('create')}
              role="tab"
              aria-selected={tab === 'create'}
            >
              Criar sala
            </button>
            <button
              type="button"
              className={`shell-tab ${tab === 'join' ? 'active' : ''}`}
              onClick={() => setTab('join')}
              role="tab"
              aria-selected={tab === 'join'}
            >
              Entrar em sala
            </button>
          </div>

          {tab === 'create' ? (
            <>
              <h2>
                Nova sala
              </h2>
              <div className="shell-field">
                <label className="shell-label" htmlFor="game-create">Jogo</label>
                <select
                  id="game-create"
                  className="shell-input"
                  value={selectedGameId}
                  onChange={(e) => setSelectedGameId(e.target.value)}
                  disabled={games.length === 0}
                >
                  {games.length === 0 && <option value="">Carregando...</option>}
                  {games.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.minPlayers}-{g.maxPlayers} jogadores)
                    </option>
                  ))}
                </select>
              </div>
              <NameField
                id="name-create"
                placeholder="Ex.: Alice"
                name={name}
                setName={setName}
                color={color}
                setColor={setColor}
              />
              <div className="shell-field">
                <label className="shell-label" htmlFor="pw-create">
                  Senha da sala{' '}
                  <span style={{ fontWeight: 400, color: '#8a7d65' }}>(opcional)</span>
                </label>
                <input
                  id="pw-create"
                  className="shell-input"
                  type="password"
                  placeholder="Deixe em branco para sala pública"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  maxLength={128}
                />
                <p className="shell-hint">
                  Sem senha, qualquer pessoa com o link entra.
                </p>
              </div>
              <button
                className="shell-button"
                disabled={busy || name.trim().length < 2 || !selectedGameId}
                onClick={() => enter('create')}
              >
                {busy
                  ? 'Criando...'
                  : `Criar sala de ${gameNameById(selectedGameId) || '...'}`}
              </button>
            </>
          ) : (
            <>
              <h2>
                Entrar em uma sala
              </h2>
              <div className="shell-field">
                <div className="shell-rooms-header">
                  <label className="shell-label">Salas abertas</label>
                  <button
                    type="button"
                    className="shell-link-btn"
                    onClick={refreshRooms}
                    disabled={loadingRooms}
                  >
                    {loadingRooms ? 'Atualizando...' : '↻ Atualizar'}
                  </button>
                </div>
                {rooms.length === 0 ? (
                  <p className="shell-hint">
                    {loadingRooms
                      ? 'Buscando salas...'
                      : 'Nenhuma sala pública aberta. Crie uma ou cole um código abaixo.'}
                  </p>
                ) : (
                  <ul className="shell-room-list">
                    {rooms.map((r) => (
                      <li
                        key={r.roomId}
                        className={`shell-room-row ${
                          roomId === r.roomId ? 'selected' : ''
                        }`}
                        onClick={() => setRoomId(r.roomId)}
                      >
                        <div className="shell-room-row-main">
                          <span className="shell-room-row-game">
                            {gameNameById(r.gameId)}
                          </span>
                          <span className="shell-room-row-host">
                            host: <b>{r.hostName}</b>
                          </span>
                        </div>
                        <span className="shell-room-row-meta">
                          {r.playerCount}/{r.maxPlayers}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <NameField
                id="name-join"
                placeholder="Ex.: Bob"
                name={name}
                setName={setName}
                color={color}
                setColor={setColor}
              />
              <div className="shell-field">
                <label className="shell-label" htmlFor="room-join">ID da sala</label>
                <input
                  id="room-join"
                  className="shell-input"
                  placeholder="Cole o ID recebido do anfitrião"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  maxLength={64}
                />
              </div>
              <div className="shell-field">
                <label className="shell-label" htmlFor="pw-join">
                  Senha{' '}
                  <span style={{ fontWeight: 400, color: '#8a7d65' }}>(se a sala pedir)</span>
                </label>
                <input
                  id="pw-join"
                  className="shell-input"
                  type="password"
                  placeholder="Deixe em branco para salas públicas"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  maxLength={128}
                />
              </div>
              <button
                className="shell-button secondary"
                disabled={busy || name.trim().length < 2 || roomId.trim().length < 1}
                onClick={() => enter('join')}
              >
                {busy ? 'Entrando...' : '🚪 Entrar na sala'}
              </button>
            </>
          )}

          {(errorMsg || lastError) && (
            <p className="shell-error">{errorMsg ?? lastError?.message}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Campo "Seu nome" com o ícone do jogador ao lado. Clicar no ícone abre um
 * popover com as cores (escondido por padrão — menos poluído).
 */
function NameField({
  id,
  placeholder,
  name,
  setName,
  color,
  setColor,
}: {
  id: string;
  placeholder: string;
  name: string;
  setName: (v: string) => void;
  color: string;
  setColor: (v: string) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const initial = (name.trim()[0] ?? '?').toUpperCase();

  return (
    <div className="shell-field">
      <label className="shell-label" htmlFor={id}>Seu nome</label>
      <div className="shell-name-row">
        <div className="shell-avatar-wrap">
          <button
            type="button"
            className="shell-avatar-btn"
            style={{ background: color }}
            onClick={() => setOpen((o) => !o)}
            title="Escolher a cor do seu ícone"
            aria-label="Escolher a cor do seu ícone"
            aria-expanded={open}
          >
            {initial}
            <span className="shell-avatar-edit" aria-hidden>🎨</span>
          </button>
          {open && (
            <>
              <div className="shell-color-backdrop" onClick={() => setOpen(false)} />
              <div className="shell-color-pop" role="listbox" aria-label="Cores do ícone">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`shell-color-swatch ${color === c ? 'active' : ''}`}
                    style={{ background: c }}
                    onClick={() => {
                      setColor(c);
                      setOpen(false);
                    }}
                    aria-label={`Cor ${c}`}
                    aria-selected={color === c}
                  />
                ))}
              </div>
            </>
          )}
        </div>
        <input
          id={id}
          className="shell-input"
          placeholder={placeholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={24}
        />
      </div>
    </div>
  );
}

/** Fundo decorativo com rabiscos de board game (estilo "portal de jogos"). */
function ShellDoodles(): JSX.Element {
  return (
    <svg className="shell-doodles" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern
          id="bz-doodles"
          width="150"
          height="150"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-8)"
        >
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinejoin="round"
            strokeLinecap="round"
          >
            {/* dado */}
            <rect x="14" y="18" width="32" height="32" rx="7" />
            <circle cx="23" cy="27" r="2.2" fill="currentColor" stroke="none" />
            <circle cx="30" cy="34" r="2.2" fill="currentColor" stroke="none" />
            <circle cx="37" cy="41" r="2.2" fill="currentColor" stroke="none" />
            {/* carta */}
            <rect
              x="0"
              y="0"
              width="24"
              height="34"
              rx="5"
              transform="translate(98 12) rotate(14)"
            />
            {/* estrela */}
            <path
              transform="translate(18 84)"
              d="M12 2 l2.9 6.3 6.9 .6 -5.2 4.6 1.6 6.8 -6.2 -3.6 -6.2 3.6 1.6 -6.8 -5.2 -4.6 6.9 -.6 z"
            />
            {/* coração */}
            <path
              transform="translate(96 80)"
              d="M12 21 C12 21 4 13.5 4 8.5 C4 5.5 6.5 4 8.5 4 C10.5 4 12 6 12 6 C12 6 13.5 4 15.5 4 C17.5 4 20 5.5 20 8.5 C20 13.5 12 21 12 21 Z"
            />
            {/* bolinhas */}
            <circle cx="132" cy="126" r="5" />
            <circle cx="74" cy="66" r="3" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#bz-doodles)" />
    </svg>
  );
}

// ============================================================
// SALA
// ============================================================

function RoomPage(): JSX.Element {
  const session = useGame((s) => s.session)!;
  const room = useGame((s) => s.room);
  const view = useGame((s) => s.view) as { kind?: string } | undefined;
  const matchGen = useGame((s) => s.matchGen);
  const lastError = useGame((s) => s.lastError);
  const [gameOptions, setGameOptions] = useState<unknown>(undefined);

  // Sincroniza a URL com o roomId atual para que F5 / Compartilhar preservem a sala.
  useEffect(() => {
    if (!session.roomId) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('room') !== session.roomId) {
      url.searchParams.set('room', session.roomId);
      window.history.replaceState(null, '', url.toString());
    }
  }, [session.roomId]);

  const inviteLink = `${window.location.origin}${window.location.pathname}?room=${session.roomId}`;
  const playerCount = room?.players?.length ?? 0;
  const isHost = room?.hostId === session.playerId;

  const wide =
    room?.status === 'playing' &&
    (room?.gameId === 'hues' ||
      room?.gameId === 'monopoly' ||
      room?.gameId === 'ito' ||
      room?.gameId === 'manada');

  return (
    <div className="shell-bg">
      <div className={`shell-container ${wide ? 'wide' : ''}`}>
        <RoomHeader roomId={session.roomId} inviteLink={inviteLink} />

        {room?.status === 'lobby' && isHost && room?.gameId && (
          <GameOptionsPanel
            gameId={room.gameId}
            value={gameOptions}
            onChange={setGameOptions}
          />
        )}

        {room?.status === 'lobby' && isHost && (
          <button
            className="shell-button start-game"
            onClick={() =>
              useGame.getState().socket?.emit(
                'room:start',
                { roomId: session.roomId, gameOptions },
                () => {},
              )
            }
            disabled={playerCount < 2}
            title={playerCount < 2 ? 'Aguardando mais jogadores...' : ''}
          >
            {playerCount < 2 ? 'Aguardando jogadores...' : '▶ Iniciar jogo'}
          </button>
        )}

        {room?.status === 'lobby' && !isHost && (
          <p style={{ textAlign: 'center', color: '#6b5f4e' }}>
            Aguardando o host iniciar o jogo...
          </p>
        )}

        {room?.status === 'playing' && view?.kind === 'sandbox' && (
          <SandboxBoard key={matchGen} />
        )}

        {room?.status === 'playing' && room?.gameId === 'ito' && <ItoBoard key={matchGen} />}

        {room?.status === 'playing' && room?.gameId === 'pato' && <PatoBoard key={matchGen} />}

        {room?.status === 'playing' && room?.gameId === 'manada' && (
          <ManadaBoard key={matchGen} />
        )}

        {room?.status === 'playing' && room?.gameId === 'hues' && <HuesBoard key={matchGen} />}

        {room?.status === 'playing' && room?.gameId === 'uno' && (
          <TurnGate key={matchGen}>
            <UnoBoard />
          </TurnGate>
        )}

        <GameOverBanner />

        {lastError && <p className="shell-error">{lastError.message}</p>}
      </div>
    </div>
  );
}

/**
 * Cabecalho da sala: id curto, copia do id e do link de convite, lista de
 * jogadores com avatar inicial.
 */
function RoomHeader({
  roomId,
  inviteLink,
}: {
  roomId: string;
  inviteLink: string;
}): JSX.Element {
  const room = useGame((s) => s.room);
  const session = useGame((s) => s.session);

  return (
    <div className="shell-room-card">
      <div className="shell-room-top">
        <div className="shell-room-id-block">
          <span className="label">ID da sala</span>
          <span className="shell-room-id" title={roomId}>
            {roomId}
          </span>
        </div>
        <div className="shell-room-actions">
          {room?.status !== 'playing' && (
            <>
              <CopyButton text={roomId} label="Copiar ID" copiedLabel="ID copiado!" icon="📋" />
              <CopyButton
                text={inviteLink}
                label="Copiar link de convite"
                copiedLabel="Link copiado!"
                icon="🔗"
              />
            </>
          )}
          <button
            type="button"
            className="shell-copy-btn"
            title="Sair desta sala"
            onClick={() => {
              if (!window.confirm('Sair desta sala?')) return;
              try { useGame.getState().socket?.disconnect(); } catch { /* ok */ }
              clearSession();
              try {
                const url = new URL(window.location.href);
                url.searchParams.delete('room');
                window.history.replaceState(null, '', url.toString());
              } catch { /* ignora */ }
              useGame.getState().reset();
            }}
          >
            🚪 Sair
          </button>
        </div>
      </div>

      {room?.players && room.players.length > 0 && (
        <ul className="shell-players">
          {room.players.map((p) => {
            const isMe = p.id === session?.playerId;
            const iAmHost = room.hostId === session?.playerId;
            const canKick = iAmHost && !isMe && room.status === 'lobby';
            return (
              <li key={p.id} className={`shell-player ${p.connected ? '' : 'offline'}`}>
                <span
                  className="shell-player-avatar"
                  style={p.color ? { background: p.color } : undefined}
                >
                  {p.name[0] ?? '?'}
                </span>
                <span>
                  {p.name}
                  {isMe ? ' (você)' : ''}
                </span>
                {p.isHost && <span className="host-badge">HOST</span>}
                <span className="dot" />
                {canKick && (
                  <button
                    type="button"
                    className="shell-kick-btn"
                    title={`Remover ${p.name} da sala`}
                    onClick={() => {
                      if (!window.confirm(`Remover ${p.name} da sala?`)) return;
                      useGame.getState().socket?.emit(
                        'room:kick',
                        { roomId: room.roomId, playerId: p.id },
                        () => {},
                      );
                    }}
                  >
                    ✕
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Botao "Copiar" com feedback temporario "Copiado!". */
function CopyButton({
  text,
  label,
  copiedLabel,
  icon,
}: {
  text: string;
  label: string;
  copiedLabel: string;
  icon?: string;
}): JSX.Element {
  const [copied, setCopied] = useState(false);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback para contextos sem Clipboard API (HTTP nao-localhost, etc.)
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        /* desistir silenciosamente */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      className={`shell-copy-btn ${copied ? 'copied' : ''}`}
      onClick={copy}
    >
      {icon && <span aria-hidden>{icon}</span>}
      {copied ? copiedLabel : label}
    </button>
  );
}
