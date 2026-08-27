/**
 * O vocabulário do Emperium, com identidade visual.
 *
 * O jogo tem umas quinze palavras que voltam o tempo todo — Reserva, Ordem,
 * Sala, Emperium, Enfermaria — e em prosa corrida elas somem no meio do texto.
 * Cada uma ganha aqui um ícone e uma cor, sempre os mesmos, em todo lugar em
 * que a palavra aparece. Um jogador novo passa a reconhecer "aquilo do
 * cristal" antes de terminar de ler a frase.
 *
 * Três decisões que valem explicar:
 *
 * 1. **SVG, não emoji.** Emoji chega colorido de fábrica e brigaria com as duas
 *    paletas; além disso ele muda de desenho em cada sistema operacional, então
 *    a "identidade" não seria a mesma para dois jogadores. Estes ícones herdam
 *    `currentColor` e acompanham o tema.
 *
 * 2. **O ícone é decorativo, o texto é o dado.** Todo `<svg>` é `aria-hidden`,
 *    e a palavra continua escrita ao lado. Quem usa leitor de tela ouve
 *    "Reserva", não "imagem". Cor e ícone só REFORÇAM — nunca são o único
 *    portador do significado, que é o que separa isto de acessibilidade de
 *    fachada.
 *
 * 3. **Uma fonte só.** A cor e o ícone de cada termo moram nesta tabela. Se a
 *    Enfermaria mudar de cor, muda em todo o tabuleiro de uma vez.
 */

export type TermoNome =
  | 'zeny'
  | 'gloria'
  | 'reserva'
  | 'enfermaria'
  | 'emperium'
  | 'sala'
  | 'ordem'
  | 'poder'
  | 'marcha'
  | 'baixa'
  | 'combo'
  | 'marca'
  | 'cla'
  | 'altar'
  | 'guardiao'
  | 'rodada';

/** Cor de cada termo, em token do tema. Ver `emperium.css`. */
type CorTermo = 'ouro' | 'cristal' | 'sangue' | 'combo' | 'tinta' | 'tinta-fraca';

interface TermoDef {
  rotulo: string;
  cor: CorTermo;
  /** Frase curta no title, para quem passa o mouse. Nunca o único caminho. */
  dica: string;
  icone: JSX.Element;
}

/* ── Ícones ────────────────────────────────────────────────────────────────
 * Traço de 1.6 sobre uma grade de 16, para ler a 12px sem virar borrão.
 * Todos em currentColor: a cor vem do termo, não do desenho.
 * ────────────────────────────────────────────────────────────────────────── */

const moeda = (
  <>
    <circle cx="8" cy="8" r="6" />
    <circle cx="8" cy="8" r="2.6" />
  </>
);

const coroa = (
  <>
    <path d="M2 12h12M2.6 12 2 4.6l3.4 2.6L8 3l2.6 4.2L14 4.6 13.4 12" />
  </>
);

/** Reserva: a tenda do acampamento, quem ainda não entrou no castelo. */
const tenda = (
  <>
    <path d="M8 2.4 2.4 12.4h11.2L8 2.4Z" />
    <path d="M8 7.8 5.8 12.4h4.4L8 7.8Z" />
    <path d="M1 14.4h14" />
  </>
);

/** Enfermaria: o frasco de poção — quem caiu volta na rodada seguinte. */
const frasco = (
  <>
    <path d="M6.4 2h3.2M7 2v4L3.6 12a1.6 1.6 0 0 0 1.4 2.4h6a1.6 1.6 0 0 0 1.4-2.4L9 6V2" />
    <path d="M5.2 10.4h5.6" />
  </>
);

/** O cristal. É a coisa pela qual se briga, então tem o desenho mais marcante. */
const cristal = (
  <>
    <path d="M8 1.6 13 5.6l-1.8 8.8H4.8L3 5.6 8 1.6Z" />
    <path d="M8 1.6 6 14.4M8 1.6l2 12.8M3 5.6h10" />
  </>
);

/** Sala: a grade do portão. Era um arco, mas o elmo do Guardião também é
 *  arredondado e a 13px os dois viravam a mesma cúpula. */
const grade = (
  <>
    <path d="M2 14V6.4L8 2l6 4.4V14" />
    <path d="M1.2 14h13.6" />
    <path d="M5 7.4V14M8 6V14M11 7.4V14M2.4 10.2h11.2" />
  </>
);

/** Ordem: o estandarte que você finca na sala. */
const estandarte = (
  <>
    <path d="M4.4 14.4V2" />
    <path d="M4.4 2.8h8l-2 2.6 2 2.6h-8" />
  </>
);

const espadas = (
  <>
    <path d="M2.6 2.6 10 10M13.4 2.6 6 10" />
    <path d="M4.6 13.4 6.8 11.2M11.4 13.4 9.2 11.2" />
  </>
);

/** Marcha Forçada: as pegadas de quem foi longe demais. */
const pegadas = (
  <>
    <path d="M4.6 3.4c1.2 0 1.8 1 1.8 2.4S5.8 8.6 4.6 8.6 2.8 7.2 2.8 5.8 3.4 3.4 4.6 3.4Z" />
    <path d="M4.6 10.2h1.8v1.6H4.6z" />
    <path d="M11.4 6.2c1.2 0 1.8 1 1.8 2.4s-.6 2.8-1.8 2.8-1.8-1.4-1.8-2.8.6-2.4 1.8-2.4Z" />
    <path d="M11.4 13h1.8" />
  </>
);

/** Baixa: a lâmina quebrada. */
const laminaQuebrada = (
  <>
    <path d="M5 14.4 7.4 12M4 11.4l2.4 2.4" />
    <path d="M7.4 12 10 9.4l-1.4-1.6" />
    <path d="M11.4 6.6 13.4 1.6 8.4 3.6l-1 3 2 .4Z" />
  </>
);

const raio = (
  <>
    <path d="M9.4 1.6 3.6 9h4l-1 5.4L14.4 7h-4l-1-5.4Z" />
  </>
);

/** Marca: o alvo pintado no clã inimigo. */
const alvo = (
  <>
    <circle cx="8" cy="8" r="5.6" />
    <circle cx="8" cy="8" r="1.8" />
    <path d="M8 .8v2.6M8 12.6v2.6M.8 8h2.6M12.6 8h2.6" />
  </>
);

const brasao = (
  <>
    <path d="M8 1.6 13.4 3.4v5.2c0 3-2.4 5-5.4 5.8-3-.8-5.4-2.8-5.4-5.8V3.4L8 1.6Z" />
    <path d="M8 1.6v12.8" />
  </>
);

/** Altar da Transcendência: a fagulha da evolução. */
const fagulha = (
  <>
    <path d="M8 1.4 9.6 6l4.6 1.6L9.6 9.2 8 13.8 6.4 9.2 1.8 7.6 6.4 6 8 1.4Z" />
  </>
);

const elmo = (
  <>
    <path d="M3.4 13.4V7.4a4.6 4.6 0 0 1 9.2 0v6" />
    <path d="M3.4 9.4h9.2M8 9.4v4M6 6.2h4" />
  </>
);

const ampulheta = (
  <>
    <path d="M4 1.8h8M4 14.2h8" />
    <path d="M4.6 1.8c0 3.4 3.4 4.6 3.4 6.2s-3.4 2.8-3.4 6.2" />
    <path d="M11.4 1.8c0 3.4-3.4 4.6-3.4 6.2s3.4 2.8 3.4 6.2" />
  </>
);

export const TERMOS: Readonly<Record<TermoNome, TermoDef>> = {
  zeny: { rotulo: 'Zeny', cor: 'ouro', dica: 'A moeda. Recruta, equipa, refina e evolui — tudo sai do mesmo bolso.', icone: moeda },
  gloria: { rotulo: 'Glória', cor: 'ouro', dica: 'A pontuação. Quem tem mais no fim da rodada 6 vence.', icone: coroa },
  reserva: { rotulo: 'Reserva', cor: 'tinta', dica: 'Seus personagens de pé, prontos para serem comprometidos.', icone: tenda },
  enfermaria: { rotulo: 'Enfermaria', cor: 'sangue', dica: 'Quem sofreu baixa. Volta à Reserva na rodada seguinte.', icone: frasco },
  emperium: { rotulo: 'Emperium', cor: 'cristal', dica: 'O cristal no coração do castelo. Quem o quebra toma o castelo.', icone: cristal },
  sala: { rotulo: 'Sala', cor: 'tinta-fraca', dica: 'Cada sala tem regra própria e um limite de personagens por clã.', icone: grade },
  ordem: { rotulo: 'Ordem', cor: 'tinta', dica: 'Investida, Cerco, Emboscada, Resguardo — uma por sala, cada uma só uma vez por rodada.', icone: estandarte },
  poder: { rotulo: 'Poder', cor: 'tinta', dica: 'A soma que decide a sala. Maior Poder controla.', icone: espadas },
  marcha: { rotulo: 'Marcha Forçada', cor: 'sangue', dica: 'Ir além da sua linha de frente custa Poder por sala de distância.', icone: pegadas },
  baixa: { rotulo: 'Baixa', cor: 'sangue', dica: 'Personagem derrubado. Vai para a Enfermaria.', icone: laminaQuebrada },
  combo: { rotulo: 'Combo', cor: 'combo', dica: 'A linha que nomeia outro personagem. Só um dispara por clã por sala.', icone: raio },
  marca: { rotulo: 'Marca', cor: 'sangue', dica: 'Exposto, Preso ou Revelado. Cai sobre o clã inimigo de maior Poder da sala.', icone: alvo },
  cla: { rotulo: 'Clã', cor: 'tinta', dica: 'Você e os personagens que recrutou. Ninguém é aliado de ninguém.', icone: brasao },
  altar: { rotulo: 'Altar', cor: 'ouro', dica: 'Onde um personagem seu evolui. Abre na rodada 3.', icone: fagulha },
  guardiao: { rotulo: 'Guardião', cor: 'tinta-fraca', dica: 'Defesa fixa que o dono do castelo posiciona nas salas.', icone: elmo },
  rodada: { rotulo: 'Rodada', cor: 'tinta-fraca', dica: 'A partida tem seis. O escudo do Emperium encolhe a cada uma.', icone: ampulheta },
};

/** O ícone sozinho, decorativo. Use quando a palavra já está escrita ao lado. */
export function IconeTermo({ nome, tam = 13 }: { nome: TermoNome; tam?: number }): JSX.Element {
  return (
    <svg
      className="emp-termo-icone"
      width={tam}
      height={tam}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {TERMOS[nome].icone}
    </svg>
  );
}

/**
 * O termo completo: ícone + palavra, na cor do termo.
 *
 * `texto` troca a palavra impressa sem trocar a identidade — serve para
 * flexionar ("Ordens", "as Salas") mantendo ícone e cor.
 */
export function Termo({
  nome,
  texto,
  semIcone,
}: {
  nome: TermoNome;
  texto?: string;
  semIcone?: boolean;
}): JSX.Element {
  const t = TERMOS[nome];
  return (
    <span className="emp-termo" data-termo={nome} data-cor={t.cor} title={t.dica}>
      {!semIcone && <IconeTermo nome={nome} />}
      {texto ?? t.rotulo}
    </span>
  );
}

/* ── Palavras-chave e marcas ───────────────────────────────────────────────
 *
 * Mesmo tratamento dos termos, com uma diferença deliberada: o ÍCONE é único
 * por palavra, mas a COR é da família. Dezoito cores distintas seriam o mesmo
 * arco-íris que evitamos nas salas do castelo — ninguém guarda dezoito, e cor
 * que ninguém guarda não é informação, é ruído. Cinco famílias, sim: bate o
 * olho num personagem e vê se ele defende, ataca, se posiciona ou manobra.
 * ────────────────────────────────────────────────────────────────────────── */

export type FamiliaChave =
  | 'defesa'
  | 'ataque'
  | 'posicao'
  | 'manobra'
  | 'defeito'
  | 'marca';

export const FAMILIA_ROTULO: Readonly<Record<FamiliaChave, string>> = {
  defesa: 'Defesa — segura a linha e absorve baixa',
  ataque: 'Ataque — coloca Poder na mesa',
  posicao: 'Posição — muda onde e como você chega',
  manobra: 'Manobra — mexe no que o outro trouxe, ou no depois',
  defeito: 'Defeito — ruim para quem carrega, e por isso é isca de ANULAR',
  marca: 'Marca — o que você faz ao clã inimigo',
};

/* ── Ícones das palavras-chave ── */

const escudo = (
  <>
    <path d="M8 1.8 13.2 3.6v4.8c0 2.9-2.2 4.8-5.2 5.8-3-1-5.2-2.9-5.2-5.8V3.6L8 1.8Z" />
  </>
);

const parede = (
  <>
    <path d="M1.8 4.2h12.4M1.8 8h12.4M1.8 11.8h12.4" />
    <path d="M1.8 3.4v9.2M14.2 3.4v9.2" />
    <path d="M5.6 4.2V8M10.4 4.2V8M8 8v3.8" />
  </>
);

/** Devoção: um escudo na frente do outro — ele leva no lugar. */
const doisEscudos = (
  <>
    <path d="M5.4 2.4 9.4 3.8v3.6c0 2.2-1.7 3.6-4 4.4-2.3-.8-4-2.2-4-4.4V3.8l4-1.4Z" />
    <path d="M10.6 4.6l4 1.4v3.6c0 2.2-1.7 3.6-4 4.4-1.3-.5-2.4-1.1-3.1-2" />
  </>
);

/** Alcance: a flecha que vem de longe. */
const flecha = (
  <>
    <path d="M1.6 14.4 13.6 2.4" />
    <path d="M9.6 2.4h4v4" />
    <path d="M1.6 9.2v5.2h5.2" />
  </>
);

/** Perfurar: a ponta que atravessa a placa. */
const lanca = (
  <>
    <path d="M1.6 8h12.8" />
    <path d="M10.6 4.6 14.4 8l-3.8 3.4" />
    <path d="M6 3.2v9.6" />
  </>
);

/** Rajada: o golpe que só vale na chegada. */
const rajadaIcone = (
  <>
    <path d="M2 5h7M2 8h5M2 11h7" />
    <path d="M10.4 3.6 14.4 8l-4 4.4" />
  </>
);

/** Elo: a corrente que liga um ao outro. */
const corrente = (
  <>
    <path d="M6.8 9.2 5.2 10.8a2.3 2.3 0 0 1-3.2-3.2l1.6-1.6" />
    <path d="M9.2 6.8l1.6-1.6a2.3 2.3 0 0 1 3.2 3.2l-1.6 1.6" />
    <path d="M5.8 10.2l4.4-4.4" />
  </>
);

/** Solo: um só, e um círculo de ninguém em volta. */
const sozinhoIcone = (
  <>
    <circle cx="8" cy="8" r="6.2" strokeDasharray="2 2.2" />
    <circle cx="8" cy="6" r="1.8" />
    <path d="M5 12.2c0-1.7 1.3-2.8 3-2.8s3 1.1 3 2.8" />
  </>
);

/** Oculto: o olho fechado, riscado. */
const olhoRiscado = (
  <>
    <path d="M1.6 8s2.6-4.2 6.4-4.2S14.4 8 14.4 8s-2.6 4.2-6.4 4.2S1.6 8 1.6 8Z" />
    <circle cx="8" cy="8" r="1.8" />
    <path d="M2.4 13.6 13.6 2.4" />
  </>
);

/** Revelado: o mesmo olho, agora aberto. */
const olhoAberto = (
  <>
    <path d="M1.6 8s2.6-4.2 6.4-4.2S14.4 8 14.4 8s-2.6 4.2-6.4 4.2S1.6 8 1.6 8Z" />
    <circle cx="8" cy="8" r="1.8" />
  </>
);

/** Anular: a runa cortada. */
const proibido = (
  <>
    <circle cx="8" cy="8" r="6" />
    <path d="M3.8 3.8 12.2 12.2" />
  </>
);

/** Imitar: a carta copiada. */
const copia = (
  <>
    <rect x="1.8" y="1.8" width="8.4" height="10.4" rx="1.2" />
    <path d="M5.8 14.2h7.2a1.2 1.2 0 0 0 1.2-1.2V5.4" />
  </>
);

/** Restaurar: quem caiu volta. */
const voltar = (
  <>
    <path d="M2.6 8a5.4 5.4 0 1 1 1.6 3.8" />
    <path d="M1.4 8h2.4M2.6 5.6V8" />
    <path d="M8 5.2v3.2l2.2 1.4" />
  </>
);

/** Pilhar: o saco que sai da sala. */
const saco = (
  <>
    <path d="M6 1.8h4l-1.2 2.4H7.2L6 1.8Z" />
    <path d="M7.2 4.2c-2.6 1-4.4 3.2-4.4 5.8 0 2.6 2.3 4.2 5.2 4.2s5.2-1.6 5.2-4.2c0-2.6-1.8-4.8-4.4-5.8" />
  </>
);

/** Esgotar: a chama que se apaga. */
const chamaApagada = (
  <>
    <path d="M8 14.2c2.4 0 4-1.6 4-3.8 0-2.8-4-4.4-4-8.6-2.6 2.4-4 4.6-4 8.6 0 2.2 1.6 3.8 4 3.8Z" />
    <path d="M2.4 13.6 13.6 2.4" />
  </>
);

/** Mover: o avanço que não custa marcha. */
const avancar = (
  <>
    <path d="M1.6 8h9.6" />
    <path d="M7.8 4.6 11.2 8l-3.4 3.4" />
    <path d="M13.4 3.6v8.8" />
  </>
);

/** Exposto: a armadura rachada. */
const escudoRachado = (
  <>
    <path d="M8 1.8 13.2 3.6v4.8c0 2.9-2.2 4.8-5.2 5.8-3-1-5.2-2.9-5.2-5.8V3.6L8 1.8Z" />
    <path d="M8.8 3.8 6.6 7.6h3l-2 4.2" />
  </>
);

/** Preso: o grilhão. */
const grilhao = (
  <>
    <circle cx="4.6" cy="11" r="3" />
    <circle cx="11.4" cy="11" r="3" />
    <path d="M4.6 8V5.2a3.4 3.4 0 0 1 6.8 0V8" />
  </>
);

/** Frágil: a rachadura no elo mais fraco. */
const trincado = (
  <>
    <path d="M3.4 2.2h9.2v11.6H3.4z" />
    <path d="M9 2.2 6.6 6.4h2.8L7 13.8" />
  </>
);

/** Berserk: a fúria que não aceita ser coberta. */
const furia = (
  <>
    <path d="M8 1.6 4.4 6.8h3L5.6 14.4l6-8.2H8.4l1.8-4.6H8Z" />
    <path d="M1.8 4.4 3.4 6M14.2 4.4 12.6 6" />
  </>
);

/** Maldição: o crânio da praga — perda pura. */
const praga = (
  <>
    <path d="M8 1.8c3 0 5 2.2 5 5 0 1.8-.8 3-1.8 3.8v2.2H4.8v-2.2C3.8 9.8 3 8.6 3 6.8c0-2.8 2-5 5-5Z" />
    <circle cx="6.2" cy="7" r="1.1" />
    <circle cx="9.8" cy="7" r="1.1" />
    <path d="M6.6 12.8v-2M9.4 12.8v-2" />
  </>
);

interface ChaveDef {
  familia: FamiliaChave;
  icone: JSX.Element;
}

export const KEYWORD_CHAVE: Readonly<Record<string, ChaveDef>> = {
  proteger: { familia: 'defesa', icone: escudo },
  muralha: { familia: 'defesa', icone: parede },
  devocao: { familia: 'defesa', icone: doisEscudos },

  alcance: { familia: 'ataque', icone: flecha },
  perfurar: { familia: 'ataque', icone: lanca },
  rajada: { familia: 'ataque', icone: rajadaIcone },

  elo: { familia: 'posicao', icone: corrente },
  solo: { familia: 'posicao', icone: sozinhoIcone },
  oculto: { familia: 'posicao', icone: olhoRiscado },
  mover: { familia: 'posicao', icone: avancar },

  anular: { familia: 'manobra', icone: proibido },
  imitar: { familia: 'manobra', icone: copia },
  restaurar: { familia: 'manobra', icone: voltar },
  pilhar: { familia: 'manobra', icone: saco },
  esgotar: { familia: 'manobra', icone: chamaApagada },

  // As RUINS: existem para dar risco ao ANULAR e ao IMITAR.
  fragil: { familia: 'defeito', icone: trincado },
  berserk: { familia: 'defeito', icone: furia },
  maldicao: { familia: 'defeito', icone: praga },
};

export const MARCA_CHAVE: Readonly<Record<string, ChaveDef>> = {
  exposto: { familia: 'marca', icone: escudoRachado },
  preso: { familia: 'marca', icone: grilhao },
  revelado: { familia: 'marca', icone: olhoAberto },
};

/** O ícone de uma palavra-chave ou marca. Decorativo, como os dos termos. */
export function IconeChave({
  nome,
  tam = 11,
}: {
  nome: string;
  tam?: number;
}): JSX.Element | null {
  const d = KEYWORD_CHAVE[nome] ?? MARCA_CHAVE[nome];
  if (!d) return null;
  return (
    <svg
      className="emp-chave-icone"
      width={tam}
      height={tam}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {d.icone}
    </svg>
  );
}

/** A família de uma palavra-chave ou marca, para pintar o chip. */
export function familiaDe(nome: string): FamiliaChave | undefined {
  return (KEYWORD_CHAVE[nome] ?? MARCA_CHAVE[nome])?.familia;
}
