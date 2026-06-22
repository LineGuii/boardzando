# Template de um jogo plugável (esqueleto em branco)

Copie estes quatro arquivos para `apps/server/src/games/<id>/`, troque `<id>` /
`MeuJogo` e preencha as regras. Veja `uno-walkthrough.md` para um exemplo real.

## `<id>.state.ts`

```ts
import type { PlayerId } from '@board-games/contracts';

// Descreva TUDO que define uma partida. Mantenha serializável (sem métodos).
export interface MeuEstado {
  // exemplo:
  // board: Cell[];
  hands: Record<PlayerId, unknown[]>;
  winner?: PlayerId;
}
```

## `<id>.moves.ts`

```ts
import type { Move } from '@board-games/contracts';
import { INVALID_MOVE } from '@board-games/contracts';
import type { MeuEstado } from './<id>.state';

export interface JogarPayload {
  // dados que o cliente envia para este move
}

export const jogar: Move<MeuEstado, JogarPayload> = (state, ctx, payload) => {
  // 1. valide a legalidade -> if (ilegal) return INVALID_MOVE;
  // 2. produza um NOVO estado (não mute `state`)
  const next = structuredClone(state);
  // ... aplique a jogada em `next`, usando ctx.random se precisar ...
  // 3. marque vitória se for o caso: next.winner = ctx.currentPlayer;
  return next;
};
```

## `<id>.game.ts`

```ts
import { Injectable } from '@nestjs/common';
import type { GameContext, GameDefinition, PlayerId } from '@board-games/contracts';
import { GamePlugin } from '../../core/registry/game-plugin.decorator';
import { jogar } from './<id>.moves';
import type { MeuEstado } from './<id>.state';

@Injectable()
@GamePlugin()
export class MeuJogo implements GameDefinition<MeuEstado> {
  readonly id = '<id>';
  readonly name = 'Meu Jogo';
  readonly minPlayers = 2;
  readonly maxPlayers = 4;

  setup(ctx: GameContext): MeuEstado {
    const hands: MeuEstado['hands'] = {};
    for (const p of ctx.players) hands[p] = [];
    return { hands };
  }

  moves = { jogar };

  // turn = { nextPlayer: (state, ctx) => ... };   // se a ordem não for circular simples
  // phases = { ... };                              // se houver fases

  endIf(state: MeuEstado) {
    if (state.winner) return { winner: state.winner };
  }

  // Implemente SE houver informação secreta. Senão, remova (envia o estado todo).
  playerView(state: MeuEstado, _ctx: GameContext, playerId: PlayerId) {
    return {
      myHand: state.hands[playerId] ?? [],
      opponents: Object.fromEntries(
        Object.entries(state.hands)
          .filter(([id]) => id !== playerId)
          .map(([id, h]) => [id, h.length]),
      ),
    };
  }
}
```

## `<id>.module.ts`

```ts
import { Module } from '@nestjs/common';
import { MeuJogo } from './<id>.game';

@Module({ providers: [MeuJogo], exports: [MeuJogo] })
export class MeuJogoModule {}
```

## Por fim

1. Importe `MeuJogoModule` em `apps/server/src/games/games.module.ts`.
2. Escreva `<id>.game.spec.ts` (copie o do UNO como base).
3. `pnpm test`.
