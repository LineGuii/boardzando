import type { BackEntry, CatalogEntry } from '@boardzando/contracts';
import { SandboxPlaceableView } from './SandboxPlaceable';

interface HiddenHandItem {
  id: string;
  ownerId?: string;
  backId?: string;
  category?: string;
}

/**
 * Faixa de "maos dos oponentes" (estilo oponentes do UNO): por jogador, mostra
 * o nome e N versos das pecas que ele tem na mao. So o verso e visivel.
 */
export function SandboxOpponentHands({
  itemsByOwner,
  nameOf,
  catalog,
  backs,
}: {
  itemsByOwner: Record<string, HiddenHandItem[]>;
  nameOf: (id: string) => string;
  catalog: Record<string, CatalogEntry>;
  backs: Record<string, BackEntry>;
}): JSX.Element | null {
  const owners = Object.keys(itemsByOwner);
  if (owners.length === 0) return null;
  return (
    <div className="sbx-opponents">
      {owners.map((ownerId) => (
        <div key={ownerId} className="sbx-opponent">
          <div className="sbx-opponent-name">
            {nameOf(ownerId)} · {itemsByOwner[ownerId]!.length}
          </div>
          <div className="sbx-opponent-hand">
            {itemsByOwner[ownerId]!.slice(0, 12).map((it) => (
              <div key={it.id} className="sbx-mini">
                <SandboxPlaceableView
                  faceUp={false}
                  backId={it.backId}
                  catalog={catalog}
                  backs={backs}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
