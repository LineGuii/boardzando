import { useState, type JSX } from 'react';

/**
 * Renderiza a capa da musica, mas some silenciosamente se o arquivo nao existir
 * (404 / erro de carregamento). Assim o layout nao mostra icone de imagem
 * quebrada — tratamos "sem capa" e "com capa que falhou" da mesma forma.
 */
export function QuizCover(props: { url: string; className?: string }): JSX.Element | null {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      className={props.className ?? 'q-cover'}
      src={props.url}
      alt=""
      onError={() => setFailed(true)}
    />
  );
}
