export interface StackMenuTarget {
  /** posicao na tela (px) onde abrir o menu */
  screenX: number;
  screenY: number;
  /** id da peca do topo */
  topId: string;
  /** stackId, se for uma pilha (>1) */
  stackId?: string;
  /** quantidade na pilha */
  count: number;
  /** e um dado? */
  isDie: boolean;
  /** pode ir para a mao? */
  canHold: boolean;
}

/**
 * Menu contextual de uma peca/pilha na mesa: embaralhar (>=2), virar topo,
 * pegar topo para a mao, rolar (dado).
 */
export function SandboxStackMenu({
  target,
  onShuffle,
  onFlip,
  onTakeToHand,
  onRoll,
  onClose,
}: {
  target: StackMenuTarget;
  onShuffle: () => void;
  onFlip: () => void;
  onTakeToHand: () => void;
  onRoll: () => void;
  onClose: () => void;
}): JSX.Element {
  return (
    <>
      <div className="sbx-menu-backdrop" onClick={onClose} />
      <div
        className="sbx-menu"
        style={{ left: target.screenX, top: target.screenY }}
        onClick={(e) => e.stopPropagation()}
      >
        {target.count > 1 && (
          <button type="button" onClick={onShuffle}>
            🔀 Embaralhar ({target.count})
          </button>
        )}
        <button type="button" onClick={onFlip}>
          🔄 Virar topo
        </button>
        {target.canHold && (
          <button type="button" onClick={onTakeToHand}>
            ✋ Pegar topo para a mão
          </button>
        )}
        {target.isDie && (
          <button type="button" onClick={onRoll}>
            🎲 Rolar
          </button>
        )}
      </div>
    </>
  );
}
