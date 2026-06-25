import type { CSSProperties } from 'react';
import type { BackEntry, CatalogEntry, PlaceableFace } from '@boardzando/contracts';

/**
 * Desenha UMA face de placeable (frente ou verso) a partir do descritor do
 * catalogo — sem assets, so cor + texto + emoji. Reutilizado na mesa, na mao
 * e na faixa de oponentes.
 */
export function SandboxFace({
  face,
  category,
  value,
  style,
}: {
  face: PlaceableFace;
  category?: string;
  value?: number;
  style?: CSSProperties;
}): JSX.Element {
  return (
    <div
      className={`sbx-face sbx-cat-${category ?? 'misc'}`}
      style={{
        background: face.color ?? '#ccc',
        color: face.textColor ?? '#111',
        ...style,
      }}
    >
      {face.emoji ? (
        <span className="sbx-emoji">{face.emoji}</span>
      ) : (
        <>
          {face.label && <span className="sbx-label">{face.label}</span>}
          {face.sub && <span className="sbx-sub">{face.sub}</span>}
        </>
      )}
      {value !== undefined && <span className="sbx-value">{value}</span>}
    </div>
  );
}

/**
 * Renderiza um placeable conhecido (frente, se faceUp) ou o verso. Recebe o
 * catalogo/versos para resolver as faces.
 */
export function SandboxPlaceableView({
  typeId,
  faceUp,
  backId,
  value,
  catalog,
  backs,
  style,
}: {
  typeId?: string;
  faceUp: boolean;
  backId?: string;
  value?: number;
  catalog: Record<string, CatalogEntry>;
  backs: Record<string, BackEntry>;
  style?: CSSProperties;
}): JSX.Element {
  const entry = typeId ? catalog[typeId] : undefined;
  if (faceUp && entry) {
    return (
      <SandboxFace face={entry.front} category={entry.category} value={value} style={style} />
    );
  }
  // verso
  const back = (backId && backs[backId]) || (entry && backs[entry.backId]);
  return (
    <SandboxFace
      face={back?.face ?? { label: '?', color: '#555', textColor: '#fff' }}
      category={entry?.category}
      style={style}
    />
  );
}
