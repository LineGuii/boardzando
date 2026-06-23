import { INestApplicationContext, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ConfigService } from '@nestjs/config';
import type { Server, ServerOptions, Socket } from 'socket.io';
import { AuthService } from './auth.service';

/**
 * Adapter que injeta um middleware do Socket.IO validando o JWT no HANDSHAKE.
 * Conexao sem token valido e RECUSADA antes de se estabelecer — abordagem
 * correta (validar por mensagem e caro e nao desconecta de fato no NestJS).
 *
 * Os dados do jogador ficam em `socket.data` para uso pelo gateway/guards.
 */
export class AuthIoAdapter extends IoAdapter {
  private readonly logger = new Logger(AuthIoAdapter.name);
  private readonly auth: AuthService;
  private readonly origin: string;

  constructor(app: INestApplicationContext) {
    super(app);
    this.auth = app.get(AuthService);
    this.origin = app.get(ConfigService).get<string>('WEB_ORIGIN', 'http://localhost:5173');
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    const server: Server = super.createIOServer(port, {
      ...options,
      cors: { origin: this.origin, credentials: true },
    });

    const authMiddleware = (socket: Socket, next: (err?: Error) => void): void => {
      // prefira `auth` ao inves de query string (nao vaza em logs/URLs)
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error('UNAUTHORIZED'));
      try {
        const payload = this.auth.verifySession(token);
        socket.data.player = { id: payload.sub, name: payload.name };
        socket.data.roomId = payload.roomId;
        next();
      } catch {
        this.logger.warn(`Handshake recusado de ${socket.handshake.address}`);
        next(new Error('UNAUTHORIZED'));
      }
    };

    // server.use() so cobre o namespace raiz "/". O gateway usa namespace
    // "/games", entao precisamos aplicar o middleware aos namespaces ja
    // criados e aos que vierem a ser criados pelo NestJS.
    server.use(authMiddleware);
    server.on('new_namespace', (namespace) => namespace.use(authMiddleware));

    return server;
  }
}
