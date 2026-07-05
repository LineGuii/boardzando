import { Module } from '@nestjs/common';
import { ManadaGame } from './manada.game';

/** Prove o plugin "Efeito Manada". Importado por GamesModule. */
@Module({
  providers: [ManadaGame],
  exports: [ManadaGame],
})
export class ManadaModule {}
