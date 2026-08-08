import { Injectable } from '@nestjs/common';
import type { GameContext, GameDefinition, PlayerId } from '@boardzando/contracts';
import { GamePlugin } from '../../core/registry/game-plugin.decorator';

/**
 * Music Quiz — quiz musical com 4 alternativas, 30s por pergunta e ranking
 * animado. Diferente dos demais jogos, NAO usa a engine `GameInstance`: o
 * gateway detecta `gameId === 'musicquiz'` e delega a `MusicQuizService`.
 * Este plugin existe apenas para aparecer em `GET /games` e habilitar o fluxo
 * de criar/entrar em sala. Os metodos abaixo sao stubs — nunca sao chamados.
 */
@Injectable()
@GamePlugin()
export class MusicQuizGame implements GameDefinition<unknown, unknown> {
  readonly id = 'musicquiz';
  readonly name = 'Music Quiz 🎵';
  readonly minPlayers = 1;
  readonly maxPlayers = 20;

  setup(_ctx: GameContext, _setupData?: unknown): unknown {
    return {};
  }

  readonly moves = {};

  endIf(): void {
    /* nunca usado — o servico proprio controla o fim da partida */
  }

  playerView(state: unknown, _ctx: GameContext, _viewer: PlayerId): unknown {
    return state;
  }
}
