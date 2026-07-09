import { Module } from '@nestjs/common';
import { Flip7Game } from './flip7.game';

/** Prove o plugin "Flip 7". Importado por GamesModule. */
@Module({
  providers: [Flip7Game],
  exports: [Flip7Game],
})
export class Flip7Module {}
