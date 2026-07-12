import type { ReactNode } from 'react';
import { selectIsMyTurn, useGame } from '../net/store';

/**
 * Fronteira da CASCA: bloqueia inputs do jogo quando nao e a vez do jogador.
 * Usa `<fieldset disabled>` (HTML nativo) + `pointer-events: none` — isso
 * desabilita botoes, inputs E o inicio de drag dos plugins de jogo, sem que
 * eles precisem cooperar. O servidor tambem recusa moves fora da vez
 * (`NotYourTurnError`); esta camada e UX.
 *
 * Plugins (UnoBoard etc.) renderizam-se normalmente; NAO devem replicar a
 * logica de turno aqui.
 */
export function TurnGate({ children }: { children: ReactNode }): JSX.Element {
  const isMyTurn = useGame(selectIsMyTurn);
  const room = useGame((s) => s.room);
  const currentPlayer = useGame((s) => s.currentPlayer);

  if (isMyTurn === undefined) {
    return <p style={{ color: '#6b5f4e' }}>Aguardando estado...</p>;
  }

  const currentName =
    room?.players.find((p) => p.id === currentPlayer)?.name ?? 'o oponente';

  // IMPORTANTE: os `children` ficam SEMPRE dentro do MESMO <fieldset>, apenas
  // alternando `disabled`. Se trocássemos a estrutura (direto vs. dentro do
  // fieldset) conforme a vez, o React DESMONTARIA/REMONTARIA o tabuleiro a cada
  // mudança de turno — perdendo o estado local dele (ex.: animações do Flip 7).
  return (
    <>
      <div className={`shell-turn-pill ${isMyTurn ? 'mine' : 'theirs'}`}>
        {isMyTurn ? (
          'Sua vez'
        ) : (
          <>
            Aguardando jogada de <b style={{ marginLeft: 4 }}>{currentName}</b>...
          </>
        )}
      </div>
      <fieldset
        disabled={!isMyTurn}
        style={{
          border: 'none',
          padding: 0,
          margin: 0,
          minInlineSize: 'auto', // evita o min-width padrão do fieldset
          opacity: isMyTurn ? 1 : 0.5,
          pointerEvents: isMyTurn ? 'auto' : 'none',
        }}
      >
        {children}
      </fieldset>
    </>
  );
}
