import { create } from 'zustand';
import type { ChatMessage, GameOverResult, RoomSnapshot, WsError } from '@boardzando/contracts';
import type { GameClientSocket } from './socket';

interface GameStore {
  socket?: GameClientSocket;
  session?: { roomId: string; playerId: string };
  room?: RoomSnapshot;
  view?: unknown; // estado de jogo filtrado (playerView)
  phase?: string;
  turn?: number;
  /** Quem deve jogar agora; alimentado pelo `game:state`. */
  currentPlayer?: string;
  /** Resultado da partida (vencedor, etc.); alimentado pelo `game:over`. */
  gameOver?: GameOverResult;
  chat: ChatMessage[];
  lastError?: WsError;
  setSocket: (s: GameClientSocket, session: { roomId: string; playerId: string }) => void;
  reset: () => void;
}

export const useGame = create<GameStore>((set) => ({
  chat: [],
  setSocket: (socket, session) => {
    socket.on('room:update', (room) => set({ room }));
    socket.on('game:state', ({ view, phase, turn, currentPlayer }) =>
      set({ view, phase, turn, currentPlayer }),
    );
    socket.on('chat:message', (msg) => set((st) => ({ chat: [...st.chat, msg] })));
    socket.on('game:over', ({ result }) => set({ gameOver: result }));
    socket.on('error', (lastError) => set({ lastError }));
    set({ socket, session });
  },
  reset: () =>
    set({
      socket: undefined,
      session: undefined,
      room: undefined,
      view: undefined,
      currentPlayer: undefined,
      gameOver: undefined,
      chat: [],
    }),
}));

/** Selector da casca: e a vez deste jogador? `undefined` antes do 1o `game:state`. */
export function selectIsMyTurn(s: GameStore): boolean | undefined {
  if (!s.currentPlayer || !s.session) return undefined;
  return s.currentPlayer === s.session.playerId;
}
