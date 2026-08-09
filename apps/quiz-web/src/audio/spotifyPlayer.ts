import { getAccessToken } from './spotifyAuth';

/**
 * Wrapper do Web Playback SDK do Spotify.
 *
 * Estrategia de sincronia: o SDK nao tem "tocar faixa X" — quem faz e a Web
 * API apontando para o `device_id` local. Uma chamada HTTP no exato
 * `serverStartAt` teria jitter alto, entao PRE-CARREGAMOS a faixa:
 *   1) play + seek(startSec) + pause      (durante a fase 'preloading')
 *   2) resume()                            (no serverStartAt — chamada local)
 * O resume via SDK e ordens de grandeza mais rapido que uma call HTTP.
 *
 * Se o usuario nao for Premium ou o SDK falhar, expomos o erro para o caller
 * cair no modo apresentador ou avisar o jogador.
 */

const SDK_SRC = 'https://sdk.scdn.co/spotify-player.js';

interface SpotifyGlobal {
  Player: new (opts: {
    name: string;
    getOAuthToken: (cb: (token: string) => void) => void;
    volume?: number;
  }) => SpotifyPlayer;
}

interface SpotifyPlayer {
  addListener: (event: string, cb: (data: unknown) => void) => boolean;
  connect: () => Promise<boolean>;
  disconnect: () => void;
  activateElement?: () => Promise<void>;
  togglePlay: () => Promise<void>;
  resume: () => Promise<void>;
  pause: () => Promise<void>;
  seek: (ms: number) => Promise<void>;
  getCurrentState: () => Promise<{ position: number; paused: boolean } | null>;
}

interface WindowWithSpotify extends Window {
  Spotify?: SpotifyGlobal;
  onSpotifyWebPlaybackSDKReady?: () => void;
}

let sdkPromise: Promise<SpotifyGlobal> | null = null;

/** Carrega o script do SDK uma unica vez e resolve com o global `Spotify`. */
function loadSDK(): Promise<SpotifyGlobal> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<SpotifyGlobal>((resolve, reject) => {
    const w = window as WindowWithSpotify;
    if (w.Spotify) return resolve(w.Spotify);
    w.onSpotifyWebPlaybackSDKReady = () => {
      if (w.Spotify) resolve(w.Spotify);
      else reject(new Error('SDK carregado mas Spotify global ausente.'));
    };
    const script = document.createElement('script');
    script.src = SDK_SRC;
    script.async = true;
    script.onerror = () => reject(new Error('Falha carregando script do Spotify SDK.'));
    document.head.appendChild(script);
  });
  return sdkPromise;
}

export class SpotifyPlayerWrapper {
  private player?: SpotifyPlayer;
  private deviceId?: string;
  private ready = false;

  /**
   * Conecta o SDK e obtem `device_id`. Deve ser chamado apos user gesture
   * (autoplay policy) — tipicamente no clique de "Conectar" ou "Iniciar".
   */
  async connect(): Promise<{ deviceId: string }> {
    if (this.ready && this.deviceId) return { deviceId: this.deviceId };
    const Spotify = await loadSDK();
    const player = new Spotify.Player({
      name: 'Music Quiz Boardzando',
      getOAuthToken: (cb) => { void getAccessToken().then((t) => cb(t ?? '')); },
      volume: 0.8,
    });
    this.player = player;

    const deviceId = await new Promise<string>((resolve, reject) => {
      player.addListener('ready', (d) => resolve((d as { device_id: string }).device_id));
      player.addListener('not_ready', () => { /* device foi embora — nao rejeita, so log */ });
      player.addListener('initialization_error', (e) => reject(new Error(`init: ${(e as { message: string }).message}`)));
      player.addListener('authentication_error', (e) => reject(new Error(`auth: ${(e as { message: string }).message}`)));
      player.addListener('account_error', () => reject(new Error('Conta nao Premium — o SDK exige Premium para tocar.')));
      void player.connect().then((ok) => { if (!ok) reject(new Error('SDK nao conseguiu conectar.')); });
      setTimeout(() => reject(new Error('Timeout aguardando device_id.')), 15_000);
    });
    this.deviceId = deviceId;
    this.ready = true;
    // Ativa elemento HTML — resolve autoplay em Safari/iOS
    try { await player.activateElement?.(); } catch { /* ignore */ }
    return { deviceId };
  }

  /**
   * Pre-carrega uma faixa: dispara PUT play (via Web API, aponta pro nosso
   * device), aguarda estado ativo, seek(startSec) e pause. Ao retornar, a
   * faixa esta armada — resume() sera imediato.
   */
  async preload(trackId: string, startSec: number): Promise<void> {
    if (!this.deviceId) throw new Error('SDK nao conectado.');
    const token = await getAccessToken();
    if (!token) throw new Error('Sem token Spotify.');
    const positionMs = Math.max(0, Math.floor(startSec * 1000));
    const res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${this.deviceId}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris: [`spotify:track:${trackId}`], position_ms: positionMs }),
    });
    if (!res.ok && res.status !== 202 && res.status !== 204) {
      const text = await res.text().catch(() => '');
      throw new Error(`Play falhou: ${res.status} ${text}`);
    }
    // Espera ~200ms o SDK reportar antes de pausar
    await new Promise((r) => setTimeout(r, 250));
    try { await this.player?.pause(); } catch { /* ignore */ }
  }

  /** Toca imediatamente. Chamado no serverStartAt (via setTimeout local). */
  async resumeAt(fireAtLocalMs: number): Promise<void> {
    const wait = fireAtLocalMs - Date.now();
    const doIt = async (): Promise<void> => {
      try { await this.player?.resume(); } catch { /* ignore */ }
    };
    if (wait <= 0) return doIt();
    return new Promise((res) => {
      setTimeout(() => { void doIt().then(res); }, wait);
    });
  }

  async stop(): Promise<void> {
    try { await this.player?.pause(); } catch { /* ignore */ }
  }

  disconnect(): void {
    try { this.player?.disconnect(); } catch { /* ignore */ }
    this.player = undefined;
    this.deviceId = undefined;
    this.ready = false;
  }
}
