import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@boardzando/contracts';

export type GameClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** Conecta ao namespace /games autenticando com o JWT de sessao no handshake. */
export function connectSocket(token: string): GameClientSocket {
  return io('/games', {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
  });
}
