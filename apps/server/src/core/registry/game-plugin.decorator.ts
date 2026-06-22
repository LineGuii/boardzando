import { DiscoveryService } from '@nestjs/core';

/**
 * Decorator que marca um provider como um jogo plugavel. O GameRegistry usa o
 * DiscoveryService para encontrar todos os providers anotados no bootstrap.
 *
 * Uso:
 *   @GamePlugin()
 *   export class UnoGame implements GameDefinition<UnoState> { ... }
 */
export const GamePlugin = DiscoveryService.createDecorator();
