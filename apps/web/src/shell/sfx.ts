/**
 * Efeitos sonoros sintetizados via Web Audio (sem arquivos de áudio). Tons
 * curtos para acerto/erro e jingles para vitória/derrota. Respeita um mute
 * persistido em localStorage.
 */

let ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const Ctor: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

let muted = false;
try {
  muted = localStorage.getItem('boardzando-sfx-muted') === '1';
} catch {
  /* sem localStorage */
}

export function isMuted(): boolean {
  return muted;
}
export function setMuted(m: boolean): void {
  muted = m;
  try {
    localStorage.setItem('boardzando-sfx-muted', m ? '1' : '0');
  } catch {
    /* ignora */
  }
}

/** Toca um tom simples com envelope (ataque rápido, decaimento exponencial). */
function tone(
  freq: number,
  startOffset: number,
  duration: number,
  type: OscillatorType = 'sine',
  gain = 0.18,
): void {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(g);
  g.connect(c.destination);
  const t0 = c.currentTime + startOffset;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/** Acerto: duas notas ascendentes alegres. */
export function playSuccess(): void {
  if (muted) return;
  tone(660, 0, 0.13, 'triangle', 0.2);
  tone(880, 0.09, 0.18, 'triangle', 0.2);
}

/** Erro: zumbido grave descendente. */
export function playError(): void {
  if (muted) return;
  tone(190, 0, 0.26, 'sawtooth', 0.16);
  tone(120, 0.09, 0.32, 'sawtooth', 0.14);
}

/** Vitória: arpejo ascendente. */
export function playWin(): void {
  if (muted) return;
  [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.22, 'triangle', 0.22));
}

/** Derrota: descida melancólica. */
export function playLose(): void {
  if (muted) return;
  [392, 330, 262].forEach((f, i) => tone(f, i * 0.17, 0.38, 'sawtooth', 0.18));
}

/**
 * "Quá!" — nota nasal (sawtooth) que cai rapidinho, imitando o som de um pato.
 * Duas notas curtas em sequência ficam mais convincentes.
 */
export function playQuack(): void {
  if (muted) return;
  tone(440, 0, 0.09, 'sawtooth', 0.22);
  tone(330, 0.08, 0.14, 'sawtooth', 0.2);
}

/** Vitória-de-pato: 3 quacks ascendentes. */
export function playQuackWin(): void {
  if (muted) return;
  [{ f: 330, t: 0 }, { f: 440, t: 0.15 }, { f: 587, t: 0.32 }].forEach(({ f, t }) => {
    tone(f, t, 0.1, 'sawtooth', 0.22);
    tone(f * 0.75, t + 0.09, 0.14, 'sawtooth', 0.18);
  });
}
