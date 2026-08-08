import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import type {
  AdminSessionPayload,
  AnySessionPayload,
  RoomSessionPayload,
} from './jwt-payload';

/**
 * Responsavel por (1) hashear/verificar a senha da SALA com Argon2id usando os
 * parametros recomendados pela OWASP (2024), (2) emitir/validar o JWT de
 * sessao curto que autentica o handshake WebSocket e reconexoes, e (3) emitir
 * o JWT de admin usado pelo editor de quizzes.
 *
 * Nao ha contas individuais de jogador: a "identidade" e o playerId (UUID)
 * embutido no JWT e dura o tempo de vida da sala. Admin e uma senha unica
 * configurada no .env.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly argonOptions: argon2.Options;
  /** Cache do hash da senha admin, gerado on-demand na primeira verificacao. */
  private adminPasswordHash: string | null = null;
  private adminHashPromise: Promise<string | null> | null = null;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.argonOptions = {
      type: argon2.argon2id,
      memoryCost: this.config.get<number>('ARGON_MEMORY_KIB', 19456), // 19 MiB
      timeCost: this.config.get<number>('ARGON_TIME_COST', 2),
      parallelism: this.config.get<number>('ARGON_PARALLELISM', 1),
    };
  }

  hashRoomPassword(plain: string): Promise<string> {
    return argon2.hash(plain, this.argonOptions);
  }

  verifyRoomPassword(hash: string, plain: string): Promise<boolean> {
    return argon2.verify(hash, plain);
  }

  signSession(payload: Omit<RoomSessionPayload, 'typ'>): string {
    return this.jwt.sign({ ...payload, typ: 'room' } satisfies RoomSessionPayload);
  }

  /**
   * Verifica um JWT de sessao de sala. Rejeita explicitamente tokens de outro
   * tipo (admin) mesmo assinados com o mesmo segredo — evita que um token
   * admin trafegue pelo handshake WS e vice-versa.
   */
  verifySession(token: string): RoomSessionPayload {
    const payload = this.jwt.verify<AnySessionPayload>(token);
    if (payload.typ !== 'room') {
      throw new Error('WRONG_TOKEN_TYPE');
    }
    return payload;
  }

  signAdmin(): string {
    return this.jwt.sign({ typ: 'admin', sub: 'admin' } satisfies AdminSessionPayload);
  }

  verifyAdmin(token: string): AdminSessionPayload {
    const payload = this.jwt.verify<AnySessionPayload>(token);
    if (payload.typ !== 'admin') {
      throw new Error('WRONG_TOKEN_TYPE');
    }
    return payload;
  }

  /**
   * Verifica a senha admin do .env. Faz hash em memoria na primeira chamada e
   * reusa — evita hashear na startup e evita comparar strings em texto claro
   * (rodamos verify tempo-constante do argon2). Se ADMIN_PASSWORD nao esta
   * configurado, rejeita tudo.
   */
  async verifyAdminPassword(plain: string): Promise<boolean> {
    const hash = await this.getAdminHash();
    if (!hash) return false;
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  private async getAdminHash(): Promise<string | null> {
    if (this.adminPasswordHash) return this.adminPasswordHash;
    if (this.adminHashPromise) return this.adminHashPromise;
    const configured = this.config.get<string>('ADMIN_PASSWORD');
    if (!configured || configured.length < 4) {
      this.logger.warn('ADMIN_PASSWORD nao configurado (ou muito curto). Endpoints admin ficarao indisponiveis.');
      return null;
    }
    this.adminHashPromise = argon2.hash(configured, this.argonOptions).then((h) => {
      this.adminPasswordHash = h;
      return h;
    });
    return this.adminHashPromise;
  }
}
