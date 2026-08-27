#!/usr/bin/env node
/**
 * Driver do cliente web (apps/web) — Chrome headless via CDP, sem dependencia
 * de npm. Abre DOIS jogadores em contextos de navegacao isolados, cria a sala,
 * entra pelo deep-link `?room=<id>`, inicia a partida e tira screenshots.
 *
 *   node driver.mjs smoke                     # UNO, 2 jogadores, headless
 *   node driver.mjs smoke --game=flip7
 *   node driver.mjs smoke --headed            # abre a janela (pra olhar)
 *   node driver.mjs shot --url=http://localhost:5175 --out=.screenshots/lobby.png
 *
 * Flags: --web=<url> (default http://localhost:5175) --game --players
 *        --out-dir=<dir> --headed --keep-open
 *
 * Precisa do servidor Nest em :3000 — o proxy do Vite (vite.config.ts) aponta
 * pra la e o endereco e FIXO no arquivo.
 */

import { launchChrome, sleep } from './cdp.mjs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const cmd = argv.find((a) => !a.startsWith('--')) ?? 'smoke';
const flag = (n, d) => { const h = argv.find((a) => a.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : d; };
const has = (n) => argv.includes(`--${n}`);

const WEB = (flag('web', 'http://localhost:5175')).replace(/\/$/, '');
const GAME = flag('game', 'uno');
const PLAYERS = Number(flag('players', 2));
const OUT = flag('out-dir', '.screenshots');
const HEADLESS = !has('headed');

const steps = [];
const ok = (l, d = '') => { steps.push({ l, d }); console.log(`  ok  ${l}${d ? ` — ${d}` : ''}`); };
function assert(c, l, d = '') {
  if (c) return ok(l, d);
  console.error(`  FAIL ${l}${d ? ` — ${d}` : ''}`);
  throw new Error(`assert falhou: ${l}`);
}

async function cmdShot(browser) {
  const url = flag('url', WEB);
  const out = flag('out', join(OUT, 'shot.png'));
  const page = await browser.newPage('shot');
  await page.setViewport(1280, 900);
  await page.goto(url, { waitMs: 900 });
  const path = await page.screenshot(out, { fullPage: has('full') });
  console.log(`screenshot: ${path}`);
  return path;
}

async function cmdSmoke(browser) {
  console.log(`\n[1] carrega o lobby em ${WEB}`);
  const host = await browser.newPage('host');
  await host.setViewport(1280, 900);
  await host.goto(WEB, { waitMs: 800 });

  // O <select> so tem opcoes depois do GET /games passar pelo proxy do Vite —
  // se o servidor Nest nao estiver de pe, e AQUI que a coisa falha.
  await host.waitFor(() => document.querySelectorAll('#game-create option').length > 0,
    'lista de jogos carregada (GET /games via proxy do Vite)');
  const games = await host.eval(() => [...document.querySelectorAll('#game-create option')].map((o) => o.value));
  assert(games.length > 0, 'lobby carregou os jogos do servidor', `${games.length}: ${games.join(', ')}`);
  assert(games.includes(GAME), `jogo "${GAME}" aparece no seletor`);
  await host.screenshot(join(OUT, '01-lobby.png'));

  console.log(`\n[2] host cria a sala de ${GAME}`);
  await host.select('#game-create', GAME);
  await host.fill('#name-create', 'AgenteHost');
  await host.fill('#pw-create', 'segredo123');
  await host.click('button.shell-button:not(.secondary)');
  // innerText vem com o text-transform do CSS aplicado (a UI e caixa-alta),
  // entao compare sempre em minusculas — 'Sala' NAO bate com 'ID DA SALA'.
  await host.waitFor(() => document.body.innerText.toLowerCase().includes('id da sala'), 'entrou na tela de sala');
  const roomId = await host.eval(() => new URLSearchParams(location.search).get('room')
    ?? (document.body.innerText.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/) ?? [])[0]);
  assert(roomId, 'sala criada e id visivel na UI', roomId);
  await host.screenshot(join(OUT, '02-sala-host.png'));

  console.log(`\n[3] os outros ${PLAYERS - 1} jogador(es) entram pelo deep-link ?room=`);
  const guests = [];
  for (let i = 1; i < PLAYERS; i++) {
    // contexto isolado: a sessao fica no localStorage, dois jogadores no mesmo
    // perfil um sobrescreve o outro (ver Gotchas)
    const g = await browser.newPage(`convidado${i}`);
    await g.setViewport(1280, 900);
    await g.goto(`${WEB}/?room=${roomId}`, { waitMs: 800 });
    await g.waitFor(() => !!document.querySelector('#name-join'), 'aba "Entrar em sala" pre-selecionada pelo deep-link');
    const prefilled = await g.eval(() => document.querySelector('#room-join')?.value ?? '');
    assert(prefilled === roomId, `?room= preencheu o id da sala pro convidado${i}`, prefilled);
    await g.fill('#name-join', `AgenteP${i + 1}`);
    await g.fill('#pw-join', 'segredo123');
    await g.click('button.shell-button.secondary');
    await g.waitFor(() => document.body.innerText.toLowerCase().includes('aguardando o host'),
      `convidado${i} entrou e espera o host`);
    ok(`convidado${i} entrou na sala`);
    guests.push(g);
  }

  console.log(`\n[4] host inicia a partida`);
  await host.waitFor(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.className.includes('start-game'));
    return b && !b.disabled;
  }, 'botao "Iniciar jogo" habilitado (>= 2 jogadores)');
  await host.click('button.start-game');
  await sleep(1200);

  const hostText = await host.text();
  assert(!/aguardando/i.test(hostText), 'a sala saiu do lobby', 'status jogando');
  await host.screenshot(join(OUT, `03-mesa-${GAME}-host.png`));
  if (guests[0]) await guests[0].screenshot(join(OUT, `04-mesa-${GAME}-convidado.png`));
  ok('mesa renderizada', `screenshots em ${OUT}/`);

  console.log(`\n[5] a mesa e diferente pra cada jogador (playerView)`);
  if (guests[0]) {
    const guestText = await guests[0].text();
    assert(hostText !== guestText, 'host e convidado veem telas diferentes',
      `${hostText.length} vs ${guestText.length} chars`);
  }

  if (GAME === 'uno') {
    console.log(`\n[6] joga de verdade: quem esta na vez compra uma carta`);
    const table = [host, ...guests];
    const hands = await Promise.all(table.map((p) => p.eval(() => document.querySelectorAll('.uno-hand-slot').length)));
    assert(hands.every((h) => h === 7), 'cada jogador recebeu 7 cartas', hands.join(' / '));

    // o botao do baralho so fica habilitado pra quem esta na vez
    const turnIdx = await (async () => {
      for (let i = 0; i < table.length; i++) {
        const enabled = await table[i].eval(() => {
          const b = document.querySelector('.uno-deck-button');
          return !!b && !b.disabled;
        });
        if (enabled) return i;
      }
      return -1;
    })();
    assert(turnIdx >= 0, 'exatamente um jogador tem o baralho habilitado', `jogador ${turnIdx}`);

    const p = table[turnIdx];
    await p.click('.uno-deck-button');
    await p.waitFor(() => document.querySelectorAll('.uno-hand-slot').length === 8,
      'a mao cresceu pra 8 depois de comprar');
    ok('compra aplicada pelo servidor e refletida na UI', '7 -> 8 cartas');
    await p.screenshot(join(OUT, `05-comprou-${GAME}.png`));
  }

  console.log(`\n[7] sem erro de JS no console`);
  const errs = [...host.consoleErrors, ...host.pageErrors, ...guests.flatMap((g) => [...g.consoleErrors, ...g.pageErrors])]
    // ruido conhecido: o Vite reclama de websocket de HMR quando roda em porta alternativa
    .filter((e) => !/HMR|hot update|WebSocket closed without opened|favicon/i.test(e));
  assert(errs.length === 0, 'console limpo', errs.slice(0, 3).join(' | ') || 'nenhum erro');

  return { roomId };
}

const commands = { smoke: cmdSmoke, shot: cmdShot };
const run = commands[cmd];
if (!run) { console.error(`comando desconhecido: ${cmd}\nuse: smoke | shot`); process.exit(2); }

let browser;
try {
  console.log(`driver web: ${cmd} em ${WEB} (game=${GAME}, players=${PLAYERS}, headless=${HEADLESS})`);
  browser = await launchChrome({ headless: HEADLESS });
  await run(browser);
  if (cmd === 'smoke') console.log(`\nSMOKE OK — ${steps.length} asserts passaram.`);
  if (has('keep-open')) { console.log('--keep-open: Ctrl-C pra fechar'); await sleep(600000); }
  process.exit(0);
} catch (e) {
  console.error(`\n${cmd.toUpperCase()} FALHOU: ${e.message}`);
  process.exit(1);
} finally {
  if (browser && !has('keep-open')) await browser.close();
}
