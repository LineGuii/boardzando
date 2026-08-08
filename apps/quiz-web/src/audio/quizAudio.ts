/**
 * Reproducao sincronizada de audio. `schedulePlay` calcula quanto falta para o
 * `fireAtServerMs` (relogio do servidor) usando o offset conhecido e agenda um
 * `setTimeout` local; se o momento ja passou, dispara imediatamente com o
 * offset em `currentTime` para "pular para o meio" do trecho.
 */

const MUTE_KEY = 'boardzando-quiz-muted';

export function isMuted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}

export function setMuted(v: boolean): void {
  try { localStorage.setItem(MUTE_KEY, v ? '1' : '0'); } catch { /* ignore */ }
}

export class QuizAudioPlayer {
  private audio?: HTMLAudioElement;
  private scheduledTimeout?: number;
  private currentUrl?: string;

  /** Pre-carrega um novo audio (interrompendo qualquer atual). */
  preload(url: string): Promise<void> {
    this.stop();
    return new Promise((resolve) => {
      const a = new Audio(url);
      a.preload = 'auto';
      a.crossOrigin = 'anonymous';
      a.muted = isMuted();
      const done = (): void => {
        a.removeEventListener('canplaythrough', done);
        a.removeEventListener('error', done);
        resolve();
      };
      a.addEventListener('canplaythrough', done, { once: true });
      a.addEventListener('error', done, { once: true });
      // Fallback: nem todo browser dispara canplaythrough previsivelmente
      setTimeout(done, 2500);
      a.load();
      this.audio = a;
      this.currentUrl = url;
    });
  }

  /**
   * Agenda play para o instante `fireAtServerMs` (Date.now do servidor).
   * `clockOffset` = serverT - clientT.
   */
  schedulePlay(fireAtServerMs: number, startSec: number, clockOffset: number): void {
    if (!this.audio) return;
    const nowLocal = Date.now();
    const fireLocal = fireAtServerMs - clockOffset;
    const wait = fireLocal - nowLocal;
    const audio = this.audio;
    const doPlay = (): void => {
      const skew = (Date.now() + clockOffset) - fireAtServerMs;
      // Se ja passou, pula para o meio do trecho
      const seek = Math.max(0, startSec + Math.max(0, skew) / 1000);
      try {
        audio.currentTime = seek;
        const p = audio.play();
        if (p && typeof p.then === 'function') p.catch(() => { /* autoplay bloqueado */ });
      } catch { /* ignore */ }
    };
    if (wait <= 0) {
      doPlay();
    } else {
      this.scheduledTimeout = window.setTimeout(doPlay, wait);
    }
  }

  stop(): void {
    if (this.scheduledTimeout) {
      clearTimeout(this.scheduledTimeout);
      this.scheduledTimeout = undefined;
    }
    if (this.audio) {
      try { this.audio.pause(); } catch { /* ignore */ }
      this.audio = undefined;
    }
    this.currentUrl = undefined;
  }

  setMuted(v: boolean): void {
    setMuted(v);
    if (this.audio) this.audio.muted = v;
  }

  get url(): string | undefined { return this.currentUrl; }
}

// ---------- SFX sintetizado (drum roll do final + bipes) ----------

let sharedCtx: AudioContext | null = null;
function ctx(): AudioContext {
  if (!sharedCtx) sharedCtx = new AudioContext();
  return sharedCtx;
}

function tone(freq: number, offset: number, dur: number, type: OscillatorType = 'sine', gain = 0.15): void {
  if (isMuted()) return;
  try {
    const ac = ctx();
    const t0 = ac.currentTime + offset;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(ac.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  } catch { /* AudioContext bloqueado */ }
}

export function playCorrect(): void {
  tone(880, 0, 0.15, 'triangle');
  tone(1320, 0.12, 0.2, 'triangle');
}

export function playWrong(): void {
  tone(200, 0, 0.25, 'sawtooth', 0.12);
}

export function playTick(): void {
  tone(1400, 0, 0.04, 'square', 0.05);
}

/** Drum-roll do reveal final (curto e crescente). */
export function playDrumRoll(seconds = 2): void {
  if (isMuted()) return;
  const steps = Math.floor(seconds * 12);
  for (let i = 0; i < steps; i++) {
    tone(80 + i * 3, i * (seconds / steps), 0.05, 'sawtooth', 0.06 + (i / steps) * 0.15);
  }
}

export function playFanfare(): void {
  tone(523, 0, 0.2, 'triangle', 0.2);
  tone(659, 0.15, 0.2, 'triangle', 0.2);
  tone(784, 0.30, 0.35, 'triangle', 0.25);
  tone(1046, 0.30, 0.5, 'triangle', 0.2);
}
