#!/usr/bin/env node
/**
 * Driver do servidor Boardzando — dirige o servidor RODANDO pela mesma porta
 * de entrada que o cliente real usa: HTTP (criar/entrar em sala) + Socket.IO
 * no namespace `/games` (handshake com JWT, start, moves, chat).
 *
 * NAO e a suite de testes: isso aqui fala com um processo Nest de verdade.
 *
 *   node driver.mjs smoke                    # fluxo completo de UNO (default)
 *   node driver.mjs smoke --game=flip7       # so cria/inicia e le o 1o estado
 *   node driver.mjs smoke --players=3        # N jogadores (respeite minPlayers)
 *   node driver.mjs games                    # GET /games
 *   node driver.mjs rooms                    # GET /rooms (salas publicas)
 *
 * Flags: --port=3100 --host=localhost --password=<senha> --json --quiet
 * Env:   BZ_PORT (mesma coisa que --port)
 *
 * Sai com codigo 0 no sucesso, 1 em qualquer assert que falhar.
 */

import { io } from 'socket.io-client';

// ---------- args ----------
const argv = process.argv.slice(2);
const cmd = argv.find((a) => !a.startsWith('--')) ?? 'smoke';
const flag = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const has = (name) => argv.includes(`--${name}`);

const PORT = Number(flag('port', process.env.BZ_PORT ?? 3100));
const HOST = flag('host', 'localhost');
const GAME = flag('game', 'uno');
const PLAYERS = Number(flag('players', 2));
const PASSWORD = flag('password', 'segredo123');
const QUIET = has('quiet');
const BASE = `http://${HOST}:${PORT}`;

// ---------- log / assert ----------
const steps = [];
const log = (...a) => { if (!QUIET) console.log(...a); };
const ok = (label, detail = '') => { steps.push({ label, pass: true, detail }); log(`  ok  ${label}${detail ? ` — ${detail}` : ''}`); };
function assert(cond, label, detail = '') {
  if (cond) return ok(label, detail);
  steps.push({ label, pass: false, detail });
  console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  throw new Error(`assert failed: ${label}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function http(path, init) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${path} -> ${res.status} ${text.slice(0, 300)}`);
  return body;
}

/** Conecta um socket autenticado ao namespace /games e junta os eventos recebidos. */
function connect(token, name) {
  const socket = io(`${BASE}/games`, {
    auth: { token },
    transports: ['websocket'],   // pula o polling: falha rapido se o handshake for recusado
    reconnection: false,
  });
  const inbox = { room: [], state: [], chat: [], over: [], error: [] };
  socket.on('room:update', (p) => inbox.room.push(p));
  socket.on('game:state', (p) => inbox.state.push(p));
  socket.on('chat:message', (p) => inbox.chat.push(p));
  socket.on('game:over', (p) => inbox.over.push(p));
  socket.on('error', (p) => inbox.error.push(p));

  const ready = new Promise((resolve, reject) => {
    socket.on('connect', () => resolve());
    socket.on('connect_error', (e) => reject(new Error(`handshake recusado (${name}): ${e.message}`)));
    setTimeout(() => reject(new Error(`timeout conectando ${name}`)), 8000);
  });
  return { socket, inbox, ready, name };
}

/**
 * socket.emit com ack. ARMADILHA: quando o handler lanca (WsException, move
 * invalido, throttle), o WsAllExceptionsFilter emite no evento `error` e o ack
 * NUNCA chega. Entao corremos ack x evento `error` — quem chegar primeiro.
 * Sem isso, todo erro do servidor vira um "timeout" enganoso.
 */
function emit(client, event, payload, timeoutMs = 5000) {
  const errorsBefore = client.inbox.error.length;
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; clearInterval(poll); clearTimeout(t); resolve(v); } };
    const poll = setInterval(() => {
      if (client.inbox.error.length > errorsBefore) finish({ ok: false, ...client.inbox.error.at(-1) });
    }, 25);
    const t = setTimeout(() => finish({ ok: false, code: 'TIMEOUT', message: `sem ack nem error: ${event}` }), timeoutMs);
    client.socket.emit(event, payload, (ack) => finish(ack ?? { ok: true }));
  });
}

/** Reenvia quando o servidor devolve RATE_LIMITED (throttle e por IP, ver Gotchas). */
async function emitPaced(client, event, payload, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const ack = await emit(client, event, payload);
    if (ack?.code !== 'RATE_LIMITED') return ack;
    await sleep(1100); // a janela do throttler e de 1s
  }
  return { ok: false, code: 'RATE_LIMITED', message: 'throttle persistente' };
}

/** Espera ate `pred(inbox)` virar verdade (polling curto — eventos sao push). */
async function waitFor(client, pred, label, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (pred(client.inbox)) return true;
    await sleep(50);
  }
  throw new Error(`timeout esperando: ${label} (${client.name})`);
}

// ---------- comandos ----------

async function cmdGames() {
  const games = await http('/games');
  console.log(JSON.stringify(games, null, 2));
  return games;
}

async function cmdRooms() {
  const rooms = await http('/rooms');
  console.log(JSON.stringify(rooms, null, 2));
  return rooms;
}

async function cmdSmoke() {
  const clients = [];
  try {
    log(`\n[1] HTTP — registro de jogos em ${BASE}`);
    const games = await http('/games');
    assert(Array.isArray(games) && games.length > 0, 'GET /games devolve plugins', `${games.length} jogo(s)`);
    const def = games.find((g) => g.id === GAME);
    assert(def, `jogo "${GAME}" esta plugado`, def && `${def.name} (${def.minPlayers}-${def.maxPlayers}p)`);
    assert(
      PLAYERS >= def.minPlayers && PLAYERS <= def.maxPlayers,
      `--players=${PLAYERS} respeita minPlayers/maxPlayers`,
      `${def.minPlayers}-${def.maxPlayers}`,
    );

    log(`\n[2] HTTP — cria sala (Argon2id + JWT) e entra com os demais`);
    const host = await http('/rooms', {
      method: 'POST',
      body: JSON.stringify({ gameId: GAME, playerName: 'DriverHost', roomPassword: PASSWORD }),
    });
    assert(host.roomId && host.token, 'POST /rooms devolve roomId + token', `sala ${host.roomId}`);
    const seats = [{ ...host, playerName: 'DriverHost' }];
    for (let i = 1; i < PLAYERS; i++) {
      const name = `DriverP${i + 1}`;
      const joined = await http('/rooms/join', {
        method: 'POST',
        body: JSON.stringify({ roomId: host.roomId, playerName: name, roomPassword: PASSWORD }),
      });
      assert(joined.token, `POST /rooms/join autentica ${name}`);
      seats.push({ ...joined, playerName: name });
    }

    log(`\n[3] HTTP — senha errada tem que ser recusada`);
    let refused = false;
    try {
      await http('/rooms/join', {
        method: 'POST',
        body: JSON.stringify({ roomId: host.roomId, playerName: 'Invasor', roomPassword: 'errada' }),
      });
    } catch (e) { refused = /401/.test(String(e.message)); }
    assert(refused, 'senha errada devolve 401', 'Argon2id verify');

    log(`\n[4] WS — handshake sem token tem que ser recusado`);
    let handshakeRefused = false;
    try {
      const bad = connect('token-invalido', 'Invasor');
      clients.push(bad);
      await bad.ready;
    } catch (e) { handshakeRefused = /recusado|UNAUTHORIZED/i.test(String(e.message)); }
    assert(handshakeRefused, 'WS sem JWT valido e recusado no handshake');

    log(`\n[5] WS — conecta os ${PLAYERS} jogadores no namespace /games`);
    for (const seat of seats) {
      const c = connect(seat.token, seat.playerName);
      clients.push(c);
      await c.ready;
      seat.client = c;
      ok(`${seat.playerName} conectado`, c.socket.id);
    }
    const hostClient = seats[0].client;
    await waitFor(hostClient, (i) => i.room.some((r) => r.players?.length === PLAYERS),
      `room:update com ${PLAYERS} jogadores`);
    ok('room:update lista todos os jogadores conectados');

    log(`\n[6] WS — chat (broadcast pra sala)`);
    const other = seats[seats.length - 1].client;
    hostClient.socket.emit('chat:send', { roomId: host.roomId, text: 'driver: opa' });
    await waitFor(other, (i) => i.chat.some((m) => m.text === 'driver: opa'), 'chat:message no outro cliente');
    ok('chat:send chega em todos os sockets da sala');

    log(`\n[7] WS — room:start`);
    const ack = await emit(seats[0].client, 'room:start', { roomId: host.roomId });
    assert(ack?.ok === true, 'room:start aceito pelo host', JSON.stringify(ack));
    await waitFor(hostClient, (i) => i.state.length > 0, 'game:state apos start');
    const first = hostClient.inbox.state.at(-1);
    assert(first?.view, 'game:state traz a view filtrada do jogador',
      `turn=${first.turn} phase=${first.phase ?? '-'} currentPlayer=${first.currentPlayer?.slice(0, 8)}`);

    log(`\n[8] WS — nao-host nao pode dar start`);
    if (seats.length > 1) {
      const bad = await emit(seats[1].client, 'room:start', { roomId: host.roomId });
      assert(bad?.ok !== true, 'room:start de nao-host e rejeitado', JSON.stringify(bad).slice(0, 120));
    }

    if (GAME === 'uno') {
      log(`\n[9] WS — joga uma rodada de UNO de verdade`);
      await playUnoRound(seats, host.roomId);
    } else {
      log(`\n[9] jogo "${GAME}": moves especificos nao automatizados — estado inicial validado acima`);
      ok(`estado inicial de ${GAME} recebido`, JSON.stringify(Object.keys(first.view)).slice(0, 120));
    }

    log(`\n[10] WS — move ilegal tem que ser rejeitado`);
    const turnSeat = seats.find((s) => s.playerId === hostClient.inbox.state.at(-1).currentPlayer) ?? seats[0];
    const bogus = await emit(turnSeat.client, 'game:move', {
      roomId: host.roomId, type: 'playCard', data: { cardId: 'nao-existe' },
    });
    assert(bogus?.ok !== true, 'move invalido nao passa pelo reducer', JSON.stringify(bogus).slice(0, 140));

    return true;
  } finally {
    for (const c of clients) { try { c.socket.close(); } catch { /* ja fechado */ } }
  }
}

/**
 * Joga UNO ate alguem ganhar ou ate o limite de jogadas. Le a mao do jogador da
 * vez pela SUA propria view (playerView esconde a mao dos outros — por isso
 * precisamos de um socket por jogador, nao da pra dirigir tudo de um so).
 */
async function playUnoRound(seats, roomId, maxMoves = 40) {
  const byId = new Map(seats.map((s) => [s.playerId, s]));
  let moves = 0, plays = 0, draws = 0;

  for (; moves < maxMoves; moves++) {
    const snap = seats[0].client.inbox.state.at(-1);
    if (seats[0].client.inbox.over.length) break;

    const seat = byId.get(snap.currentPlayer);
    if (!seat) throw new Error(`currentPlayer ${snap.currentPlayer} nao e um dos jogadores do driver`);

    const myState = seat.client.inbox.state.at(-1);
    const view = myState.view;
    const hand = view.myHand ?? [];
    const top = view.topCard;
    const active = view.activeColor;

    // mesma regra do servidor (uno.deck.isPlayable), replicada pra escolher a jogada
    const playable = hand.filter((c) =>
      view.pendingDraw > 0
        ? c.kind === 'draw2'
        : c.color === 'wild' || c.color === active || (c.kind === top?.kind && c.kind !== 'number') ||
          (c.kind === 'number' && top?.kind === 'number' && c.value === top.value),
    );

    let ack;
    if (playable.length) {
      const card = playable[0];
      const data = { cardId: card.id, ...(card.color === 'wild' ? { chosenColor: 'red' } : {}) };
      ack = await emitPaced(seat.client, 'game:move', { roomId, type: 'playCard', data });
      if (ack?.ok) plays++;
    } else {
      ack = await emitPaced(seat.client, 'game:move', { roomId, type: 'drawCard', data: {} });
      if (ack?.ok) draws++;
      // depois de comprar, o jogador PRECISA decidir: jogar a comprada ou passar
      await sleep(80);
      const after = seat.client.inbox.state.at(-1).view;
      if (after.mustDecideAfterDraw) {
        await emitPaced(seat.client, 'game:move', { roomId, type: 'passTurn', data: {} });
      }
    }
    if (ack?.ok !== true) throw new Error(`move rejeitado no lance ${moves}: ${JSON.stringify(ack)}`);

    // canta UNO quando ficar com 1 carta (senao leva contestUno)
    await sleep(60);
    const now = seat.client.inbox.state.at(-1).view;
    if ((now.myHand ?? []).length === 1) {
      await emitPaced(seat.client, 'game:move', { roomId, type: 'callUno', data: {} });
    }
  }

  assert(moves > 0, 'ao menos um lance foi aplicado', `${moves} lances (${plays} jogadas, ${draws} compras)`);
  const final = seats[0].client.inbox.state.at(-1).view;
  ok('estado avancou', `topo=${final.topCard?.color}/${final.topCard?.kind} deck=${final.deckCount}`);
  const over = seats[0].client.inbox.over.at(-1);
  if (over) ok('game:over emitido', JSON.stringify(over.result));
  else ok(`partida em andamento apos ${maxMoves} lances (normal — UNO nao acaba rapido)`);
}

// ---------- main ----------
const commands = { smoke: cmdSmoke, games: cmdGames, rooms: cmdRooms };
const run = commands[cmd];
if (!run) {
  console.error(`comando desconhecido: ${cmd}\nuse: smoke | games | rooms`);
  process.exit(2);
}

try {
  log(`driver: ${cmd} em ${BASE} (game=${GAME}, players=${PLAYERS})`);
  await run();
  if (has('json')) console.log(JSON.stringify({ ok: true, steps }, null, 2));
  if (cmd === 'smoke') console.log(`\nSMOKE OK — ${steps.length} asserts passaram.`);
  process.exit(0);
} catch (e) {
  console.error(`\nSMOKE FALHOU: ${e.message}`);
  if (has('json')) console.log(JSON.stringify({ ok: false, error: e.message, steps }, null, 2));
  process.exit(1);
}
