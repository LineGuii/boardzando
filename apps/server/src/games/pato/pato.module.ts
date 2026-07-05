import { Module } from '@nestjs/common';
import { PatoGame } from './pato.game';

/** Prove o plugin "Nem a Pato". Importado por GamesModule. */
@Module({
  providers: [PatoGame],
  exports: [PatoGame],
})
export class PatoModule {}
