/**
 * Paleta de cores de avatar do jogador (fundo do ícone no lobby/sala). Cada
 * jogador escolhe uma para se diferenciar. Cores de tom médio/escuro para
 * contrastar com o texto branco da inicial.
 */
export const AVATAR_COLORS: readonly string[] = [
  '#d4332b', // vermelho
  '#e8590c', // laranja
  '#c08a00', // âmbar
  '#2f9e44', // verde
  '#0ca678', // esmeralda
  '#0d9488', // teal
  '#1971c2', // azul
  '#3b5bdb', // índigo
  '#6741d9', // violeta
  '#9c36b5', // roxo
  '#c2255c', // rosa escuro
  '#e64980', // pink
  '#a52714', // tijolo
  '#8a5a44', // marrom
  '#495057', // chumbo
  '#5c940d', // oliva
  '#087f5b', // musgo
  '#b08900', // mostarda
  '#d6336c', // framboesa
  '#5f3dc4', // púrpura
];

/** Escolhe uma cor de avatar aleatória da paleta. */
export function randomAvatarColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]!;
}

/** Verdadeiro se `c` é uma cor válida da paleta. */
export function isAvatarColor(c: unknown): c is string {
  return typeof c === 'string' && AVATAR_COLORS.includes(c);
}
