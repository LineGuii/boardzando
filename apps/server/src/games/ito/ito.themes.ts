import type { ItoTheme } from './ito.state';

/**
 * Temas (cartas de topico) do Ito. A escala vai de 1 (`low`) a 100 (`high`).
 * Conjunto em pt-BR; ajuste/expanda a vontade.
 */
export const ITO_THEMES: readonly ItoTheme[] = [
  { topic: 'Força dos animais', low: 'mais fraco', high: 'mais forte' },
  { topic: 'Tamanho das coisas', low: 'minúsculo', high: 'gigante' },
  { topic: 'Popularidade de comidas', low: 'impopular', high: 'super popular' },
  { topic: 'Velocidade', low: 'lentíssimo', high: 'rapidíssimo' },
  { topic: 'Preço de itens do dia a dia', low: 'baratíssimo', high: 'caríssimo' },
  { topic: 'Quão assustador é', low: 'nada', high: 'aterrorizante' },
  { topic: 'Temperatura das coisas', low: 'congelante', high: 'fervendo' },
  { topic: 'Utilidade de um app', low: 'inútil', high: 'essencial' },
  { topic: 'Vontade de comer agora', low: 'sem vontade', high: 'desejo total' },
  { topic: 'Dificuldade de acordar cedo', low: 'fácil', high: 'impossível' },
  { topic: 'Fofura dos animais', low: 'nada fofo', high: 'fofíssimo' },
  { topic: 'Quão perigosa é a profissão', low: 'seguríssima', high: 'perigosíssima' },
  { topic: 'Distância de lugares (de você)', low: 'pertinho', high: 'longíssimo' },
  { topic: 'Quão saudável é o alimento', low: 'nada saudável', high: 'super saudável' },
  { topic: 'Brilho / luminosidade', low: 'escuro', high: 'ofuscante' },
  { topic: 'Quão famoso é', low: 'desconhecido', high: 'mundialmente famoso' },
  // --- Expansão de temas ---
  { topic: 'Quão barulhento é', low: 'silêncio total', high: 'ensurdecedor' },
  { topic: 'Utilidade numa ilha deserta', low: 'inútil', high: 'salva vidas' },
  { topic: 'Dificuldade de aprender', low: 'trivial', high: 'impossível' },
  { topic: 'Cheiro', low: 'péssimo', high: 'maravilhoso' },
  { topic: 'Quão viciante', low: 'nada', high: 'irresistível' },
  { topic: 'Peso das coisas', low: 'levíssimo', high: 'pesadíssimo' },
  { topic: 'Quão romântico', low: 'nada romântico', high: 'ultra romântico' },
  { topic: 'Superpoder', low: 'inútil', high: 'incrível' },
  { topic: 'Quão brasileiro é', low: 'nada nosso', high: 'muito brasileiro' },
  { topic: 'Frequência de uso diário', low: 'quase nunca', high: 'o tempo todo' },
  { topic: 'Chance de dar errado', low: 'sem chance', high: 'certeza absoluta' },
  { topic: 'Nostalgia dos anos 2000', low: 'nada nostálgico', high: 'lágrima na cara' },
  { topic: 'Quão nojento é', low: 'delícia', high: 'insuportável' },
  { topic: 'Quantidade de açúcar', low: 'zero doce', high: 'diabético' },
  { topic: 'Dificuldade de pronunciar', low: 'facílimo', high: 'trava-língua' },
  { topic: 'Quão constrangedor', low: 'tranquilo', high: 'quero morrer' },
  { topic: 'Quão inteligente é', low: 'burríssimo', high: 'gênio' },
  { topic: 'Grau de emergência', low: 'pode esperar', high: 'agora mesmo!' },
  { topic: 'Quão útil na escola', low: 'inútil', high: 'indispensável' },
  { topic: 'Habilidade de sobreviver ao inverno', low: 'não sobrevive', high: 'nasceu pro frio' },
  { topic: 'Chance de virar meme', low: 'zero', high: 'já é viral' },
  { topic: 'Nível de fofoca sobre isso', low: 'ninguém fala', high: 'todo mundo comenta' },
  { topic: 'Espaço que ocupa em casa', low: 'cabe no bolso', high: 'toma um quarto' },
  { topic: 'Idade em que se aprende', low: 'ainda bebê', high: 'adulto tardio' },
];
