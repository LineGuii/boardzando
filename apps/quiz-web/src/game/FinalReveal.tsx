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
/** Delay antes do primeiro reveal — deixa o publico absorver a tela. */
const INITIAL_DELAY_MS = 1500;
/** Tempo entre revelacoes dos nao-vencedores (do ultimo pro segundo lugar). */
const STEP_MS = 1800;
/** Drum roll ANTES do #1 aparecer. Mais longo = mais suspense. */
const CROWN_DRAMA_MS = 4500;

/**
 * Reveal do fim de partida. Cada linha comeca invisivel (opacity 0) e some do
 * layout final (translateY negativo). E revelada DO ULTIMO AO PRIMEIRO com
 * spring. O #1 leva um drum roll mais longo + zoom rapido (scale 0.2 -> 1.4 ->
 * 1) + fanfare + coroa dourada com brilho pulsante.
 *
 * A tela NAO some sozinha: nao ha auto-dismiss nem timer para reset. Ela fica
 * ate o host decidir "Jogar de novo" ou o usuario clicar "Sair da sala".
 */
export function FinalReveal(props: Props): JSX.Element {
  const sorted = useMemo(() => {
    const players = props.final.ranking.filter((r) => !r.presenter).sort((a, b) => a.rank - b.rank);
    const presenters = props.final.ranking.filter((r) => r.presenter);
    return [...players, ...presenters];
  }, [props.final.ranking]);

  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [showWinnerGlow, setShowWinnerGlow] = useState<string | null>(null);
  /** Fase visual: 'wait' -> 'revealing' -> 'drumroll' -> 'winner'. Controla o
   *  destaque "..." piscando durante o drum roll para dar tensao. */
  const [phase, setPhase] = useState<'wait' | 'revealing' | 'drumroll' | 'winner'>('wait');

  // Effect executa a cada mount ou mudanca de `seq/sorted`. StrictMode em dev
  // faz mount/unmount/mount — o cleanup abaixo cancela os timers do mount
  // fantasma; o segundo mount reagenda tudo do zero. Sem dedupe por ref (que
  // quebra exatamente por isso).
  useEffect(() => {
    const playersOnly = sorted.filter((r) => !r.presenter);
    const total = playersOnly.length;

    // Todas as linhas comecam invisiveis.
    for (const r of sorted) {
      const el = rowRefs.current.get(r.playerId);
      if (!el) continue;
      el.style.opacity = '0';
      el.style.transform = `translateY(-40px)`;
    }
    setPhase('wait');
    setShowWinnerGlow(null);

    const timers: number[] = [];
    const later = (ms: number, fn: () => void): void => {
      timers.push(window.setTimeout(fn, ms));
    };

    // Delay inicial para dar peso a "chegada" da tela.
    later(INITIAL_DELAY_MS, () => setPhase('revealing'));

    // Reveal do ultimo ao penultimo colocado (rank total, total-1, ..., 2).
    for (let i = 0; i < total - 1; i++) {
      const revealAt = INITIAL_DELAY_MS + i * STEP_MS;
      later(revealAt, () => {
        const targetRow = playersOnly.find((r) => r.rank === total - i);
        if (!targetRow) return;
        const el = rowRefs.current.get(targetRow.playerId);
        if (!el) return;
        const domIdx = sorted.indexOf(targetRow);
        animate(el, {
          translateY: [-40, domIdx * (ROW_H + ROW_GAP)],
          opacity: [0, 1],
          ease: createSpring({ mass: 1, stiffness: 200, damping: 18, velocity: 0 }),
        });
      });
    }

    // Presenters entram junto com a fase de revelacao (nao interessam ao suspense).
    for (const r of sorted) {
      if (!r.presenter) continue;
      const el = rowRefs.current.get(r.playerId);
      if (!el) continue;
      const domIdx = sorted.indexOf(r);
      later(INITIAL_DELAY_MS + 200, () => {
        animate(el, {
          translateY: [-40, domIdx * (ROW_H + ROW_GAP)],
          opacity: [0, 0.7],
          ease: createSpring({ mass: 1, stiffness: 180, damping: 20 }),
        });
      });
    }

    // Drum roll antes do #1
    const drumAt = INITIAL_DELAY_MS + Math.max(0, (total - 1) * STEP_MS);
    later(drumAt, () => {
      setPhase('drumroll');
      playDrumRoll(CROWN_DRAMA_MS / 1000);
    });

    // #1 revela com ZOOM rapido: overshoot grande e assenta via spring bouncy.
    later(drumAt + CROWN_DRAMA_MS, () => {
      const winner = playersOnly.find((r) => r.rank === 1);
      if (!winner) return;
      const el = rowRefs.current.get(winner.playerId);
      if (!el) return;
      const domIdx = sorted.indexOf(winner);
      // Zoom "punch": comeca minusculo, overshoot para 1.4 e assenta em 1.
      animate(el, {
        translateY: [0, domIdx * (ROW_H + ROW_GAP)],
        opacity: [0, 1],
        scale: [0.2, 1],
        ease: createSpring({ mass: 1.2, stiffness: 380, damping: 12, velocity: 0 }),
      });
      playFanfare();
      setShowWinnerGlow(winner.playerId);
      setPhase('winner');
    });

    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [sorted, props.final.seq]);

  const listHeight = sorted.length * (ROW_H + ROW_GAP);

  return (
    <div className="q-final">
      <div className={`q-final-title ${phase === 'drumroll' ? 'drumroll' : ''}`}>
        {phase === 'drumroll' ? 'E O CAMPEÃO É...' : 'Fim da partida'}
      </div>

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

      {phase === 'winner' && <Confetti />}

      <div className="q-final-actions">
        {props.isHost ? (
          <>
            <button className="q-btn" style={{ maxWidth: 260 }} onClick={props.onRestart}>
              Jogar de novo
            </button>
            <button className="q-btn secondary" style={{ maxWidth: 260 }} onClick={props.onLeave}>
              Sair da sala
            </button>
          </>
        ) : (
          <>
            <div className="q-final-wait">Aguardando o host decidir o próximo passo…</div>
            <button
              className="q-btn small secondary"
              style={{ marginTop: 12, opacity: 0.7 }}
              onClick={props.onLeave}
            >
              Sair mesmo assim
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Confetti(): JSX.Element {
  const pieces = useMemo(() => {
    const colors = ['#22d3ee', '#a78bfa', '#f472b6', '#fbbf24', '#86efac', '#f87171', '#fde047'];
    return Array.from({ length: 80 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 1.2,
      duration: 3 + Math.random() * 3,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
  }, []);
  return (
    <div className="q-confetti">
      {pieces.map((p) => (
        <span
          key={p.id}
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
