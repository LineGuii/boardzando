#!/usr/bin/env node
/**
 * Driver do Music Quiz (apps/quiz-web) — Chrome headless via CDP, sem npm.
 *
 * O fluxo tem uma porta a mais que o apps/web: criar sala aqui e operacao de
 * ADMIN (`POST /quiz/rooms` tem AdminGuard), entao o driver faz login em
 * `/?admin` com a ADMIN_PASSWORD antes de qualquer coisa.
 *
 *   node driver.mjs smoke                  # admin cria sala, jogador entra,
 *                                          # partida comeca, jogador responde
 *   node driver.mjs smoke --quiz=test      # quiz de 1 faixa (o mais rapido)
 *   node driver.mjs shot --url=... --out=...
 *
 * Flags: --web=<url> (default http://localhost:5176) --quiz --rounds
 *        --players --out-dir --headed --keep-open
 *
 * A senha do admin vem de ADMIN_PASSWORD no ambiente ou do .env da raiz do
 * repo. O driver NUNCA imprime a senha.
 */

import { launchChrome, sleep } from './cdp.mjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const cmd = argv.find((a) => !a.startsWith('--')) ?? 'smoke';
const flag = (n, d) => { const h = argv.find((a) => a.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : d; };
const has = (n) => argv.includes(`--${n}`);

const WEB = (flag('web', 'http://localhost:5176')).replace(/\/$/, '');
const QUIZ = flag('quiz', 'test');
const ROUNDS = flag('rounds', '1');
const PLAYERS = Number(flag('players', 2));   // 1 host + (PLAYERS-1) convidados
const OUT = flag('out-dir', '.screenshots');
const HEADLESS = !has('headed');

const steps = [];
const ok = (l, d = '') => { steps.push({ l, d }); console.log(`  ok  ${l}${d ? ` — ${d}` : ''}`); };
function assert(c, l, d = '') {
  if (c) return ok(l, d);
  console.error(`  FAIL ${l}${d ? ` — ${d}` : ''}`);
  throw new Error(`assert falhou: ${l}`);
}

/** Le a senha do admin sem nunca imprimi-la. */
function adminPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  const envPath = join(fileURLToPath(new URL('../../../../../', import.meta.url)), '.env');
  try {
    const line = readFileSync(envPath, 'utf8').split(/\r?\n/).find((l) => l.startsWith('ADMIN_PASSWORD='));
    const value = (line ?? '').slice('ADMIN_PASSWORD='.length).trim();
    if (value) return value;
  } catch { /* sem .env */ }
  throw new Error(
    'ADMIN_PASSWORD nao definida. Sem ela o servidor desliga TODOS os endpoints admin ' +
    `e nao da pra criar sala. Defina no .env da raiz (procurei em ${envPath}).`,
  );
}

// seletores (o quiz-web nao usa id — vai por placeholder/classe)
const SEL = {
  pass: 'input[type=password].q-input',
  name: 'input[placeholder="Como voce quer ser chamado?"]',
  code: 'input[placeholder="cole o codigo aqui"]',
  // ATENCAO: a aba e o botao tem o MESMO texto "CRIAR SALA". A aba e .q-tab.
  submit: 'button.q-btn',
  quizSelect: 'select.q-select',
  option: 'button.q-option',
};

async function cmdShot(browser) {
  const page = await browser.newPage('shot');
  await page.setViewport(1280, 900);
  await page.goto(flag('url', WEB), { waitMs: 1200 });
  const path = await page.screenshot(flag('out', join(OUT, 'shot.png')), { fullPage: has('full') });
  console.log(`screenshot: ${path}`);
  return path;
}

async function cmdSmoke(browser) {
  console.log(`\n[1] painel de admin em ${WEB}/?admin`);
  const admin = await browser.newPage('admin');
  await admin.setViewport(1280, 900);
  await admin.goto(`${WEB}/?admin`, { waitMs: 1200 });
  await admin.waitFor(() => document.body.innerText.toLowerCase().includes('entrar como admin'),
    'tela de login do admin');
  await admin.screenshot(join(OUT, '01-admin-login.png'));

  await admin.fill(SEL.pass, adminPassword());
  await admin.click(SEL.submit);
  await admin.waitFor(() => document.body.innerText.toLowerCase().includes('voce esta autenticado'),
    'login de admin aceito');
  ok('login de admin (POST /quiz/admin/login)');

  console.log(`\n[2] admin cria a sala com o quiz "${QUIZ}"`);
  // so o PRIMEIRO select e o de quizzes; os outros sao modo de audio e ordem
  const quizzes = await admin.eval(() => [...document.querySelectorAll('select.q-select')[0].options].map((o) => o.value));
  assert(quizzes.includes(QUIZ), `quiz "${QUIZ}" existe em data/musicquiz/tracks.json`, quizzes.join(', '));
  await admin.select(SEL.quizSelect, QUIZ);
  await admin.fill(SEL.name, 'AgenteHost');
  await admin.fill('input[type=number].q-input', ROUNDS);
  await admin.click(SEL.submit);

  await admin.waitFor(() => document.body.innerText.toLowerCase().includes('sala de espera'),
    'host caiu na sala de espera');
  const roomId = await admin.eval(() => new URLSearchParams(location.search).get('room')
    ?? (document.body.innerText.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/) ?? [])[0]);
  assert(roomId, 'sala de quiz criada', roomId);
  await admin.screenshot(join(OUT, '02-sala-espera.png'));

  console.log(`\n[3] ${PLAYERS - 1} jogador(es) entram com o codigo`);
  const players = [];
  for (let i = 1; i < PLAYERS; i++) {
    const p = await browser.newPage(`jogador${i}`);   // contexto isolado: sessao no localStorage
    await p.setViewport(1280, 900);
    await p.goto(WEB, { waitMs: 1000 });
    await p.fill(SEL.name, `AgenteP${i + 1}`);
    await p.fill(SEL.code, roomId);
    await p.click(SEL.submit);
    await p.waitFor(() => document.body.innerText.toLowerCase().includes('aguardando o host'),
      `jogador${i} na sala de espera`);
    ok(`jogador${i} entrou (POST /quiz/rooms/join — sem admin)`);
    players.push(p);
  }
  const seen = await admin.eval(() => document.body.innerText);
  assert(/AgenteP2/i.test(seen), 'o host ve o jogador na lista da sala');

  console.log(`\n[4] host inicia a partida`);
  await admin.clickText('Iniciar partida');
  // ARMADILHA: `.q-question` monta ANTES das alternativas — fica ~2,5s em
  // "Carregando pergunta 1..." enquanto o audio e preparado. Espere as OPCOES.
  await admin.waitFor(() => document.querySelectorAll('button.q-option').length > 0,
    'alternativas da pergunta 1 renderizadas (passa pelo "Carregando pergunta...")', 30000);
  const q = await admin.eval(() => ({
    texto: document.querySelector('.q-question-text')?.innerText,
    opcoes: [...document.querySelectorAll('button.q-option')].map((b) => b.innerText.replace(/\s+/g, ' ')),
  }));
  assert(q.opcoes.length > 1, 'pergunta com alternativas renderizada',
    `"${q.texto}" -> ${q.opcoes.join(' / ')}`);
  await admin.screenshot(join(OUT, '03-pergunta-host.png'));

  console.log(`\n[5] o jogador responde de verdade`);
  if (players[0]) {
    const p = players[0];
    await p.waitFor(() => document.querySelectorAll('button.q-option:not([disabled])').length > 0,
      'alternativas habilitadas pro jogador', 20000);
    await p.click('button.q-option[data-idx="0"]');
    // Com --rounds=1 a partida ACABA na hora e a tela pula direto pro campeao,
    // entao `.chosen` pode nem chegar a ser observado. Aceite os dois desfechos.
    const desfecho = await p.waitFor(() => {
      if (document.querySelector('button.q-option.chosen')) return 'marcada como escolhida';
      const t = document.body.innerText.toLowerCase();
      if (/campe|ranking|placar|acertou|errou/.test(t)) return 'partida avancou (reveal/ranking)';
      return null;
    }, 'resposta registrada na UI', 20000);
    ok('resposta enviada (quiz:answer)', desfecho);
    const pontos = await p.eval(() => (document.body.innerText.match(/\b\d{2,4}\b/) ?? [])[0]);
    if (pontos) ok('o servidor pontuou a resposta', `${pontos} pontos`);
    await p.screenshot(join(OUT, '04-respondeu-jogador.png'));
    await admin.screenshot(join(OUT, '05-host-apos-resposta.png'));
  }

  console.log(`\n[6] sem erro de JS no console`);
  const errs = [...admin.consoleErrors, ...admin.pageErrors, ...players.flatMap((p) => [...p.consoleErrors, ...p.pageErrors])]
    // ruido conhecido: audio bloqueado por autoplay e HMR em porta alternativa
    .filter((e) => !/HMR|hot update|favicon|autoplay|play\(\) failed|NotAllowedError/i.test(e));
  assert(errs.length === 0, 'console limpo', errs.slice(0, 3).join(' | ') || 'nenhum erro');

  return { roomId };
}

const commands = { smoke: cmdSmoke, shot: cmdShot };
const run = commands[cmd];
if (!run) { console.error(`comando desconhecido: ${cmd}\nuse: smoke | shot`); process.exit(2); }

let browser;
try {
  console.log(`driver quiz: ${cmd} em ${WEB} (quiz=${QUIZ}, rounds=${ROUNDS}, players=${PLAYERS}, headless=${HEADLESS})`);
  browser = await launchChrome({ headless: HEADLESS, port: 9336 });
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
