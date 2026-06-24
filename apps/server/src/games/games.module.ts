import { Module } from '@nestjs/common';
import { HuesModule } from './hues/hues.module';
import { UnoModule } from './uno/uno.module';

/**
 * Agrega todos os jogos plugados. Para adicionar um jogo novo:
 *   1. crie a pasta `games/<id>/` implementando GameDefinition;
 *   2. exporte um <Id>Module que provê o jogo com @GamePlugin;
 *   3. importe-o aqui. O core o descobre automaticamente.
 * (Ver skill `add-game-plugin`.)
 */
@Module({
  imports: [UnoModule, HuesModule],
})
export class GamesModule {}
