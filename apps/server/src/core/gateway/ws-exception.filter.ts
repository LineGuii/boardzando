import { ArgumentsHost, Catch } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import type { WsError } from '@boardzando/contracts';

/**
 * Sem este filtro, erros de validacao viram "Internal server error" no cliente
 * (armadilha conhecida do ValidationPipe em gateways). Aqui normalizamos tudo
 * para o envelope WsError do contrato e emitimos no evento "error".
 */
@Catch()
export class WsAllExceptionsFilter extends BaseWsExceptionFilter {
  override catch(exception: unknown, host: ArgumentsHost): void {
    const client = host.switchToWs().getClient<Socket>();
    const error = this.normalize(exception);
    client.emit('error', error);
  }

  private normalize(exception: unknown): WsError {
    if (exception instanceof WsException) {
      const e = exception.getError();
      if (typeof e === 'object' && e !== null && 'code' in e) return e as WsError;
      return { code: 'VALIDATION', message: String(e) };
    }
    const message = exception instanceof Error ? exception.message : 'Erro interno';
    const known: WsError['code'][] = [
      'UNAUTHORIZED',
      'INVALID_MOVE',
      'NOT_YOUR_TURN',
      'ROOM_FULL',
      'ROOM_NOT_FOUND',
      'RATE_LIMITED',
    ];
    const code = (known.find((c) => message.includes(c)) ?? 'INTERNAL') as WsError['code'];
    return { code, message };
  }
}
