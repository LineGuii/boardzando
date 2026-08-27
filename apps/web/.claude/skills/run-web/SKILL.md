---
name: run-web
description: Build, run and drive the Boardzando board-games web client (apps/web) — start the Vite dev server and use driver.mjs to open two players in headless Chrome, create a room, join, start a match, click cards and save screenshots. Use when asked to run, start, preview, screenshot, smoke-test or visually verify the web client / lobby / a game board (uno, emperium, flip7, hues, ito, …) in a real browser.
---

# Run the Boardzando web client

React + Vite. The lobby creates/joins rooms over HTTP and everything after that is
Socket.IO. **It is useless without `apps/server`** — the Vite dev server proxies `/games`,
`/rooms` and `/socket.io` to the backend.

**The agent path is [driver.mjs](driver.mjs)** — it launches headless Chrome and drives
the real UI over the Chrome DevTools Protocol: two players in isolated browser contexts,
room created through the form, second player joining by deep link, match started, a card
actually clicked, PNGs written to disk. [cdp.mjs](cdp.mjs) is the tiny CDP client it uses
(no npm dependency — Node 22+ has a global `WebSocket`, and Chrome is already installed).

All paths below are relative to `apps/web/`.

## Prerequisites

Node 20+ and pnpm 9 (here: Node v23.11.0, pnpm 9.12.0). Google Chrome — found
automatically at `C:\Program Files\Google\Chrome\Application\chrome.exe`; override with
`CHROME_PATH=<path>` if it lives elsewhere. No Playwright, no `chromium-cli`, no
`apt-get` — none of that is available or needed here.

## Build

From the repo root (`@boardzando/contracts` must compile first — turbo orders it):

```bash
pnpm install --frozen-lockfile
```

```bash
pnpm build
```

`tsc -b && vite build` → `apps/web/dist/`. Typecheck alone:
`pnpm --filter @boardzando/web typecheck`.

## Run (agent path)

**1. The backend must be on port 3000.** `vite.config.ts` hardcodes
`http://localhost:3000` in `server.proxy` — there is no env var for it, so the server
cannot be moved without editing that file:

```bash
cd apps/server && node dist/main.js
```

**2. Start Vite.** Port 5173 is usually taken by the developer's own dev server; use a
free port so you don't fight over it:

```bash
pnpm --filter @boardzando/web exec vite --port 5175 --strictPort
```

(**`pnpm --filter <app> dev -- --port N` does not work** — the flag never reaches Vite,
which then silently auto-increments from 5173. The `exec vite` form above is the one that
actually binds.)

**3. Drive it:**

```bash
cd apps/web && node .claude/skills/run-web/driver.mjs smoke
```

What the smoke does — every step is a real click, and it exits non-zero on the first
failed assert:

```
[1] loads the lobby, waits for the game <select> to fill (proves the Vite proxy
    reached the server — this is where a missing backend shows up)
[2] host: picks the game, fills name + password, clicks "Criar sala de …"
[3] guest: opens /?room=<id>, checks the deep link prefilled the room id, joins
[4] host clicks "▶ Iniciar jogo"
[5] asserts host and guest see DIFFERENT screens (playerView really filters)
[6] whoever holds the turn clicks the deck; asserts their hand goes 7 -> 8
[7] asserts the JS console is clean
```

Last verified run: `SMOKE OK — 12 asserts passaram`.

Screenshots land in `apps/web/.screenshots/` (gitignored): `01-lobby.png`,
`02-sala-host.png`, `03-mesa-<game>-host.png`, `04-mesa-<game>-convidado.png`,
`05-comprou-<game>.png`. **Open them** — a green table with cards means it worked.

Other games (steps 1-5 and 7 are generic; step 6 is UNO-specific and is skipped):

```bash
cd apps/web && node .claude/skills/run-web/driver.mjs smoke --game=emperium --players=3
```

One-off screenshot of any page:

```bash
cd apps/web && node .claude/skills/run-web/driver.mjs shot --url=http://localhost:5175 --out=.screenshots/lobby.png --full
```

Flags: `--web=<url>` (default `http://localhost:5175`), `--game`, `--players`,
`--out-dir`, `--headed` (real window), `--keep-open` (leave Chrome up to poke at).

`cdp.mjs` gives you `goto`, `eval(fn, ...args)`, `waitFor`, `click(selector)`,
`clickText`, `fill`, `select`, `text()`, `screenshot(path, {fullPage})`, plus
`consoleErrors` / `pageErrors` per page. Add steps to `cmdSmoke` in
[driver.mjs](driver.mjs) — the two-player plumbing is already there.

Stable hooks in the lobby markup: `#game-create`, `#name-create`, `#pw-create`,
`#name-join`, `#room-join`, `#pw-join`, `button.shell-button` (create),
`button.shell-button.secondary` (join), `button.start-game`. On the UNO table:
`.uno-hand-slot`, `.uno-deck-button`, `.uno-discard`.

## Run (human path)

```bash
pnpm dev
```

Turbo boots the server on 3000 and the web app on 5173; open http://localhost:5173.
Nothing drives it — that's the point, a human does.

## Test

`apps/web` has **no test script** — `pnpm test` at the root skips it. `pnpm lint` and
`pnpm --filter @boardzando/web typecheck` are the only static checks; the driver above is
the functional one.

## Gotchas

- **`innerText` comes back UPPERCASED.** The shell styles headings with
  `text-transform`, and `innerText` reflects the rendered CSS — the room screen reads
  `ID DA SALA`, not `Sala`. Every text assertion must lowercase both sides. This silently
  cost a debugging round here.
- **Never match buttons by text in the lobby.** The *tab* "Criar sala" and the *submit*
  button "Criar sala de UNO" both contain "Criar sala", and a text match hits the tab —
  which switches tabs and does nothing visible. Use the CSS selectors listed above;
  `page.click()` also throws on a `disabled` button instead of silently no-op'ing.
- **One browser context per player.** The session lives in `localStorage`, and the app
  auto-resumes it when `?room=` matches. Two players in the same profile means the second
  one silently takes over the first one's session. `browser.newPage()` creates an isolated
  context for exactly this reason.
- **Setting `input.value` does not reach React.** React listens via the native prototype
  setter, so a plain assignment leaves the form thinking the field is empty and the submit
  button stays `disabled`. `page.fill()` uses the native setter + `input` event.
- **The proxy target is hardcoded.** `vite.config.ts` → `localhost:3000` for `/rooms`,
  `/games` and `/socket.io`. Running the server on another port makes the lobby load with
  an empty game `<select>` and no visible error.
- **Vite's port is also hardcoded** (`server.port: 5173`), and `pnpm --filter <app> dev --
  --port N` does *not* forward the flag — Vite ignores it and auto-increments to the next
  free port (5174, which is quiz-web's, then 5175…). Use `pnpm --filter <app> exec vite
  --port N --strictPort` so it binds where you asked or fails loudly.
- **The Claude Code Browser pane cannot screenshot here**: "the Browser pane is not
  displayed, so the page is not compositing frames". `read_page` works fine for structure,
  but for pixels use the driver. That's why `cdp.mjs` exists.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Lobby renders but the game `<select>` is empty; driver step 1 times out | The server isn't on 3000. Start it (`cd apps/server && node dist/main.js`). |
| `Port 5173 is in use by "node.exe" (not a preview server)` | The developer's own Vite is running. Start yours with `exec vite --port 5175 --strictPort` and pass `--web=http://localhost:5175` to the driver. |
| `Chrome nao encontrado` | Set `CHROME_PATH` to your `chrome.exe` (or `msedge.exe` — the driver accepts it). |
| `click "button.start-game" falhou: disabled` | Fewer than 2 players in the room. The host can't start alone; raise `--players`. |
| `timeout esperando "entrou na tela de sala"` | Usually a text assertion that forgot the uppercase gotcha, or the name field never reached React (<2 chars keeps the button disabled). Re-run with `--headed --keep-open` and look. |
| Guest lands on the create tab instead of join | The `?room=` deep link didn't parse — check the URL really has `/?room=<uuid>`. |
| Screenshot is a blank white PNG | The page hadn't painted. Increase the `waitMs` on `goto`, or `await page.waitFor(...)` on something real before capturing. |
