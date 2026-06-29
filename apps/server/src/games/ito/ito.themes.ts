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
];
