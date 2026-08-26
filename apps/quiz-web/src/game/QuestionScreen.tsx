import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { QuizCover } from './QuizCover';
import type { QuizQuestionPublic } from '@boardzando/contracts';
import { useQuiz } from '../net/store';
import { QuizAudioPlayer, playCorrect, playTick, playWrong } from '../audio/quizAudio';
import { SpotifyPlayerWrapper } from '../audio/spotifyPlayer';
import { isLoggedIn as isSpotifyLoggedIn } from '../audio/spotifyAuth';

interface Props {
  question: QuizQuestionPublic;
  isPresenter: boolean;
  audioMode: 'remote' | 'presenter';
  isHost: boolean;
  waitingCount: number;
  totalPlayers: number;
}

const LETTERS = ['A', 'B', 'C', 'D'];

/**
 * Tela ativa da pergunta. Responsavel por:
 * - Agendar o audio no `serverStartAt` (converte para relogio local via offset).
 * - Rodar o timer visual de 30s baseado no `serverStartAt`.
 * - Emitir `quiz:answer` no clique. Bloqueia apos responder.
 * - No `presenter` (audioMode='presenter'), so o host toca audio; os demais so
 *   veem UI silenciosa.
 * - Host que nao joga (`isPresenter`) NAO recebe correctIndex — a tela dele
 *   costuma ir para uma TV e nao pode entregar a resposta antes do reveal.
 */
export function QuestionScreen(props: Props): JSX.Element {
  const socket = useQuiz((s) => s.socket);
  const session = useQuiz((s) => s.session);
  const clockOffset = useQuiz((s) => s.clockOffset);
  const myAnswer = useQuiz((s) => s.myAnswer);
  const setMyAnswer = useQuiz((s) => s.setMyAnswer);
  const phase = useQuiz((s) => s.phase);

  const playerRef = useRef<QuizAudioPlayer | null>(null);
  const spotifyRef = useRef<SpotifyPlayerWrapper | null>(null);
  const [remainingMs, setRemainingMs] = useState<number>(props.question.answerWindowMs);
  const [audioError, setAudioError] = useState<string | undefined>();
  const lastTickSecRef = useRef<number>(999);

  const isSpotify = props.question.audioUrl.startsWith('spotify:track:');
  const spotifyTrackId = isSpotify ? props.question.audioUrl.split(':').pop()! : '';

  // Setup audio. Este bloco cria o player, faz preload e agenda o play.
  useEffect(() => {
    // Modo "presenter": so o host toca; os outros ficam mudos
    const shouldPlay =
      props.audioMode === 'remote' || (props.audioMode === 'presenter' && props.isHost);
    if (!shouldPlay) return;

    let cancelled = false;
    setAudioError(undefined);

    if (isSpotify) {
      // Reprodutor Spotify — requer login PKCE. Se nao logou, avisa e sai.
      if (!isSpotifyLoggedIn()) {
        setAudioError('Faca login no Spotify em /?admin antes de comecar.');
        return;
      }
      if (!spotifyRef.current) spotifyRef.current = new SpotifyPlayerWrapper();
      const sp = spotifyRef.current;
      const startSec = props.question.startSec;
      const fireLocalMs = props.question.serverStartAt - clockOffset;
      void (async () => {
        try {
          await sp.connect();
          if (cancelled) return;
          await sp.preload(spotifyTrackId, startSec);
          if (cancelled) return;
          socket?.emit('quiz:ready', {
            roomId: session?.roomId ?? '',
            questionIndex: props.question.index,
          });
          await sp.resumeAt(fireLocalMs);
        } catch (e) {
          if (!cancelled) setAudioError((e as Error).message);
        }
      })();
      return () => {
        cancelled = true;
        void sp.stop();
      };
    }

    // Fonte local (HTMLAudioElement)
    if (!playerRef.current) playerRef.current = new QuizAudioPlayer();
    const player = playerRef.current;
    void player.preload(props.question.audioUrl).then(() => {
      if (cancelled) return;
      socket?.emit('quiz:ready', {
        roomId: session?.roomId ?? '',
        questionIndex: props.question.index,
      });
      player.schedulePlay(props.question.serverStartAt, props.question.startSec, clockOffset);
    });
    return () => {
      cancelled = true;
      player.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.question.index]);

  useEffect(() => () => {
    playerRef.current?.stop();
    spotifyRef.current?.disconnect();
  }, []);

  // Timer visual — atualiza a cada 100ms. Baseado no relogio do servidor.
  useEffect(() => {
    if (phase !== 'playing') return;
    const tick = (): void => {
      const nowServer = Date.now() + clockOffset;
      const elapsed = Math.max(0, nowServer - props.question.serverStartAt);
      const rem = Math.max(0, props.question.answerWindowMs - elapsed);
      setRemainingMs(rem);
      const remSec = Math.ceil(rem / 1000);
      if (remSec <= 5 && remSec > 0 && remSec !== lastTickSecRef.current) {
        lastTickSecRef.current = remSec;
        playTick();
      }
    };
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [phase, props.question.index, props.question.serverStartAt, props.question.answerWindowMs, clockOffset]);

  const answer = (idx: number): void => {
    if (myAnswer !== undefined) return;
    if (props.isPresenter) return;
    if (!socket || !session) return;
    setMyAnswer(idx);
    // SFX imediato para feedback local; server responde ok/erro
    if (props.question.correctIndex !== undefined) {
      // Presenter host nunca chega aqui, mas por completude
    }
    socket.emit(
      'quiz:answer',
      { roomId: session.roomId, questionIndex: props.question.index, optionIndex: idx },
      (res) => {
        if (!res.ok) {
          // Rollback local — resposta rejeitada (ja terminou etc.)
          setMyAnswer(-1 as unknown as number);
        }
      },
    );
    // Feedback local sonoro leve
    playTick();
  };

  const totalMs = props.question.answerWindowMs;
  const pct = useMemo(() => (remainingMs / totalMs) * 100, [remainingMs, totalMs]);
  const remSec = Math.ceil(remainingMs / 1000);

  // Durante playing, NUNCA destacamos a resposta correta — nem para o host
  // apresentador. O server tambem nao envia correctIndex nessa fase; esta
  // constante fica false para reforcar o contrato na UI.
  const showCorrect = false;

  const answeredCount = props.totalPlayers - props.waitingCount;

  return (
    <div className="q-question">
      <div className="q-question-head">
        <div className="q-round-idx">
          Pergunta {props.question.index + 1} / {props.question.total}
        </div>
        {props.question.coverUrl && <QuizCover url={props.question.coverUrl} />}
      </div>

      <div className="q-question-text">{props.question.questionText}</div>

      <div className="q-timer-wrap">
        <div className="q-timer">
          <div className="q-timer-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="q-timer-count">{remSec}</div>
      </div>

      {audioError && (
        <div className="q-alert" style={{ marginBottom: 12 }}>
          <span>Audio: {audioError}</span>
          <button onClick={() => setAudioError(undefined)}>×</button>
        </div>
      )}

      <div className="q-options">
        {props.question.options.map((label, i) => {
          const chosen = myAnswer === i;
          const isCorrect = showCorrect && props.question.correctIndex === i;
          const cls = [
            'q-option',
            chosen ? 'chosen' : '',
            isCorrect ? 'correct' : '',
          ].filter(Boolean).join(' ');
          return (
            <button
              key={i}
              data-idx={i}
              className={cls}
              disabled={myAnswer !== undefined || props.isPresenter}
              onClick={() => answer(i)}
            >
              <span className="q-opt-badge">{LETTERS[i]}</span>
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      <div className="q-status-line">
        {props.isPresenter
          ? `Voce esta apresentando. Aguardando ${props.waitingCount} de ${props.totalPlayers} respostas...`
          : myAnswer !== undefined
            ? `Resposta enviada. ${answeredCount}/${props.totalPlayers} responderam.`
            : `Escolha uma alternativa. ${answeredCount}/${props.totalPlayers} ja responderam.`}
      </div>

      {props.audioMode === 'presenter' && !props.isHost && (
        <div className="q-presenter-note">🔊 Audio no dispositivo do host</div>
      )}
      {props.isPresenter && (
        <div className="q-presenter-note">
          🎤 Modo apresentador — projete esta tela; os jogadores respondem no celular
        </div>
      )}
    </div>
  );
}

// Helper exportado para o hook de correto/errado apos reveal
export function playAnswerSfx(correct: boolean): void {
  if (correct) playCorrect(); else playWrong();
}
