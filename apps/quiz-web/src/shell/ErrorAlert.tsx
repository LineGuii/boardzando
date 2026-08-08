import type { JSX } from 'react';
import type { WsError } from '@boardzando/contracts';

const FRIENDLY: Record<WsError['code'], string> = {
  UNAUTHORIZED: 'Sessao expirada — recarregue a pagina.',
  INVALID_MOVE: 'Acao invalida.',
  NOT_YOUR_TURN: 'Nao e a sua vez.',
  ROOM_FULL: 'Sala cheia.',
  ROOM_NOT_FOUND: 'Sala nao encontrada.',
  VALIDATION: 'Dados invalidos.',
  RATE_LIMITED: 'Voce esta muito rapido. Espere um pouco.',
  KICKED: 'Voce foi removido da sala.',
  INTERNAL: 'Erro interno no servidor.',
};

export function ErrorAlert(props: { error?: WsError; onClose: () => void }): JSX.Element | null {
  if (!props.error) return null;
  const msg = props.error.message || FRIENDLY[props.error.code] || props.error.code;
  return (
    <div className="q-alert">
      <span>⚠ {msg}</span>
      <button onClick={props.onClose} aria-label="fechar">×</button>
    </div>
  );
}
