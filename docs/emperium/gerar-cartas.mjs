/**
 * Gera o catalogo legivel de todas as cartas a partir da FONTE REAL
 * (packages/contracts/src/emperium.ts, compilado em dist).
 *
 * Escrever esse documento a mao garante que ele mente depois da primeira
 * mudanca de balanceamento. Gerando, ele nao pode divergir do jogo.
 *
 * Uso, da raiz do repo:
 *   pnpm --filter @boardzando/contracts build && node docs/emperium/gerar-cartas.mjs
 *
 * Sai em: docs/emperium/04-todas-as-cartas.md  e  cartas.html
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, '..', '..');

const cat = require(join(raiz, 'packages/contracts/dist/index.js'));
const {
  DECK_I,
  rotuloKeyword,
  TRANSCENDENCIAS,
  EQUIPMENT,
  MONSTER_CARDS,
  CONSUMABLES,
  caminhosDaClasse,
} = cat;

/* ── Formatação ──────────────────────────────────────────────────────────── */

const PAPEL = { vanguarda: 'Vanguarda', arcano: 'Arcano', agil: 'Ágil', suporte: 'Suporte' };

const kw = (k) => rotuloKeyword(k);
const kws = (arr) => (arr.length ? arr.map(kw).join(' · ') : '—');
const slots = (n) => (n > 0 ? '◇'.repeat(n) : '—');
const encaixes = (n) => (n > 0 ? '◈'.repeat(n) : '—');

/** Custo por ponto de Poder — o numero que faz um outlier saltar aos olhos. */
const razao = (custo, poder) => (poder > 0 ? (custo / poder).toFixed(1) : '—');

const ESPECIAL = {
  'ignora-primeira-baixa': 'Ignora a primeira baixa desta sala',
  'baixa-vai-reserva': 'Baixas vão para a Reserva, não para a Enfermaria',
  'imune-anular': 'Imune a Anular',
  renda2: '+2 de renda por rodada',
  'acao-extra': '+1 ação de mercado por rodada',
  'nunca-primeira-baixa': 'Nunca é a primeira baixa',
  'ignora-posicionamento': 'Ignora a Marcha Forçada',
  'revela-oculto': 'Revela Oculto inimigo na sala',
  'poder-emperium': '+2 de Poder na Sala do Emperium',
  'penalidade-escudar': '−1 se o portador tiver PROTEGER',
  'marcha-livre': 'anula a Marcha Forçada do clã inteiro',
  'forja-suprema': 'refino sem quebra e 1 grátis por rodada',
  imortal: 'não pode sofrer baixa',
  ensemble: 'com um Bardo E uma Odalisca seus na sala, cada músico dá +5',
  marionete: 'dobra o Poder base de outro seu, máx. +6',
};
const especial = (id) => ESPECIAL[id] ?? id;

const ordemClasses = [...new Set(DECK_I.map((c) => c.classe))];

/* ── Markdown ────────────────────────────────────────────────────────────── */

function markdown() {
  const L = [];
  const p = (s = '') => L.push(s);

  p('# TODAS AS CARTAS — Guerra do Emperium');
  p();
  p('> **Documento gerado.** Sai de `packages/contracts/src/emperium.ts`, que é a fonte');
  p('> única dos números do jogo. Para regenerar depois de mexer no catálogo:');
  p('>');
  p('> ```bash');
  p('> pnpm --filter @boardzando/contracts build && node docs/emperium/gerar-cartas.mjs');
  p('> ```');
  p();
  p('---');
  p();
  p('## Como ler isto');
  p();
  p('As cartas estão **agrupadas por classe**, e dentro de cada classe as duas bases vêm');
  p('antes dos três caminhos de Transcendência. É de propósito: a maior parte dos problemas');
  p('de balanceamento aparece **comparando irmãs**, não lendo carta isolada.');
  p();
  p('A coluna **z/P** é o custo dividido pelo Poder — quanto *menor*, mais Poder por zeny.');
  p('Ela não julga sozinha (uma carta de Poder 1 com palavra-chave forte deve mesmo ter');
  p('razão ruim), mas duas cartas de custo parecido com razões muito diferentes merecem uma');
  p('segunda olhada.');
  p();
  p('**Perguntas úteis para anotar na margem:**');
  p();
  p('- Alguma classe tem duas bases que fazem a mesma coisa?');
  p('- Algum caminho de Transcendência nunca seria escolhido sobre os outros dois?');
  p('- Alguma carta tem razão z/P muito fora da faixa da classe dela?');
  p('- Algum combo exige um companheiro que quase nunca vai estar na mesma sala?');
  p('- Alguma carta sem palavra-chave e sem combo é chata demais para existir?');
  p();

  /* Panorama */
  const comCombo = DECK_I.filter((c) => c.combo).length;
  const trComCombo = TRANSCENDENCIAS.filter((t) => t.combo).length;
  const semNada = DECK_I.filter((c) => !c.combo && c.keywords.length === 0);
  const custos = DECK_I.map((c) => c.custo);
  const poderes = DECK_I.map((c) => c.poder);

  p('---');
  p();
  p('## Panorama');
  p();
  p('| | |');
  p('|---|---|');
  p(`| Variações base | **${DECK_I.length}** (13 classes × 2) |`);
  p(`| Transcendências | **${TRANSCENDENCIAS.length}** (13 classes × 3) |`);
  p(`| Desfechos possíveis | **${DECK_I.length * 3}** (cada base × 3 caminhos) |`);
  p(`| Bases com combo | ${comCombo} de ${DECK_I.length} |`);
  p(`| Transcendências com combo | ${trComCombo} de ${TRANSCENDENCIAS.length} |`);
  p(`| Custo das bases | ${Math.min(...custos)}–${Math.max(...custos)} zeny |`);
  p(`| Poder das bases | ${Math.min(...poderes)}–${Math.max(...poderes)} |`);
  p(`| Custo das evoluções | ${Math.min(...TRANSCENDENCIAS.map((t) => t.custo))}–${Math.max(...TRANSCENDENCIAS.map((t) => t.custo))} zeny |`);
  p(`| Equipamentos | ${EQUIPMENT.length} |`);
  p(`| Cartas de monstro | ${MONSTER_CARDS.length} tipos |`);
  p(`| Consumíveis | ${CONSUMABLES.length} tipos |`);
  p();
  if (semNada.length) {
    p(`**Cartas sem palavra-chave e sem combo** — são as mais simples do baralho, e vale`);
    p(`conferir se são simples de propósito ou só sem graça: ${semNada.map((c) => c.nome).join(', ')}.`);
    p();
  }

  /* Personagens por classe */
  p('---');
  p();
  p('## Personagens');
  p();

  for (const classe of ordemClasses) {
    const bases = DECK_I.filter((c) => c.classe === classe);
    const paths = caminhosDaClasse(classe);

    p(`### ${classe}`);
    p();
    p('| Base | Custo | Poder | z/P | Papel | Slots | Palavras-chave | Build |');
    p('|---|---|---|---|---|---|---|---|');
    for (const c of bases) {
      p(
        `| **${c.nome}** | ${c.custo}z | ${c.poder} | ${razao(c.custo, c.poder)} | ` +
          `${PAPEL[c.papel]} | ${slots(c.slots)} | ${kws(c.keywords)} | *${c.build}* |`,
      );
    }
    p();
    for (const c of bases) {
      if (c.combo) p(`- **${c.nome}** — ${c.combo.texto}`);
    }
    if (bases.some((c) => c.combo)) p();

    p('| Transcendência | Custo | +Poder | Ganha | Origem |');
    p('|---|---|---|---|---|');
    for (const t of paths) {
      const slot = t.slotsBonus ? ` · *+${t.slotsBonus} slot de equipamento*` : '';
      const extra = (t.special ? ` · *${especial(t.special)}*` : '') + slot;
      p(
        `| **${t.nome.replace(/^[^—]+— /, '')}** | ${t.custo}z | +${t.poderBonus} | ` +
          `${kws(t.keywords)}${extra} | *${t.build}* |`,
      );
    }
    p();
    for (const t of paths) {
      if (t.combo) p(`- **${t.nome.replace(/^[^—]+— /, '')}** — ${t.combo.texto}`);
    }
    if (paths.some((t) => t.combo)) p();
    p('> **Anotações:**');
    p();
  }

  /* Equipamento */
  p('---');
  p();
  p('## Equipamento');
  p();
  for (const kind of ['arma', 'armadura', 'acessorio']) {
    const titulo = { arma: 'Armas', armadura: 'Armaduras', acessorio: 'Acessórios' }[kind];
    p(`### ${titulo}`);
    p();
    p('| Carta | Papel | Custo | +Poder | Encaixes | Palavras-chave | Efeito próprio |');
    p('|---|---|---|---|---|---|---|');
    for (const e of EQUIPMENT.filter((x) => x.kind === kind)) {
      const papeis = e.papeis.length ? e.papeis.map((x) => PAPEL[x]).join(' / ') : 'qualquer';
      const esp = [e.special ? especial(e.special) : null, e.exige ? `exige ${e.exige.toUpperCase()}` : null]
        .filter(Boolean)
        .join(' · ');
      p(
        `| **${e.nome}** | ${papeis} | ${e.custo}z | +${e.poder} | ${encaixes(e.encaixes)} | ` +
          `${kws(e.keywords)} | ${esp || '—'} |`,
      );
    }
    p();
    p('> **Anotações:**');
    p();
  }

  /* Cartas de monstro */
  p('---');
  p();
  p('## Cartas de monstro');
  p();
  p('Encaixam nos slots ◈ dos equipamentos. Permanentes e viradas para cima na mesa.');
  p();
  p('| Carta | Efeito |');
  p('|---|---|');
  for (const m of MONSTER_CARDS) {
    p(`| **${m.nome}** | ${m.texto ?? kws(m.keywords)} |`);
  }
  p();
  p('> **Anotações:**');
  p();

  /* Consumíveis */
  p('---');
  p();
  p('## Consumíveis');
  p();
  p('| Carta | Efeito | Jogado |');
  p('|---|---|---|');
  for (const c of CONSUMABLES) {
    p(`| **${c.nome}** | ${c.efeito} | ${c.naSala ? 'na sala, de bruços' : 'no mercado'} |`);
  }
  p();
  p('> **Anotações:**');
  p();

  return L.join('\n');
}

/* ── HTML, feito para ler no celular ─────────────────────────────────────── */

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function cardHTML(c) {
  const k = c.keywords.length
    ? `<span class="kws">${c.keywords.map((x) => `<span class="kw">${esc(kw(x))}</span>`).join('')}</span>`
    : '';
  return `
      <article class="carta" data-papel="${c.papel}">
        <div class="topo">
          <span class="nome">${esc(c.nome)}</span>
          <span class="custo">${c.custo}z</span>
        </div>
        <div class="stats">
          <span><em>Poder</em><b>${c.poder}</b></span>
          <span><em>z/P</em><b>${razao(c.custo, c.poder)}</b></span>
          <span><em>Papel</em><b>${PAPEL[c.papel]}</b></span>
          <span><em>Slots</em><b>${slots(c.slots)}</b></span>
        </div>
        ${k}
        ${c.combo ? `<p class="combo">${esc(c.combo.texto)}</p>` : ''}
        <p class="build">${esc(c.build)}</p>
      </article>`;
}

function transHTML(t) {
  const k = t.keywords.length
    ? `<span class="kws">${t.keywords.map((x) => `<span class="kw">${esc(kw(x))}</span>`).join('')}</span>`
    : '';
  return `
      <article class="carta asc">
        <div class="topo">
          <span class="nome">${esc(t.nome.replace(/^[^—]+— /, ''))}</span>
          <span class="custo">${t.custo}z</span>
        </div>
        <div class="stats">
          <span><em>+Poder</em><b>+${t.poderBonus}</b></span>
          ${t.special ? `<span><em>Especial</em><b>${esc(especial(t.special))}</b></span>` : ''}
          ${t.slotsBonus ? `<span><em>Slots</em><b>+${t.slotsBonus}</b></span>` : ''}
        </div>
        ${k}
        ${t.combo ? `<p class="combo">${esc(t.combo.texto)}</p>` : ''}
        <p class="build">${esc(t.build)}</p>
      </article>`;
}

function html() {
  const secoes = ordemClasses
    .map((classe) => {
      const bases = DECK_I.filter((c) => c.classe === classe);
      const paths = caminhosDaClasse(classe);
      const id = classe.toLowerCase().replace(/[^a-z]/g, '');
      return `
  <section id="${id}">
    <h2>${esc(classe)}</h2>
    <h3>Bases</h3>
    <div class="grade">${bases.map(cardHTML).join('')}</div>
    <h3>Transcendências</h3>
    <div class="grade">${paths.map(transHTML).join('')}</div>
  </section>`;
    })
    .join('');

  const tabela = (titulo, cabecalhos, linhas) => `
  <h3>${titulo}</h3>
  <div class="twrap"><table>
    <thead><tr>${cabecalhos.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${linhas.map((l) => `<tr>${l.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>`;

  const equipSec = ['arma', 'armadura', 'acessorio']
    .map((kind) => {
      const titulo = { arma: 'Armas', armadura: 'Armaduras', acessorio: 'Acessórios' }[kind];
      const linhas = EQUIPMENT.filter((e) => e.kind === kind).map((e) => [
        `<b>${esc(e.nome)}</b>`,
        e.papeis.length ? e.papeis.map((x) => PAPEL[x]).join(' / ') : 'qualquer',
        `${e.custo}z`,
        `+${e.poder}`,
        encaixes(e.encaixes),
        esc(kws(e.keywords)),
        esc(
          [e.special ? especial(e.special) : null, e.exige ? `exige ${e.exige.toUpperCase()}` : null].filter(Boolean).join(' · ') ||
            '—',
        ),
      ]);
      return tabela(titulo, ['Carta', 'Papel', 'Custo', '+Poder', '◈', 'Palavras-chave', 'Efeito'], linhas);
    })
    .join('');

  const monstros = tabela(
    'Cartas de monstro',
    ['Carta', 'Efeito'],
    MONSTER_CARDS.map((m) => [
      `<b>${esc(m.nome)}</b>`,
      esc(m.texto ?? kws(m.keywords)),
    ]),
  );

  const consumiveis = tabela(
    'Consumíveis',
    ['Carta', 'Efeito'],
    CONSUMABLES.map((c) => [`<b>${esc(c.nome)}</b>`, esc(c.efeito)]),
  );

  const nav = ordemClasses
    .map((c) => `<a href="#${c.toLowerCase().replace(/[^a-z]/g, '')}">${esc(c)}</a>`)
    .join('');

  return `<title>Cartas do Emperium</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Spectral:wght@600;800&family=Karla:wght@400;500;700&family=Silkscreen&display=swap">
<style>
:root{--ground:#E9EBEC;--surface:#F8F9F9;--alt:#DFE3E4;--ink:#151B1F;--soft:#3A454C;
--muted:#667279;--rule:#C6CCCE;--soft-rule:#D8DCDE;--tea:#00807E;--combo:#6B4BA8;
--gold:#8A6A18;--vanguarda:#8A5A2B;--arcano:#3C5FA8;--agil:#5B7A3A;--suporte:#8A4A72;
--d:"Spectral",Georgia,serif;--b:"Karla",system-ui,sans-serif;--m:"Silkscreen",monospace;}
@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){
--ground:#0F1417;--surface:#161D21;--alt:#1E272C;--ink:#E3E8E9;--soft:#BAC4C7;
--muted:#89949A;--rule:#2B363B;--soft-rule:#222C31;--tea:#3CD4CC;--combo:#A98CE0;
--gold:#D8B45F;--vanguarda:#B07B3C;--arcano:#5B82CE;--agil:#7CA34E;--suporte:#B06A97;}}
:root[data-theme="dark"]{--ground:#0F1417;--surface:#161D21;--alt:#1E272C;--ink:#E3E8E9;
--soft:#BAC4C7;--muted:#89949A;--rule:#2B363B;--soft-rule:#222C31;--tea:#3CD4CC;
--combo:#A98CE0;--gold:#D8B45F;--vanguarda:#B07B3C;--arcano:#5B82CE;--agil:#7CA34E;--suporte:#B06A97;}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);font-family:var(--b);
font-size:17px;line-height:1.55;-webkit-font-smoothing:antialiased}
.wrap{max-width:60rem;margin:0 auto;padding:0 1rem 4rem}
h1,h2,h3{font-family:var(--d);margin:0;text-wrap:balance}
p{margin:0}
a{color:var(--tea)}
:focus-visible{outline:2px solid var(--tea);outline-offset:3px}
header{padding:3rem 0 1.5rem;border-bottom:1px solid var(--rule);margin-bottom:1.2rem}
header h1{font-size:clamp(2rem,7vw,3rem);font-weight:800;line-height:1;letter-spacing:-.02em}
header p{color:var(--soft);margin-top:.7rem;max-width:52ch}
.eyebrow{font-family:var(--m);font-size:.58rem;letter-spacing:.11em;text-transform:uppercase;color:var(--muted)}
nav{display:flex;flex-wrap:wrap;gap:.3rem;margin-bottom:2.4rem;
position:sticky;top:0;background:var(--ground);padding:.6rem 0;z-index:5;
border-bottom:1px solid var(--soft-rule)}
nav a{font-size:.72rem;text-decoration:none;color:var(--soft);
border:1px solid var(--rule);border-radius:99px;padding:.2rem .55rem;white-space:nowrap}
nav a:hover{color:var(--tea);border-color:var(--tea)}
section{margin-bottom:2.8rem;scroll-margin-top:3.4rem}
section>h2{font-size:1.5rem;font-weight:800;padding-bottom:.3rem;
border-bottom:2px solid var(--tea);margin-bottom:.9rem}
h3{font-family:var(--m);font-size:.6rem;letter-spacing:.11em;text-transform:uppercase;
color:var(--muted);margin:1.1rem 0 .5rem}
.grade{display:grid;grid-template-columns:repeat(auto-fit,minmax(15.5rem,1fr));gap:.6rem}
.carta{background:var(--surface);border:1px solid var(--rule);border-radius:4px;
padding:.7rem .8rem;display:flex;flex-direction:column;gap:.4rem;min-width:0;
border-left:3px solid var(--muted)}
.carta[data-papel=vanguarda]{border-left-color:var(--vanguarda)}
.carta[data-papel=arcano]{border-left-color:var(--arcano)}
.carta[data-papel=agil]{border-left-color:var(--agil)}
.carta[data-papel=suporte]{border-left-color:var(--suporte)}
.carta.asc{border-left-color:var(--gold)}
.topo{display:flex;gap:.6rem;align-items:baseline}
.nome{font-family:var(--d);font-weight:700;font-size:.98rem;line-height:1.2;flex:1;min-width:0}
.custo{font-weight:800;color:var(--gold);font-variant-numeric:tabular-nums}
.stats{display:flex;gap:.9rem;flex-wrap:wrap;border-top:1px dashed var(--soft-rule);
border-bottom:1px dashed var(--soft-rule);padding:.35rem 0}
.stats em{display:block;font-style:normal;font-family:var(--m);font-size:.5rem;
letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.stats b{font-size:.92rem;font-variant-numeric:tabular-nums}
.kws{display:flex;gap:.25rem;flex-wrap:wrap}
.kw{font-family:var(--m);font-size:.53rem;letter-spacing:.05em;padding:.15rem .3rem;
border-radius:2px;background:var(--alt);color:var(--soft)}
.combo{font-size:.76rem;line-height:1.35;color:var(--combo)}
.build{font-family:var(--d);font-style:italic;font-size:.76rem;color:var(--muted);margin-top:auto}
.twrap{overflow-x:auto;border:1px solid var(--rule);border-radius:4px;background:var(--surface)}
table{border-collapse:collapse;width:100%;font-size:.82rem}
th,td{text-align:left;padding:.45rem .6rem;border-bottom:1px solid var(--soft-rule);vertical-align:top}
thead th{font-family:var(--m);font-size:.53rem;letter-spacing:.07em;text-transform:uppercase;
color:var(--muted);background:var(--alt);white-space:nowrap}
tbody tr:last-child td{border-bottom:0}
.nota{border-left:3px solid var(--combo);background:var(--surface);padding:.8rem 1rem;
border-radius:0 4px 4px 0;margin-bottom:1.6rem}
.nota ul{margin:.5rem 0 0;padding-left:1.1rem;font-size:.88rem}
.nota li{margin-bottom:.2rem}
footer{border-top:1px solid var(--rule);padding-top:1rem;color:var(--muted);font-size:.8rem}
@media(max-width:30rem){body{font-size:16px}.grade{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>

<div class="wrap">
<header>
  <span class="eyebrow">Catálogo completo · gerado do código</span>
  <h1>Cartas do Emperium</h1>
  <p>${DECK_I.length} variações base, ${TRANSCENDENCIAS.length} Transcendências,
     ${EQUIPMENT.length} equipamentos, ${MONSTER_CARDS.length} cartas de monstro e
     ${CONSUMABLES.length} consumíveis. Agrupados por classe, porque problema de
     balanceamento aparece comparando irmãs.</p>
</header>

<div class="nota">
  <b>O que procurar enquanto lê</b>
  <ul>
    <li>Alguma classe tem duas bases que fazem a mesma coisa?</li>
    <li>Algum caminho de Transcendência nunca seria escolhido sobre os outros dois?</li>
    <li>Alguma carta tem <b>z/P</b> muito fora da faixa da classe dela?</li>
    <li>Algum combo exige um companheiro que quase nunca estaria na mesma sala?</li>
    <li>Alguma carta sem palavra-chave e sem combo é chata demais para existir?</li>
  </ul>
</div>

<nav>${nav}<a href="#itens">Itens</a></nav>
${secoes}
<section id="itens">
  <h2>Equipamento e itens</h2>
  ${equipSec}
  ${monstros}
  ${consumiveis}
</section>

<footer>
  <p>Gerado de <code>packages/contracts/src/emperium.ts</code> por
  <code>docs/emperium/gerar-cartas.mjs</code>. Se um número aqui parecer errado, ele
  está errado <em>no jogo</em> — os dois saem da mesma fonte.</p>
</footer>
</div>`;
}

/* ── Saída ───────────────────────────────────────────────────────────────── */

writeFileSync(join(aqui, '04-todas-as-cartas.md'), markdown() + '\n', 'utf8');
writeFileSync(join(aqui, 'cartas.html'), html() + '\n', 'utf8');

console.log('gerado:');
console.log('  docs/emperium/04-todas-as-cartas.md');
console.log('  docs/emperium/cartas.html');
console.log(
  `  ${DECK_I.length} bases · ${TRANSCENDENCIAS.length} evoluções · ` +
    `${EQUIPMENT.length} equipamentos · ${MONSTER_CARDS.length} monstros · ${CONSUMABLES.length} consumíveis`,
);
