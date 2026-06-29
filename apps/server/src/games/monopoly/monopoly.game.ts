import { Injectable } from '@nestjs/common';
import type { GameContext, GameDefinition, PlayerId, SandboxState } from '@boardzando/contracts';
import { INVALID_MOVE } from '@boardzando/contracts';
import { GamePlugin } from '../../core/registry/game-plugin.decorator';
import { makeSandboxMoves, SANDBOX_MOVE_NAMES, sandboxPlayerView } from '../_sandbox';
import { buildMonopolySandbox } from './monopoly.catalog';

/**
 * Monopoly como MESA LIVRE (sandbox): sem regras, sem turnos. Apenas dispoe
 * todas as pecas oficiais na mesa; os jogadores movem/empilham/embaralham e
 * guardam na mao livremente. Toda a mecanica vem do framework `_sandbox`.
 */
@Injectable()
@GamePlugin()
export class MonopolyGame implements GameDefinition<SandboxState> {
  readonly id = 'monopoly';
  readonly name = 'Monopoly (Mesa livre)';
  readonly minPlayers = 2;
  readonly maxPlayers = 8;

  setup(ctx: GameContext): SandboxState {
    return buildMonopolySandbox(ctx.random, ctx.players as PlayerId[]);
  }

  readonly moves = makeSandboxMoves() as Record<
    string,
    (state: SandboxState, ctx: GameContext, payload: unknown) => SandboxState | typeof INVALID_MOVE
  >;

  /** Mesa sem turnos: todos os moves sao off-turn. */
  readonly offTurnMoves = SANDBOX_MOVE_NAMES;

  playerView(state: SandboxState, ctx: GameContext, playerId: PlayerId): unknown {
    return sandboxPlayerView(state, ctx, playerId);
  }
}
