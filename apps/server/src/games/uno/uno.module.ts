import { Module } from '@nestjs/common';
import { UnoGame } from './uno.game';

/** Provê o plugin UNO. Importado por GamesModule. */
@Module({
  providers: [UnoGame],
  exports: [UnoGame],
})
export class UnoModule {}
