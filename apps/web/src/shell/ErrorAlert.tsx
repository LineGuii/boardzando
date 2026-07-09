import type { WsError } from '@boardzando/contracts';

/**
 * Traduz um erro do servidor (WsError) para uma mensagem amigavel em pt-BR.
 * Cai na mensagem original (ou um texto generico) para codigos desconhecidos.
 */
export function friendlyError(err: WsError): string {
  switch (err.code) {
    case 'INVALID_MOVE':
      return 'Essa jogada não é válida agora. 🤔 Tente outra ação.';
    case 'NOT_YOUR_TURN':
      return 'Calma lá! Ainda não é a sua vez. ⏳';
    case 'ROOM_FULL':
      return 'Esta sala já está cheia. 🚪 Tente outra ou crie uma nova.';
    case 'ROOM_NOT_FOUND':
      return 'Não encontramos essa sala. 🔍 Talvez ela já tenha sido encerrada.';
    case 'UNAUTHORIZED':
      return 'Sua sessão expirou. 🔒 Entre na sala novamente.';
    case 'VALIDATION':
      return err.message || 'Alguns dados estão incorretos. ✏️ Confira e tente de novo.';
    case 'RATE_LIMITED':
      return 'Você está indo rápido demais! 🐢 Aguarde um instante e tente de novo.';
    case 'KICKED':
      return 'Você foi removido da sala pelo host. 👋';
    case 'INTERNAL':
      return 'Algo deu errado do nosso lado. 🛠️ Tente novamente em instantes.';
    default:
      return err.message || 'Ops, algo deu errado. Tente novamente. 🙏';
  }
}

/** Alerta de erro amigavel e dispensavel (botao "X"). */
export function ErrorAlert({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}): JSX.Element {
  return (
    <div className="shell-error" role="alert">
      <span className="shell-error-icon" aria-hidden>
        ⚠️
      </span>
      <span className="shell-error-msg">{message}</span>
      <button
        type="button"
        className="shell-error-close"
        onClick={onClose}
        aria-label="Fechar aviso"
        title="Fechar"
      >
        ×
      </button>
    </div>
  );
}
