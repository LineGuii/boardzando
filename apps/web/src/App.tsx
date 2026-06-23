import { useEffect, useState } from 'react';
import { api } from './net/api';
import { connectSocket } from './net/socket';
import { useGame } from './net/store';
import { UnoBoard } from './games/uno/UnoBoard';
import { UnoOffTurnControls } from './games/uno/UnoOffTurnControls';
import { TurnGate } from './shell/TurnGate';
import { GameOverBanner } from './shell/GameOverBanner';
import './shell/shell.css';

/**
 * UI da CASCA: lobby de entrada (criar/entrar em sala) e cabecalho de sala.
 * Suporta deep-link via `?room=<id>` (pre-seleciona "Entrar" com o id pronto)
 * e oferece botoes para copiar o id da sala / link de convite.
 */
export function App(): JSX.Element {
  const session = useGame((s) => s.session);
  return session ? <RoomPage /> : <Lobby />;
}

// ============================================================
// LOBBY
// ============================================================

function Lobby(): JSX.Element {
  const setSocket = useGame((s) => s.setSocket);
  const lastError = useGame((s) => s.lastError);

  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [roomId, setRoomId] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pre-seleciona "Entrar" se a URL tem ?room=<id>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rid = params.get('room');
    if (rid) {
      setRoomId(rid);
      setTab('join');
    }
  }, []);

  async function enter(action: 'create' | 'join'): Promise<void> {
    setBusy(true);
    setErrorMsg(null);
    try {
      const res =
        action === 'create'
          ? await api.createRoom('uno', name.trim(), password || undefined)
          : await api.joinRoom(roomId.trim(), name.trim(), password || undefined);
      const socket = connectSocket(res.token);
      setSocket(socket, { roomId: res.roomId, playerId: res.playerId });
    } catch (e) {
      setErrorMsg((e as Error).message || 'Falha ao conectar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell-bg">
      <div className="shell-container">
        <div className="shell-hero">
          <div className="shell-dice" aria-hidden>🎲 🃏 🎯</div>
          <h1>Boardzando</h1>
          <p className="shell-tagline">
            Jogue board games com seus amigos. Sem cadastro, sem fricção.
          </p>
        </div>

        <div className="shell-card">
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
                <span className="shell-icon">🎴</span> Nova sala de UNO
              </h2>
              <div className="shell-field">
                <label className="shell-label" htmlFor="name-create">Seu nome</label>
                <input
                  id="name-create"
                  className="shell-input"
                  placeholder="Ex.: Alice"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={24}
                />
              </div>
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
                disabled={busy || name.trim().length < 2}
                onClick={() => enter('create')}
              >
                {busy ? 'Criando...' : 'Criar sala de UNO'}
              </button>
            </>
          ) : (
            <>
              <h2>
                <span className="shell-icon">🚪</span> Entrar em uma sala
              </h2>
              <div className="shell-field">
                <label className="shell-label" htmlFor="name-join">Seu nome</label>
                <input
                  id="name-join"
                  className="shell-input"
                  placeholder="Ex.: Bob"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={24}
                />
              </div>
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
                {busy ? 'Entrando...' : 'Entrar na sala'}
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

// ============================================================
// SALA
// ============================================================

function RoomPage(): JSX.Element {
  const session = useGame((s) => s.session)!;
  const room = useGame((s) => s.room);
  const lastError = useGame((s) => s.lastError);

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

  return (
    <div className="shell-bg">
      <div className="shell-container">
        <RoomHeader roomId={session.roomId} inviteLink={inviteLink} />

        {room?.status === 'lobby' && isHost && (
          <button
            className="shell-button start-game"
            onClick={() =>
              useGame.getState().socket?.emit(
                'room:start',
                { roomId: session.roomId },
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

        {room?.status === 'playing' && (
          <>
            <UnoOffTurnControls />
            <TurnGate>
              <UnoBoard />
            </TurnGate>
          </>
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
          <CopyButton text={roomId} label="Copiar ID" copiedLabel="ID copiado!" icon="📋" />
          <CopyButton
            text={inviteLink}
            label="Copiar link de convite"
            copiedLabel="Link copiado!"
            icon="🔗"
          />
        </div>
      </div>

      {room?.players && room.players.length > 0 && (
        <ul className="shell-players">
          {room.players.map((p) => (
            <li key={p.id} className={`shell-player ${p.connected ? '' : 'offline'}`}>
              <span className="shell-player-avatar">{p.name[0] ?? '?'}</span>
              <span>
                {p.name}
                {p.id === session?.playerId ? ' (você)' : ''}
              </span>
              {p.isHost && <span className="host-badge">HOST</span>}
              <span className="dot" />
            </li>
          ))}
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
