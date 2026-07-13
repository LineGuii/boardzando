import { Module } from '@nestjs/common';
import { StopConnectGame } from './stopconnect.game';

/** Prove o plugin "StopConnect". Importado por GamesModule. */
@Module({
  providers: [StopConnectGame],
  exports: [StopConnectGame],
})
export class StopConnectModule {}
