import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { BackEntry, CatalogEntry, SandboxBoard as SandboxBoardData } from '@boardzando/contracts';
import { useGame } from '../../net/store';
import { SandboxPlaceableView } from './SandboxPlaceable';
import { SandboxHand, type HandItem } from './SandboxHand';
import { SandboxOpponentHands } from './SandboxOpponentHands';
import { SandboxStackMenu, type StackMenuTarget } from './SandboxStackMenu';
import { SandboxPerimeterBoard } from './SandboxPerimeterBoard';
import './sandbox.css';

interface ClientPlaceable {
  id: string;
  typeId?: string;
  x?: number;
  y?: number;
  z?: number;
  faceUp?: boolean;
  ownerId?: string;
  stackId?: string;
  stackOrder?: number;
  value?: number;
  backId?: string;
  category?: string;
  inHand?: boolean;
}

interface SandboxView {
  kind: 'sandbox';
  allowHand: boolean;
  catalog: Record<string, CatalogEntry>;
  backs: Record<string, BackEntry>;
  board?: SandboxBoardData;
  placeables: Record<string, ClientPlaceable>;
}

interface DragState {
  kind: 'table' | 'hand';
  id: string;
  stackId?: string;
  count: number;
  grabDX: number;
  grabDY: number;
  startClientX: number;
  startClientY: number;
  clientX: number;
  clientY: number;
  moved: boolean;
  typeId?: string;
  faceUp: boolean;
  backId?: string;
  value?: number;
  w: number;
  h: number;
}

const UNIT = 40; // px por unidade de peca
const STREAM_MS = 33;
const OVERRIDE_TTL = 400;

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

function defaultSize(category?: string): { w: number; h: number } {
  switch (category) {
    case 'card':
      return { w: 1.1, h: 1.6 };
    case 'money':
      return { w: 1.6, h: 0.9 };
    default:
      return { w: 0.8, h: 0.8 };
  }
}

export function SandboxBoard(): JSX.Element {
  const view = useGame((s) => s.view) as SandboxView | undefined;
  const session = useGame((s) => s.session);
  const socket = useGame((s) => s.socket);
  const room = useGame((s) => s.room);
  const dragOverrides = useGame((s) => s.dragOverrides);

  const boardRef = useRef<HTMLDivElement | null>(null);
  const handRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const lastEmit = useRef(0);

  const [drag, setDrag] = useState<DragState | null>(null);
  const [menu, setMenu] = useState<StackMenuTarget | null>(null);
  const [, force] = useState(0);

  // re-render periodico para expirar overrides de drag obsoletos
  useEffect(() => {
    const t = window.setInterval(() => force((n) => n + 1), 250);
    return () => window.clearInterval(t);
  }, []);

  // listeners de janela enquanto arrasta
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent): void => {
      const ds = dragRef.current;
      if (!ds) return;
      ds.clientX = e.clientX;
      ds.clientY = e.clientY;
      if (
        !ds.moved &&
        Math.hypot(e.clientX - ds.startClientX, e.clientY - ds.startClientY) > 4
      ) {
        ds.moved = true;
      }
      setDrag({ ...ds });
      // stream apenas para drags de mesa (mão alheia não é renderizada pelos outros)
      if (ds.moved && ds.kind === 'table' && session && socket) {
        const now = Date.now();
        if (now - lastEmit.current > STREAM_MS) {
          lastEmit.current = now;
          const pos = normalizedPos(ds);
          if (pos) socket.emit('placeable:drag', { roomId: session.roomId, id: ds.id, x: pos.x, y: pos.y });
        }
      }
    };
    const onUp = (e: PointerEvent): void => {
      const ds = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (!ds) return;
      finishDrag(ds, e);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag !== null]);

  if (!view || !session || view.kind !== 'sandbox') return <p>Aguardando estado...</p>;
  const me = session.playerId;
  const { catalog, backs } = view;

  const emitMove = (type: string, data: unknown): void => {
    socket?.emit('game:move', { roomId: session.roomId, type, data }, () => {});
  };

  // ---- normaliza posição do ponteiro -> coords 0..1 da mesa ----
  function normalizedPos(ds: DragState): { x: number; y: number } | null {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = clamp((ds.clientX - ds.grabDX - rect.left) / rect.width, 0, 1);
    const y = clamp((ds.clientY - ds.grabDY - rect.top) / rect.height, 0, 1);
    return { x, y };
  }

  function isOver(ref: HTMLElement | null, e: PointerEvent): boolean {
    if (!ref) return false;
    const r = ref.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  }

  function stackGroupOf(typeId?: string): string | undefined {
    return typeId ? catalog[typeId]?.stackGroup : undefined;
  }

  // ---- partição ----
  const all = Object.values(view.placeables);
  const myHand: HandItem[] = all
    .filter((p) => p.ownerId === me)
    .map((p) => ({ id: p.id, typeId: p.typeId, faceUp: p.faceUp ?? true, value: p.value }));

  const othersByOwner: Record<string, ClientPlaceable[]> = {};
  for (const p of all) {
    if (p.ownerId && p.ownerId !== me) (othersByOwner[p.ownerId] ??= []).push(p);
  }
  const tableItems = all.filter((p) => !p.ownerId);

  // ---- pilhas (agrupa por stackId; solto = pilha de 1) ----
  const pileMap = new Map<string, ClientPlaceable[]>();
  for (const p of tableItems) {
    const key = p.stackId ?? `solo-${p.id}`;
    const arr = pileMap.get(key);
    if (arr) arr.push(p);
    else pileMap.set(key, [p]);
  }
  const piles = [...pileMap.values()].map((members) => {
    members.sort((a, b) => (a.stackOrder ?? 0) - (b.stackOrder ?? 0));
    const top = members[members.length - 1]!;
    return { members, top, count: members.length };
  });
  piles.sort((a, b) => (a.top.z ?? 0) - (b.top.z ?? 0));

  function posFor(p: ClientPlaceable): { x: number; y: number } {
    if (drag && drag.kind === 'table' && drag.id === p.id) {
      const np = normalizedPos(drag);
      if (np) return np;
    }
    const ov = dragOverrides[p.id];
    if (ov && ov.by !== me && Date.now() - ov.at < OVERRIDE_TTL) return { x: ov.x, y: ov.y };
    return { x: p.x ?? 0, y: p.y ?? 0 };
  }

  // ---- início de drag (mesa) ----
  const onPilePointerDown = (e: ReactPointerEvent, pile: (typeof piles)[number]): void => {
    if (e.button !== 0) return;
    e.preventDefault();
    const rect = boardRef.current!.getBoundingClientRect();
    const pos = posFor(pile.top);
    const px = rect.left + pos.x * rect.width;
    const py = rect.top + pos.y * rect.height;
    const sz = pile.top.typeId && catalog[pile.top.typeId]
      ? { w: catalog[pile.top.typeId]!.w, h: catalog[pile.top.typeId]!.h }
      : defaultSize(pile.top.category);
    const ds: DragState = {
      kind: 'table',
      id: pile.top.id,
      stackId: pile.count > 1 ? pile.top.stackId : undefined,
      count: pile.count,
      grabDX: e.clientX - px,
      grabDY: e.clientY - py,
      startClientX: e.clientX,
      startClientY: e.clientY,
      clientX: e.clientX,
      clientY: e.clientY,
      moved: false,
      typeId: pile.top.typeId,
      faceUp: pile.top.faceUp ?? true,
      backId: pile.top.backId,
      value: pile.top.value,
      w: sz.w,
      h: sz.h,
    };
    dragRef.current = ds;
    setDrag(ds);
  };

  // ---- início de drag (mão) ----
  const onHandPointerDown = (e: ReactPointerEvent, item: HandItem): void => {
    if (e.button !== 0) return;
    e.preventDefault();
    const el = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const sz = item.typeId && catalog[item.typeId]
      ? { w: catalog[item.typeId]!.w, h: catalog[item.typeId]!.h }
      : defaultSize('card');
    const ds: DragState = {
      kind: 'hand',
      id: item.id,
      count: 1,
      grabDX: e.clientX - el.left,
      grabDY: e.clientY - el.top,
      startClientX: e.clientX,
      startClientY: e.clientY,
      clientX: e.clientX,
      clientY: e.clientY,
      moved: false,
      typeId: item.typeId,
      faceUp: item.faceUp,
      value: item.value,
      w: sz.w,
      h: sz.h,
    };
    dragRef.current = ds;
    setDrag(ds);
  };

  // ---- fim de drag ----
  function finishDrag(ds: DragState, e: PointerEvent): void {
    if (!ds.moved) {
      if (ds.kind === 'table') openMenu(ds, e.clientX, e.clientY);
      return;
    }
    if (ds.kind === 'hand') {
      if (isOver(handRef.current, e)) return; // soltou de volta na mão
      const pos = normalizedPos(ds);
      if (pos) emitMove('fromHand', { id: ds.id, x: pos.x, y: pos.y, faceUp: ds.faceUp });
      return;
    }
    // drag de mesa
    if (isOver(handRef.current, e) && view!.allowHand && ds.count === 1) {
      emitMove('toHand', { id: ds.id });
      return;
    }
    // empilhar: item único sobre pilha de mesmo grupo
    if (ds.count === 1 && ds.typeId) {
      const target = findStackTarget(ds);
      if (target) {
        emitMove('stackItem', { id: ds.id, ontoId: target });
        return;
      }
    }
    const pos = normalizedPos(ds);
    if (!pos) return;
    if (ds.stackId) emitMove('moveStack', { stackId: ds.stackId, x: pos.x, y: pos.y });
    else emitMove('moveItem', { id: ds.id, x: pos.x, y: pos.y });
  }

  function findStackTarget(ds: DragState): string | null {
    const pos = normalizedPos(ds);
    if (!pos) return null;
    const group = stackGroupOf(ds.typeId);
    if (!group) return null;
    let best: { id: string; d: number } | null = null;
    for (const pile of piles) {
      if (pile.top.id === ds.id) continue;
      if (stackGroupOf(pile.top.typeId) !== group) continue;
      const pp = posFor(pile.top);
      const d = Math.hypot(pp.x - pos.x, pp.y - pos.y);
      if (d < 0.06 && (!best || d < best.d)) best = { id: pile.top.id, d };
    }
    return best?.id ?? null;
  }

  function openMenu(ds: DragState, screenX: number, screenY: number): void {
    const entry = ds.typeId ? catalog[ds.typeId] : undefined;
    setMenu({
      screenX,
      screenY,
      topId: ds.id,
      stackId: ds.stackId,
      count: ds.count,
      isDie: entry?.category === 'die',
      canHold: view!.allowHand && (entry?.canHold ?? true),
    });
  }

  const nameOf = (pid: string): string =>
    room?.players.find((p) => p.id === pid)?.name ?? pid.slice(0, 4);

  return (
    <div className="sbx-root">
      <SandboxOpponentHands
        itemsByOwner={othersByOwner}
        nameOf={nameOf}
        catalog={catalog}
        backs={backs}
      />

      <p className="sbx-hint">
        Mesa livre — arraste as peças à vontade. Clique numa peça/pilha para o
        menu (virar, embaralhar, pegar, rolar). Solte na sua mão para esconder.
      </p>

      <div className="sbx-board" ref={boardRef}>
        {view.board?.kind === 'perimeter' && <SandboxPerimeterBoard board={view.board} />}
        {piles.map((pile) => {
          const hidden = drag?.kind === 'table' && drag.id === pile.top.id;
          if (hidden) return null;
          const pos = posFor(pile.top);
          const sz = pile.top.typeId && catalog[pile.top.typeId]
            ? { w: catalog[pile.top.typeId]!.w, h: catalog[pile.top.typeId]!.h }
            : defaultSize(pile.top.category);
          return (
            <div
              key={pile.top.id}
              className="sbx-pile"
              style={{
                left: `calc(${pos.x * 100}% )`,
                top: `calc(${pos.y * 100}% )`,
                width: sz.w * UNIT,
                height: sz.h * UNIT,
                zIndex: pile.top.z ?? 1,
              }}
              onPointerDown={(e) => onPilePointerDown(e, pile)}
            >
              <SandboxPlaceableView
                typeId={pile.top.typeId}
                faceUp={pile.top.faceUp ?? false}
                backId={pile.top.backId}
                value={pile.top.value}
                catalog={catalog}
                backs={backs}
              />
              {pile.count > 1 && <span className="sbx-count-badge">×{pile.count}</span>}
            </div>
          );
        })}
      </div>

      <SandboxHand
        ref={handRef}
        items={myHand}
        catalog={catalog}
        backs={backs}
        onItemPointerDown={onHandPointerDown}
        onFlip={(id) => emitMove('flipItem', { id })}
      />

      {/* ghost seguindo o cursor */}
      {drag && drag.moved && (
        <div
          className="sbx-ghost"
          style={{
            left: drag.clientX - drag.grabDX,
            top: drag.clientY - drag.grabDY,
            width: drag.w * UNIT,
            height: drag.h * UNIT,
          }}
        >
          <SandboxPlaceableView
            typeId={drag.typeId}
            faceUp={drag.faceUp}
            backId={drag.backId}
            value={drag.value}
            catalog={catalog}
            backs={backs}
          />
          {drag.count > 1 && <span className="sbx-count-badge">×{drag.count}</span>}
        </div>
      )}

      {menu && (
        <SandboxStackMenu
          target={menu}
          onShuffle={() => {
            if (menu.stackId) emitMove('shuffleStack', { stackId: menu.stackId });
            setMenu(null);
          }}
          onFlip={() => {
            emitMove('flipItem', { id: menu.topId });
            setMenu(null);
          }}
          onTakeToHand={() => {
            emitMove('toHand', { id: menu.topId });
            setMenu(null);
          }}
          onRoll={() => {
            emitMove('rollDie', { id: menu.topId });
            setMenu(null);
          }}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
