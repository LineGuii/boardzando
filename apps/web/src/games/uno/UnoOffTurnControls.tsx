import { useEffect, useState } from 'react';
import { useGame } from '../../net/store';

interface UnoView {
  myHand: { id: string }[];
  opponents: Record<string, number>;
  unoCalled: Record<string, boolean>;
}

/**
 * Botao "UNO!" do proprio jogador, encaixado na mesa (perto da mao).
 * So aparece quando voce tem 1 carta e ainda nao cantou. Levemente opaco
 * em repouso para nao roubar a atencao; ganha opacidade total no hover.
 */
export function UnoCallButton(): JSX.Element | null {
  const view = useGame((s) => s.view) as UnoView | undefined;
  const session = useGame((s) => s.session);
  const socket = useGame((s) => s.socket);

  if (!view || !session) return null;
  const meCalled = view.unoCalled[session.playerId];
  if (view.myHand.length !== 1 || meCalled !== false) return null;

  return (
    <button
      type="button"
      className="uno-call-button"
      onClick={() =>
        socket?.emit(
          'game:move',
          { roomId: session.roomId, type: 'callUno', data: {} },
          () => {},
        )
      }
    >
      UNO!
    </button>
  );
}

/**
 * Botao "Contestar UNO" preso ao card do oponente em questao. Aparece 1s
 * apos detectarmos que o oponente esta com 1 carta sem ter cantado.
 */
export function UnoContestButton({ opponentId }: { opponentId: string }): JSX.Element | null {
  const view = useGame((s) => s.view) as UnoView | undefined;
  const session = useGame((s) => s.session);
  const room = useGame((s) => s.room);
  const socket = useGame((s) => s.socket);

  const count = view?.opponents[opponentId] ?? 0;
  const called = view?.unoCalled[opponentId];
  const eligible = count === 1 && called === false;

  const [contestable, setContestable] = useState(false);
  useEffect(() => {
    if (!eligible) {
      setContestable(false);
      return;
    }
    const t = setTimeout(() => setContestable(true), 1000);
    return () => clearTimeout(t);
  }, [eligible]);

  if (!view || !session || !eligible || !contestable) return null;
  const name = room?.players.find((p) => p.id === opponentId)?.name ?? '???';

  return (
    <button
      type="button"
      className="uno-contest-button"
      onClick={() =>
        socket?.emit(
          'game:move',
          { roomId: session.roomId, type: 'contestUno', data: { target: opponentId } },
          () => {},
        )
      }
      title={`Contestar UNO de ${name}`}
    >
      Contestar UNO!
    </button>
  );
}
