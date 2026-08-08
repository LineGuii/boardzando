import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';

interface MinReq {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
}

/**
 * Guard HTTP que exige `Authorization: Bearer <jwt>` com `typ: 'admin'`.
 * Primeiro (e unico) guard HTTP do projeto — WsThrottlerGuard cobre so a
 * camada WebSocket. Nunca registrar como APP_GUARD: proteger endpoint a
 * endpoint via @UseGuards.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  private readonly logger = new Logger(AdminGuard.name);

  constructor(private readonly auth: AuthService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<MinReq>();
    const raw = req.headers.authorization;
    const header = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '');
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (!match) {
      throw new UnauthorizedException('Faltou o token admin.');
    }
    try {
      this.auth.verifyAdmin(match[1]!);
      return true;
    } catch {
      this.logger.warn(`Admin token invalido de ${req.ip ?? '?'}`);
      throw new UnauthorizedException('Token admin invalido ou expirado.');
    }
  }
}
