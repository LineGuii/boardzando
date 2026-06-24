import { useRef, useState, type DragEvent } from 'react';
import { createPortal } from 'react-dom';
import { useGame } from '../../net/store';
import { UnoCard, UnoCardBack, type CardData, type UnoColor } from './UnoCard';
import { UnoCallButton, UnoContestButton } from './UnoOffTurnControls';
import './uno.css';

interface UnoView {
  myHand: CardData[];
  opponents: Record<string, number>;
  topCard?: CardData;
  activeColor: string;
  pendingDraw: number;
  unoCalled: Record<string, boolean>;
  mustDecideAfterDraw?: { playerId: string; cardIndex: number };
}

const CONCRETE_COLORS: UnoColor[] = ['red', 'yellow', 'green', 'blue'];
const SWATCH: Record<string, string> = {
  red: '#d4332b',
  yellow: '#f5cb1a',
  green: '#2d932d',
  blue: '#205db2',
  wild: '#333',
};

interface FlyingCard {
  card: CardData;
  fromRect: DOMRect;
  toRect: DOMRect;
  /** Define `transform` ja aplicada para animar de from -> to. */
  phase: 'start' | 'end';
}

/**
 * Tabuleiro do UNO com visual de mesa: oponentes no topo (cartas viradas),
 * baralho e descarte no centro (descarte e drop-zone), mao em leque embaixo.
 * Cartas sao arrastaveis para o descarte; clicar tambem joga (fallback).
 * Curinga abre um seletor de cor antes de enviar o move. Apos comprar (fora
 * de stack +2), o jogador escolhe jogar a carta comprada ou apertar pular.
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
  const [flying, setFlying] = useState<FlyingCard | null>(null);

  // refs: cada carta da mao + alvo do descarte (para FLIP animation)
  const handCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const discardRef = useRef<HTMLDivElement | null>(null);

  if (!view || !session) return <p>Aguardando estado...</p>;

  const pendingIdx = view.mustDecideAfterDraw?.cardIndex ?? -1;
  const justDrawnCardId =
    pendingIdx >= 0 && pendingIdx < view.myHand.length
      ? view.myHand[pendingIdx]!.id
      : null;
  const waitingDecision = view.mustDecideAfterDraw !== undefined;

  const sendPlay = (cardId: string, chosenColor?: UnoColor): void =>
    void socket?.emit(
      'game:move',
      { roomId: session.roomId, type: 'playCard', data: { cardId, chosenColor } },
      () => {},
    );

  /**
   * Anima a carta saindo da mao ate o descarte, e SO depois emite o move.
   * Se nao tivermos refs (ex.: drag-and-drop solto fora do alvo), envia direto.
   */
  const playWithAnimation = (card: CardData, chosenColor?: UnoColor): void => {
    const handEl = handCardRefs.current.get(card.id);
    const discardEl = discardRef.current;
    if (!handEl || !discardEl || flying) {
      sendPlay(card.id, chosenColor);
      return;
    }
    const fromRect = handEl.getBoundingClientRect();
    const toRect = discardEl.getBoundingClientRect();
    setFlying({ card, fromRect, toRect, phase: 'start' });

    // proximo frame: mover para o destino (CSS transition cuida)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setFlying((cur) => (cur ? { ...cur, phase: 'end' } : cur));
      });
    });

    // ao fim da transicao, emite e limpa
    window.setTimeout(() => {
      sendPlay(card.id, chosenColor);
      setFlying(null);
    }, 340);
  };

  const draw = (): void =>
    void socket?.emit(
      'game:move',
      { roomId: session.roomId, type: 'drawCard', data: {} },
      () => {},
    );

  const passTurn = (): void =>
    void socket?.emit(
      'game:move',
      { roomId: session.roomId, type: 'passTurn', data: {} },
      () => {},
    );

  /** Clicar tenta jogar. Curinga -> abre seletor de cor antes. */
  const onCardClick = (c: CardData): void => {
    if (c.color === 'wild') setWildPickFor(c.id);
    else playWithAnimation(c);
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
    else playWithAnimation(c);
  };

  const onPickColor = (color: UnoColor): void => {
    if (wildPickFor) {
      const c = view.myHand.find((x) => x.id === wildPickFor);
      if (c) playWithAnimation(c, color);
    }
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
              <UnoContestButton opponentId={p.id} />
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
            disabled={waitingDecision}
            title={
              waitingDecision
                ? 'Voce ja comprou — jogue ou pule o turno'
                : view.pendingDraw > 0
                  ? `Comprar ${view.pendingDraw}`
                  : 'Comprar'
            }
          >
            <UnoCardBack />
          </button>
          <div className="uno-deck-label">
            {view.pendingDraw > 0 ? `Comprar ${view.pendingDraw}` : 'Baralho'}
          </div>
        </div>

        <div
          ref={discardRef}
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
        {view.myHand.map((c) => {
          const isJustDrawn = c.id === justDrawnCardId;
          const isFlying = flying?.card.id === c.id;
          return (
            <div
              key={c.id}
              ref={(el) => {
                if (el) handCardRefs.current.set(c.id, el);
                else handCardRefs.current.delete(c.id);
              }}
              className={`uno-hand-slot ${isJustDrawn ? 'just-drawn' : ''}`}
              style={isFlying ? { visibility: 'hidden' } : undefined}
            >
              <UnoCard
                card={c}
                draggable
                dragging={draggingId === c.id}
                onClick={() => onCardClick(c)}
                onDragStart={onCardDragStart(c)}
                onDragEnd={onCardDragEnd}
              />
            </div>
          );
        })}
      </div>

      <div className="uno-actions">
        {waitingDecision ? (
          <button className="uno-draw-button uno-pass-button" onClick={passTurn}>
            Pular turno
          </button>
        ) : (
          <button className="uno-draw-button" onClick={draw}>
            {view.pendingDraw > 0
              ? `Comprar ${view.pendingDraw} cartas`
              : 'Comprar carta'}
          </button>
        )}
      </div>

      <UnoCallButton />

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

      {flying && <FlyingGhost flying={flying} />}
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
    </div>
  );
}

/** Ghost da carta voando da mao ate o descarte. Renderizado via portal. */
function FlyingGhost({ flying }: { flying: FlyingCard }): JSX.Element {
  const { card, fromRect, toRect, phase } = flying;
  // ponto inicial: posicao da carta na mao.
  const dx = toRect.left + toRect.width / 2 - (fromRect.left + fromRect.width / 2);
  const dy = toRect.top + toRect.height / 2 - (fromRect.top + fromRect.height / 2);
  const style: React.CSSProperties = {
    left: fromRect.left,
    top: fromRect.top,
    width: fromRect.width,
    height: fromRect.height,
    transform:
      phase === 'start'
        ? 'translate(0px, 0px) rotate(0deg)'
        : `translate(${dx}px, ${dy}px) rotate(-12deg) scale(0.95)`,
  };

  // tamanho final (escala): a carta cresce um pouco para "encaixar" no descarte
  const node = (
    <div className="uno-fly-ghost" style={style}>
      <UnoCard card={card} />
    </div>
  );
  return createPortal(node, document.body) as JSX.Element;
}

