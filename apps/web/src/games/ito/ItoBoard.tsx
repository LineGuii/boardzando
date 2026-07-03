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

  // overlays de feedback/tema
  const [feedback, setFeedback] = useState<'success' | 'error' | null>(null);
  const [feedbackKey, setFeedbackKey] = useState(0);
  const [heartLoss, setHeartLoss] = useState(0);
  const [themeIntro, setThemeIntro] = useState(false);

  const feedbackTimer = useRef<number | undefined>(undefined);
  const themeTimer = useRef<number | undefined>(undefined);

  // ----- orquestra som + animação a cada mudança de estado -----
  const prevPlayed = useRef(0);
  const prevLives = useRef(0);
  const prevLevel = useRef(0);
  const inited = useRef(false);
  useEffect(() => {
    if (!view) return;
    const playedLen = view.playedPile.length;
    const lives = view.lives;
    const level = view.level;

    const showFeedback = (type: 'success' | 'error'): void => {
      setFeedback(type);
      setFeedbackKey((k) => k + 1);
      window.clearTimeout(feedbackTimer.current);
      feedbackTimer.current = window.setTimeout(() => setFeedback(null), 1800);
    };
    const showThemeIntro = (): void => {
      setThemeIntro(true);
      window.clearTimeout(themeTimer.current);
      themeTimer.current = window.setTimeout(() => setThemeIntro(false), 5000);
    };

    if (!inited.current) {
      inited.current = true;
      showThemeIntro(); // primeira tela de tema
    } else if (level !== prevLevel.current) {
      // novo nível (novo tema): tela de 5s; se também perdeu vida, mostra a quebra por cima
      showThemeIntro();
      if (lives < prevLives.current) {
        setHeartLoss(prevLives.current - lives);
        showFeedback('error');
        playError();
      } else {
        playSuccess();
      }
    } else if (lives < prevLives.current) {
      setHeartLoss(prevLives.current - lives);
      showFeedback('error');
      playError();
    } else if (playedLen > prevPlayed.current) {
      showFeedback('success');
      playSuccess();
    }

    prevPlayed.current = playedLen;
    prevLives.current = lives;
    prevLevel.current = level;
  }, [view]);

  // limpa timers ao desmontar
  useEffect(
    () => () => {
      window.clearTimeout(feedbackTimer.current);
      window.clearTimeout(themeTimer.current);
    },
    [],
  );

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

  // placar único: todas as cartas reveladas (jogadas certas + descartadas por
  // erro), em ordem crescente de valor. Assim acertos e erros ficam no mesmo lugar.
  const resolved = all
    .filter((c) => c.played || c.discarded)
    .sort((a, b) => (a.value ?? 0) - (b.value ?? 0));

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
          <span
            className={`ito-lives ${feedback === 'error' ? 'shake' : ''}`}
            title={`${view.lives} vidas`}
          >
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

      {/* placar único: acertos e erros juntos, em ordem crescente */}
      <div className="ito-played">
        <span className="ito-played-label">Placar (ordem crescente):</span>
        {resolved.length === 0 ? (
          <span className="ito-played-empty">nada revelado ainda</span>
        ) : (
          <div className="ito-played-row">
            {resolved.map((c) => (
              <div
                key={c.id}
                className={`ito-chip ${c.discarded ? 'discarded' : 'played'}`}
                title={c.discarded ? 'Erro: ficou para trás' : 'Jogada na ordem'}
              >
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

      {/* feedback grande e explícito de acerto/erro (+ vida sendo destruída) */}
      {feedback && (
        <div key={feedbackKey} className={`ito-feedback ${feedback}`}>
          {feedback === 'success' ? (
            <div className="ito-feedback-inner success">
              <span className="ito-feedback-icon">✓</span>
              <span className="ito-feedback-text">Acertou!</span>
              <span className="ito-feedback-sub">carta na ordem certa</span>
            </div>
          ) : (
            <div className="ito-feedback-inner error">
              <span className="ito-heartbreak" aria-hidden>
                <span className="ito-heartbreak-emoji">💔</span>
                <span className="ito-shard s1" />
                <span className="ito-shard s2" />
                <span className="ito-shard s3" />
              </span>
              <span className="ito-feedback-text">Erro!</span>
              <span className="ito-feedback-sub">
                −{heartLoss} vida{heartLoss > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      )}

      {/* tela de novo tema (5s) antes das cartas */}
      {themeIntro && (
        <div className="ito-theme-intro">
          <div className="ito-theme-intro-card">
            <span className="ito-theme-intro-eyebrow">Novo tema · Nível {view.level}</span>
            <h2 className="ito-theme-intro-topic">{view.theme.topic}</h2>
            <div className="ito-theme-intro-scale">
              <span>1 · {view.theme.low}</span>
              <div className="ito-theme-intro-bar" />
              <span>{view.theme.high} · 100</span>
            </div>
            <p className="ito-theme-intro-hint">
              Memorizem a escala… as cartas chegam em instantes!
            </p>
            <div className="ito-theme-intro-progress">
              <span />
            </div>
          </div>
        </div>
      )}
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
