import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import type { RoomSessionPayload } from './jwt-payload';

/**
 * Responsavel por (1) hashear/verificar a senha da SALA com Argon2id usando os
 * parametros recomendados pela OWASP (2024), e (2) emitir/validar o JWT de
 * sessao curto que autentica o handshake WebSocket e reconexoes.
 *
 * Nao ha contas individuais: a "identidade" e o playerId (UUID) embutido no JWT
 * e dura o tempo de vida da sala.
 */
@Injectable()
export class AuthService {
  private readonly argonOptions: argon2.Options;

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

  signSession(payload: RoomSessionPayload): string {
    return this.jwt.sign(payload);
  }

  verifySession(token: string): RoomSessionPayload {
    return this.jwt.verify<RoomSessionPayload>(token);
  }
}
