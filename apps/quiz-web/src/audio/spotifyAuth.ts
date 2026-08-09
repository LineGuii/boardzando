/**
 * PKCE flow para o Web Playback SDK. O `client_id` do Spotify e publico por
 * design; o `client_secret` NUNCA sai do servidor. Escopos:
 *   - streaming            : reproduzir via SDK
 *   - user-read-email      : requisito do SDK ler conta
 *   - user-read-private    : idem (checa Premium)
 *
 * Tokens sao guardados em localStorage com refresh_token; refresh acontece
 * on-demand quando expira. Nunca colocamos o token em URL/query.
 */

const KEY = 'boardzando-quiz:spotify-tok';
const VERIFIER_KEY = 'boardzando-quiz:spotify-verifier';
const SCOPES = 'streaming user-read-email user-read-private';

interface StoredToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

async function fetchClientId(): Promise<string | null> {
  try {
    const r = await fetch('/quiz/config');
    if (!r.ok) return null;
    const b = await r.json() as { spotifyClientId: string | null };
    return b.spotifyClientId ?? null;
  } catch { return null; }
}

function base64UrlEncode(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(str: string): Promise<ArrayBuffer> {
  const data = new TextEncoder().encode(str);
  return crypto.subtle.digest('SHA-256', data);
}

function randomString(len: number): string {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return base64UrlEncode(arr.buffer);
}

/** Redireciona para a tela de consentimento do Spotify (PKCE). */
export async function beginLogin(): Promise<void> {
  const clientId = await fetchClientId();
  if (!clientId) throw new Error('Spotify nao configurado no servidor.');
  const verifier = randomString(48);
  const challenge = base64UrlEncode(await sha256(verifier));
  localStorage.setItem(VERIFIER_KEY, verifier);
  const redirectUri = `${window.location.origin}/?admin&spotify-callback=1`;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: SCOPES,
    redirect_uri: redirectUri,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });
  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

/**
 * Chamado ao voltar do Spotify (?code=...). Troca `code` + `verifier` por
 * access+refresh token e guarda. Retorna true se logou.
 */
export async function completeLoginIfCallback(): Promise<boolean> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  if (!code) return false;
  const verifier = localStorage.getItem(VERIFIER_KEY);
  if (!verifier) return false;
  const clientId = await fetchClientId();
  if (!clientId) return false;
  const redirectUri = `${window.location.origin}/?admin&spotify-callback=1`;
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: verifier,
  });
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) return false;
  const json = await res.json() as { access_token: string; refresh_token: string; expires_in: number };
  saveToken({
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  });
  localStorage.removeItem(VERIFIER_KEY);
  // Limpa `?code`/`?spotify-callback` da URL
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  url.searchParams.delete('spotify-callback');
  window.history.replaceState(null, '', url.toString());
  return true;
}

export function saveToken(t: StoredToken): void {
  try { localStorage.setItem(KEY, JSON.stringify(t)); } catch { /* ignore */ }
}

export function loadToken(): StoredToken | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredToken;
  } catch { return null; }
}

export function clearToken(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/**
 * Devolve um access token valido. Renova se estiver perto de expirar.
 */
export async function getAccessToken(): Promise<string | null> {
  const t = loadToken();
  if (!t) return null;
  if (t.expiresAt > Date.now() + 30_000) return t.accessToken;
  // Refresh
  const clientId = await fetchClientId();
  if (!clientId) return null;
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: t.refreshToken,
    client_id: clientId,
  });
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) { clearToken(); return null; }
  const json = await res.json() as { access_token: string; refresh_token?: string; expires_in: number };
  const next: StoredToken = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? t.refreshToken,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  saveToken(next);
  return next.accessToken;
}

export function isLoggedIn(): boolean {
  return loadToken() !== null;
}
