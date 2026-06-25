import { create } from 'zustand';
import type { ChatMessage, GameOverResult, RoomSnapshot, WsError } from '@boardzando/contracts';
import type { GameClientSocket } from './socket';

/** Posicao ao vivo de uma peca sendo arrastada por outro jogador (efemera). */
export interface DragOverride {
  x: number;
  y: number;
  z?: number;
  rotation?: number;
  by: string;
  at: number;
}

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
  /** Posicoes ao vivo de pecas arrastadas por outros (jogos sandbox). */
  dragOverrides: Record<string, DragOverride>;
  chat: ChatMessage[];
  lastError?: WsError;
  setSocket: (s: GameClientSocket, session: { roomId: string; playerId: string }) => void;
  reset: () => void;
}

export const useGame = create<GameStore>((set) => ({
  chat: [],
  dragOverrides: {},
  setSocket: (socket, session) => {
    socket.on('room:update', (room) => set({ room }));
    socket.on('game:state', ({ view, phase, turn, currentPlayer }) =>
      set({ view, phase, turn, currentPlayer }),
    );
    socket.on('chat:message', (msg) => set((st) => ({ chat: [...st.chat, msg] })));
    socket.on('game:over', ({ result }) => set({ gameOver: result }));
    socket.on('placeable:dragging', ({ id, x, y, z, rotation, by }) =>
      set((st) => ({
        dragOverrides: {
          ...st.dragOverrides,
          [id]: { x, y, z, rotation, by, at: Date.now() },
        },
      })),
    );
    socket.on('error', (lastError) => {
      // se fomos expulsos, encerra a sessao para voltar ao lobby.
      if (lastError.code === 'KICKED') {
        try { socket.disconnect(); } catch { /* ja desconectado */ }
        set({
          socket: undefined,
          session: undefined,
          room: undefined,
          view: undefined,
          currentPlayer: undefined,
          gameOver: undefined,
          chat: [],
          lastError,
        });
        return;
      }
      set({ lastError });
    });
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
      dragOverrides: {},
      chat: [],
    }),
}));

/** Selector da casca: e a vez deste jogador? `undefined` antes do 1o `game:state`. */
export function selectIsMyTurn(s: GameStore): boolean | undefined {
  if (!s.currentPlayer || !s.session) return undefined;
  return s.currentPlayer === s.session.playerId;
}
