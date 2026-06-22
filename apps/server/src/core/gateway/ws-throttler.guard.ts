import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerException, ThrottlerGuard } from '@nestjs/throttler';
import type { Socket } from 'socket.io';

/**
 * Rate limiting para mensagens WebSocket (anti-flood/spam). Estende o
 * ThrottlerGuard usando o IP do socket como tracker. NAO pode ser registrado
 * como APP_GUARD global — aplique por gateway/handler com @UseGuards.
 */
@Injectable()
export class WsThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, any>): Promise<string> {
    // para socket.io; se usar `ws` puro, troque _socket por conn
    return req._socket?.remoteAddress ?? req.conn?.remoteAddress ?? 'unknown';
  }

  protected override async handleRequest(requestProps: any): Promise<boolean> {
    const { context, limit, ttl, throttler, blockDuration, generateKey } = requestProps;
    const client = context.switchToWs().getClient<Socket>();
    const tracker = await this.getTracker(client);
    const key = generateKey(context, tracker, throttler.name);

    const { totalHits } = await this.storageService.increment(
      key,
      ttl,
      limit,
      blockDuration,
      throttler.name,
    );

    if (totalHits > limit) {
      throw new ThrottlerException('RATE_LIMITED');
    }
    return true;
  }
}
