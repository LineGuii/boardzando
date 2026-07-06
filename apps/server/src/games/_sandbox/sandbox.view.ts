import type {
  GameContext,
  HiddenPlaceable,
  Placeable,
  PlayerId,
  SandboxState,
} from '@boardzando/contracts';

/**
 * Filtra o estado do sandbox para a perspectiva de um jogador:
 *  - peca na mao do proprio viewer => completa (ele ve a frente);
 *  - peca na mao de outro => so o verso (identidade escondida);
 *  - peca na mesa virada para cima => completa (todos veem a frente);
 *  - peca na mesa virada para baixo => so o verso (identidade escondida de
 *    TODOS — e o que torna o shuffle real). Posicao continua publica.
 */
export function sandboxPlayerView(
  state: SandboxState,
  _ctx: GameContext,
  viewer: PlayerId,
): unknown {
  const visible: Record<string, Placeable | HiddenPlaceable> = {};

  for (const item of Object.values(state.placeables)) {
    const entry = state.catalog[item.typeId];
    const backId = entry?.backId ?? 'back-generic';
    const category = entry?.category ?? 'misc';

    if (item.ownerId) {
      if (item.ownerId === viewer) {
        visible[item.id] = item; // dono ve a propria mao
      } else {
        // mao alheia: so o verso, sem identidade nem posicao
        visible[item.id] = {
          id: item.id,
          backId,
          category,
          ownerId: item.ownerId,
          inHand: true,
        };
      }
      continue;
    }

    // na mesa
    if (item.faceUp) {
      visible[item.id] = item;
    } else {
      visible[item.id] = {
        id: item.id,
        backId,
        category,
        x: item.x,
        y: item.y,
        z: item.z,
        rotation: item.rotation,
        stackId: item.stackId,
        stackOrder: item.stackOrder,
        faceUp: false,
      };
    }
  }

  return {
    kind: state.kind,
    allowHand: state.allowHand,
    catalog: state.catalog,
    backs: state.backs,
    board: state.board,
    placeables: visible,
  };
}
