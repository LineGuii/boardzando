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
    // Presenters (host que nao joga) nao aparecem no ranking final — sao
    // apresentadores da partida e mostrar uma linha "—" tira o foco do
    // vencedor real.
    return props.final.ranking
      .filter((r) => !r.presenter)
      .slice()
      .sort((a, b) => a.rank - b.rank);
  }, [props.final.ranking]);

  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [showWinnerGlow, setShowWinnerGlow] = useState<string | null>(null);
  /** Fase visual: 'wait' -> 'revealing' -> 'drumroll' -> 'winner'. Controla o
   *  destaque "..." piscando durante o drum roll para dar tensao. */
  const [phase, setPhase] = useState<'wait' | 'revealing' | 'drumroll' | 'winner'>('wait');
  /** Botoes de acao aparecem so 2s DEPOIS do reveal do #1 — evita que o
   *  usuario clique "Jogar de novo" antes de curtir a coroa/confete. */
  const [showActions, setShowActions] = useState(false);

  // Effect executa a cada mount ou mudanca de `seq/sorted`. StrictMode em dev
  // faz mount/unmount/mount — o cleanup abaixo cancela os timers do mount
  // fantasma; o segundo mount reagenda tudo do zero. Sem dedupe por ref (que
  // quebra exatamente por isso).
  useEffect(() => {
    const total = sorted.length;

    // Todas as linhas comecam invisiveis.
    for (const r of sorted) {
      const el = rowRefs.current.get(r.playerId);
      if (!el) continue;
      el.style.opacity = '0';
      el.style.transform = `translateY(-40px)`;
    }
    setPhase('wait');
    setShowWinnerGlow(null);
    setShowActions(false);

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
        const targetRow = sorted.find((r) => r.rank === total - i);
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

    // Drum roll antes do #1
    const drumAt = INITIAL_DELAY_MS + Math.max(0, (total - 1) * STEP_MS);
    later(drumAt, () => {
      setPhase('drumroll');
      playDrumRoll(CROWN_DRAMA_MS / 1000);
    });

    // #1 revela com ZOOM rapido: overshoot grande e assenta via spring bouncy.
    later(drumAt + CROWN_DRAMA_MS, () => {
      const winner = sorted.find((r) => r.rank === 1);
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

    // Botoes aparecem 2s depois do #1 pra dar tempo de curtir coroa + confete.
    later(drumAt + CROWN_DRAMA_MS + 2000, () => setShowActions(true));

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
          const isWinner = r.rank === 1;
          const glowing = showWinnerGlow === r.playerId;
          return (
            <div
              key={r.playerId}
              ref={(el) => {
                if (el) rowRefs.current.set(r.playerId, el);
                else rowRefs.current.delete(r.playerId);
              }}
              className={['q-final-row', isWinner && glowing ? 'first' : ''].filter(Boolean).join(' ')}
              style={{ opacity: 0, transform: 'translateY(-40px)' }}
            >
              {isWinner && glowing && <div className="q-winner-crown">👑</div>}
              <div className="q-final-pos">{r.rank}</div>
              <div className="q-final-avatar" style={{ background: r.color ?? '#334155' }}>
                {r.name[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="q-final-name">{r.name}</div>
              <div className="q-final-score">{r.score}</div>
            </div>
          );
        })}
      </div>

      {phase === 'winner' && <Confetti />}

      <div className={`q-final-actions ${showActions ? 'visible' : ''}`}>
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

/**
 * Confete festivo com fisica real: multiplos "canhoes" disparam particulas em
 * cone; cada uma tem velocidade inicial + gravidade + rotacao + fade. Muito
 * mais parecido com confete de festa do que "chove pra baixo".
 *
 * 3 bursts ao longo de 1.5s (bottom-left, bottom-right, top-center) para dar
 * cobertura de tela sem parecer scripted.
 */
const CONFETTI_COLORS = [
  '#22d3ee', '#a78bfa', '#f472b6', '#fbbf24', '#86efac', '#f87171',
  '#fde047', '#ec4899', '#38bdf8', '#c084fc',
];

interface BurstOrigin {
  /** 0..1 relativo ao viewport. */
  x: number;
  y: number;
  /** Angulo do centro do cone em graus (0 = direita, -90 = pra cima). */
  angle: number;
  /** Abertura total do cone em graus. */
  spread: number;
  /** Quantidade de particulas. */
  count: number;
  /** Delay para disparo. */
  delayMs: number;
}

const BURSTS: BurstOrigin[] = [
  { x: 0.10, y: 1.00, angle: -75, spread: 60, count: 60, delayMs: 0    }, // canhao esq -> pra cima e direita
  { x: 0.90, y: 1.00, angle: -105, spread: 60, count: 60, delayMs: 250 }, // canhao dir -> pra cima e esquerda
  { x: 0.50, y: 0.15, angle: 90, spread: 120, count: 50, delayMs: 700 }, // canhao topo -> chuva ampla pra baixo
];

function Confetti(): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const spawned: HTMLElement[] = [];
    const rafs = new Set<number>();

    const spawnBurst = (b: BurstOrigin): void => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const angleCenter = (b.angle * Math.PI) / 180;
      const angleSpread = (b.spread * Math.PI) / 180;

      for (let i = 0; i < b.count; i++) {
        const el = document.createElement('span');
        el.className = 'q-confetti-piece';
        const isCircle = Math.random() < 0.35;
        const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]!;
        el.style.background = color;
        if (isCircle) {
          el.style.borderRadius = '50%';
          el.style.width = `${7 + Math.random() * 5}px`;
          el.style.height = el.style.width;
        } else {
          el.style.width = `${6 + Math.random() * 5}px`;
          el.style.height = `${10 + Math.random() * 8}px`;
        }
        const startX = b.x * w;
        const startY = b.y * h;
        el.style.left = `${startX}px`;
        el.style.top = `${startY}px`;
        container.appendChild(el);
        spawned.push(el);

        // Vetor inicial em cone
        const angle = angleCenter + (Math.random() - 0.5) * angleSpread;
        const speed = 600 + Math.random() * 500; // 600..1100 px/s
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        const gravity = 1300 + Math.random() * 400; // px/s^2
        const drag = 0.4;                            // desacelera horizontal
        const rot0 = Math.random() * 360;
        const rotRate = (Math.random() - 0.5) * 900; // deg/s
        const duration = 3200 + Math.random() * 1800;
        const totalT = duration / 1000;

        const t0 = performance.now();
        const tick = (now: number): void => {
          const t = (now - t0) / 1000;
          if (t >= totalT) {
            el.remove();
            return;
          }
          // Integracao simples: x = vx*t*(1 - drag*t/totalT), y = vy*t + 0.5*g*t^2
          const damp = Math.max(0, 1 - (drag * t) / totalT);
          const px = vx * t * damp;
          const py = vy * t + 0.5 * gravity * t * t;
          const rot = rot0 + rotRate * t;
          // Wobble horizontal leve (papel voando)
          const wobble = Math.sin(t * 8 + rot0) * 6;
          const opacity = t > totalT - 0.6 ? Math.max(0, (totalT - t) / 0.6) : 1;
          el.style.transform = `translate(${px + wobble}px, ${py}px) rotate(${rot}deg)`;
          el.style.opacity = String(opacity);
          const r = requestAnimationFrame(tick);
          rafs.add(r);
        };
        const first = requestAnimationFrame(tick);
        rafs.add(first);
      }
    };

    const timers: number[] = [];
    for (const b of BURSTS) {
      timers.push(window.setTimeout(() => spawnBurst(b), b.delayMs));
    }

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      rafs.forEach((r) => cancelAnimationFrame(r));
      spawned.forEach((el) => el.remove());
    };
  }, []);

  return <div ref={containerRef} className="q-confetti-container" />;
}
