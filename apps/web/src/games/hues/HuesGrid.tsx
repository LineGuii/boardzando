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
  /** Cor visual (HSL string) usada como cor do cone — derivada do nome do jogador. */
  color: string;
  /** Iniciais do jogador para visualizar quem clicou onde. */
  initial: string;
}

/**
 * Tabuleiro 30x16. Pinta cada celula com a cor deterministica do contracts.
 * Sobrepoe os cones e, em modo `revealedTarget`, destaca a moldura 3x3 e o
 * anel ortogonal externo.
 */
export function HuesGrid({
  cones,
  clickable,
  onPick,
  revealedTarget,
}: {
  cones: ConeMark[];
  clickable: boolean;
  onPick?: (coord: HuesCoord) => void;
  revealedTarget?: HuesCoord;
}): JSX.Element {
  const cells: JSX.Element[] = [];
  for (let row = 0; row < HUES_ROWS; row++) {
    for (let col = 0; col < HUES_COLS; col++) {
      const here: HuesCoord = { col, row };
      const isTarget = !!revealedTarget && revealedTarget.col === col && revealedTarget.row === row;
      const inFrame = !!revealedTarget && chebyshev(revealedTarget, here) <= 1 && !isTarget;
      const inRing =
        !!revealedTarget &&
        chebyshev(revealedTarget, here) === 2 &&
        manhattan(revealedTarget, here) === 2;
      const conesHere = cones.filter((c) => c.coord.col === col && c.coord.row === row);
      const cls = [
        'hues-cell',
        clickable ? 'clickable' : '',
        isTarget ? 'target-exact' : '',
        inFrame ? 'target-frame' : '',
        inRing ? 'target-ring' : '',
      ]
        .filter(Boolean)
        .join(' ');
      cells.push(
        <div
          key={`${col}-${row}`}
          className={cls}
          style={{ background: cellColor(col, row) }}
          onClick={clickable && onPick ? () => onPick(here) : undefined}
          title={`${labelCol(col)}${row + 1}`}
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
        </div>,
      );
    }
  }
  return <div className="hues-grid">{cells}</div>;
}

function labelCol(col: number): string {
  // A..Z, AA..AD (30 colunas)
  if (col < 26) return String.fromCharCode(65 + col);
  return 'A' + String.fromCharCode(65 + (col - 26));
}
