import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@boardzando/contracts';

export type GameClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Conecta ao namespace /games autenticando com o JWT de sessao no handshake.
 *
 * Transportes: comeca em long-polling (HTTPS puro — atravessa qualquer
 * proxy/CDN/tunel) e faz upgrade para WebSocket quando possivel. NAO force
 * `transports: ['websocket']`: navegadores atras de Cloudflare/HTTP3 tem
 * handshakes WS instaveis, e sem fallback o jogador simplesmente nao conecta
 * (sintoma: "WebSocket connection to wss://... failed" em loop no console).
 *
 * Reconexao: sem teto de tentativas — o servidor de dev reinicia a cada
 * recompilacao e o cliente deve se re-conectar sozinho. Salas mortas sao
 * tratadas via erro ROOM_NOT_FOUND (o store limpa a sessao).
 */
export function connectSocket(token: string): GameClientSocket {
  return io('/games', {
    auth: { token },
    reconnection: true,
  });
}
