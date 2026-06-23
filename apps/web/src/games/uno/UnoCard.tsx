import type { DragEvent } from 'react';

export type UnoColor = 'red' | 'yellow' | 'green' | 'blue' | 'wild';

export interface CardData {
  id: string;
  color: string; // UnoColor mas vem da view como string
  kind: string;
  value?: number;
}

interface UnoCardProps {
  card: CardData;
  draggable?: boolean;
  dragging?: boolean;
  onClick?: () => void;
  onDragStart?: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (e: DragEvent<HTMLDivElement>) => void;
  /** Sobrescreve o estilo (usado para empilhar no descarte com leve rotacao). */
  style?: React.CSSProperties;
}

/** Renderiza um simbolo legivel para cada tipo de carta. */
function symbolFor(kind: string, value?: number): string {
  if (kind === 'number') return value === undefined ? '?' : String(value);
  if (kind === 'skip') return 'Ø';
  if (kind === 'reverse') return '⟳';
  if (kind === 'draw2') return '+2';
  if (kind === 'wild_draw4') return '+4';
  if (kind === 'wild') return '★';
  return '?';
}

/** Carta jogavel (face para cima) com visual estilo UNO. */
export function UnoCard({
  card,
  draggable,
  dragging,
  onClick,
  onDragStart,
  onDragEnd,
  style,
}: UnoCardProps): JSX.Element {
  const sym = symbolFor(card.kind, card.value);
  const cls = `uno-card ${card.color} ${dragging ? 'dragging' : ''}`.trim();
  return (
    <div
      className={cls}
      draggable={draggable}
      onClick={onClick}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={style}
      role={onClick ? 'button' : undefined}
      title={`${card.color} ${card.kind}${card.value !== undefined ? ' ' + card.value : ''}`}
    >
      <span className="uno-card-corner tl">{sym}</span>
      <div className="uno-card-inner">
        <span className="uno-card-symbol">{sym}</span>
      </div>
      <span className="uno-card-corner br">{sym}</span>
    </div>
  );
}

/** Carta virada (verso). Usado para o baralho e a mao dos oponentes. */
export function UnoCardBack({ style }: { style?: React.CSSProperties }): JSX.Element {
  return <div className="uno-card-back" style={style} />;
}
