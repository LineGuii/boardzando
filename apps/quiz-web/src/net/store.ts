import { create } from 'zustand';
import type {
  QuizFinalPayload,
  QuizPhase,
  QuizQuestionPublic,
  QuizRevealPayload,
  RoomSnapshot,
  WsError,
} from '@boardzando/contracts';
import { clearSession } from './session';
import type { QuizClientSocket } from './socket';

interface QuizStore {
  socket?: QuizClientSocket;
  session?: { roomId: string; playerId: string };
  room?: RoomSnapshot;

  /** Fase corrente da partida quiz (undefined = sem partida / no lobby). */
  phase?: QuizPhase;
  question?: QuizQuestionPublic;
  reveal?: QuizRevealPayload;
  final?: QuizFinalPayload;
  /** Resposta do jogador para a pergunta corrente (0..3), local. */
  myAnswer?: number;
  /** Offset ms para converter Date.now local em relogio do servidor. */
  clockOffset: number;
  lastError?: WsError;

  clearError: () => void;
  setSocket: (s: QuizClientSocket, session: { roomId: string; playerId: string }) => void;
  setClockOffset: (offset: number) => void;
  setMyAnswer: (idx: number) => void;
  reset: () => void;
}

export const useQuiz = create<QuizStore>((set, get) => ({
  clockOffset: 0,
  clearError: () => set({ lastError: undefined }),
  setClockOffset: (clockOffset) => set({ clockOffset }),
  setMyAnswer: (myAnswer) => set({ myAnswer }),
  setSocket: (socket, session) => {
    socket.on('room:update', (room) => set({ room }));

    socket.on('quiz:preload', ({ question }) => {
      set({ phase: 'preloading', question, reveal: undefined, myAnswer: undefined });
    });
    socket.on('quiz:question', ({ question }) => {
      set({ phase: 'playing', question });
    });
    socket.on('quiz:reveal', ({ reveal }) => {
      set({ phase: 'reveal', reveal });
    });
    socket.on('quiz:final', ({ final }) => {
      set({ phase: 'finished', final });
    });
    socket.on('quiz:snapshot', ({ snapshot }) => {
      set({
        phase: snapshot.phase,
        question: snapshot.question,
        reveal: snapshot.reveal,
        final: snapshot.final,
      });
    });

    socket.on('error', (lastError) => {
      const terminal = lastError.code === 'KICKED' || lastError.code === 'ROOM_NOT_FOUND';
      if (terminal) {
        try { socket.disconnect(); } catch { /* ja fechado */ }
        clearSession();
        try {
          const url = new URL(window.location.href);
          if (url.searchParams.has('room')) {
            url.searchParams.delete('room');
            window.history.replaceState(null, '', url.toString());
          }
        } catch { /* SSR */ }
        set({
          socket: undefined,
          session: undefined,
          room: undefined,
          phase: undefined,
          question: undefined,
          reveal: undefined,
          final: undefined,
          myAnswer: undefined,
          lastError,
        });
        return;
      }
      set({ lastError });
    });

    set({ socket, session });
    void get();
  },
  reset: () =>
    set({
      socket: undefined,
      session: undefined,
      room: undefined,
      phase: undefined,
      question: undefined,
      reveal: undefined,
      final: undefined,
      myAnswer: undefined,
      clockOffset: 0,
    }),
}));
