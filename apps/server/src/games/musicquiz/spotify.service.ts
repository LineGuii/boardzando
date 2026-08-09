import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Cliente do Spotify Web API para o EDITOR. Usa Client Credentials — o
 * client_secret nunca sai do servidor. Reproducao (fase 4) e outro fluxo,
 * do lado do cliente (Authorization Code + PKCE + Web Playback SDK).
 *
 * Endpoints usados aqui sobreviveram a depreciacao de nov/2024:
 *   - GET /v1/search           (busca por track/artist)
 *   - GET /v1/artists/{id}/top-tracks
 *
 * O que MORREU (nao usamos): related-artists, recommendations, audio-features,
 * audio-analysis, preview_url. `buildDistractors` degrada de forma graciosa
 * usando top-tracks + search em vez de related-artists.
 */
@Injectable()
export class SpotifyService {
  private readonly logger = new Logger(SpotifyService.name);
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private tokenCache: { accessToken: string; expiresAt: number } | null = null;

  constructor(config: ConfigService) {
    this.clientId = config.get<string>('SPOTIFY_CLIENT_ID') || undefined;
    this.clientSecret = config.get<string>('SPOTIFY_CLIENT_SECRET') || undefined;
    if (!this.clientId || !this.clientSecret) {
      this.logger.warn('SPOTIFY_CLIENT_ID/SECRET nao configurados — busca do Spotify indisponivel.');
    }
  }

  get isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  /** Busca faixas por query livre. Retorna resultados normalizados. */
  async searchTracks(query: string, limit = 12): Promise<SpotifyTrackResult[]> {
    this.assertConfigured();
    if (!query.trim()) return [];
    const url = new URL('https://api.spotify.com/v1/search');
    url.searchParams.set('q', query);
    url.searchParams.set('type', 'track');
    url.searchParams.set('limit', String(Math.min(50, Math.max(1, limit))));
    const data = await this.get<SpotifySearchResponse>(url.toString());
    return (data.tracks?.items ?? []).map((t) => this.normalizeTrack(t));
  }

  /**
   * Gera 3 distratores plausiveis para uma faixa correta.
   * Cadeia com degradacao graciosa (related-artists morreu):
   *   1. top-tracks do mesmo artista (menos a propria)
   *   2. search pelo nome do artista, pegando outras faixas
   *   3. vazio — o cliente cai no fallback local (titulos das demais do quiz)
   */
  async buildDistractors(
    correctTrack: { trackId: string; trackName: string; artistId?: string; artistName: string },
    field: DistractorField,
  ): Promise<string[]> {
    this.assertConfigured();
    const out: string[] = [];
    const seen = new Set<string>();
    const push = (s: string): void => {
      const norm = s.trim();
      if (!norm) return;
      const key = norm.toLowerCase();
      // Rejeita se coincide com a resposta correta OU se ja vimos
      const rightAnswer = field === 'title' ? correctTrack.trackName : correctTrack.artistName;
      if (key === rightAnswer.toLowerCase()) return;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(norm);
    };

    // 1) top-tracks do mesmo artista
    if (correctTrack.artistId) {
      try {
        const tt = await this.get<SpotifyArtistTopTracksResponse>(
          `https://api.spotify.com/v1/artists/${correctTrack.artistId}/top-tracks?market=BR`,
        );
        for (const t of tt.tracks ?? []) {
          push(field === 'title' ? t.name : (t.artists[0]?.name ?? ''));
          if (out.length >= 3) return out;
        }
      } catch (e) {
        this.logger.warn(`top-tracks falhou: ${(e as Error).message}`);
      }
    }

    // 2) search pelo nome do artista
    try {
      const searched = await this.searchTracks(correctTrack.artistName, 20);
      for (const t of searched) {
        if (t.trackId === correctTrack.trackId) continue;
        push(field === 'title' ? t.name : t.artist);
        if (out.length >= 3) return out;
      }
    } catch (e) {
      this.logger.warn(`search fallback falhou: ${(e as Error).message}`);
    }

    return out; // pode ter menos que 3; cliente completa se precisar
  }

  // ---------- interno ----------

  private assertConfigured(): void {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException(
        'Spotify nao configurado (SPOTIFY_CLIENT_ID/SECRET ausentes no .env).',
      );
    }
  }

  private async ensureToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt > now + 30_000) {
      return this.tokenCache.accessToken;
    }
    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new HttpException(
        `Falha obtendo token Spotify: ${res.status} ${text}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
    const body = await res.json() as { access_token: string; expires_in: number };
    this.tokenCache = {
      accessToken: body.access_token,
      expiresAt: Date.now() + body.expires_in * 1000,
    };
    return this.tokenCache.accessToken;
  }

  private async get<T>(url: string): Promise<T> {
    const token = await this.ensureToken();
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.status === 401) {
      // Token expirou entre a checagem e a chamada — tenta uma vez
      this.tokenCache = null;
      const token2 = await this.ensureToken();
      const res2 = await fetch(url, { headers: { 'Authorization': `Bearer ${token2}` } });
      if (!res2.ok) {
        const text = await res2.text().catch(() => '');
        throw new HttpException(`Spotify ${res2.status}: ${text}`, HttpStatus.BAD_GATEWAY);
      }
      return res2.json() as Promise<T>;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new HttpException(`Spotify ${res.status}: ${text}`, HttpStatus.BAD_GATEWAY);
    }
    return res.json() as Promise<T>;
  }

  private normalizeTrack(t: SpotifyApiTrack): SpotifyTrackResult {
    const primary = t.artists[0];
    return {
      trackId: t.id,
      name: t.name,
      artist: primary?.name ?? '(desconhecido)',
      artistId: primary?.id,
      albumCover: this.pickImage(t.album?.images),
      durationMs: t.duration_ms,
    };
  }

  private pickImage(images?: SpotifyImage[]): string | undefined {
    if (!images || images.length === 0) return undefined;
    // 300x300 costuma ser o do meio; caimos pro maior se nao tiver
    const mid = images.find((i) => i.width >= 200 && i.width <= 400);
    return (mid ?? images[0])!.url;
  }
}

export type DistractorField = 'title' | 'artist';

export interface SpotifyTrackResult {
  trackId: string;
  name: string;
  artist: string;
  artistId?: string;
  albumCover?: string;
  durationMs: number;
}

interface SpotifyImage { url: string; width: number; height: number }
interface SpotifyApiTrack {
  id: string;
  name: string;
  duration_ms: number;
  artists: { id: string; name: string }[];
  album?: { images?: SpotifyImage[] };
}
interface SpotifySearchResponse { tracks?: { items: SpotifyApiTrack[] } }
interface SpotifyArtistTopTracksResponse { tracks?: SpotifyApiTrack[] }
