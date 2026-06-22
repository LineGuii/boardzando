---
name: add-game-plugin
description: >-
  Adiciona um novo jogo plugável à plataforma de board games (monorepo NestJS +
  React deste repositório). Use SEMPRE que o usuário quiser "criar um jogo novo",
  "plugar um jogo", "adicionar um jogo à plataforma", implementar regras de um
  jogo de tabuleiro/cartas (xadrez, damas, truco, banco imobiliário, jogo da
  velha, batalha naval, etc.), ou mencionar GameDefinition, moves, fases, turnos
  ou playerView. Cobre desde a criação da pasta do plugin, implementação do
  contrato GameDefinition com reducers puros, registro via @GamePlugin, UI no
  frontend e testes. Acione mesmo que o usuário não diga a palavra "plugin".
---

# Adicionar um jogo plugável

Este repositório separa um **núcleo genérico** (`apps/server/src/core`) dos
**jogos** (`apps/server/src/games/<id>`). O núcleo nunca conhece um jogo
concreto: ele opera sobre a interface `GameDefinition` (em
`packages/contracts/src/game-definition.ts`). Adicionar um jogo = implementar
esse contrato e registrá-lo. **Nunca edite `core/` para adicionar um jogo** — se
parecer necessário, a abstração precisa evoluir (veja a skill
`board-game-architecture`).

## Antes de escrever código: modele o jogo

Responda, com o usuário, a estas perguntas — elas mapeiam 1:1 para o contrato:

1. **Estado (`TState`)**: o que descreve uma partida? (baralho, tabuleiro, mãos,
   pontuação, posições). Deve ser **serializável** (sem classes com métodos, sem
   funções) para permitir snapshots/persistência.
2. **Setup**: como o estado inicial é montado? Quais aleatoriedades? (use
   `ctx.random`, **nunca** `Math.random`).
3. **Moves**: quais ações um jogador pode tomar? Cada move é um **reducer puro**
   `(state, ctx, payload) => novoEstado | INVALID_MOVE`.
4. **Turnos**: ordem circular simples basta, ou há inversão/skip/jogadores
   simultâneos? (sobrescreva `turn.nextPlayer`).
5. **Fases** (opcional): o jogo tem etapas distintas com moves diferentes?
   (ex.: "leilão" → "rodada"). Senão, deixe sem `phases`.
6. **Fim (`endIf`)**: qual condição encerra e quem vence?
7. **Informação secreta**: há algo que um jogador não pode ver (mãos, cartas
   viradas)? Então implemente `playerView` para filtrar por jogador.

## Passos

### 1. Crie a pasta do plugin

```
apps/server/src/games/<id>/
├── <id>.state.ts     # tipos do estado (TState) — serializável
├── <id>.moves.ts     # reducers puros + helpers de turno
├── <id>.game.ts      # a classe GameDefinition (@Injectable @GamePlugin)
├── <id>.module.ts    # módulo Nest que provê o jogo
└── <id>.game.spec.ts # testes das regras (reducers são triviais de testar)
```

Use o **UNO** como modelo de referência completo: leia
`references/uno-walkthrough.md` para ver cada arquivo comentado, e copie a
estrutura. Para um esqueleto em branco, veja `references/template.md`.

### 2. Implemente o contrato em `<id>.game.ts`

A classe deve ser `@Injectable()` **e** `@GamePlugin()`, e implementar
`GameDefinition<TState>`:

```ts
@Injectable()
@GamePlugin()
export class MeuJogo implements GameDefinition<MeuEstado> {
  readonly id = 'meu-jogo';        // único, estável, usado em URLs e contratos
  readonly name = 'Meu Jogo';
  readonly minPlayers = 2;
  readonly maxPlayers = 4;

  setup(ctx) { /* monta o estado inicial usando ctx.random */ }
  moves = { /* nome: reducer puro */ };
  turn = { nextPlayer /*, onBegin, onEnd */ };  // opcional
  phases = { /* ... */ };                        // opcional
  endIf(state, ctx) { /* retorna { winner } para encerrar */ }
  playerView(state, ctx, playerId) { /* esconde info secreta */ }
}
```

**Regras de ouro dos moves** (a arquitetura depende disso):

- **Pureza**: não faça I/O, rede, `Date.now()` ou `Math.random` dentro de um
  move. Toda aleatoriedade vem de `ctx.random` (RNG seeded e server-side).
- **Imutabilidade**: não mute `state`; produza um novo objeto
  (`structuredClone` + alterações, ou immer). O engine assume imutabilidade.
- **Validação**: retorne `INVALID_MOVE` (de `@board-games/contracts`) para
  qualquer jogada ilegal (carta que não possui, fora das regras, etc.). O engine
  já valida "é a vez deste jogador" antes de chamar o move.

### 3. Registre o módulo

Em `apps/server/src/games/games.module.ts`, importe o novo módulo:

```ts
@Module({ imports: [UnoModule, MeuJogoModule] })
export class GamesModule {}
```

O `GameRegistryService` descobre o plugin automaticamente no bootstrap (via
`@GamePlugin` + `DiscoveryService`). Não há mais nada a fazer no servidor.

### 4. (Opcional) UI específica no frontend

Crie `apps/web/src/games/<id>/<Id>Board.tsx` lendo o `view` do store
(`useGame`) — que já é o resultado do seu `playerView` — e emitindo `game:move`
com `{ type, data }`. Renderize a `<Id>Board` quando `room.gameId === '<id>'`.
A UI de **lobby/sala/chat é genérica** e já funciona para qualquer jogo.

### 5. Testes (faça antes da UI)

Como os moves são puros, teste-os com `GameInstance.create(...)` e
`applyMove(...)` sem subir servidor nem WebSocket. Cubra: setup correto, cada
move legal, rejeição de moves ilegais (`expect(...).toThrow(InvalidMoveError)`),
efeitos especiais, condição de vitória, e que `playerView` esconde o segredo.
Veja `<id>.game.spec.ts` do UNO como gabarito. Rode com `pnpm test`.

## Checklist de conclusão

ALWAYS verifique antes de declarar pronto:

- [ ] `id` é único e estável; `name`, `minPlayers`, `maxPlayers` definidos.
- [ ] `setup` usa apenas `ctx.random` para aleatoriedade.
- [ ] Todo move é puro e imutável; jogadas ilegais retornam `INVALID_MOVE`.
- [ ] `endIf` cobre todas as condições de término.
- [ ] `playerView` esconde toda informação secreta (se houver).
- [ ] Módulo importado em `games.module.ts`.
- [ ] Testes cobrindo regras e vitória passando (`pnpm test`).
- [ ] `core/` **não** foi modificado.

## Erros comuns

**Example 1** — RNG fora do contrato:
Input: usar `Math.random()` para embaralhar dentro de um move.
Output: ❌ quebra o determinismo/replay. Use `ctx.random.shuffle(...)`.

**Example 2** — mutar o estado:
Input: `state.hands[p].push(card); return state;`
Output: ❌ muta a entrada. Faça `const next = structuredClone(state); next.hands[p] = [...]; return next;`

**Example 3** — efeito de turno (skip/reverse) tentando pular dentro do move:
Input: o move tenta setar `ctx.currentPlayer`.
Output: ❌ o contexto é read-only. Marque uma flag no estado (ex.: `skipNext`)
e leia-a em `turn.nextPlayer`, limpando-a em `turn.onBegin` (padrão do UNO).

## Referências

- `references/uno-walkthrough.md` — o UNO destrinchado arquivo a arquivo.
- `references/template.md` — esqueleto em branco para copiar.
- `../board-game-architecture/SKILL.md` — convenções do núcleo, EDA/CQRS,
  segurança do WebSocket e caminho para escalar (Redis).
