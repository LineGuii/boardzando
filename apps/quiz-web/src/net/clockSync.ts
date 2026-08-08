import type { QuizClientSocket } from './socket';

/**
 * Sincronia de relogio com o servidor. Faz N pings, calcula offset por ping
 * (offset = serverT - (clientT + rtt/2)) e retorna a mediana — mais robusta a
 * outliers de latencia. Uso: `const off = await syncClock(sock, roomId);
 * serverNow(off)` devolve `Date.now()` corrigido para o relogio do servidor.
 */
export async function syncClock(
  socket: QuizClientSocket,
  roomId: string,
  samples = 5,
): Promise<number> {
  const offsets: number[] = [];
  for (let i = 0; i < samples; i++) {
    const off = await pingOnce(socket, roomId);
    if (off !== null) offsets.push(off);
    await new Promise((r) => setTimeout(r, 40));
  }
  if (offsets.length === 0) return 0;
  offsets.sort((a, b) => a - b);
  return offsets[Math.floor(offsets.length / 2)]!;
}

function pingOnce(socket: QuizClientSocket, roomId: string): Promise<number | null> {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const timeout = setTimeout(() => resolve(null), 1500);
    socket.emit(
      'quiz:ping',
      { roomId, clientT: t0 },
      (res: { serverT: number; clientT: number }) => {
        clearTimeout(timeout);
        const t1 = Date.now();
        const rtt = t1 - t0;
        // offset = serverT - t_middle, onde t_middle = t0 + rtt/2 (assume ida = volta)
        const offset = res.serverT - (t0 + rtt / 2);
        resolve(offset);
      },
    );
  });
}

/** Date.now() ajustado para o relogio do servidor. */
export function serverNow(offset: number): number {
  return Date.now() + offset;
}
