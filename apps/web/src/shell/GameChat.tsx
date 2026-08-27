import { useEffect, useRef, useState } from 'react';
import { useGame } from '../net/store';

/**
 * Chat da sala (reutilizável por qualquer jogo). Usa o canal
 * `chat:send`/`chat:message` que já existe nos contratos e no store.
 *
 * Começa FECHADO: durante a partida o tabuleiro é o que importa, e um chat
 * sempre aberto rouba altura de tela em todos os jogos. Enquanto está fechado
 * ele conta as mensagens que chegaram e mostra o número no badge — assim
 * ninguém precisa deixá-lo aberto só para não perder conversa.
 */
export function GameChat(): JSX.Element | null {
  const chat = useGame((s) => s.chat);
  const session = useGame((s) => s.session);
  const socket = useGame((s) => s.socket);
  const [aberto, setAberto] = useState(false);
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  /** Quantas mensagens já estavam na tela na última vez que o chat esteve aberto. */
  const [lidasAte, setLidasAte] = useState(chat.length);

  // Aberto: tudo que chega já conta como lido, e a lista rola para o fim.
  useEffect(() => {
    if (!aberto) return;
    setLidasAte(chat.length);
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [aberto, chat.length]);

  if (!session) return null;

  const naoLidas = Math.max(0, chat.length - lidasAte);

  const send = (): void => {
    const t = text.trim();
    if (!t) return;
    socket?.emit('chat:send', { roomId: session.roomId, text: t.slice(0, 300) });
    setText('');
  };

  const alternar = (): void => {
    const proximo = !aberto;
    setAberto(proximo);
    // Abrir para escrever é o caso comum: já entrega o cursor no campo.
    if (proximo) window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div className={`game-chat ${aberto ? 'aberto' : 'fechado'}`}>
      <button
        type="button"
        className="game-chat-header"
        onClick={alternar}
        aria-expanded={aberto}
        aria-controls="game-chat-corpo"
      >
        <span className="game-chat-seta" aria-hidden="true">
          {aberto ? '▾' : '▸'}
        </span>
        <span className="game-chat-titulo">💬 Chat</span>
        {!aberto && naoLidas > 0 && (
          <span className="game-chat-badge" aria-label={`${naoLidas} mensagens não lidas`}>
            {naoLidas > 99 ? '99+' : naoLidas}
          </span>
        )}
        {!aberto && naoLidas === 0 && chat.length > 0 && (
          <span className="game-chat-contagem">{chat.length}</span>
        )}
      </button>

      {aberto && (
        <div className="game-chat-corpo" id="game-chat-corpo">
          <div className="game-chat-messages" ref={listRef}>
            {chat.length === 0 ? (
              <span className="game-chat-empty">Sem mensagens ainda. Diga olá! 👋</span>
            ) : (
              chat.map((m, i) => (
                <div
                  key={i}
                  className={`game-chat-msg ${m.from === session.playerId ? 'mine' : ''}`}
                >
                  <span className="game-chat-from">{m.fromName}</span>
                  <span className="game-chat-text">{m.text}</span>
                </div>
              ))
            )}
          </div>
          <div className="game-chat-input-row">
            <input
              ref={inputRef}
              className="game-chat-input"
              placeholder="Mensagem..."
              value={text}
              maxLength={300}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') send();
                if (e.key === 'Escape') setAberto(false);
              }}
            />
            <button
              type="button"
              className="game-chat-send"
              onClick={send}
              disabled={!text.trim()}
            >
              Enviar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
