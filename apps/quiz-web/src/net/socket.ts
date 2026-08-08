import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@boardzando/contracts';

export type QuizClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function connectSocket(token: string): QuizClientSocket {
  return io('/games', { auth: { token }, reconnection: true });
}
