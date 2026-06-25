import { forwardRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { BackEntry, CatalogEntry } from '@boardzando/contracts';
import { SandboxPlaceableView } from './SandboxPlaceable';

export interface HandItem {
  id: string;
  typeId?: string;
  faceUp: boolean;
  value?: number;
}

/**
 * Gaveta inferior com a MINHA mao. Cada peca mostra a frente (so eu vejo),
 * pode ser virada (muda a face com que sera colocada) e arrastada para a mesa.
 */
export const SandboxHand = forwardRef<HTMLDivElement, {
  items: HandItem[];
  catalog: Record<string, CatalogEntry>;
  backs: Record<string, BackEntry>;
  onItemPointerDown: (e: ReactPointerEvent, item: HandItem) => void;
  onFlip: (id: string) => void;
}>(function SandboxHand({ items, catalog, backs, onItemPointerDown, onFlip }, ref): JSX.Element {
  return (
    <div className="sbx-hand" ref={ref}>
      <div className="sbx-hand-label">Sua mão ({items.length})</div>
      <div className="sbx-hand-items">
        {items.length === 0 && (
          <span className="sbx-hand-empty">
            Arraste peças da mesa para cá para mantê-las escondidas.
          </span>
        )}
        {items.map((it) => (
          <div key={it.id} className="sbx-hand-item">
            <div
              className="sbx-hand-card"
              onPointerDown={(e) => onItemPointerDown(e, it)}
              title="Arraste para a mesa"
            >
              <SandboxPlaceableView
                typeId={it.typeId}
                faceUp={it.faceUp}
                value={it.value}
                catalog={catalog}
                backs={backs}
              />
            </div>
            <button
              type="button"
              className="sbx-hand-flip"
              onClick={() => onFlip(it.id)}
              title="Virar (define a face ao colocar)"
            >
              {it.faceUp ? '🔼 frente' : '🔽 verso'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
});
