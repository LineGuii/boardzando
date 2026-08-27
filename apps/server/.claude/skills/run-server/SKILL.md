---
name: run-server
description: Build, run and drive the Boardzando NestJS server (apps/server) — start it on a free port, then use driver.mjs to create rooms over HTTP, connect authenticated Socket.IO clients and play real game moves. Use when asked to run, start, boot, smoke-test, debug or verify the server / backend / gateway / WebSocket / a game plugin against a live process, or to call a game reducer directly.
---

# Run the Boardzando server

NestJS + Socket.IO. HTTP (`/games`, `/rooms`, `/rooms/join`) issues an Argon2id-verified
JWT; the real-time surface is a Socket.IO namespace `/games` that refuses the handshake
without that JWT. Clients (`apps/web`, `apps/quiz-web`) are just consumers of this.

**The agent path is [driver.mjs](driver.mjs)** — a Node script that acts as N real
players: creates a room over HTTP, opens one authenticated socket per player, starts the
match and plays actual moves. Use it instead of `curl` for anything past `/games`: the
interesting behaviour is all behind the WebSocket, and every player needs their own
socket because `playerView` hides other players' hands.

All paths below are relative to `apps/server/`.

## Prerequisites

Node 20+ and pnpm 9 (`node -v` → v23.11.0, `pnpm -v` → 9.12.0 here). No OS packages, no
Docker, no database — rooms live in memory. `argon2` is a native module and is already
prebuilt by `pnpm install`.

## Build

From the repo root — `@boardzando/contracts` must be compiled first, turbo handles it:

```bash
pnpm install --frozen-lockfile
```

```bash
pnpm build
```

The server itself is `nest build` → `dist/`. Rebuild just this app with
`pnpm --filter @boardzando/server build`.

## Run (agent path)

**Port 3000 is often already taken** by the developer's own dev server. Boot yours on
3100 and leave theirs alone — `PORT` is read from the environment, and `.env` at the repo
root supplies `JWT_SECRET` and the rest:

```bash
cd apps/server && PORT=3100 node dist/main.js
```

Wait for `Servidor on em http://localhost:3100`, then drive it:

```bash
cd apps/server && node .claude/skills/run-server/driver.mjs smoke --port=3100
```

That runs the full flow and exits non-zero on the first failed assert:

```
[1] GET /games lists the plugged-in games
[2] POST /rooms (host) + POST /rooms/join (the others) → roomId + JWT per player
[3] wrong room password → 401
[4] WS handshake with a bogus token → refused
[5] one authenticated socket per player on /games, room:update sees them all
[6] chat:send broadcasts to the room
[7] room:start → game:state with the per-player filtered view
[8] room:start from a non-host → ONLY_HOST_CAN_START
[9] plays a real UNO round (reads each player's own hand, picks a legal card,
    draws + passes when stuck, calls UNO at one card)
[10] an illegal move → INVALID_MOVE
```

Last verified run: `SMOKE OK — 18 asserts passaram`, 40 moves (20 plays, 20 draws).

Other games — steps 1-8 and 10 are generic, step 9 is UNO-specific and the driver says so
instead of pretending:

```bash
cd apps/server && node .claude/skills/run-server/driver.mjs smoke --port=3100 --game=emperium --players=3
```

Read-only helpers:

```bash
cd apps/server && node .claude/skills/run-server/driver.mjs games --port=3100
```

Flags: `--port` (or `BZ_PORT`), `--host`, `--game`, `--players`, `--password`, `--json`
(machine-readable step list), `--quiet`.

To teach the driver a new game's moves, add a branch next to `playUnoRound` in
[driver.mjs](driver.mjs) — it already has the socket-per-player plumbing.

## Direct invocation (no server)

Game rules are pure reducers and `SeededRandom` is standalone, so a plugin can be called
straight from `dist/` with no Nest bootstrap and no DI container — `new UnoGame()` works
because the plugins take no constructor dependencies. This is the fastest loop for a PR
that only touches `src/games/<id>/*.moves.ts`:

```bash
cd apps/server && node -e "
const { UnoGame } = require('./dist/games/uno/uno.game.js');
const { SeededRandom } = require('./dist/core/engine/seeded-random.js');
const game = new UnoGame();
const ctx = { players: ['a','b'], actor: 'a', random: new SeededRandom(42) };
const s0 = game.setup(ctx);
const card = s0.hands.a.find(c => c.color === s0.activeColor && c.kind === 'number');
const s1 = game.moves.playCard(s0, ctx, { cardId: card.id });
console.log('hand:', s0.hands.a.length, '->', s1.hands.a.length);
"
```

Seed the `SeededRandom` with a fixed number to make a run reproducible. Reducers return
the `INVALID_MOVE` sentinel rather than throwing.

## Run (human path)

```bash
pnpm --filter @boardzando/server dev
```

`nest start --watch` on port 3000, recompiling on save. Useful when a human has a browser
open on `apps/web`; useless on its own — nothing drives it.

## Test

```bash
cd apps/server && npx jest
```

229 tests / 14 suites, ~7s. Pure reducer tests (UNO, emperium, …) plus `room.service`.
They never open a socket, so they prove nothing about the gateway, the JWT handshake or
the throttler — that's what the driver is for.

## Gotchas

- **A failing WS handler never acks.** `WsAllExceptionsFilter` catches the exception and
  emits it on the `error` event instead, so a `socket.emit(..., cb)` callback simply never
  fires. Naively you get a meaningless "ack timeout" for every server-side rejection. The
  driver's `emit()` races the ack against the `error` event — copy that shape in any new
  WS client code.
- **The WS throttler tracks by IP, not by socket.** `WsThrottlerGuard.getTracker` returns
  `remoteAddress`, so every player the driver connects from this machine shares one
  bucket: `game:move` is 15/s **total**, not per player. Driving moves in a tight loop
  gets `RATE_LIMITED` mid-game (it first bit at move 25). `emitPaced()` retries after the
  1s window.
- **`playerView` means one socket per player.** The `game:state` a socket receives is
  filtered for that player — the host's view contains only the host's hand. There is no
  god-view socket; to decide a legal move for player B you must read B's own `game:state`.
- **`musicquiz` is hidden from `/games` and `/rooms` on purpose** and `POST /rooms` with
  `gameId: 'musicquiz'` returns "Jogo desconhecido." It has its own door at `/quiz/*` —
  see the `run-quiz-web` skill.
- **`.env` is resolved relative to cwd** (`envFilePath: ['.env', '../../.env']`). Launch
  from `apps/server/` so `../../.env` finds the repo-root file; from anywhere else the
  server starts with a default `JWT_SECRET`.
- **`/rooms/join` is throttled to 5 requests/minute per IP** (anti brute-force). Repeated
  driver runs with many players will start getting 429s; wait a minute or use fewer
  players.
- **Rooms are in-memory.** Restarting the server invalidates every issued JWT's room, and
  a client reconnecting gets `ROOM_NOT_FOUND` and is disconnected.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Error: listen EADDRINUSE: address already in use :::3000` | Someone's dev server owns 3000. Use `PORT=3100` and pass `--port=3100` to the driver. |
| Driver step 5: `handshake recusado ... UNAUTHORIZED` | The JWT is stale — the server restarted since the token was issued, or you're pointing at a *different* server than the one that minted it. Re-run the whole smoke. |
| `{"ok":false,"code":"RATE_LIMITED"}` | The per-IP WS throttler. Wait 1s and retry (`emitPaced` does), or space the moves out. |
| `POST /rooms/join -> 429` | The 5/min per-IP join throttle. Wait a minute. |
| `{"code":"ROOM_NOT_FOUND"}` right after connecting | The server was restarted between the HTTP call and the socket connect. Rooms don't survive a restart. |
| `Move invalido: playCard` when you expected it to work | The reducer rejected it — wrong colour/kind, or a `pendingDraw` stack is open (while one is, only `draw2` may be played). |
| `Python não foi encontrado` | Python isn't installed on this machine. Use `node -e` for one-off scripting. |
