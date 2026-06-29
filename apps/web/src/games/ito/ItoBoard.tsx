import { useEffect, useRef, useState } from 'react';
import { useGame } from '../../net/store';
import { GameChat } from '../../shell/GameChat';
import { isMuted, playError, playLose, playSuccess, playWin, setMuted } from '../../shell/sfx';
import './ito.css';

interface ItoTheme {
  topic: string;
  low: string;
  high: string;
}
interface ItoCardView {
  id: string;
  ownerId: string;
  clue?: string;
  played: boolean;
  discarded?: boolean;
  playedOrder?: number;
  value?: number;
}
interface ItoView {
  theme: ItoTheme;
  level: number;
  maxLevel: number;
  lives: number;
  step: 'clue' | 'play';
  playedPile: string[];
  lastPlayedValue: number;
  lastMistake?: { count: number; byValue: number };
  /** voter -> cardId votado. */
  votes: Record<string, string>;
  cards: Record<string, ItoCardView>;
}

interface Voter {
  id: string;
  name: string;
  color: string;
}

export function ItoBoard(): JSX.Element {
  const view = useGame((s) => s.view) as ItoView | undefined;
  const session = useGame((s) => s.session);
  const room = useGame((s) => s.room);
  const socket = useGame((s) => s.socket);
  const gameOver = useGame((s) => s.gameOver);

  const [muted, setMutedState] = useState(isMuted());

  // ----- sons: acerto / erro / nível concluído -----
  const prevPlayed = useRef(0);
  const prevMistake = useRef<string | undefined>(undefined);
  const prevLevel = useRef(0);
  useEffect(() => {
    if (!view) return;
    const playedLen = view.playedPile.length;
    const mistakeStr = view.lastMistake
      ? `${view.lastMistake.byValue}:${view.lastMistake.count}`
      : undefined;
    if (prevLevel.current === 0) {
      // primeira leitura: só inicializa, sem tocar
      prevLevel.current = view.level;
      prevPlayed.current = playedLen;
      prevMistake.current = mistakeStr;
      return;
    }
    if (view.lastMistake && mistakeStr !== prevMistake.current) playError();
    else if (view.level > prevLevel.current) playSuccess();
    else if (playedLen > prevPlayed.current) playSuccess();
    prevLevel.current = view.level;
    prevPlayed.current = playedLen;
    prevMistake.current = mistakeStr;
  }, [view]);

  // ----- som de fim de jogo (vitória/derrota) -----
  const prevOver = useRef(false);
  useEffect(() => {
    if (gameOver && !prevOver.current) {
      if (gameOver.coop?.outcome === 'win') playWin();
      else playLose();
    }
    prevOver.current = !!gameOver;
  }, [gameOver]);

  if (!view || !session || !room) return <p>Aguardando estado...</p>;
  const me = session.playerId;

  const emit = (type: string, data: unknown): void => {
    socket?.emit('game:move', { roomId: session.roomId, type, data }, () => {});
  };
  const toggleMute = (): void => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };

  const all = Object.values(view.cards);
  const nameOf = (pid: string): string =>
    room.players.find((p) => p.id === pid)?.name ?? pid.slice(0, 4);
  const colorOf = (pid: string): string =>
    room.players.find((p) => p.id === pid)?.color ?? '#888';

  const played = view.playedPile
    .map((id) => view.cards[id])
    .filter((c): c is ItoCardView => !!c);
  const discarded = all.filter((c) => c.discarded);

  // votos: voter -> cardId; agrupa por carta
  const votersByCard: Record<string, Voter[]> = {};
  for (const [pid, cid] of Object.entries(view.votes)) {
    (votersByCard[cid] ??= []).push({ id: pid, name: nameOf(pid), color: colorOf(pid) });
  }
  const myVote = view.votes[me];
  // só posso jogar a MINHA carta: a barra de confirmar aparece quando voto nela.
  const intendedCard =
    myVote && view.cards[myVote]?.ownerId === me ? view.cards[myVote] : undefined;

  // clicar em QUALQUER carta não jogada = votar nela (toggle). Off-turn.
  const onCardClick = (c: ItoCardView): void => {
    if (view.step !== 'play' || c.played || c.discarded) return;
    emit('voteCard', { cardId: c.id });
  };
  const confirmPlay = (): void => {
    if (intendedCard) emit('playLowest', { cardId: intendedCard.id });
  };
  const cancelIntent = (): void => {
    if (myVote) emit('voteCard', { cardId: myVote }); // toggle off
  };

  return (
    <div className="ito-root">
      {/* cabeçalho */}
      <div className="ito-header">
        <div className="ito-theme">
          <span className="ito-theme-topic">{view.theme.topic}</span>
          <div className="ito-scale">
            <span className="ito-scale-low">1 · {view.theme.low}</span>
            <div className="ito-scale-bar" />
            <span className="ito-scale-high">{view.theme.high} · 100</span>
          </div>
        </div>
        <div className="ito-meta">
          <button
            type="button"
            className="ito-mute"
            onClick={toggleMute}
            title={muted ? 'Sons desligados' : 'Sons ligados'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <span className="ito-level">
            Nível {view.level}/{view.maxLevel}
          </span>
          <span className="ito-lives" title={`${view.lives} vidas`}>
            {view.lives > 0 ? '❤️'.repeat(view.lives) : '—'}
          </span>
        </div>
      </div>

      {view.lastMistake && (
        <div className="ito-mistake" key={`${view.lastMistake.byValue}-${view.lastMistake.count}`}>
          ⚠️ Erro! {view.lastMistake.count} carta(s) menor(es) ficaram para trás e foram
          descartadas.
        </div>
      )}

      {/* pilha jogada */}
      <div className="ito-played">
        <span className="ito-played-label">Mesa (ordem crescente):</span>
        {played.length === 0 ? (
          <span className="ito-played-empty">nada jogado ainda</span>
        ) : (
          <div className="ito-played-row">
            {played.map((c) => (
              <div key={c.id} className="ito-chip played">
                <span className="ito-chip-value">{c.value}</span>
                <span className="ito-chip-owner">{nameOf(c.ownerId)[0]}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* jogadores */}
      <div className="ito-players">
        {room.players.map((p) => {
          const cards = all
            .filter((c) => c.ownerId === p.id && !c.played && !c.discarded)
            .sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
          const mine = p.id === me;
          // destaca o painel se alguma carta dele recebeu votos
          const hasVotes = cards.some((c) => (votersByCard[c.id]?.length ?? 0) > 0);
          return (
            <div
              key={p.id}
              className={`ito-player ${mine ? 'mine' : ''} ${hasVotes ? 'intending' : ''}`}
            >
              <div className="ito-player-name">
                <span
                  className="ito-player-dot"
                  style={{ background: p.color ?? '#888' }}
                  aria-hidden
                />
                {nameOf(p.id)} {mine ? '(você)' : ''} · {cards.length} carta(s)
              </div>
              <div className="ito-cards">
                {cards.map((c) => (
                  <ItoCardItem
                    key={c.id}
                    card={c}
                    editable={mine}
                    clickable={view.step === 'play'}
                    voters={votersByCard[c.id] ?? []}
                    votedByMe={myVote === c.id}
                    onClue={(text) => emit('setClue', { cardId: c.id, text })}
                    onClick={() => onCardClick(c)}
                  />
                ))}
                {cards.length === 0 && <span className="ito-empty">—</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* controles */}
      {view.step === 'clue' && (
        <button className="ito-start-btn" onClick={() => emit('startPlay', {})}>
          ▶ Começar a jogar
        </button>
      )}
      {view.step === 'play' && !intendedCard && (
        <p className="ito-hint">
          Cliquem nas cartas para <b>votar</b> qual deve ser jogada (a sua ou a de outro). O dono
          confirma para jogar.
        </p>
      )}

      {discarded.length > 0 && (
        <div className="ito-discarded">
          <span>Descartadas (erros):</span>
          {discarded.map((c) => (
            <span key={c.id} className="ito-chip discarded">
              {c.value} ✗
            </span>
          ))}
        </div>
      )}

      {/* barra de confirmação (sua intenção de jogar a própria carta) */}
      {intendedCard && (
        <div className="ito-confirm-bar">
          <span>
            Jogar a sua carta <b>{intendedCard.value}</b>
            {intendedCard.clue ? ` (“${intendedCard.clue}”)` : ''}?
            {(votersByCard[intendedCard.id]?.length ?? 0) > 1 &&
              ` · ${votersByCard[intendedCard.id]!.length} votos`}
          </span>
          <div className="ito-confirm-buttons">
            <button type="button" className="ito-confirm-cancel" onClick={cancelIntent}>
              Cancelar
            </button>
            <button type="button" className="ito-confirm-ok" onClick={confirmPlay}>
              Confirmar jogada
            </button>
          </div>
        </div>
      )}

      <GameChat />
    </div>
  );
}

function ItoCardItem({
  card,
  editable,
  clickable,
  voters,
  votedByMe,
  onClue,
  onClick,
}: {
  card: ItoCardView;
  editable: boolean;
  clickable: boolean;
  voters: Voter[];
  votedByMe: boolean;
  onClue: (text: string) => void;
  onClick: () => void;
}): JSX.Element {
  const [text, setText] = useState(card.clue ?? '');
  const voted = voters.length > 0;
  return (
    <div
      className={`ito-card ${editable ? 'own' : 'hidden'} ${voted ? 'voted' : ''} ${
        votedByMe ? 'voted-by-me' : ''
      }`}
    >
      <div
        className={`ito-card-face ${clickable ? 'clickable' : ''}`}
        onClick={clickable ? onClick : undefined}
        role={clickable ? 'button' : undefined}
        title={clickable ? 'Clique para votar nesta carta' : undefined}
      >
        {card.value !== undefined ? (
          <span className="ito-card-value">{card.value}</span>
        ) : (
          <span className="ito-card-back">?</span>
        )}
        {voted && (
          <div className="ito-votes" title={`${voters.length} voto(s)`}>
            {voters.map((v) => (
              <span
                key={v.id}
                className="ito-vote-dot"
                style={{ background: v.color }}
                title={`${v.name} votou nesta carta`}
              >
                {v.name[0]?.toUpperCase()}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* dica: grande, em balão. Para os outros, anima ao aparecer/mudar. */}
      {editable ? (
        <div className="ito-clue-edit">
          <input
            className="ito-clue-input"
            placeholder="sua dica (sem o número)"
            value={text}
            maxLength={60}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => text.trim() !== (card.clue ?? '') && onClue(text.trim())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
          />
          {card.clue ? (
            <span key={card.clue} className="ito-saved-badge">
              ✓ dica enviada
            </span>
          ) : (
            <span className="ito-saved-hint">pressione Enter para enviar</span>
          )}
        </div>
      ) : card.clue ? (
        <div key={card.clue} className="ito-clue-bubble pop">
          {card.clue}
        </div>
      ) : (
        <div className="ito-clue-bubble empty">pensando…</div>
      )}
    </div>
  );
}
