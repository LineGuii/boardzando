/**
 * Banco de perguntas "Nem a Pato": fatos curiosos com resposta NUMERICA,
 * intencionalmente dificeis de acertar exatamente. Ganha quem chegar mais
 * perto. Todos em pt-BR. Fontes: enciclopedias populares, National Geographic,
 * Guinness, Wikipedia — arredondados para "resposta canonica".
 */

export interface PatoQuestion {
  question: string;
  answer: number;
  unit: string;
  explanation: string;
}

export const PATO_QUESTIONS: readonly PatoQuestion[] = [
  {
    question: 'Quantos corações tem um polvo?',
    answer: 3,
    unit: 'corações',
    explanation:
      'O polvo tem 3 corações: dois bombeiam sangue pelas guelras e um pelo resto do corpo.',
  },
  {
    question: 'A que velocidade (km/h) sai um espirro humano em média?',
    answer: 160,
    unit: 'km/h',
    explanation:
      'Estudos medem espirros humanos por volta de 160 km/h — mais rápido que um carro na estrada.',
  },
  {
    question: 'Quantos anos uma tartaruga-gigante-das-galápagos pode viver?',
    answer: 190,
    unit: 'anos',
    explanation:
      'Tartarugas-de-galápagos costumam passar dos 150 anos; o recorde documentado é de ~190.',
  },
  {
    question: 'Quantos ovos uma pata-doméstica põe por ano em média?',
    answer: 300,
    unit: 'ovos',
    explanation:
      'A raça Khaki Campbell é campeã: pode passar de 300 ovos em um ano de postura.',
  },
  {
    question: 'Quantos ossos tem um bebê humano ao nascer?',
    answer: 270,
    unit: 'ossos',
    explanation:
      'O bebê tem cerca de 270 ossos; muitos se fundem, chegando aos 206 do adulto.',
  },
  {
    question: 'Quantos dentes tem um caracol?',
    answer: 25000,
    unit: 'dentes',
    explanation:
      'A rádula do caracol pode ter mais de 25 mil "dentes" microscópicos usados para raspar comida.',
  },
  {
    question: 'Quantos cheiros diferentes o nariz humano consegue distinguir?',
    answer: 1000000000000,
    unit: 'cheiros',
    explanation:
      'Um estudo da Rockefeller (2014) estimou o teto em ~1 trilhão de odores distinguíveis.',
  },
  {
    question: 'Em quantos segundos a Terra é atingida por um raio, em média?',
    answer: 1,
    unit: 'segundos',
    explanation:
      'A cada segundo caem cerca de 100 raios no planeta — quase um por segundo em qualquer instante.',
  },
  {
    question: 'Quantos litros de saliva uma pessoa produz por ano?',
    answer: 500,
    unit: 'litros',
    explanation:
      'A produção diária média é de ~1,5 L; ao longo de um ano ~500 L — o suficiente pra encher uma banheira.',
  },
  {
    question: 'Quantos km/h a lingua do camaleão atinge para pegar uma presa?',
    answer: 96,
    unit: 'km/h',
    explanation:
      'A língua do camaleão-do-Rosette dispara a ~96 km/h — de 0 a máximo em 20 milissegundos.',
  },
  {
    question: 'Quantos ossos tem um pato-doméstico?',
    answer: 200,
    unit: 'ossos',
    explanation:
      'A anatomia do pato conta com cerca de 200 ossos — muitos são ocos para ajudar no voo.',
  },
  {
    question: 'Quantas palavras o vocabulário passivo de um adulto costuma ter?',
    answer: 40000,
    unit: 'palavras',
    explanation:
      'Adultos costumam reconhecer 30–40 mil palavras de sua língua nativa (o ativo é menor).',
  },
  {
    question: 'Quantos milhões de km/h a Via Láctea se move pelo universo?',
    answer: 2,
    unit: 'milhões de km/h',
    explanation:
      'A galáxia inteira viaja a cerca de 2,1 milhões de km/h em relação à radiação cósmica de fundo.',
  },
  {
    question: 'Quantos anos leva a luz do Sol até chegar aqui... digo, minutos?',
    answer: 8,
    unit: 'minutos',
    explanation:
      'A luz solar leva ~8 minutos e 20 segundos para percorrer os 150 milhões de km até a Terra.',
  },
  {
    question: 'Quantos batimentos cardíacos, em média, um humano tem em toda a vida?',
    answer: 3000000000,
    unit: 'batimentos',
    explanation:
      'Estima-se ~3 bilhões de batimentos em uma vida (~80 anos a ~70 bpm).',
  },
  {
    question: 'Quantos gramas pesa o coração de um beija-flor?',
    answer: 1,
    unit: 'gramas',
    explanation:
      'Cerca de 1 grama — mas bate até 1200 vezes por minuto durante o voo.',
  },
  {
    question: 'Quantos anos uma baleia-da-Groenlândia pode viver?',
    answer: 200,
    unit: 'anos',
    explanation:
      'A baleia-da-Groenlândia é o mamífero mais longevo conhecido: passa dos 200 anos.',
  },
  {
    question: 'Quantos km um trabalhador médio caminha em toda a vida?',
    answer: 120000,
    unit: 'km',
    explanation:
      'Somando ~7500 passos/dia por décadas, chega-se a cerca de 120 mil km — 3 voltas na Terra.',
  },
  {
    question: 'Quantos km/h atinge um pato em voo migratório?',
    answer: 80,
    unit: 'km/h',
    explanation:
      'Muitas espécies migratórias de patos cruzam os céus a 80 km/h em voo sustentado.',
  },
  {
    question: 'Quantos anos tem a árvore viva mais velha do mundo?',
    answer: 5000,
    unit: 'anos',
    explanation:
      'O pinheiro Methuselah, nos EUA, tem aproximadamente 4850 anos — brotou antes das pirâmides.',
  },
  {
    question: 'Quantos km de vasos sanguíneos existem em um corpo humano adulto?',
    answer: 100000,
    unit: 'km',
    explanation:
      'Cerca de 100 mil km — daria pra dar duas voltas e meia na Terra.',
  },
  {
    question: 'Quantos km/h vira o núcleo interno da Terra no seu eixo?',
    answer: 1,
    unit: 'km/h',
    explanation:
      'O núcleo interno gira um pouquinho mais rápido que a crosta — ~1 km/h de diferença angular.',
  },
  {
    question: 'Em quantos milissegundos o cérebro humano detecta um susto?',
    answer: 100,
    unit: 'ms',
    explanation:
      'A resposta de sobressalto começa em ~100 ms — antes de você perceber conscientemente o barulho.',
  },
  {
    question: 'Quantos km um pato-selvagem migratório pode voar em um único trecho?',
    answer: 800,
    unit: 'km',
    explanation:
      'Muitos anatídeos fazem trechos de 800 km sem parar durante a migração.',
  },
  {
    question: 'Quantos km/h atinge o guepardo em corrida?',
    answer: 112,
    unit: 'km/h',
    explanation:
      'O guepardo é o animal terrestre mais rápido: 112 km/h em arrancadas curtas.',
  },
  {
    question: 'Quantos ovos põe uma tartaruga marinha em uma única desova?',
    answer: 110,
    unit: 'ovos',
    explanation:
      'Uma tartaruga-cabeçuda costuma botar cerca de 110 ovos por desova.',
  },
  {
    question: 'Quantos anos tem o buraco negro supermassivo M87 (descoberto pela EHT)?',
    answer: 13000000000,
    unit: 'anos',
    explanation:
      'Estima-se ~13 bilhões de anos — quase a idade do próprio universo.',
  },
  {
    question: 'Quantas espécies de patos existem hoje no mundo?',
    answer: 120,
    unit: 'espécies',
    explanation:
      'A família Anatidae inclui cerca de 120 espécies de patos, gansos e cisnes.',
  },
  {
    question: 'Quantos km de intestino tem um humano adulto?',
    answer: 8,
    unit: 'metros',
    explanation:
      'Cerca de 8 metros somando delgado e grosso — enrolado dentro do abdômen.',
  },
  {
    question: 'Quantos minutos, em média, um bocejo é contagioso após você ver alguém bocejar?',
    answer: 5,
    unit: 'minutos',
    explanation:
      'Estudos sugerem uma janela de contágio social de até 5 minutos após ver o bocejo.',
  },
  {
    question: 'Quantos gramas pesa a nuvem cumulus típica?',
    answer: 500000,
    unit: 'kg',
    explanation:
      'Uma nuvem cumulus média pesa ~500 toneladas — mas está "flutuando" em ar ainda mais denso.',
  },
  {
    question: 'Quantos anos leva o Sol para completar uma volta na Via Láctea?',
    answer: 230000000,
    unit: 'anos',
    explanation:
      'O Sistema Solar orbita o centro galáctico uma vez a cada ~230 milhões de anos.',
  },
  {
    question: 'Quantos metros um pato-doméstico consegue voar (altura máxima registrada)?',
    answer: 6000,
    unit: 'metros',
    explanation:
      'Um pato-marreco chegou a 6400 m — quase a altitude do Monte Everest.',
  },
  {
    question: 'Quantos km/h atinge uma bola de tênis no saque profissional?',
    answer: 260,
    unit: 'km/h',
    explanation:
      'Sam Groth cravou o recorde: 263 km/h — mais rápido que a maioria dos carros de rua.',
  },
  {
    question: 'Quantos dias uma abelha operária costuma viver na primavera?',
    answer: 40,
    unit: 'dias',
    explanation:
      'Cerca de 40 dias no auge da estação; no inverno pode viver meses ao economizar energia.',
  },
  {
    question: 'Quantos km2 tem o maior deserto do mundo (Antártida)?',
    answer: 14000000,
    unit: 'km²',
    explanation:
      'Isso mesmo: o maior deserto é a Antártida, com ~14 milhões de km² (deserto polar).',
  },
  {
    question: 'Quantos anos os patos podem viver em cativeiro?',
    answer: 12,
    unit: 'anos',
    explanation:
      'Bem cuidados, patos-domésticos vivem de 10 a 15 anos — média ~12.',
  },
  {
    question: 'Quantos milhões de espermatozoides um homem produz por mililitro?',
    answer: 100,
    unit: 'milhões/mL',
    explanation:
      'A concentração normal fica em torno de 100 milhões por mL de sêmen.',
  },
  {
    question: 'Quantos km/h um pica-pau bate a cabeça contra a árvore?',
    answer: 25,
    unit: 'km/h',
    explanation:
      'Ele desacelera de ~25 km/h a zero em milissegundos — 1200 g de força na cabeça.',
  },
  {
    question: 'Quantos km/h uma tartaruga terrestre "corre" no seu melhor?',
    answer: 1,
    unit: 'km/h',
    explanation:
      'Menos de 1 km/h em ritmo confortável — as marinhas, na água, chegam a 30 km/h.',
  },
];
