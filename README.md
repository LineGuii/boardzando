# Boardzando — plataforma plugável de jogos multiplayer

Casca (framework) para hospedar **vários jogos de tabuleiro/cartas** sobre um
mesmo núcleo: salas, jogadores, turnos, chat, reconexão e WebSocket seguro.
Cada jogo é um **plugin** que implementa o contrato `GameDefinition`. O primeiro
jogo de exemplo é o **UNO**.

> Stack: **TypeScript** ponta a ponta · **NestJS** + **Socket.IO** no servidor ·
> **React + Vite** no cliente · monorepo **pnpm + Turborepo** · auth de sala com
> **Argon2id + JWT** · exposição via **Cloudflare Tunnel**.

## Arquitetura em 30 segundos

```
packages/contracts   ← tipos compartilhados (GameDefinition, eventos WS, DTOs)
        ▲
        │
apps/server (NestJS)
  ├─ core/            ← NÚCLEO genérico (não conhece nenhum jogo concreto)
  │   ├─ registry/    ← descobre plugins via @GamePlugin (DiscoveryService)
  │   ├─ engine/      ← roda uma GameDefinition: moves, turnos, fases, RNG
  │   ├─ room/        ← ciclo de vida de salas, reconexão
  │   └─ gateway/     ← WebSocket (validação, throttling, broadcast/playerView)
  ├─ auth/            ← login por sala (Argon2id), JWT no handshake
  └─ games/uno/       ← PLUGIN UNO (setup, moves puros, fases, playerView)

apps/web (React)      ← lobby, sala e UI específica por jogo
```

O núcleo opera **somente** sobre a interface `GameDefinition`. Adicionar um jogo
novo nunca exige tocar em `core/` — veja `skills/add-game-plugin`.

## Como rodar (dev)

Pré-requisitos: Node 20+ e pnpm 9+.

```bash
pnpm install
cp .env.example .env        # gere um JWT_SECRET forte!
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"  # cole em JWT_SECRET

pnpm dev                    # sobe server (3000) e web (5173) via turbo
```

Abra http://localhost:5173, crie uma sala de UNO, compartilhe o ID e a senha.

## Testes, lint, build

```bash
pnpm test        # testes (inclui regras do UNO — reducers puros)
pnpm lint
pnpm typecheck
pnpm build
```

## Expor para os amigos

Veja `deploy/cloudflared/README.md` (Cloudflare Tunnel, WSS, sem abrir portas).

## Skills (para evolução com o Claude)

- `skills/add-game-plugin/` — passo a passo para plugar um jogo novo.
- `skills/board-game-architecture/` — convenções, EDA/CQRS, segurança WS, escala.

## Status / próximos passos

Este é um **esqueleto funcional** (precisa de `pnpm install` para compilar).
Itens deixados como evolução: "dizer UNO" e penalidade, desafio do `wild_draw4`,
persistência (Redis) para múltiplas instâncias, migração dos handlers do gateway
para CQRS (Commands/Events). Tudo descrito nas skills.
