import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { GameRegistryService } from './registry/game-registry.service';
import { RoomService } from './room/room.service';
import { GameGateway } from './gateway/game.gateway';

/**
 * NUCLEO GENERICO. Nao importa nenhum jogo concreto. Expoe registro, salas e o
 * gateway. Os jogos sao descobertos em runtime via DiscoveryModule (qualquer
 * provider @GamePlugin carregado pela aplicacao e indexado pelo registry).
 */
@Module({
  imports: [DiscoveryModule],
  providers: [GameRegistryService, RoomService, GameGateway],
  exports: [GameRegistryService, RoomService],
})
export class CoreModule {}
