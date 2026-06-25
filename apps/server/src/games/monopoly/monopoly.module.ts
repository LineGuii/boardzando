import { Module } from '@nestjs/common';
import { MonopolyGame } from './monopoly.game';

/** Prove o plugin Monopoly (mesa livre). Importado por GamesModule. */
@Module({
  providers: [MonopolyGame],
  exports: [MonopolyGame],
})
export class MonopolyModule {}
