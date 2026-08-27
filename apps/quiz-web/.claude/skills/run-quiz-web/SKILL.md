---
name: run-quiz-web
description: Build, run and drive the Music Quiz client (apps/quiz-web) — start its Vite dev server and use driver.mjs to log into the admin panel, create a quiz room, join as a player in headless Chrome, start the match, answer a question and save screenshots. Use when asked to run, start, preview, screenshot, smoke-test or verify the music quiz / quiz-web / the admin panel / the question or ranking screens.
---

# Run the Music Quiz client

React + Vite, sibling of `apps/web` but a **separate front door**: the `musicquiz` game is
deliberately hidden from `/games` and `/rooms`, and lives at `/quiz/*` on the server.
Creating a room is an **admin** operation (`POST /quiz/rooms` is behind `AdminGuard`), so
any run starts with an admin login. Joining as a player is not gated.

**The agent path is [driver.mjs](driver.mjs)** — headless Chrome over the DevTools
Protocol: admin logs in, creates the room, a player joins in an isolated browser context,
the host starts the match, the player answers a real question and gets scored.
[cdp.mjs](cdp.mjs) is the dependency-free CDP client (Node 22+ global `WebSocket` + the
installed Chrome).

All paths below are relative to `apps/quiz-web/`.

## Prerequisites

Node 20+, pnpm 9, and Google Chrome (auto-detected at
`C:\Program Files\Google\Chrome\Application\chrome.exe`; override with `CHROME_PATH`).

**`ADMIN_PASSWORD` must be set in the repo-root `.env`.** If it's empty the server
disables *every* admin endpoint and no room can be created. The driver reads it from
`$ADMIN_PASSWORD` or straight from `.env` and never prints it.

Quiz content comes from `data/musicquiz/tracks.json` (41 tracks, 3 quizzes here:
`acervo-completo`, `test`, `quiz-definicao-guilherme`). `test` has a single track — use it,
a run finishes in seconds.

## Build

From the repo root:

```bash
pnpm install --frozen-lockfile
```

```bash
pnpm build
```

## Run (agent path)

**1. Backend on port 3000** — `vite.config.ts` hardcodes `http://localhost:3000` for
`/quiz`, `/rooms`, `/games`, `/media` and `/socket.io`:

```bash
cd apps/server && node dist/main.js
```

**2. Start Vite on a free port.** 5174 is normally the developer's own quiz-web:

```bash
pnpm --filter @boardzando/quiz-web exec vite --port 5176 --strictPort
```

**3. Drive it:**

```bash
cd apps/quiz-web && node .claude/skills/run-quiz-web/driver.mjs smoke
```

What it does, all through the real UI:

```
[1] opens /?admin and logs in with ADMIN_PASSWORD (POST /quiz/admin/login)
[2] picks the quiz + rounds, creates the room, lands in the waiting room
[3] a player joins by room code in an isolated browser context
    (asserts the host's player list actually shows them)
[4] host clicks "Iniciar partida"; waits for the answer buttons to render
[5] the player clicks an answer; asserts the server scored it
[6] asserts the JS console is clean
```

Last verified run: `SMOKE OK — 9 asserts passaram`, question *"De que jogo é essa
música?"* with four options, answer scored **995 points**.

Screenshots land in `apps/quiz-web/.screenshots/` (gitignored): `01-admin-login.png`,
`02-sala-espera.png`, `03-pergunta-host.png`, `04-respondeu-jogador.png`,
`05-host-apos-resposta.png`. Open them to confirm.

Longer match — after the answer the match continues to the reveal/ranking instead of
ending outright (verified: question *"De que jogo é essa música?"*, 995 points):

```bash
cd apps/quiz-web && node .claude/skills/run-quiz-web/driver.mjs smoke --quiz=acervo-completo --rounds=3
```

One-off screenshot:

```bash
cd apps/quiz-web && node .claude/skills/run-quiz-web/driver.mjs shot --url=http://localhost:5176/?admin --out=.screenshots/admin.png
```

Flags: `--web=<url>` (default `http://localhost:5176`), `--quiz`, `--rounds`, `--players`,
`--out-dir`, `--headed`, `--keep-open`.

**Selectors** — quiz-web uses no `id`s, so go by placeholder/class:
`input[type=password].q-input` (admin password and room password),
`input[placeholder="Como voce quer ser chamado?"]` (name),
`input[placeholder="cole o codigo aqui"]` (room code), `button.q-btn` (submit),
`select.q-select` (**first one** is the quiz; the others are audio mode and question
order), `button.q-option[data-idx="N"]` (answers), `.q-question`, `.q-question-text`.

## Run (human path)

```bash
pnpm dev
```

Turbo brings up server 3000 + web 5173 + quiz-web 5174. Open http://localhost:5174 to
play, http://localhost:5174/?admin to host.

## Test

`apps/quiz-web` has **no test script**. The quiz's server-side rules are covered by
`apps/server`'s jest suite; `pnpm --filter @boardzando/quiz-web typecheck` and `lint` are
the static checks. This driver is the only end-to-end coverage of the client.

## Gotchas

- **`--rounds=1` ends the match the instant the answer lands**, jumping straight to the
  champion screen — so an assertion waiting for the chosen-answer highlight can time out
  even though everything worked. The driver accepts either outcome. Use `--rounds=3` if
  you need the reveal screen to stay up.
- **The question screen mounts before its answers.** `.q-question` appears immediately
  showing "Carregando pergunta 1…" for ~2.5s while audio is prepared. Always wait on
  `button.q-option`, never on `.q-question`.
- **The host is a presenter by default** — their answer buttons render but are `disabled`
  ("MODO APRESENTADOR"). Only a joined player can answer. There's a "O host tambem
  responde" checkbox in the create form to change that.
- **"CRIAR SALA" is both a tab (`.q-tab`) and the submit button (`.q-btn`).** Matching by
  text hits the tab. Same trap as `apps/web`.
- **`innerText` is UPPERCASED by CSS** (`ENTRAR COMO ADMIN`, `SALA DE ESPERA`). Lowercase
  both sides of any text assertion.
- **Empty `ADMIN_PASSWORD` silently kills room creation** — that's the documented switch
  for turning admin off, not a bug. You get a 401, not a helpful message.
- **One browser context per participant.** The session is in `localStorage`; the admin and
  the player in the same profile overwrite each other.
- **`musicquiz` cannot be created through the normal lobby.** `POST /rooms` with
  `gameId: 'musicquiz'` returns "Jogo desconhecido." by design — it's `/quiz/rooms` only.
- **Autoplay is blocked in headless Chrome**, so the audio never really plays. It doesn't
  affect the flow; the driver filters those console warnings out.
- **`pnpm --filter <app> dev -- --port N` does NOT pass the flag through.** Vite ignored it
  and auto-incremented from 5174 instead. Use `pnpm --filter <app> exec vite --port N
  --strictPort`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `ADMIN_PASSWORD nao definida` | Set it in the repo-root `.env` and restart the server. |
| Admin login says "Senha incorreta" | The server loaded a different `.env` — it resolves `['.env','../../.env']` relative to cwd, so start it from `apps/server/`. |
| `POST /quiz/admin/login -> 429` | 5 attempts/minute per IP. Wait a minute. |
| Quiz `<select>` empty / "Nenhum quiz disponivel" | `data/musicquiz/tracks.json` wasn't found. The server looks in `QUIZ_DATA_DIR`, else `<repo>/data/musicquiz`. |
| `timeout esperando "alternativas da pergunta 1"` | The preroll is longer than the timeout, or the track's audio is missing from `data/musicquiz/assets`. Re-run with `--headed --keep-open` and watch. |
| Player's answer buttons all `disabled` | You're driving the host page, not the player's — the host presents by default. |
| Vite starts on the wrong port | Use the `exec vite --port N --strictPort` form; `dev -- --port` is silently dropped. |
