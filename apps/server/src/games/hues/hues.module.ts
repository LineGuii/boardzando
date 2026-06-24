import { Module } from '@nestjs/common';
import { HuesGame } from './hues.game';

/** Prove o plugin Hues & Cues. Importado por GamesModule. */
@Module({
  providers: [HuesGame],
  exports: [HuesGame],
})
export class HuesModule {}
