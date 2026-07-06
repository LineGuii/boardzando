import type { SandboxBoard } from '@boardzando/contracts';

/**
 * Tabuleiro perimetral (estilo Monopoly) renderizado como camada de FUNDO da
 * mesa. Decorativo: `pointer-events: none` deixa os placeables receberem o
 * drag por cima. As 4*(N-1) casas ficam na borda de um grid NxN; o centro fica
 * livre para as peças.
 */
export function SandboxPerimeterBoard({ board }: { board: SandboxBoard }): JSX.Element {
  const N = board.size;
  return (
    <div
      className="sbx-perimeter"
      style={{
        gridTemplateColumns: `repeat(${N}, 1fr)`,
        gridTemplateRows: `repeat(${N}, 1fr)`,
      }}
    >
      {board.spaces.map((sp) => {
        const { row, col } = cellOf(sp.index, N);
        return (
          <div
            key={sp.index}
            className={`sbx-space sbx-space-${sp.type}`}
            style={{ gridRow: row, gridColumn: col }}
          >
            {sp.type === 'property' && (
              <div className="sbx-space-bar" style={{ background: sp.color }} />
            )}
            <div className="sbx-space-body">
              {sp.emoji && <span className="sbx-space-emoji">{sp.emoji}</span>}
              <span className="sbx-space-name">{sp.name}</span>
              {sp.price !== undefined && <span className="sbx-space-price">${sp.price}</span>}
            </div>
          </div>
        );
      })}
      <div className="sbx-perimeter-center" style={{ gridArea: `2 / 2 / ${N} / ${N}` }}>
        <span className="sbx-perimeter-title">BANCO IMOBILIÁRIO</span>
      </div>
    </div>
  );
}

/**
 * Mapeia o índice 0..(4N-5) para (row,col) 1-based num grid NxN, percorrendo a
 * borda: canto inferior-direito (índice 0) -> base (esquerda) -> coluna esquerda
 * (sobe) -> topo (direita) -> coluna direita (desce).
 */
function cellOf(index: number, N: number): { row: number; col: number } {
  const last = N - 1;
  if (index <= last) return { row: N, col: N - index };
  if (index <= 2 * last) return { row: N - (index - last), col: 1 };
  if (index <= 3 * last) return { row: 1, col: 1 + (index - 2 * last) };
  return { row: 1 + (index - 3 * last), col: N };
}
