import { useGame } from '../net/store';

/**
 * Fronteira da CASCA: exibe o resultado da partida quando ela termina.
 * Le `gameOver` do store (alimentado pelo evento `game:over`) e a snapshot da
 * sala para resolver nomes. Plugins NAO precisam renderizar nada de vitoria —
 * a casca cuida da regra "0 cartas / endIf -> vencedor".
 */
export function GameOverBanner(): JSX.Element | null {
  const gameOver = useGame((s) => s.gameOver);
  const room = useGame((s) => s.room);
  const session = useGame((s) => s.session);
  if (!gameOver) return null;

  const winnerId = gameOver.winner;
  const winnerName =
    (winnerId && room?.players.find((p) => p.id === winnerId)?.name) || winnerId;
  const youWon = !!winnerId && winnerId === session?.playerId;
  const isHost = room?.hostId === session?.playerId;

  const restartGame = (): void => {
    if (!session?.roomId) return;
    useGame.getState().socket?.emit(
      'room:start',
      { roomId: session.roomId },
      () => {},
    );
  };

  return (
    <div
      style={{
        marginTop: 16,
        padding: 16,
        borderRadius: 8,
        background: youWon ? '#e7f7ec' : '#f4f4f4',
        border: '1px solid #cbd5e1',
        textAlign: 'center',
      }}
    >
      {gameOver.draw ? (
        <h2 style={{ margin: 0 }}>Empate!</h2>
      ) : youWon ? (
        <h2 style={{ margin: 0, color: 'seagreen' }}>🎉 Voce venceu!</h2>
      ) : (
        <h2 style={{ margin: 0 }}>
          Vencedor: <b>{winnerName ?? '—'}</b>
        </h2>
      )}
      {isHost && (
        <button
          type="button"
          className="shell-button"
          onClick={restartGame}
          style={{ marginTop: 12 }}
        >
          Reiniciar jogo
        </button>
      )}
    </div>
  );
}
