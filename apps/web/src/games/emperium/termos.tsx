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
