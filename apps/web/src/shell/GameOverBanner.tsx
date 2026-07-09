import { useState } from 'react';
import { useGame } from '../net/store';
import { GameOptionsPanel, gameHasOptions } from './GameOptionsPanel';

/**
 * Fronteira da CASCA: exibe o resultado da partida quando ela termina.
 * Le `gameOver` do store (alimentado pelo evento `game:over`) e a snapshot da
 * sala para resolver nomes. Plugins NAO precisam renderizar nada de vitoria —
 * a casca cuida da regra "0 cartas / endIf -> vencedor".
 *
 * O host pode reiniciar reusando as mesmas opcoes, OU abrir o painel de setup
 * para trocar as configuracoes e reiniciar com elas.
 */
export function GameOverBanner(): JSX.Element | null {
  const gameOver = useGame((s) => s.gameOver);
  const room = useGame((s) => s.room);
  const session = useGame((s) => s.session);

  const [showSetup, setShowSetup] = useState(false);
  // opcoes em edicao ao "trocar setup" (inicia das ultimas usadas na sala).
  const [opts, setOpts] = useState<unknown>(undefined);

  if (!gameOver) return null;

  const winnerId = gameOver.winner;
  const winnerName =
    (winnerId && room?.players.find((p) => p.id === winnerId)?.name) || winnerId;
  const youWon = !!winnerId && winnerId === session?.playerId;
  const isHost = room?.hostId === session?.playerId;
  const gameId = room?.gameId ?? '';
  const canChangeSetup = isHost && gameHasOptions(gameId);

  const start = (gameOptions?: unknown): void => {
    if (!session?.roomId) return;
    useGame.getState().socket?.emit(
      'room:start',
      gameOptions === undefined
        ? { roomId: session.roomId }
        : { roomId: session.roomId, gameOptions },
      () => {},
    );
  };
  const openSetup = (): void => {
    setOpts(room?.lastGameOptions); // pre-preenche com as ultimas opcoes
    setShowSetup(true);
  };

  // Jogos cooperativos: a equipe inteira vence ou perde junta.
  const coop = gameOver.coop;
  const coopWin = coop?.outcome === 'win';

  return (
    <div
      style={{
        marginTop: 16,
        padding: 16,
        borderRadius: 8,
        background: coop
          ? coopWin
            ? '#e7f7ec'
            : '#fdeaea'
          : youWon
            ? '#e7f7ec'
            : '#f4f4f4',
        border: '1px solid #cbd5e1',
        textAlign: 'center',
      }}
    >
      {coop ? (
        <>
          <h2 style={{ margin: 0, color: coopWin ? 'seagreen' : '#b41818' }}>
            {coopWin ? '🎉 Vitória da equipe!' : '💀 Derrota da equipe'}
          </h2>
          {coop.detail && (
            <p style={{ margin: '6px 0 0', color: '#555' }}>{coop.detail}</p>
          )}
        </>
      ) : gameOver.draw ? (
        <h2 style={{ margin: 0 }}>Empate!</h2>
      ) : youWon ? (
        <h2 style={{ margin: 0, color: 'seagreen' }}>🎉 Voce venceu!</h2>
      ) : (
        <h2 style={{ margin: 0 }}>
          Vencedor: <b>{winnerName ?? '—'}</b>
        </h2>
      )}

      {isHost && !showSetup && (
        <div
          style={{
            marginTop: 12,
            display: 'flex',
            gap: 10,
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <button type="button" className="shell-button" onClick={() => start()}>
            🔄 Reiniciar jogo
          </button>
          {canChangeSetup && (
            <button
              type="button"
              className="shell-button"
              style={{ background: '#8a5a2b' }}
              onClick={openSetup}
            >
              ⚙️ Trocar configurações
            </button>
          )}
        </div>
      )}

      {isHost && showSetup && (
        <div style={{ marginTop: 12, textAlign: 'left' }}>
          <GameOptionsPanel gameId={gameId} value={opts} onChange={setOpts} />
          <div
            style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 12 }}
          >
            <button
              type="button"
              className="shell-button"
              onClick={() => {
                start(opts);
                setShowSetup(false);
              }}
            >
              ▶ Reiniciar com estas opções
            </button>
            <button
              type="button"
              className="shell-button"
              style={{ background: '#9aa39a' }}
              onClick={() => setShowSetup(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
