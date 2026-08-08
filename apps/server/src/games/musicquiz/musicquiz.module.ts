/**
 * Re-export do `MusicQuizModule` que fica junto ao service para evitar circular
 * import (service <-> module). O modulo e `@Global()` (ver musicquiz.service.ts)
 * — basta importa-lo uma vez em `games.module.ts`.
 */
export { MusicQuizModule } from './musicquiz.service';
