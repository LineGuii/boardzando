import { Module } from '@nestjs/common';
import { EmperiumGame } from './emperium.game';

/** Prove o plugin "Guerra do Emperium". Importado por GamesModule. */
@Module({
  providers: [EmperiumGame],
  exports: [EmperiumGame],
})
export class EmperiumModule {}
