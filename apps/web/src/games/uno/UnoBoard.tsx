import { useState, type DragEvent } from 'react';
import { useGame } from '../../net/store';
import { UnoCard, UnoCardBack, type CardData, type UnoColor } from './UnoCard';
import './uno.css';

interface UnoView {
  myHand: CardData[];
  opponents: Record<string, number>;
  topCard?: CardData;
  activeColor: string;
  pendingDraw: number;
  unoCalled: Record<string, boolean>;
}

const CONCRETE_COLORS: UnoColor[] = ['red', 'yellow', 'green', 'blue'];
const SWATCH: Record<string, string> = {
  red: '#d4332b',
  yellow: '#f5cb1a',
  green: '#2d932d',
  blue: '#205db2',
  wild: '#333',
};

/**
 * Tabuleiro do UNO com visual de mesa: oponentes no topo (cartas viradas),
 * baralho e descarte no centro (descarte e drop-zone), mao em leque embaixo.
 * Cartas sao arrastaveis para o descarte; clicar tambem joga (fallback).
 * Curinga abre um seletor de cor antes de enviar o move.
 */
export function UnoBoard(): JSX.Element {
  const view = useGame((s) => s.view) as UnoView | undefined;
  const session = useGame((s) => s.session);
  const room = useGame((s) => s.room);
  const socket = useGame((s) => s.socket);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);
  /** id da carta curinga aguardando escolha de cor. */
  const [wildPickFor, setWildPickFor] = useState<string | null>(null);

  if (!view || !session) return <p>Aguardando estado...</p>;

  const play = (cardId: string, chosenColor?: UnoColor): void =>
    void socket?.emit(
      'game:move',
      { roomId: session.roomId, type: 'playCard', data: { cardId, chosenColor } },
      () => {},
    );

  const draw = (): void =>
    void socket?.emit(
      'game:move',
      { roomId: session.roomId, type: 'drawCard', data: {} },
      () => {},
    );

  /** Clicar tenta jogar. Curinga -> abre seletor de cor antes. */
  const onCardClick = (c: CardData): void => {
    if (c.color === 'wild') setWildPickFor(c.id);
    else play(c.id);
  };

  const onCardDragStart =
    (c: CardData) =>
    (e: DragEvent<HTMLDivElement>): void => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', c.id);
      setDraggingId(c.id);
    };

  const onCardDragEnd = (): void => setDraggingId(null);

  const onDiscardDragOver = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropping(true);
  };

  const onDiscardDragLeave = (): void => setDropping(false);

  const onDiscardDrop = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setDropping(false);
    const cardId = e.dataTransfer.getData('text/plain');
    if (!cardId) return;
    const c = view.myHand.find((x) => x.id === cardId);
    if (!c) return;
    if (c.color === 'wild') setWildPickFor(c.id);
    else play(c.id);
  };

  const onPickColor = (color: UnoColor): void => {
    if (wildPickFor) play(wildPickFor, color);
    setWildPickFor(null);
  };

  // oponentes na ordem em que estao em room.players (excluindo voce)
  const opponents = (room?.players ?? []).filter((p) => p.id !== session.playerId);

  return (
    <div className="uno-table">
      {/* ---- Oponentes ---- */}
      <div className="uno-opponents">
        {opponents.map((p) => {
          const count = view.opponents[p.id] ?? 0;
          const mustCallUno = count === 1 && view.unoCalled[p.id] === false;
          return (
            <div key={p.id} className="uno-opponent">
              <div className="uno-opponent-name">
                <span>{p.name}</span>
                <span style={{ opacity: 0.8 }}>· {count}</span>
                {mustCallUno && <span className="uno-opponent-warn">UNO?</span>}
              </div>
              <div className="uno-opponent-mini-hand">
                {Array.from({ length: Math.min(count, 7) }).map((_, i) => (
                  <UnoCardBack key={i} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ---- Centro: deck + descarte ---- */}
      <div className="uno-center">
        <div className="uno-deck">
          <button
            type="button"
            className="uno-deck-button"
            onClick={draw}
            title={view.pendingDraw > 0 ? `Comprar ${view.pendingDraw}` : 'Comprar'}
          >
            <UnoCardBack />
          </button>
          <div className="uno-deck-label">
            {view.pendingDraw > 0 ? `Comprar ${view.pendingDraw}` : 'Baralho'}
          </div>
        </div>

        <div
          className={`uno-discard ${dropping ? 'drop-target' : ''} ${!view.topCard ? 'empty' : ''}`}
          onDragOver={onDiscardDragOver}
          onDragLeave={onDiscardDragLeave}
          onDrop={onDiscardDrop}
        >
          {view.topCard ? (
            <DiscardStack top={view.topCard} />
          ) : (
            <span>Arraste uma carta aqui</span>
          )}
          {view.topCard && (
            <div className="uno-active-color">
              <span className="uno-active-color-swatch" style={{ background: SWATCH[view.activeColor] }} />
              {view.activeColor}
            </div>
          )}
        </div>
      </div>

      {view.pendingDraw > 0 && (
        <div className="uno-pending-banner">
          Stack de compra: <b>+{view.pendingDraw}</b> — empilhe um <b>+2</b> ou compre para encerrar.
        </div>
      )}

      {/* ---- Mao do jogador ---- */}
      <div className="uno-hand">
        {view.myHand.map((c) => (
          <UnoCard
            key={c.id}
            card={c}
            draggable
            dragging={draggingId === c.id}
            onClick={() => onCardClick(c)}
            onDragStart={onCardDragStart(c)}
            onDragEnd={onCardDragEnd}
          />
        ))}
      </div>

      <button className="uno-draw-button" onClick={draw}>
        {view.pendingDraw > 0 ? `Comprar ${view.pendingDraw} cartas` : 'Comprar carta'}
      </button>

      {/* ---- Modal seletor de cor (curinga) ---- */}
      {wildPickFor && (
        <div className="color-picker-overlay" onClick={() => setWildPickFor(null)}>
          <div className="color-picker" onClick={(e) => e.stopPropagation()}>
            <h3>Escolha a cor</h3>
            <div className="color-buttons">
              {CONCRETE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`color-button ${c}`}
                  onClick={() => onPickColor(c)}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Pilha visual: 2 cartas sobrepostas com rotacoes sutis sugerindo "empilhadas". */
function DiscardStack({ top }: { top: CardData }): JSX.Element {
  return (
    <div className="uno-discard-stack">
      <UnoCard
        card={top}
        style={{
          transform: 'translateX(-4px) translateY(-6px) rotate(-3deg)',
          zIndex: 2,
        }}
      />
      <UnoCard
        card={top}
        style={{
          transform: 'translateX(4px) translateY(6px) rotate(3deg)',
          opacity: 0.6,
          zIndex: 1,
        }}
      />
    </div>
  );
}
