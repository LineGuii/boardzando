/**
 * Mini cliente do Chrome DevTools Protocol — sem dependencia nenhuma.
 * Usa o WebSocket global do Node 22+ e o Chrome ja instalado na maquina.
 *
 * Motivo de existir: o painel de Browser do Claude Code nao consegue tirar
 * screenshot quando nao esta visivel ("the Browser pane is not displayed, so
 * the page is not compositing frames"), e nao ha chromium-cli/playwright aqui.
 * Chrome headless via CDP funciona sempre, inclusive sem sessao interativa.
 *
 * Usado por driver.mjs (apps/web) e pelo driver do apps/quiz-web.
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

export function findChrome() {
  const hit = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!hit) throw new Error(`Chrome nao encontrado. Tente CHROME_PATH=<caminho do chrome.exe>`);
  return hit;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Sobe um Chrome headless proprio (perfil descartavel) com a porta de debug aberta. */
export async function launchChrome({ port = 9333, headless = true } = {}) {
  const bin = findChrome();
  const profile = mkdtempSync(join(tmpdir(), 'bz-chrome-'));
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    // sem isso o Chrome headless as vezes nao pinta nada em maquina sem GPU
    '--disable-gpu',
    '--window-size=1280,900',
  ];
  if (headless) args.push('--headless=new');
  const proc = spawn(bin, args, { stdio: 'ignore', detached: false });

  // espera a porta de debug responder
  const deadline = Date.now() + 20000;
  let version;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) { version = await res.json(); break; }
    } catch { /* ainda subindo */ }
    await sleep(150);
  }
  if (!version) { try { proc.kill(); } catch {} throw new Error(`Chrome nao abriu a porta ${port}`); }

  const browser = await Browser.connect(version.webSocketDebuggerUrl, proc, port);
  return browser;
}

/** Conexao com o alvo "browser" — cria contextos e paginas. */
export class Browser {
  constructor(ws, proc, port) { this.ws = ws; this.proc = proc; this.port = port; this.id = 0; this.pending = new Map(); this.listeners = []; }

  static async connect(url, proc, port) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = () => reject(new Error('falha conectando no CDP'));
      setTimeout(() => reject(new Error('timeout conectando no CDP')), 10000);
    });
    const b = new Browser(ws, proc, port);
    ws.onmessage = (ev) => b.#onMessage(JSON.parse(ev.data));
    return b;
  }

  #onMessage(msg) {
    if (msg.id && this.pending.has(msg.id)) {
      const { resolve, reject } = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message} (${JSON.stringify(msg.error.data ?? '')})`));
      else resolve(msg.result);
      return;
    }
    for (const fn of this.listeners) fn(msg);
  }

  send(method, params = {}, sessionId) {
    const id = ++this.id;
    const payload = { id, method, params, ...(sessionId ? { sessionId } : {}) };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error(`CDP timeout: ${method}`));
      }, 30000);
      this.ws.send(JSON.stringify(payload));
    });
  }

  on(fn) { this.listeners.push(fn); }

  /**
   * Uma aba num contexto de navegacao ISOLADO. Isso importa: o app guarda a
   * sessao da sala no localStorage, entao dois jogadores no mesmo contexto se
   * atropelam (o segundo "retoma" a sessao do primeiro).
   */
  async newPage(name = 'page') {
    const { browserContextId } = await this.send('Target.createBrowserContext', { disposeOnDetach: true });
    const { targetId } = await this.send('Target.createTarget', { url: 'about:blank', browserContextId });
    const { sessionId } = await this.send('Target.attachToTarget', { targetId, flatten: true });
    const page = new Page(this, sessionId, name);
    await page.init();
    return page;
  }

  async close() {
    try { this.ws.close(); } catch {}
    try { this.proc.kill(); } catch {}
  }
}

export class Page {
  constructor(browser, sessionId, name) {
    this.browser = browser; this.sessionId = sessionId; this.name = name;
    this.consoleErrors = []; this.pageErrors = [];
  }

  send(method, params) { return this.browser.send(method, params, this.sessionId); }

  async init() {
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('Log.enable');
    this.browser.on((msg) => {
      if (msg.sessionId !== this.sessionId) return;
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        this.consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        this.pageErrors.push(msg.params.exceptionDetails.exception?.description ?? 'exception');
      }
      if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
        // inclui a url: sem ela um '404 Not Found' generico e indebugavel
        this.consoleErrors.push([msg.params.entry.text, msg.params.entry.url].filter(Boolean).join(' '));
      }
    });
  }

  async goto(url, { waitMs = 400 } = {}) {
    await this.send('Page.navigate', { url });
    await this.waitFor(() => document.readyState === 'complete', `load ${url}`);
    await sleep(waitMs); // React precisa de um tick pra montar
  }

  /** Avalia uma funcao no contexto da pagina e devolve o valor (JSON-serializavel). */
  async eval(fn, ...args) {
    const expression = `(${fn.toString()})(${args.map((a) => JSON.stringify(a)).join(',')})`;
    const { result, exceptionDetails } = await this.send('Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true,
    });
    if (exceptionDetails) {
      throw new Error(`eval falhou: ${exceptionDetails.exception?.description ?? exceptionDetails.text}`);
    }
    return result.value;
  }

  /** Repete `fn` na pagina ate devolver truthy. */
  async waitFor(fn, label, timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs;
    let last;
    while (Date.now() < deadline) {
      try { last = await this.eval(fn); if (last) return last; } catch (e) { last = e.message; }
      await sleep(120);
    }
    throw new Error(`timeout esperando "${label}" em ${this.name} (ultimo: ${JSON.stringify(last)?.slice(0, 200)})`);
  }

  text() { return this.eval(() => document.body.innerText); }

  /**
   * Clica por seletor CSS. PREFIRA isto a clickText: no lobby, a ABA "Criar
   * sala" e o BOTAO "Criar sala de UNO" batem no mesmo texto, e clickText pega
   * a aba (que nao faz nada). Falha alto se o botao estiver disabled.
   */
  async click(selector) {
    const res = await this.eval((selector) => {
      const el = document.querySelector(selector);
      if (!el) return { err: 'nao encontrado' };
      if (el.disabled) return { err: `disabled (texto: ${el.innerText})` };
      el.scrollIntoView({ block: 'center' });
      el.click();
      return { text: el.innerText || el.tagName };
    }, selector);
    if (res?.err) throw new Error(`click "${selector}" falhou: ${res.err} (${this.name})`);
    await sleep(250);
    return res.text;
  }

  /** Clica no primeiro elemento clicavel cujo texto contem `needle`. */
  async clickText(needle, { tag = 'button,[role=button],a,label' } = {}) {
    const hit = await this.eval((needle, tag) => {
      const els = [...document.querySelectorAll(tag)];
      const el = els.find((e) => (e.innerText || e.textContent || '').toLowerCase().includes(needle.toLowerCase()));
      if (!el) return null;
      el.scrollIntoView({ block: 'center' });
      el.click();
      return el.innerText || el.textContent || el.tagName;
    }, needle, tag);
    if (!hit) throw new Error(`nao achei clicavel com texto "${needle}" em ${this.name}`);
    await sleep(250);
    return hit;
  }

  /**
   * Preenche um input controlado por React. ARMADILHA: setar `.value` direto
   * nao dispara o onChange do React (ele usa o setter nativo do prototype), o
   * campo volta vazio no submit. Por isso o setter nativo + evento 'input'.
   */
  async fill(selector, value) {
    const okFill = await this.eval((selector, value) => {
      const el = document.querySelector(selector);
      if (!el) return false;
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }, selector, value);
    if (!okFill) throw new Error(`seletor nao encontrado: ${selector} (${this.name})`);
    await sleep(120);
    return true;
  }

  /** Seleciona uma <option> por value num <select> controlado por React. */
  async select(selector, value) {
    const okSel = await this.eval((selector, value) => {
      const el = document.querySelector(selector);
      if (!el) return false;
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, value);
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return el.value === value;
    }, selector, value);
    if (!okSel) throw new Error(`select falhou: ${selector}=${value} (${this.name})`);
    await sleep(120);
    return true;
  }

  /** PNG no disco. `fullPage` usa o tamanho real do documento. */
  async screenshot(path, { fullPage = false } = {}) {
    if (fullPage) {
      const m = await this.send('Page.getLayoutMetrics');
      const { width, height } = m.cssContentSize ?? m.contentSize;
      await this.send('Emulation.setDeviceMetricsOverride', {
        width: Math.ceil(width), height: Math.ceil(height), deviceScaleFactor: 1, mobile: false,
      });
    }
    const { data } = await this.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: fullPage });
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, Buffer.from(data, 'base64'));
    if (fullPage) await this.send('Emulation.clearDeviceMetricsOverride');
    return path;
  }

  async setViewport(width = 1280, height = 900) {
    await this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  }
}

export { sleep };
