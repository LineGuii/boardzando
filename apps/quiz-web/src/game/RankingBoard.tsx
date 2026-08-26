import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { animate, createSpring } from 'animejs';
import type { QuizRevealPayload } from '@boardzando/contracts';
import { playAnswerSfx } from './QuestionScreen';

interface Props {
  reveal: QuizRevealPayload;
  myPlayerId: string;
  correctAnswerText: string;
  isHost: boolean;
  onSkip: () => void;
  onTogglePause: (paused: boolean) => void;
  clockOffset: number;
}

const ROW_H = 64;
const ROW_GAP = 8;

/**
 * Ranking apos cada rodada. Cada linha e um <div> absolutamente posicionado,
 * ancorado por `playerId` (React key), com transform animado via animejs.
 * Estrategia:
 *   1. React desenha a lista SEM transform inline (ou com a posicao anterior).
 *   2. Um useEffect roda para cada `seq` novo: para cada jogador, calcula a
 *      posicao de origem (o valor atual do transform, ou rankBefore no 1o
 *      reveal) e a posicao final (rank), e chama `animate(el, { translateY:
 *      [from, to], ease: createSpring(...) })`.
 *   3. As posicoes atuais sao memorizadas em um ref para sobreviver a rodadas
 *      subsequentes.
 * O spring "strong" tem stiffness alto e damping moderado — travel firme com
 * bounce sutil no fim.
 */
export function RankingBoard(props: Props): JSX.Element {
  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const currentPositions = useRef<Map<string, number>>(new Map());
  const seenSeq = useRef<number>(-1);
  const [now, setNow] = useState<number>(props.reveal.nextAt);

  const sorted = useMemo(() => {
    // Ordena por playerId — a posicao visual e SEMPRE controlada pelo
    // transform, nunca pela ordem do DOM. Isso mantem a key estavel entre
    // rodadas e permite o spring animar `from` -> `to`.
    // Presenters (host que nao joga) somem do ranking — sao apenas
    // apresentadores e uma linha "—" atrapalha a leitura do placar.
    return props.reveal.ranking
      .filter((r) => !r.presenter)
      .slice()
      .sort((a, b) => a.playerId.localeCompare(b.playerId));
  }, [props.reveal.ranking]);

  // Animacao spring a cada `seq` novo
  useEffect(() => {
    if (seenSeq.current === props.reveal.seq) return;
    seenSeq.current = props.reveal.seq;

    // SFX para o proprio jogador
    const me = props.reveal.ranking.find((r) => r.playerId === props.myPlayerId);
    if (me && me.lastCorrect !== undefined) playAnswerSfx(me.lastCorrect);

    for (const r of props.reveal.ranking) {
      const el = rowRefs.current.get(r.playerId);
      if (!el) continue;
      const to = (r.rank - 1) * (ROW_H + ROW_GAP);
      const from = currentPositions.current.get(r.playerId)
        ?? ((r.rankBefore ?? r.rank) - 1) * (ROW_H + ROW_GAP);
      currentPositions.current.set(r.playerId, to);
      // Se ja esta no lugar, pula animacao
      if (Math.abs(from - to) < 0.5) {
        el.style.transform = `translateY(${to}px)`;
        continue;
      }
      animate(el, {
        translateY: [from, to],
        // Spring "strong": travel rapido com bounce firme no assentamento
        ease: createSpring({ mass: 1, stiffness: 240, damping: 16, velocity: 0 }),
      });
    }
  }, [props.reveal.seq, props.reveal.ranking, props.myPlayerId]);

  // Countdown ate a proxima pergunta
  useEffect(() => {
    setNow(Date.now() + props.clockOffset);
    const id = window.setInterval(() => setNow(Date.now() + props.clockOffset), 250);
    return () => window.clearInterval(id);
  }, [props.reveal.seq, props.clockOffset]);

  const remain = Math.max(0, Math.ceil((props.reveal.nextAt - now) / 1000));
  const listHeight = props.reveal.ranking.length * (ROW_H + ROW_GAP);

  return (
    <div className="q-ranking">
      <h2>Placar da rodada {props.reveal.index + 1}</h2>
      <div className="q-reveal-hint">
        Resposta correta: <span className="correct-answer">{props.correctAnswerText}</span>
      </div>

      <div ref={listRef} className="q-ranking-list" style={{ height: listHeight }}>
        {sorted.map((r) => {
          // Posicao inicial no DOM = rankBefore (pra 1o reveal) ou posicao ja
          // memorizada. O effect assume dai.
          const initialIdx = (currentPositions.current.get(r.playerId) !== undefined)
            ? currentPositions.current.get(r.playerId)! / (ROW_H + ROW_GAP)
            : ((r.rankBefore ?? r.rank) - 1);
          const move = (r.rankBefore ?? r.rank) - r.rank;
          const moveIcon = move > 0 ? '▲' : move < 0 ? '▼' : '·';
          const moveClass = move > 0 ? 'up' : move < 0 ? 'down' : '';
          return (
            <div
              key={r.playerId}
              ref={(el) => {
                if (el) rowRefs.current.set(r.playerId, el);
                else rowRefs.current.delete(r.playerId);
              }}
              className={['q-rank-row', r.rank === 1 ? 'first' : ''].filter(Boolean).join(' ')}
              style={{ transform: `translateY(${initialIdx * (ROW_H + ROW_GAP)}px)` }}
            >
              <span className="q-rank-pos">{r.rank}</span>
              <span className="q-rank-avatar" style={{ background: r.color ?? '#334155' }}>
                {r.name[0]?.toUpperCase() ?? '?'}
              </span>
              <span className="q-rank-name">
                {r.name}{r.playerId === props.myPlayerId ? ' (voce)' : ''}
              </span>
              <span className={`q-rank-move ${moveClass}`}>{moveIcon}</span>
              <span className={`q-rank-gain ${(r.lastGain ?? 0) > 0 ? 'pos' : 'zero'}`}>
                {(r.lastGain ?? 0) > 0 ? `+${r.lastGain}` : '0'}
              </span>
              <span className="q-rank-score">{r.score}</span>
            </div>
          );
        })}
      </div>

      <div style={{ textAlign: 'center', marginTop: 18, color: '#a5b4fc', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
        {props.reveal.paused ? (
          <strong style={{ color: '#fbbf24' }}>⏸ Pausado pelo host</strong>
        ) : (
          <span>Proxima pergunta em {remain}s</span>
        )}
        {props.isHost && (
          <>
            {props.reveal.paused ? (
              <button className="q-btn small" onClick={() => props.onTogglePause(false)}>Retomar</button>
            ) : (
              <button className="q-btn small secondary" onClick={() => props.onTogglePause(true)}>Pausar</button>
            )}
            <button className="q-btn small secondary" onClick={props.onSkip}>Pular</button>
          </>
        )}
      </div>
    </div>
  );
}
