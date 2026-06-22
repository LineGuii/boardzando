import { useState } from 'react';
import { api } from './net/api';
import { connectSocket } from './net/socket';
import { useGame } from './net/store';
import { UnoBoard } from './games/uno/UnoBoard';

/**
 * UI minima de demonstracao: lobby (criar/entrar) -> sala -> tabuleiro do jogo.
 * Proposito: exercitar o fluxo REST(JWT)->WS->playerView de ponta a ponta.
 * Estilizacao deixada de proposito enxuta.
 */
export function App() {
  const { room, session, setSocket, lastError } = useGame();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [roomId, setRoomId] = useState('');
  const [busy, setBusy] = useState(false);

  async function enter(action: 'create' | 'join') {
    setBusy(true);
    try {
      const res =
        action === 'create'
          ? await api.createRoom('uno', name, password)
          : await api.joinRoom(roomId, name, password);
      const socket = connectSocket(res.token);
      setSocket(socket, { roomId: res.roomId, playerId: res.playerId });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <main style={{ fontFamily: 'system-ui', maxWidth: 420, margin: '40px auto' }}>
        <h1>Board Games</h1>
        <input placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} />
        <input
          placeholder="Senha da sala"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button disabled={busy} onClick={() => enter('create')}>
          Criar sala de UNO
        </button>
        <hr />
        <input placeholder="ID da sala" value={roomId} onChange={(e) => setRoomId(e.target.value)} />
        <button disabled={busy} onClick={() => enter('join')}>
          Entrar
        </button>
        {lastError && <p style={{ color: 'crimson' }}>{lastError.message}</p>}
      </main>
    );
  }

  return (
    <main style={{ fontFamily: 'system-ui', maxWidth: 720, margin: '24px auto' }}>
      <h2>Sala {session.roomId}</h2>
      <p>Status: {room?.status}</p>
      <ul>
        {room?.players.map((p) => (
          <li key={p.id}>
            {p.name} {p.isHost ? '(host)' : ''} {p.connected ? '🟢' : '⚪'}
          </li>
        ))}
      </ul>
      {room?.status === 'lobby' && room.hostId === session.playerId && (
        <button onClick={() => useGame.getState().socket?.emit('room:start', { roomId: session.roomId }, () => {})}>
          Iniciar jogo
        </button>
      )}
      {room?.status === 'playing' && <UnoBoard />}
      {lastError && <p style={{ color: 'crimson' }}>{lastError.message}</p>}
    </main>
  );
}
