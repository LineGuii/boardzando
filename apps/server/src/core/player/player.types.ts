import type { PlayerId } from '@boardzando/contracts';

export interface Player {
  id: PlayerId;
  name: string;
  /** false durante o periodo de carencia de reconexao. */
  connected: boolean;
  /** Cor de fundo do avatar (paleta AVATAR_COLORS). */
  color?: string;
  /** socket.id atual (se conectado). */
  socketId?: string;
  /** timestamp do ultimo desligamento, para timeout de reconexao. */
  disconnectedAt?: number;
}
