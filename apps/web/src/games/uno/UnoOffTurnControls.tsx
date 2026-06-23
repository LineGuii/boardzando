import { useEffect, useState } from 'react';
import { useGame } from '../../net/store';

interface UnoView {
  myHand: { id: string }[];
  opponents: Record<string, number>;
  unoCalled: Record<string, boolean>;
}

/**
 * Controles do UNO que rodam FORA do TurnGate (a qualquer momento):
 *   - botao "UNO!" quando voce tem 1 carta e ainda nao cantou;
 *   - botao "Contestar UNO de {nome}" que aparece 1s depois para cada
 *     oponente que tem 1 carta e nao cantou.
 *
 * Os moves `callUno` e `contestUno` estao em `offTurnMoves` do UnoGame, entao
 * o servidor os aceita off-turn. O timer de 1s e puramente UX: server nao
 * mede tempo — quem clicar primeiro vence.
 */
export function UnoOffTurnControls(): JSX.Element | null {
  const view = useGame((s) => s.view) as UnoView | undefined;
  const session = useGame((s) => s.session);
  const room = useGame((s) => s.room);
  const socket = useGame((s) => s.socket);

  // chave -> momento em que vimos o oponente com 1 carta nao-cantado.
  const [seenAt, setSeenAt] = useState<Record<string, number>>({});
  // chave -> tornou-se contestavel (passou de 1s)
  const [contestable, setContestable] = useState<Record<string, boolean>>({});

  // identifica os "alvos de contest" atuais: oponentes com 1 carta sem cantar.
  const targets: string[] = [];
  if (view && session) {
    for (const [pid, count] of Object.entries(view.opponents)) {
      if (count === 1 && view.unoCalled[pid] === false) targets.push(pid);
    }
  }
  const targetsKey = targets.sort().join('|');

  useEffect(() => {
    if (!view) return;
    const now = Date.now();
    setSeenAt((prev) => {
      const next = { ...prev };
      // limpa quem nao e mais alvo (cantou ou comprou)
      for (const k of Object.keys(next)) if (!targets.includes(k)) delete next[k];
      // adiciona novos alvos com timestamp
      for (const t of targets) if (next[t] === undefined) next[t] = now;
      return next;
    });
    // o `contestable` recalcula via outro effect com setTimeout
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetsKey]);

  useEffect(() => {
    // agenda 1 timer por alvo ainda nao contestavel
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const [pid, t0] of Object.entries(seenAt)) {
      if (contestable[pid]) continue;
      const remaining = Math.max(0, 1000 - (Date.now() - t0));
      timers.push(
        setTimeout(() => setContestable((prev) => ({ ...prev, [pid]: true })), remaining),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [seenAt, contestable]);

  // limpa contestable para alvos que sairam do conjunto
  useEffect(() => {
    setContestable((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) if (!targets.includes(k)) delete next[k];
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetsKey]);

  if (!view || !session) return null;

  const myHandSize = view.myHand.length;
  const meCalled = view.unoCalled[session.playerId];
  const showCallButton = myHandSize === 1 && meCalled === false;

  const showableContests = targets.filter((pid) => contestable[pid]);
  if (!showCallButton && showableContests.length === 0) return null;

  return (
    <section
      style={{
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
        alignItems: 'center',
        margin: '8px 0',
        padding: 8,
        background: '#fff7ed',
        border: '1px dashed #f59e0b',
        borderRadius: 6,
      }}
    >
      {showCallButton && (
        <button
          style={{ background: '#f59e0b', color: 'white', fontWeight: 'bold', padding: '6px 14px' }}
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
      )}
      {showableContests.map((pid) => {
        const name = room?.players.find((p) => p.id === pid)?.name ?? pid.slice(0, 4);
        return (
          <button
            key={pid}
            style={{ background: '#dc2626', color: 'white', padding: '6px 14px' }}
            onClick={() =>
              socket?.emit(
                'game:move',
                { roomId: session.roomId, type: 'contestUno', data: { target: pid } },
                () => {},
              )
            }
          >
            Contestar UNO de {name}
          </button>
        );
      })}
    </section>
  );
}
