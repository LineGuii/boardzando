import { useRef, useState, type MouseEvent } from 'react';
import type { HuesCoord } from '@boardzando/contracts';
import {
  HUES_COLS,
  HUES_ROWS,
  cellColor,
  chebyshev,
  manhattan,
} from '@boardzando/contracts';

interface ConeMark {
  coord: HuesCoord;
  color: string;
  initial: string;
}

interface HoverState {
  col: number;
  row: number;
  /** Posicao do cursor em coordenadas de viewport (clientX/Y). */
  x: number;
  y: number;
}

/** Rotulo da coluna: numero 1..30. */
export function colNumber(col: number): string {
  return String(col + 1);
}

/** Rotulo da linha: letra A..P (16 linhas). */
export function rowLetter(row: number): string {
  return String.fromCharCode(65 + row);
}

/** Coordenada formatada como "LINHA + COLUNA", ex.: "A1", "P30". */
export function coordLabel(coord: { col: number; row: number }): string {
  return `${rowLetter(coord.row)}${colNumber(coord.col)}`;
}

/**
 * Tabuleiro 30x16 com labels de coluna (1..30) e linha (A..P), magnifier
 * que segue o cursor mostrando a cor amplificada, e overlays de moldura
 * 3x3 + anel ortogonal no reveal. Quando recebe `pendingCoord`, renderiza
 * um cone pontilhado naquela posicao (preview antes de confirmar — usado
 * no fluxo mobile).
 */
export function HuesGrid({
  cones,
  clickable,
  onPick,
  revealedTarget,
  pendingCoord,
  pendingConeColor,
}: {
  cones: ConeMark[];
  clickable: boolean;
  onPick?: (coord: HuesCoord) => void;
  revealedTarget?: HuesCoord;
  pendingCoord?: HuesCoord;
  pendingConeColor?: string;
}): JSX.Element {
  const [hover, setHover] = useState<HoverState | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  const handleMove = (col: number, row: number) => (e: MouseEvent<HTMLDivElement>): void => {
    setHover({ col, row, x: e.clientX, y: e.clientY });
  };
  const handleLeave = (): void => setHover(null);

  const cells: JSX.Element[] = [];
  for (let row = 0; row < HUES_ROWS; row++) {
    for (let col = 0; col < HUES_COLS; col++) {
      const here: HuesCoord = { col, row };
      const isTarget =
        !!revealedTarget && revealedTarget.col === col && revealedTarget.row === row;
      const inFrame =
        !!revealedTarget && chebyshev(revealedTarget, here) <= 1 && !isTarget;
      const inRing =
        !!revealedTarget &&
        chebyshev(revealedTarget, here) === 2 &&
        manhattan(revealedTarget, here) === 2;
      const conesHere = cones.filter((c) => c.coord.col === col && c.coord.row === row);
      const isHovered = hover && hover.col === col && hover.row === row;
      const isPending =
        !!pendingCoord && pendingCoord.col === col && pendingCoord.row === row;
      const cls = [
        'hues-cell',
        clickable ? 'clickable' : '',
        isTarget ? 'target-exact' : '',
        inFrame ? 'target-frame' : '',
        inRing ? 'target-ring' : '',
        isHovered ? 'hovered' : '',
        isPending ? 'pending' : '',
      ]
        .filter(Boolean)
        .join(' ');
      cells.push(
        <div
          key={`${col}-${row}`}
          className={cls}
          style={{
            background: cellColor(col, row),
            gridColumn: col + 2,
            gridRow: row + 2,
          }}
          onClick={clickable && onPick ? () => onPick(here) : undefined}
          onMouseMove={handleMove(col, row)}
          onMouseLeave={handleLeave}
          title={coordLabel(here)}
        >
          {conesHere.map((c, i) => (
            <div
              key={i}
              className="hues-cone"
              style={{ transform: `translate(${i * 4}px, ${i * 4}px)` }}
            >
              <div className="hues-cone-dot" style={{ background: c.color }}>
                {c.initial}
              </div>
            </div>
          ))}
          {isPending && (
            <div className="hues-cone hues-cone-pending">
              <div
                className="hues-cone-dot"
                style={{
                  background: pendingConeColor ?? 'rgba(255, 255, 255, 0.6)',
                }}
              >
                ?
              </div>
            </div>
          )}
        </div>,
      );
    }
  }

  // labels de coluna (1..30) no topo + labels de linha (A..P) a esquerda
  const colLabels: JSX.Element[] = [];
  for (let c = 0; c < HUES_COLS; c++) {
    colLabels.push(
      <div
        key={`col-label-${c}`}
        className={`hues-col-label ${hover?.col === c ? 'active' : ''}`}
        style={{ gridColumn: c + 2, gridRow: 1 }}
      >
        {colNumber(c)}
      </div>,
    );
  }
  const rowLabels: JSX.Element[] = [];
  for (let r = 0; r < HUES_ROWS; r++) {
    rowLabels.push(
      <div
        key={`row-label-${r}`}
        className={`hues-row-label ${hover?.row === r ? 'active' : ''}`}
        style={{ gridColumn: 1, gridRow: r + 2 }}
      >
        {rowLetter(r)}
      </div>,
    );
  }

  return (
    <>
      <div className="hues-grid-scroll">
        <div ref={gridRef} className="hues-grid" onMouseLeave={handleLeave}>
          <div className="hues-corner" style={{ gridColumn: 1, gridRow: 1 }} />
          {colLabels}
          {rowLabels}
          {cells}
        </div>
      </div>
      {hover && <Magnifier hover={hover} />}
    </>
  );
}

/**
 * Loupe que segue o cursor mostrando a cor amplificada da celula sob o
 * mouse. Renderizada como overlay `position: fixed` proxima ao cursor.
 */
function Magnifier({ hover }: { hover: HoverState }): JSX.Element {
  const SIZE = 96;
  // posiciona ligeiramente abaixo/direita do cursor; gruda a borda se chegar
  // perto da margem da viewport.
  const margin = 16;
  let left = hover.x + margin;
  let top = hover.y + margin;
  if (typeof window !== 'undefined') {
    if (left + SIZE + 8 > window.innerWidth) left = hover.x - SIZE - margin;
    if (top + SIZE + 8 > window.innerHeight) top = hover.y - SIZE - margin;
  }
  return (
    <div
      className="hues-magnifier"
      style={{
        left,
        top,
        width: SIZE,
        height: SIZE,
        background: cellColor(hover.col, hover.row),
      }}
    >
      <span className="hues-magnifier-label">{coordLabel(hover)}</span>
    </div>
  );
}
