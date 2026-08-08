import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { animate, createSpring } from 'animejs';
import type { QuizFinalPayload } from '@boardzando/contracts';
import { playDrumRoll, playFanfare } from '../audio/quizAudio';

interface Props {
  final: QuizFinalPayload;
  isHost: boolean;
  onRestart: () => void;
  onLeave: () => void;
}

const ROW_H = 74;
const ROW_GAP = 10;
const STEP_MS = 1400;
const CROWN_DRAMA_MS = 2400;

/**
 * Reveal do fim de partida. Cada linha comeca no centro da tela (opacidade 0)
 * e e revelada do ULTIMO ao PRIMEIRO com um spring "strong" (mesmo perfil do
 * ranking entre rodadas, so mais lento). Drum roll + fanfare no #1.
 */
export function FinalReveal(props: Props): JSX.Element {
  const sorted = useMemo(() => {
    const players = props.final.ranking.filter((r) => !r.presenter).sort((a, b) => a.rank - b.rank);
    const presenters = props.final.ranking.filter((r) => r.presenter);
    return [...players, ...presenters];
  }, [props.final.ranking]);

  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const seenSeq = useRef<number>(-1);
  const [showWinnerGlow, setShowWinnerGlow] = useState<string | null>(null);

  useEffect(() => {
    if (seenSeq.current === props.final.seq) return;
    seenSeq.current = props.final.seq;

    const playersOnly = sorted.filter((r) => !r.presenter);
    const total = playersOnly.length;

    // Todas as linhas comecam com opacidade 0 e a 40px acima do destino
    for (const r of sorted) {
      const el = rowRefs.current.get(r.playerId);
      if (!el) continue;
      el.style.opacity = '0';
      el.style.transform = `translateY(-40px)`;
    }

    const timers: number[] = [];

    // Reveal do ultimo ao primeiro (rank descendente do fim)
    for (let i = 0; i < total - 1; i++) {
      const revealAt = i * STEP_MS;
      const t = window.setTimeout(() => {
        const targetRow = playersOnly.find((r) => r.rank === total - i);
        if (!targetRow) return;
        const el = rowRefs.current.get(targetRow.playerId);
        if (!el) return;
        // Indice DOM (posicao vertical final) — usa a ordem `sorted`
        const domIdx = sorted.indexOf(targetRow);
        animate(el, {
          translateY: [-40, domIdx * (ROW_H + ROW_GAP)],
          opacity: [0, 1],
          ease: createSpring({ mass: 1, stiffness: 200, damping: 18, velocity: 0 }),
        });
      }, revealAt);
      timers.push(t);
    }

    // Presenters aparecem junto com o primeiro nao-vencedor
    for (const r of sorted) {
      if (!r.presenter) continue;
      const el = rowRefs.current.get(r.playerId);
      if (!el) continue;
      const domIdx = sorted.indexOf(r);
      const t = window.setTimeout(() => {
        animate(el, {
          translateY: [-40, domIdx * (ROW_H + ROW_GAP)],
          opacity: [0, 0.7],
          ease: createSpring({ mass: 1, stiffness: 180, damping: 20 }),
        });
      }, 200);
      timers.push(t);
    }

    // Drum roll antes do #1
    const drumAt = Math.max(0, (total - 1) * STEP_MS);
    timers.push(window.setTimeout(() => playDrumRoll(CROWN_DRAMA_MS / 1000), drumAt));

    // #1 revela com spring MAIS forte + fanfare + destaque dourado
    timers.push(window.setTimeout(() => {
      const winner = playersOnly.find((r) => r.rank === 1);
      if (!winner) return;
      const el = rowRefs.current.get(winner.playerId);
      if (!el) return;
      const domIdx = sorted.indexOf(winner);
      animate(el, {
        translateY: [-80, domIdx * (ROW_H + ROW_GAP)],
        opacity: [0, 1],
        scale: [0.6, 1],
        ease: createSpring({ mass: 1.2, stiffness: 300, damping: 14 }),
      });
      playFanfare();
      setShowWinnerGlow(winner.playerId);
    }, drumAt + CROWN_DRAMA_MS));

    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [sorted, props.final.seq]);

  const listHeight = sorted.length * (ROW_H + ROW_GAP);

  return (
    <div className="q-final">
      <div className="q-final-title">Fim da partida</div>

      <div className="q-final-list" style={{ height: listHeight }}>
        {sorted.map((r) => {
          const isWinner = r.rank === 1 && !r.presenter;
          const glowing = showWinnerGlow === r.playerId;
          return (
            <div
              key={r.playerId}
              ref={(el) => {
                if (el) rowRefs.current.set(r.playerId, el);
                else rowRefs.current.delete(r.playerId);
              }}
              className={[
                'q-final-row',
                isWinner && glowing ? 'first' : '',
                r.presenter ? 'presenter' : '',
              ].filter(Boolean).join(' ')}
              style={{ opacity: 0, transform: 'translateY(-40px)' }}
            >
              {isWinner && glowing && <div className="q-winner-crown">👑</div>}
              <div className="q-final-pos">{r.presenter ? '🎤' : r.rank}</div>
              <div className="q-final-avatar" style={{ background: r.color ?? '#334155' }}>
                {r.name[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="q-final-name">{r.name}</div>
              <div className="q-final-score">{r.presenter ? '—' : r.score}</div>
            </div>
          );
        })}
      </div>

      <div className="q-final-actions">
        {props.isHost && (
          <button className="q-btn" style={{ maxWidth: 260 }} onClick={props.onRestart}>
            Jogar de novo
          </button>
        )}
        <button className="q-btn secondary" style={{ maxWidth: 260 }} onClick={props.onLeave}>
          Sair da sala
        </button>
      </div>
    </div>
  );
}
