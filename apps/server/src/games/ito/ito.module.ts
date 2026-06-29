import { Module } from '@nestjs/common';
import { ItoGame } from './ito.game';

/** Prove o plugin Ito (cooperativo). Importado por GamesModule. */
@Module({
  providers: [ItoGame],
  exports: [ItoGame],
})
export class ItoModule {}
