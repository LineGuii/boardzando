---
name: board-game-architecture
description: >-
  Referência de arquitetura e melhores práticas para evoluir a plataforma de
  board games deste repositório (NestJS + Socket.IO + React, monorepo pnpm).
  Use SEMPRE que o usuário quiser mexer no NÚCLEO (não em um jogo específico):
  refatorar o gateway para CQRS/eventos de domínio, endurecer a segurança do
  WebSocket (auth no handshake, rate limiting, validação), escalar para várias
  instâncias com Redis, ajustar reconexão/persistência, evoluir os contratos de
  evento, ou entender as convenções e fronteiras core ↔ plugin. Acione também
  para dúvidas tipo "como funciona a autenticação", "por que o núcleo não
  importa jogos", "como adicionar uma fila", "event-driven aqui".
---

# Arquitetura da plataforma de board games

Este documento orienta mudanças no **núcleo**. Para adicionar um jogo, use a
skill `add-game-plugin` (não toque no núcleo para isso).

## Princípio central: core ↔ plugin

O núcleo (`apps/server/src/core`) **só** conhece a interface `GameDefinition`
(`packages/contracts`). Ele gerencia salas, jogadores, turnos, RNG, gateway e
broadcast. Os jogos vivem em `apps/server/src/games/<id>` e são descobertos em
runtime por `@GamePlugin` + `DiscoveryService` (`GameRegistryService`).

**Teste de fronteira:** se uma mudança para suportar um jogo específico exige
editar `core/`, a abstração está vazando. Conserte movendo a variação para o
contrato (`GameDefinition`) — ex.: um novo hook opcional — em vez de criar um
`if (gameId === 'x')` no núcleo.

O fluxo de uma jogada:

```
cliente --(WS game:move, validado)--> GameGateway
  -> RoomService.getOrThrow(roomId).instance.applyMove(playerId, type, data)
       -> GameInstance valida vez + resolve move (global/fase) + roda reducer puro
       -> avança fase (endIf) e turno (nextPlayer/onBegin/onEnd)
  -> Gateway faz broadcast: a cada jogador, game:state com viewFor(playerId)
```

## Segurança do WebSocket (já implementada — mantenha os invariantes)

1. **Auth no handshake, não por mensagem.** `AuthIoAdapter` injeta um middleware
   do Socket.IO que valida o JWT de sessão **antes** de aceitar a conexão e
   popula `socket.data.player` / `socket.data.roomId`. Não reintroduza
   verificação de token por evento — é cara e não desconecta de fato.
2. **Validação de payload.** O `GameGateway` usa `ValidationPipe` com
   `whitelist`, `forbidNonWhitelisted`, `transform` e um `exceptionFactory` que
   lança `WsException` (senão erros viram "Internal server error" — armadilha
   conhecida). DTOs são **classes** em `packages/contracts/src/dtos.ts`.
3. **Rate limiting.** `WsThrottlerGuard` (estende `ThrottlerGuard`) aplicado por
   handler com `@Throttle`. Lembre: **não** pode ser `APP_GUARD` global; precisa
   de um listener para o evento de exceção. Limites atuais: move 15/s, chat
   5/2s.
4. **Filtro de exceções.** `WsAllExceptionsFilter` normaliza tudo para o
   envelope `WsError` do contrato e emite no evento `error`.
5. **Login por sala.** `AuthService` faz Argon2id (params OWASP 2024) na senha
   da sala e emite JWT curto. O `/rooms/join` tem `@Throttle` apertado
   (anti-brute-force). Não baixe os parâmetros do Argon nem alargue o throttle
   do join sem motivo.

Ao adicionar um novo evento WS: crie o DTO em `contracts`, adicione ao
`ClientToServerEvents`/`ServerToClientEvents`, aplique `@Throttle` adequado e
trate erros via `WsException`.

## Evoluir para CQRS / eventos de domínio

Hoje o gateway chama o `RoomService`/engine diretamente — simples e claro para o
esqueleto. Quando a lógica crescer (efeitos encadeados, persistência, métricas,
múltiplos reagentes a um mesmo fato), **migre para `@nestjs/cqrs`** para
desacoplar. Padrão alvo:

- **Commands** (intenções): `PlayMoveCommand`, `StartGameCommand`. O gateway só
  despacha via `CommandBus`; não orquestra.
- **Events** (fatos de domínio): `MovePlayedEvent`, `TurnEndedEvent`,
  `GameOverEvent`. Publicados via `EventBus` pelo handler do command.
- **EventHandlers** desacoplados reagem aos fatos: um faz o broadcast do estado
  (`viewFor`), outro persiste histórico, outro registra métricas — sem um saber
  do outro.
- **Sagas** (opcional): orquestram fluxos multi-etapa (ex.: a fase de desafio do
  `wild_draw4`).

Benefício: o broadcast deixa de estar acoplado ao handler do gateway, e novos
side-effects entram só adicionando um `@EventsHandler`. Veja
`references/cqrs-migration.md` para o passo a passo.

Para notificações leves dentro de um módulo, `EventEmitter2`
(`@nestjs/event-emitter`) é suficiente e mais simples que CQRS.

## Quando (e quando não) adicionar Redis/BullMQ

Comece **in-process** — para board games (sem game loop de baixa latência,
poucos jogadores), EventBus/EventEmitter em memória basta e tem latência mínima.
Introduza Redis/BullMQ **apenas** quando precisar de:

- **Escala horizontal** (2+ instâncias do servidor): use o **adaptador Redis do
  Socket.IO** para sincronizar rooms entre processos, e troque o `Map` de salas
  do `RoomService` por um store em Redis. A interface pública do `RoomService`
  pode permanecer a mesma.
- **Durabilidade/retry** de tarefas (persistir histórico, e-mails) ou **jobs
  agendados** (timeout de turno) → BullMQ.

Não adicione antes de precisar: é complexidade sem retorno para "jogar com os
amigos no localhost".

## Reconexão e ciclo de vida da sala

`RoomService` marca jogadores como `connected: false` numa **janela de carência**
(`RECONNECT_GRACE_MS`) antes de remover (no lobby). Partidas em curso preservam
o assento. A reconexão reusa o JWT de sessão (mesmo `playerId`). Se for
implementar persistência de partida, serialize `GameInstance.snapshot`
(`MatchState`, incluindo `rngState`) — é tudo serializável de propósito.

## Contratos de evento como API versionada

`packages/contracts` é o acoplamento intencional entre cliente e servidor.
Trate-o como **API pública**: mudança quebrada nos payloads = major bump
(SemVer). Como TypeScript some em runtime, a validação real está nos DTOs
(`class-validator`); mantenha DTO e tipo de evento em sincronia. Para um novo
campo opcional, prefira aditivo (não-quebrante).

## Convenções gerais

- **Pureza no domínio do jogo**: nenhuma lógica de regra faz I/O ou usa
  `Math.random`/`Date.now`. Toda aleatoriedade vem de `ctx.random`.
- **Imutabilidade**: moves retornam novo estado; o engine assume snapshots.
- **Núcleo agnóstico**: nada em `core/` importa de `games/`.
- **Tipos compartilhados**: cliente e servidor importam de
  `@boardzando/contracts` — nunca duplique tipos de evento/estado.
- **Testes**: regras testadas como funções puras (`GameInstance` +
  `applyMove`); gateways testados com `socket.io-client` em e2e.

## Referências

- `references/cqrs-migration.md` — migrar o gateway para Commands/Events/Sagas.
- `references/scaling-and-security.md` — Redis adapter, store distribuído,
  checklist de hardening do WebSocket e do Cloudflare Tunnel.
- `../add-game-plugin/SKILL.md` — adicionar um jogo (não mexe no núcleo).
