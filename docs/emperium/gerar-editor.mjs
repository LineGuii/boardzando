/**
 * Gera o editor online de cartas (docs/emperium/editor.html).
 *
 * Lê o catálogo compilado dos contratos e embute o estado ATUAL como linha de
 * base. O que o editor salva no `db` é só o DELTA — assim, ao regerar esta
 * página depois de aplicar mudanças no código, o delta some sozinho porque a
 * base passou a incluí-lo.
 *
 *   node docs/emperium/gerar-editor.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const C = require('../../packages/contracts/dist/index.js');

const KEYWORDS = Object.keys(C.KEYWORD_LABEL);
const PAPEIS = ['vanguarda', 'arcano', 'agil', 'suporte'];

/** Os tipos de efeito de combo, espelhando `ComboEfeito` nos contratos. */
const EFEITOS = [
  { tipo: 'poder', campos: ['x'], rotulo: '+X de Poder' },
  { tipo: 'poder-por-zeny', campos: ['cada'], rotulo: '+1 de Poder a cada N zeny' },
  { tipo: 'perfurar-total', campos: [], rotulo: 'ignora toda a Muralha inimiga' },
  { tipo: 'cobrir-papel', campos: ['papel'], rotulo: 'este Papel não sofre baixa' },
  { tipo: 'rajada-papel', campos: ['papel', 'x'], rotulo: '+X de Poder a este Papel' },
  { tipo: 'cancela-esgotar', campos: [], rotulo: 'ninguém vai à Enfermaria por Esgotar' },
  { tipo: 'mover', campos: ['x'], rotulo: 'o clã ganha MOVER X' },
  { tipo: 'marca', campos: ['marca'], rotulo: 'marca o maior clã inimigo' },
  { tipo: 'rapto', campos: [], rotulo: 'RAPTO — arranca 1 inimigo da sala' },
  { tipo: 'troco', campos: [], rotulo: 'se perder, o vencedor sofre 1 baixa' },
  { tipo: 'ariete', campos: [], rotulo: 'o clã atravessa o Escudo do Emperium' },
];

const dados = {
  keywords: KEYWORDS,
  rotulos: C.KEYWORD_LABEL,
  descricoes: C.KEYWORD_DESC,
  papeis: PAPEIS,
  marcas: Object.keys(C.MARCA_LABEL),
  efeitos: EFEITOS,
  bases: C.DECK_I,
  transcendencias: C.TRANSCENDENCIAS,
  equipamentos: C.EQUIPMENT,
};

const html = `<title>Balanço do Emperium</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;800&display=swap">

<style>
/* =========================================================
 * Herda a paleta do tabuleiro: Pergaminho no claro, Cerco no
 * escuro. Nao e uma paleta nova — e a MESMA do jogo, para o
 * editor parecer parte dele e nao uma planilha a parte.
 * ========================================================= */
:root {
  --pedra: #E6D9BB; --pedra-alta: #F6EFDD; --pedra-borda: #BFA97C;
  --tinta: #2B2114; --tinta-fraca: #6B5B3E;
  --cristal: #0A5F59; --sangue: #8F2A1E; --ouro: #6F4E0D;
  --vanguarda: #6E4718; --arcano: #204A85; --agil: #3B6522; --suporte: #78325A;
  --fundo: linear-gradient(180deg, #F3EAD3 0%, #E4D7B4 100%);
  --sombra: 0 6px 18px -10px rgba(70,52,20,.5);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --pedra: #16121A; --pedra-alta: #221B27; --pedra-borda: #3C3043;
    --tinta: #F1E7D5; --tinta-fraca: #A5937D;
    --cristal: #4ADFD3; --sangue: #E36A5C; --ouro: #E8B849;
    --vanguarda: #C9924A; --arcano: #6E96DC; --agil: #8DB55F; --suporte: #C77CA8;
    --fundo: linear-gradient(180deg, #1D1723 0%, #120E16 100%);
    --sombra: 0 10px 26px -14px rgba(0,0,0,.9);
  }
}
:root[data-theme="dark"] {
  --pedra: #16121A; --pedra-alta: #221B27; --pedra-borda: #3C3043;
  --tinta: #F1E7D5; --tinta-fraca: #A5937D;
  --cristal: #4ADFD3; --sangue: #E36A5C; --ouro: #E8B849;
  --vanguarda: #C9924A; --arcano: #6E96DC; --agil: #8DB55F; --suporte: #C77CA8;
  --fundo: linear-gradient(180deg, #1D1723 0%, #120E16 100%);
  --sombra: 0 10px 26px -14px rgba(0,0,0,.9);
}

* { box-sizing: border-box; }
body { margin: 0; background: var(--pedra); color: var(--tinta);
  font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
  font-size: 15px; line-height: 1.5; }
h1, h2, h3 { font-family: Cinzel, Georgia, serif; margin: 0; text-wrap: balance; }
:focus-visible { outline: 2px solid var(--cristal); outline-offset: 2px; }

.folha { max-width: 84rem; margin: 0 auto; padding: 0 16px 80px; }

/* ── Barra de comando, fixa: o estado do trabalho fica sempre visivel ── */
.barra { position: sticky; top: 0; z-index: 20; background: var(--fundo);
  border-bottom: 1px solid var(--pedra-borda); padding: 14px 0 12px;
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.barra h1 { font-size: 1.1rem; font-weight: 800; letter-spacing: .02em; }
.selo { display: inline-flex; align-items: center; gap: 6px; font-size: .7rem;
  font-weight: 700; padding: 3px 9px; border-radius: 999px;
  border: 1px solid var(--pedra-borda); color: var(--tinta-fraca); }
.selo.vivo { color: var(--cristal); border-color: var(--cristal); }
.selo.aviso { color: var(--sangue); border-color: var(--sangue); }
.ponto { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.espaco { flex: 1; }

button { font: inherit; cursor: pointer; border-radius: 4px;
  border: 1px solid var(--pedra-borda); background: var(--pedra-alta);
  color: var(--tinta); padding: 6px 12px; }
button:hover { border-color: var(--cristal); }
button.forte { background: var(--cristal); border-color: var(--cristal);
  color: var(--pedra); font-weight: 700; }
button.risco { color: var(--sangue); border-color: var(--sangue); }
button.mini { padding: 2px 7px; font-size: .7rem; }

.busca { flex: 1; min-width: 12rem; max-width: 22rem; padding: 6px 10px;
  border-radius: 4px; border: 1px solid var(--pedra-borda);
  background: var(--pedra-alta); color: var(--tinta); font: inherit; }

/* ── Grupos por classe: balanceamento aparece comparando irmas ── */
section { margin-top: 26px; }
section > h2 { font-size: 1rem; font-weight: 800; letter-spacing: .06em;
  text-transform: uppercase; color: var(--tinta-fraca);
  border-bottom: 1px solid var(--pedra-borda); padding-bottom: 5px; margin-bottom: 10px; }

.tabela { display: flex; flex-direction: column; gap: 6px; }

.linha { background: var(--pedra-alta); border: 1px solid var(--pedra-borda);
  border-left: 3px solid var(--tinta-fraca); border-radius: 4px; }
.linha[data-papel="vanguarda"] { border-left-color: var(--vanguarda); }
.linha[data-papel="arcano"] { border-left-color: var(--arcano); }
.linha[data-papel="agil"] { border-left-color: var(--agil); }
.linha[data-papel="suporte"] { border-left-color: var(--suporte); }
.linha.alterada { border-left-color: var(--ouro); box-shadow: inset 0 0 0 1px var(--ouro); }

.cab { display: grid; gap: 10px; align-items: center; padding: 8px 11px;
  grid-template-columns: minmax(0,1fr) auto auto auto auto auto; }
/* O nome e a descricao sao editaveis, mas continuam LENDO como titulo e
   legenda: borda so no foco, para a tabela seguir escaneavel. */
.nome { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.nome input { width: 100%; font: inherit; font-weight: 700; padding: 2px 4px;
  border: 1px solid transparent; border-radius: 3px;
  background: none; color: inherit; }
.nome input.desc { font-weight: 400; font-size: .78rem; color: var(--tinta-fraca);
  font-style: italic; }
.nome input:hover { border-color: var(--pedra-borda); }
.nome input:focus { border-color: var(--cristal); background: var(--pedra);
  outline: none; font-style: normal; }
.nome input.mudou { color: var(--ouro); border-color: var(--ouro); }
.nome .id { font-size: .62rem; color: var(--tinta-fraca); padding-left: 5px;
  font-family: ui-monospace, "Cascadia Mono", Menlo, monospace; }
.campo { display: flex; flex-direction: column; gap: 2px; }
.campo em { font-style: normal; font-size: .56rem; letter-spacing: .1em;
  text-transform: uppercase; color: var(--tinta-fraca); }
.campo input, .campo select { width: 5.4rem; padding: 4px 6px; border-radius: 3px;
  border: 1px solid var(--pedra-borda); background: var(--pedra); color: var(--tinta);
  font: inherit; font-size: .86rem; font-variant-numeric: tabular-nums; }
.campo input[type=number] { width: 4rem; }
.campo.mudou input, .campo.mudou select { border-color: var(--ouro); color: var(--ouro); }
.zp { font-variant-numeric: tabular-nums; font-size: .8rem; color: var(--tinta-fraca);
  min-width: 3.4rem; text-align: right; }

.detalhe { border-top: 1px dashed var(--pedra-borda); padding: 11px;
  display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr)); }
.bloco h3 { font-size: .62rem; letter-spacing: .1em; text-transform: uppercase;
  color: var(--tinta-fraca); font-family: inherit; font-weight: 700; margin-bottom: 6px; }

.chips { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.chip { display: inline-flex; align-items: center; gap: 4px; font-size: .62rem;
  font-weight: 700; letter-spacing: .05em; padding: 3px 6px; border-radius: 3px;
  border: 1px solid var(--cristal); color: var(--cristal); }
.chip input { width: 2.4rem; padding: 0 3px; border: 0; border-bottom: 1px solid currentColor;
  background: none; color: inherit; font: inherit; text-align: center; }
.chip button { border: 0; background: none; color: inherit; padding: 0 2px;
  font-size: .8rem; line-height: 1; }

.linha-form { display: flex; gap: 6px; flex-wrap: wrap; align-items: center;
  margin-bottom: 6px; }
.linha-form select, .linha-form input { padding: 4px 6px; border-radius: 3px;
  border: 1px solid var(--pedra-borda); background: var(--pedra); color: var(--tinta);
  font: inherit; font-size: .82rem; }
.linha-form input.texto { flex: 1; min-width: 12rem; }
.dica { font-size: .68rem; color: var(--tinta-fraca); line-height: 1.4; }
.dica b { color: var(--tinta); }

/* ── Painel de exportacao ── */
dialog { border: 1px solid var(--pedra-borda); border-radius: 6px; padding: 0;
  background: var(--pedra-alta); color: var(--tinta); max-width: 56rem; width: 92vw; }
dialog::backdrop { background: rgba(0,0,0,.6); }
.dlg-cab { display: flex; align-items: center; gap: 10px; padding: 12px 14px;
  border-bottom: 1px solid var(--pedra-borda); }
.dlg-cab h2 { font-size: .95rem; flex: 1; }
.dlg-corpo { padding: 14px; display: flex; flex-direction: column; gap: 10px; }
pre { margin: 0; max-height: 50vh; overflow: auto; padding: 11px;
  border-radius: 4px; border: 1px solid var(--pedra-borda); background: var(--pedra);
  font-family: ui-monospace, "Cascadia Mono", Menlo, monospace; font-size: .74rem;
  line-height: 1.45; white-space: pre; }

.vazio { color: var(--tinta-fraca); font-size: .85rem; padding: 10px 0; }

@media (max-width: 820px) {
  .cab { grid-template-columns: 1fr 1fr; }
  .nome { grid-column: 1 / -1; }
}
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>

<div class="folha">
  <div class="barra">
    <h1>Balanço do Emperium</h1>
    <span class="selo" id="selo-db"><span class="ponto"></span><span id="selo-db-txt">conectando…</span></span>
    <span class="selo" id="selo-mud">nenhuma alteração</span>
    <span class="espaco"></span>
    <input class="busca" id="busca" placeholder="Filtrar por nome, classe ou palavra-chave…" aria-label="Filtrar cartas">
    <button id="btn-exportar" class="forte">Ver alterações</button>
    <button id="btn-tudo" class="risco">Restaurar tudo</button>
  </div>

  <p class="dica" style="margin:12px 0 0">
    Cada mudança é salva sozinha, na hora. O que fica guardado é só a
    <b>diferença</b> em relação ao catálogo do código — então quando eu aplicar as
    alterações e regerar esta página, a lista de mudanças volta a ficar vazia.
    <b>Combo x Especial:</b> quando “exige” for <b>nenhum</b>, o efeito dispara sozinho e o
    texto deve começar com <b>ESPECIAL:</b>; com classe ou papel, começa com <b>COMBO</b>.
    O <b>id</b> e a <b>classe</b> não se editam aqui: o id é referenciado pelo código, pelos
    testes e pelos documentos, e a classe decide quais Transcendências a carta pode tomar.
  </p>

  <div id="lista"></div>
</div>

<dialog id="dlg">
  <div class="dlg-cab">
    <h2>Alterações</h2>
    <button id="btn-copiar">Copiar</button>
    <button id="btn-baixar">Baixar .json</button>
    <button id="btn-fechar">Fechar</button>
  </div>
  <div class="dlg-corpo">
    <p class="dica">Cole isto na conversa para eu aplicar no código do jogo. Só aparecem
      os campos que você mudou.</p>
    <pre id="saida"></pre>
  </div>
</dialog>

<script>
const D = ${JSON.stringify(dados)};

/* Todas as cartas num indice unico, com o grupo a que pertencem. */
const CARTAS = [];
for (const c of D.bases) CARTAS.push({ ...c, _grupo: 'base', _classe: c.classe });
for (const t of D.transcendencias) CARTAS.push({ ...t, _grupo: 'transcendencia', _classe: t.classe });
for (const e of D.equipamentos) CARTAS.push({ ...e, _grupo: 'equipamento', _classe: 'Equipamento' });
const PORID = new Map(CARTAS.map((c) => [c.id, c]));

/** O delta: id -> { campo: valorNovo }. Vazio = igual ao codigo. */
let edits = {};
let db = null;
let salvando = 0;

const $ = (s) => document.querySelector(s);

/**
 * Alcanca uma capacidade do visualizador.
 *
 * O objeto claude so existe DENTRO do visualizador do artefato: numa copia
 * salva em arquivo, ou servida de outro lugar, ele nao existe e um
 * claude.use() direto estoura um ReferenceError que derruba o resto do
 * arranque. A pagina tem de funcionar sozinha e acender quando puder.
 */
async function usar(nome) {
  try {
    if (typeof claude === 'undefined' || !claude || typeof claude.use !== 'function') return null;
    return await claude.use(nome);
  } catch {
    return null;
  }
}
const clonar = (v) => JSON.parse(JSON.stringify(v));

/** O valor em vigor: o editado, ou o do codigo. */
function valor(id, campo) {
  const e = edits[id];
  if (e && Object.prototype.hasOwnProperty.call(e, campo)) return e[campo];
  return PORID.get(id)?.[campo];
}

function mudou(id, campo) {
  return Boolean(edits[id] && Object.prototype.hasOwnProperty.call(edits[id], campo));
}

/** Igualdade estrutural simples — basta para numeros, textos e as listas curtas. */
const igual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

async function definir(id, campo, novo) {
  const base = PORID.get(id)?.[campo];
  edits[id] = edits[id] || {};
  if (igual(novo, base)) delete edits[id][campo];
  else edits[id][campo] = novo;
  if (Object.keys(edits[id]).length === 0) delete edits[id];

  atualizarSelos();
  await gravar(id);
}

async function gravar(id) {
  if (!db) return;
  salvando++;
  selar('salvando');
  try {
    const ref = db.doc('cartas/' + id);
    if (edits[id]) await ref.set({ campos: clonar(edits[id]), em: Date.now() });
    else await ref.delete();
    selar('ok');
  } catch (err) {
    selar('erro', err && err.code ? err.code : 'falhou');
  } finally {
    salvando--;
  }
}

function selar(estado, detalhe) {
  const s = $('#selo-db');
  const t = $('#selo-db-txt');
  if (estado === 'sem-db') {
    s.className = 'selo aviso';
    t.textContent = 'sem sincronia — as mudanças ficam só neste navegador';
  } else if (estado === 'salvando') {
    s.className = 'selo';
    t.textContent = 'salvando…';
  } else if (estado === 'erro') {
    s.className = 'selo aviso';
    t.textContent = 'não salvou (' + detalhe + ') — tente de novo';
  } else {
    s.className = 'selo vivo';
    t.textContent = 'salvo';
  }
}

function atualizarSelos() {
  const n = Object.keys(edits).length;
  const s = $('#selo-mud');
  s.textContent = n === 0 ? 'nenhuma alteração' : n === 1 ? '1 carta alterada' : n + ' cartas alteradas';
  s.className = n === 0 ? 'selo' : 'selo vivo';
  for (const el of document.querySelectorAll('.linha')) {
    el.classList.toggle('alterada', Boolean(edits[el.dataset.id]));
  }
}

/* ── Desenho ──────────────────────────────────────────────────────────── */

const esc = (s) => String(s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));

function campoNum(id, campo, rotulo, min, max) {
  const v = valor(id, campo) ?? 0;
  return '<label class="campo ' + (mudou(id, campo) ? 'mudou' : '') + '"><em>' + rotulo + '</em>' +
    '<input type="number" value="' + v + '" min="' + min + '" max="' + max + '" ' +
    'data-id="' + id + '" data-campo="' + campo + '"></label>';
}

function campoSel(id, campo, rotulo, opcoes) {
  const v = valor(id, campo) ?? '';
  const ops = opcoes.map((o) => '<option value="' + o + '"' + (o === v ? ' selected' : '') + '>' + o + '</option>').join('');
  return '<label class="campo ' + (mudou(id, campo) ? 'mudou' : '') + '"><em>' + rotulo + '</em>' +
    '<select data-id="' + id + '" data-campo="' + campo + '">' + ops + '</select></label>';
}

function desenharChips(id) {
  const kws = valor(id, 'keywords') || [];
  const usados = new Set(kws.map((k) => k.kw));
  const livres = D.keywords.filter((k) => !usados.has(k));
  return '<div class="chips">' +
    kws.map((k, i) =>
      '<span class="chip">' + esc(D.rotulos[k.kw] || k.kw) +
      '<input type="number" value="' + (k.x ?? '') + '" placeholder="—" title="X (deixe vazio se não tem número)" ' +
      'data-id="' + id + '" data-kw-x="' + i + '">' +
      '<button data-id="' + id + '" data-kw-rm="' + i + '" aria-label="Remover">×</button></span>',
    ).join('') +
    (livres.length
      ? '<select data-id="' + id + '" data-kw-add="1"><option value="">+ palavra-chave</option>' +
        livres.map((k) => '<option value="' + k + '">' + esc(D.rotulos[k] || k) + '</option>').join('') +
        '</select>'
      : '') +
    '</div>';
}

function desenharCombo(id) {
  const combo = valor(id, 'combo');
  if (!combo) {
    return '<button class="mini" data-id="' + id + '" data-combo-novo="1">+ adicionar combo ou especial</button>';
  }
  const ex = combo.exige || { tipo: 'nenhum' };
  const ef = combo.efeito || { tipo: 'poder', x: 1 };
  const def = D.efeitos.find((e) => e.tipo === ef.tipo) || D.efeitos[0];
  const classes = [...new Set(D.bases.map((b) => b.classe))];

  let campos = '';
  if (ex.tipo === 'classe') {
    campos += '<select data-id="' + id + '" data-combo="exige.valor">' +
      classes.map((c) => '<option' + (c === ex.valor ? ' selected' : '') + '>' + esc(c) + '</option>').join('') + '</select>';
  } else if (ex.tipo === 'papel') {
    campos += '<select data-id="' + id + '" data-combo="exige.valor">' +
      D.papeis.map((p) => '<option' + (p === ex.valor ? ' selected' : '') + '>' + p + '</option>').join('') + '</select>';
  }

  let efCampos = '';
  for (const c of def.campos) {
    if (c === 'papel') {
      efCampos += '<select data-id="' + id + '" data-combo="efeito.papel">' +
        D.papeis.map((p) => '<option' + (p === ef.papel ? ' selected' : '') + '>' + p + '</option>').join('') + '</select>';
    } else if (c === 'marca') {
      efCampos += '<select data-id="' + id + '" data-combo="efeito.marca">' +
        D.marcas.map((m) => '<option' + (m === ef.marca ? ' selected' : '') + '>' + m + '</option>').join('') + '</select>';
    } else {
      efCampos += '<input type="number" style="width:4rem" value="' + (ef[c] ?? 1) + '" ' +
        'data-id="' + id + '" data-combo="efeito.' + c + '" title="' + c + '">';
    }
  }

  return '<div class="linha-form"><span class="dica">exige</span>' +
    '<select data-id="' + id + '" data-combo="exige.tipo">' +
    ['nenhum', 'classe', 'papel'].map((t) => '<option value="' + t + '"' + (t === ex.tipo ? ' selected' : '') + '>' + t + '</option>').join('') +
    '</select>' + campos +
    '<button class="mini risco" data-id="' + id + '" data-combo-rm="1">remover</button></div>' +
    '<div class="linha-form"><span class="dica">efeito</span>' +
    '<select data-id="' + id + '" data-combo="efeito.tipo">' +
    D.efeitos.map((e) => '<option value="' + e.tipo + '"' + (e.tipo === ef.tipo ? ' selected' : '') + '>' + esc(e.rotulo) + '</option>').join('') +
    '</select>' + efCampos + '</div>' +
    '<div class="linha-form"><input class="texto" value="' + esc(combo.texto || '') + '" ' +
    'data-id="' + id + '" data-combo="texto" placeholder="Texto impresso na carta"></div>' +
    (ex.tipo === 'nenhum' && !/^ESPECIAL/.test(combo.texto || '')
      ? '<p class="dica" style="color:var(--sangue)">Não exige companheiro: o texto deveria começar com <b>ESPECIAL:</b></p>'
      : '') +
    (ex.tipo !== 'nenhum' && !/^COMBO/.test(combo.texto || '')
      ? '<p class="dica" style="color:var(--sangue)">Exige companheiro: o texto deveria começar com <b>COMBO</b></p>'
      : '');
}

function desenharLinha(c) {
  const id = c.id;
  const ehEquip = c._grupo === 'equipamento';
  const ehTrans = c._grupo === 'transcendencia';
  const poderCampo = ehTrans ? 'poderBonus' : 'poder';
  const custo = Number(valor(id, 'custo')) || 0;
  const poder = Number(valor(id, poderCampo)) || 0;
  const zp = poder > 0 ? (custo / poder).toFixed(1) : '—';

  return '<div class="linha" data-id="' + id + '" data-papel="' + (c.papel || '') + '">' +
    '<div class="cab">' +
    '<div class="nome">' +
      '<input value="' + esc(valor(id, 'nome') || '') + '" data-id="' + id + '" data-texto="nome" ' +
      'class="' + (mudou(id, 'nome') ? 'mudou' : '') + '" aria-label="Nome da carta" placeholder="Nome">' +
      '<input value="' + esc(valor(id, 'build') || '') + '" data-id="' + id + '" data-texto="build" ' +
      'class="desc ' + (mudou(id, 'build') ? 'mudou' : '') + '" aria-label="Descrição" ' +
      'placeholder="Descrição — o build do Ragnarok que a carta representa">' +
      '<span class="id">' + id + '</span>' +
    '</div>' +
    campoNum(id, 'custo', 'Custo', 0, 30) +
    campoNum(id, poderCampo, ehTrans ? '+Poder' : 'Poder', -10, 30) +
    '<span class="zp" title="zeny por ponto de Poder">' + zp + '</span>' +
    (ehEquip || ehTrans ? '<span></span>' : campoSel(id, 'papel', 'Papel', D.papeis)) +
    (ehTrans ? campoNum(id, 'slotsBonus', '+Slots', 0, 3) : campoNum(id, ehEquip ? 'encaixes' : 'slots', ehEquip ? 'Encaixes' : 'Slots', 0, 4)) +
    '</div>' +
    '<div class="detalhe">' +
    '<div class="bloco"><h3>Palavras-chave</h3>' + desenharChips(id) + '</div>' +
    (ehEquip ? '' : '<div class="bloco"><h3>Combo / Especial</h3>' + desenharCombo(id) + '</div>') +
    '</div>' +
    '</div>';
}

function desenhar() {
  const q = ($('#busca').value || '').trim().toLowerCase();
  const casa = (c) => {
    if (!q) return true;
    const kws = (valor(c.id, 'keywords') || []).map((k) => D.rotulos[k.kw] || k.kw).join(' ');
    const texto = [valor(c.id, 'nome'), c._classe, valor(c.id, 'build'), kws, c.id].join(' ');
    return texto.toLowerCase().includes(q);
  };

  const grupos = new Map();
  for (const c of CARTAS) {
    if (!casa(c)) continue;
    const chave = c._grupo === 'equipamento' ? 'Equipamento' : c._classe;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(c);
  }

  if (grupos.size === 0) {
    $('#lista').innerHTML = '<p class="vazio">Nada com “' + esc(q) + '”.</p>';
    return;
  }

  let html = '';
  for (const [classe, cartas] of grupos) {
    html += '<section><h2>' + esc(classe) + '</h2><div class="tabela">' +
      cartas.map(desenharLinha).join('') + '</div></section>';
  }
  $('#lista').innerHTML = html;
  atualizarSelos();
}

/* ── Eventos: um so ouvinte na lista, para o redesenho nao perder nada ── */

$('#lista').addEventListener('change', async (ev) => {
  const el = ev.target;
  const id = el.dataset.id;
  if (!id) return;

  if (el.dataset.campo) {
    const campo = el.dataset.campo;
    const v = el.type === 'number' ? Number(el.value) : el.value;
    await definir(id, campo, v);
    el.closest('.campo')?.classList.toggle('mudou', mudou(id, campo));
    if (campo === 'custo' || campo === 'poder' || campo === 'poderBonus') desenhar();
    return;
  }

  if (el.dataset.kwAdd !== undefined && el.value) {
    const kws = clonar(valor(id, 'keywords') || []);
    kws.push({ kw: el.value });
    await definir(id, 'keywords', kws);
    desenhar();
    return;
  }

  if (el.dataset.kwX !== undefined) {
    const kws = clonar(valor(id, 'keywords') || []);
    const i = Number(el.dataset.kwX);
    if (el.value === '') delete kws[i].x;
    else kws[i].x = Number(el.value);
    await definir(id, 'keywords', kws);
    return;
  }

  if (el.dataset.combo) {
    const combo = clonar(valor(id, 'combo')) || { exige: { tipo: 'nenhum' }, texto: '', efeito: { tipo: 'poder', x: 1 } };
    const caminho = el.dataset.combo;
    const v = el.type === 'number' ? Number(el.value) : el.value;
    if (caminho === 'texto') combo.texto = v;
    else if (caminho === 'exige.tipo') {
      combo.exige = v === 'nenhum' ? { tipo: 'nenhum' } : { tipo: v, valor: v === 'papel' ? D.papeis[0] : D.bases[0].classe };
    } else if (caminho === 'exige.valor') combo.exige = { ...combo.exige, valor: v };
    else if (caminho === 'efeito.tipo') {
      const def = D.efeitos.find((e) => e.tipo === v);
      const novo = { tipo: v };
      for (const c of def.campos) novo[c] = c === 'papel' ? D.papeis[0] : c === 'marca' ? D.marcas[0] : 1;
      combo.efeito = novo;
    } else {
      const campo = caminho.split('.')[1];
      combo.efeito = { ...combo.efeito, [campo]: v };
    }
    await definir(id, 'combo', combo);
    desenhar();
  }
});

$('#lista').addEventListener('click', async (ev) => {
  const el = ev.target.closest('button');
  if (!el) return;
  const id = el.dataset.id;
  if (!id) return;

  if (el.dataset.kwRm !== undefined) {
    const kws = clonar(valor(id, 'keywords') || []);
    kws.splice(Number(el.dataset.kwRm), 1);
    await definir(id, 'keywords', kws);
    desenhar();
  } else if (el.dataset.comboNovo) {
    await definir(id, 'combo', { exige: { tipo: 'nenhum' }, texto: 'ESPECIAL: ', efeito: { tipo: 'poder', x: 1 } });
    desenhar();
  } else if (el.dataset.comboRm) {
    await definir(id, 'combo', null);
    desenhar();
  }
});

/*
 * Texto salva ENQUANTO se digita, com uma pausa curta para nao gravar letra
 * por letra. E de proposito que isto NAO redesenha a lista: redesenhar tira o
 * cursor do campo no meio da palavra.
 */
const pendentes = new Map();
$('#lista').addEventListener('input', (ev) => {
  const el = ev.target;
  const campo = el.dataset.texto;
  if (!campo) return;
  const id = el.dataset.id;
  clearTimeout(pendentes.get(el));
  pendentes.set(
    el,
    setTimeout(async () => {
      await definir(id, campo, el.value);
      el.classList.toggle('mudou', mudou(id, campo));
    }, 350),
  );
});

/* Sair do campo grava na hora, sem esperar a pausa. */
$('#lista').addEventListener(
  'blur',
  async (ev) => {
    const el = ev.target;
    const campo = el.dataset.texto;
    if (!campo) return;
    clearTimeout(pendentes.get(el));
    pendentes.delete(el);
    await definir(el.dataset.id, campo, el.value);
    el.classList.toggle('mudou', mudou(el.dataset.id, campo));
  },
  true,
);

$('#busca').addEventListener('input', desenhar);

/* ── Exportacao ── */

function montarDiff() {
  const out = {};
  for (const [id, campos] of Object.entries(edits)) {
    const base = PORID.get(id);
    // Rotulo da carta separado do de/para: agora que o NOME e editavel,
    // "nome" seria ao mesmo tempo o titulo e um campo alterado.
    out[id] = { carta: base?.nome, de: {}, para: {} };
    for (const [k, v] of Object.entries(campos)) {
      out[id].de[k] = base?.[k] ?? null;
      out[id].para[k] = v;
    }
  }
  return JSON.stringify({ alteracoes: out }, null, 2);
}

$('#btn-exportar').addEventListener('click', () => {
  $('#saida').textContent = Object.keys(edits).length ? montarDiff() : 'Nada alterado ainda.';
  $('#dlg').showModal();
});
$('#btn-fechar').addEventListener('click', () => $('#dlg').close());
$('#btn-copiar').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('#saida').textContent);
    $('#btn-copiar').textContent = 'Copiado';
    setTimeout(() => ($('#btn-copiar').textContent = 'Copiar'), 1500);
  } catch {
    $('#btn-copiar').textContent = 'Selecione e copie';
  }
});
$('#btn-baixar').addEventListener('click', async () => {
  const downloads = await usar('downloads');
  if (!downloads) { $('#btn-baixar').textContent = 'indisponível aqui'; return; }
  try {
    await downloads.save({ filename: 'emperium-alteracoes.json', data: $('#saida').textContent });
  } catch { /* o visitante recusou: nada a fazer */ }
});

$('#btn-tudo').addEventListener('click', async () => {
  if (!Object.keys(edits).length) return;
  if (!confirm('Descartar TODAS as alterações e voltar ao catálogo do código?')) return;
  const ids = Object.keys(edits);
  edits = {};
  desenhar();
  for (const id of ids) await gravar(id);
});

/* ── Arranque ── */

desenhar();

(async () => {
  db = await usar('db');
  if (!db) { selar('sem-db'); return; }
  try {
    const snap = await db.collection('cartas').get();
    for (const d of snap.docs) {
      const dados = d.data();
      if (dados && dados.campos) edits[d.id] = dados.campos;
    }
    selar('ok');
    desenhar();
  } catch (err) {
    selar('erro', err && err.code ? err.code : 'falhou');
  }
})();
</script>
`;

writeFileSync(new URL('./editor.html', import.meta.url), html);
console.log(
  'editor gerado: ' +
    dados.bases.length + ' bases · ' +
    dados.transcendencias.length + ' transcendencias · ' +
    dados.equipamentos.length + ' equipamentos',
);
