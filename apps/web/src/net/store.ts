import { create } from 'zustand';
import type { ChatMessage, RoomSnapshot, WsError } from '@board-games/contracts';
import type { GameClientSocket } from './socket';

interface GameStore {
  socket?: GameClientSocket;
  session?: { roomId: string; playerId: string };
  room?: RoomSnapshot;
  view?: unknown; // estado de jogo filtrado (playerView)
  phase?: string;
  turn?: number;
  chat: ChatMessage[];
  lastError?: WsError;
  setSocket: (s: GameClientSocket, session: { roomId: string; playerId: string }) => void;
  reset: () => void;
}

export const useGame = create<GameStore>((set) => ({
  chat: [],
  setSocket: (socket, session) => {
    socket.on('room:update', (room) => set({ room }));
    socket.on('game:state', ({ view, phase, turn }) => set({ view, phase, turn }));
    socket.on('chat:message', (msg) => set((st) => ({ chat: [...st.chat, msg] })));
    socket.on('error', (lastError) => set({ lastError }));
    set({ socket, session });
  },
  reset: () => set({ socket: undefined, session: undefined, room: undefined, view: undefined, chat: [] }),
}));
