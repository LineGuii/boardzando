import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import type { GameDefinition, GameId } from '@boardzando/contracts';
import { GamePlugin } from './game-plugin.decorator';

/**
 * Indexa todos os jogos plugados (providers anotados com @GamePlugin) por id.
 * O core consulta este registro; nunca importa um jogo concreto diretamente.
 */
@Injectable()
export class GameRegistryService implements OnApplicationBootstrap {
  private readonly logger = new Logger(GameRegistryService.name);
  private readonly games = new Map<GameId, GameDefinition>();

  constructor(private readonly discovery: DiscoveryService) {}

  onApplicationBootstrap(): void {
    const providers = this.discovery.getProviders({ metadataKey: GamePlugin.KEY });
    for (const wrapper of providers) {
      const instance = wrapper.instance as GameDefinition | undefined;
      if (!instance?.id) continue;
      if (this.games.has(instance.id)) {
        throw new Error(`Jogo duplicado registrado: "${instance.id}"`);
      }
      this.games.set(instance.id, instance);
      this.logger.log(`Jogo registrado: ${instance.id} (${instance.name})`);
    }
    this.logger.log(`${this.games.size} jogo(s) plugado(s).`);
  }

  get(id: GameId): GameDefinition | undefined {
    return this.games.get(id);
  }

  getOrThrow(id: GameId): GameDefinition {
    const game = this.games.get(id);
    if (!game) throw new Error(`Jogo nao encontrado: "${id}"`);
    return game;
  }

  list(): Array<Pick<GameDefinition, 'id' | 'name' | 'minPlayers' | 'maxPlayers'>> {
    return [...this.games.values()].map(({ id, name, minPlayers, maxPlayers }) => ({
      id,
      name,
      minPlayers,
      maxPlayers,
    }));
  }
}
