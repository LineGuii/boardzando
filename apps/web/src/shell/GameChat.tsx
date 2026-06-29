import { useEffect, useRef, useState } from 'react';
import { useGame } from '../net/store';

/**
 * Chat simples da sala (reutilizável por qualquer jogo). Usa o canal
 * `chat:send`/`chat:message` que já existe nos contratos e no store.
 */
export function GameChat(): JSX.Element | null {
  const chat = useGame((s) => s.chat);
  const session = useGame((s) => s.session);
  const socket = useGame((s) => s.socket);
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);

  // rola para a última mensagem
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.length]);

  if (!session) return null;

  const send = (): void => {
    const t = text.trim();
    if (!t) return;
    socket?.emit('chat:send', { roomId: session.roomId, text: t.slice(0, 300) });
    setText('');
  };

  return (
    <div className="game-chat">
      <div className="game-chat-header">💬 Chat</div>
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
          className="game-chat-input"
          placeholder="Mensagem..."
          value={text}
          maxLength={300}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send();
          }}
        />
        <button type="button" className="game-chat-send" onClick={send} disabled={!text.trim()}>
          Enviar
        </button>
      </div>
    </div>
  );
}
