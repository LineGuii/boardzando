import { useGame } from '../../net/store';

interface UnoView {
  myHand: Array<{ id: string; color: string; kind: string; value?: number }>;
  opponents: Record<string, number>;
  topCard?: { color: string; kind: string; value?: number };
  activeColor: string;
}

/** Tabuleiro de UNO especifico do jogo (UI plugavel por jogo). */
export function UnoBoard() {
  const { view, session, socket } = useGame();
  const v = view as UnoView | undefined;
  if (!v || !session) return <p>Aguardando estado...</p>;

  const play = (cardId: string, chosenColor?: string) =>
    socket?.emit('game:move', { roomId: session.roomId, type: 'playCard', data: { cardId, chosenColor } }, () => {});
  const draw = () =>
    socket?.emit('game:move', { roomId: session.roomId, type: 'drawCard', data: {} }, () => {});

  return (
    <section>
      <p>
        Topo: <b>{label(v.topCard)}</b> · cor ativa: <b>{v.activeColor}</b>
      </p>
      <p>Oponentes: {Object.entries(v.opponents).map(([id, n]) => `${id.slice(0, 4)}:${n}`).join('  ')}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {v.myHand.map((c) => (
          <button
            key={c.id}
            onClick={() => play(c.id, c.color === 'wild' ? prompt('Cor? red/yellow/green/blue') ?? 'red' : undefined)}
          >
            {label(c)}
          </button>
        ))}
      </div>
      <button onClick={draw} style={{ marginTop: 12 }}>
        Comprar
      </button>
    </section>
  );
}

function label(c?: { color: string; kind: string; value?: number }): string {
  if (!c) return '-';
  if (c.kind === 'number') return `${c.color} ${c.value}`;
  return `${c.color} ${c.kind}`;
}
