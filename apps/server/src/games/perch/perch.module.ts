import { Module } from '@nestjs/common';
import { PerchGame } from './perch.game';

/** Prove o plugin "Perch". Importado por GamesModule. */
@Module({
  providers: [PerchGame],
  exports: [PerchGame],
})
export class PerchModule {}
