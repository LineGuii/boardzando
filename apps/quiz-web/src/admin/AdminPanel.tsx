import { useEffect, useState, type JSX } from 'react';
import { AVATAR_COLORS, randomAvatarColor } from '@boardzando/contracts';
import { adminApi, AdminUnauthorizedError } from '../net/adminApi';
import { clearAdmin, loadAdmin, saveAdmin } from '../net/adminSession';
import { connectSocket } from '../net/socket';
import { saveSession } from '../net/session';
import { syncClock } from '../net/clockSync';
import { useQuiz } from '../net/store';

/**
 * Ponto de entrada do painel admin. Se nao tem sessao admin salva, mostra o
 * login. Se tem, mostra o painel principal (por enquanto so a criacao de sala;
 * o editor de quizzes vira nas proximas fases).
 *
 * Ao criar sala, faz o mesmo handoff do lobby publico antigo: salva a sessao
 * de jogador (chave separada), abre o socket, syncClock, e o App.tsx vai
 * renderizar RoomPage.
 */
export function AdminPanel(): JSX.Element {
  const [hasSession, setHasSession] = useState<boolean>(() => loadAdmin() !== null);

  if (!hasSession) {
    return <AdminLogin onLoggedIn={() => setHasSession(true)} />;
  }
  return <AdminHome onLogout={() => { clearAdmin(); setHasSession(false); }} />;
}

function AdminLogin(props: { onLoggedIn: () => void }): JSX.Element {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    setError(undefined);
    if (password.length < 4) { setError('Senha muito curta.'); return; }
    setBusy(true);
    try {
      const { token } = await adminApi.login(password);
      saveAdmin(token);
      props.onLoggedIn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="q-container">
      <div className="q-hero">
        <h1>Music Quiz</h1>
        <p className="tagline">Painel do host — acesso restrito</p>
      </div>
      <div className="q-card">
        <h2>Entrar como admin</h2>
        {error && (
          <div className="q-alert">
            <span>⚠ {error}</span>
            <button onClick={() => setError(undefined)}>×</button>
          </div>
        )}
        <label className="q-label">Senha</label>
        <input
          className="q-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
          autoFocus
        />
        <button className="q-btn" onClick={submit} disabled={busy}>
          {busy ? 'Verificando...' : 'Entrar'}
        </button>
        <p className="q-help" style={{ marginTop: 12, textAlign: 'center' }}>
          <a href="/" style={{ color: '#a5b4fc' }}>← Voltar para entrar em sala</a>
        </p>
      </div>
    </div>
  );
}

function AdminHome(props: { onLogout: () => void }): JSX.Element {
  const [name, setName] = useState<string>(() => localStorage.getItem('quiz:name') ?? '');
  const [color, setColor] = useState<string>(randomAvatarColor());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [rounds, setRounds] = useState(10);
  const [audioMode, setAudioMode] = useState<'remote' | 'presenter'>('remote');
  const [hostIsPlayer, setHostIsPlayer] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  useEffect(() => { localStorage.setItem('quiz:name', name); }, [name]);

  const create = async (): Promise<void> => {
    setError(undefined);
    if (name.trim().length < 2) { setError('Escolha um nome (2+ caracteres).'); return; }
    setBusy(true);
    try {
      // Mesmo mecanismo de handoff do fluxo publico antigo: opcoes viram
      // localStorage e vao para o servidor no primeiro room:start.
      localStorage.setItem(
        'quiz:pending-options',
        JSON.stringify({ rounds, audioMode, hostIsPlayer }),
      );
      const res = await adminApi.createRoom(name.trim(), color, password || undefined);
      saveSession({ roomId: res.roomId, playerId: res.playerId, token: res.token });
      const sock = connectSocket(res.token);
      sock.once('connect', () => {
        useQuiz.getState().setSocket(sock, { roomId: res.roomId, playerId: res.playerId });
        try {
          const u = new URL(window.location.href);
          u.searchParams.set('room', res.roomId);
          u.searchParams.delete('admin');
          window.history.replaceState(null, '', `/?room=${res.roomId}`);
        } catch { /* ignore */ }
        void syncClock(sock, res.roomId).then((off) => useQuiz.getState().setClockOffset(off));
      });
    } catch (e) {
      if (e instanceof AdminUnauthorizedError) {
        setError('Sessao expirada — faca login de novo.');
        setTimeout(() => props.onLogout(), 800);
      } else {
        setError((e as Error).message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="q-container">
      <div className="q-hero">
        <h1>Music Quiz</h1>
        <p className="tagline">Painel do host — voce esta autenticado.</p>
      </div>
      <div className="q-card">
        <h2>Criar sala</h2>
        {error && (
          <div className="q-alert">
            <span>⚠ {error}</span>
            <button onClick={() => setError(undefined)}>×</button>
          </div>
        )}

        <label className="q-label">Seu nome</label>
        <div className="q-avatar-row">
          <div style={{ position: 'relative' }}>
            <div
              className="q-avatar"
              style={{ background: color }}
              onClick={() => setPickerOpen((o) => !o)}
            >
              {(name[0] ?? '?').toUpperCase()}
            </div>
            {pickerOpen && (
              <div className="q-avatar-picker">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c}
                    style={{ background: c }}
                    className={c === color ? 'selected' : ''}
                    onClick={() => { setColor(c); setPickerOpen(false); }}
                  />
                ))}
              </div>
            )}
          </div>
          <input
            className="q-input"
            placeholder="Como voce quer ser chamado?"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
          />
        </div>

        <div className="q-row">
          <div style={{ flex: 1 }}>
            <label className="q-label">Rodadas</label>
            <input
              className="q-input"
              type="number"
              min={1}
              max={50}
              value={rounds}
              onChange={(e) => setRounds(Math.max(1, Math.min(50, Number(e.target.value) || 10)))}
            />
          </div>
          <div style={{ flex: 2 }}>
            <label className="q-label">Modo de audio</label>
            <select
              className="q-select"
              value={audioMode}
              onChange={(e) => setAudioMode(e.target.value as 'remote' | 'presenter')}
            >
              <option value="remote">🎧 Cada jogador ouve no proprio dispositivo</option>
              <option value="presenter">So o host toca (TV/compartilhado)</option>
            </select>
          </div>
        </div>

        <label className="q-switch" style={{ marginTop: 12 }}>
          <input
            type="checkbox"
            checked={hostIsPlayer}
            onChange={(e) => setHostIsPlayer(e.target.checked)}
          />
          O host tambem responde as perguntas
        </label>
        <p className="q-help">
          Desmarque para o host ser apenas apresentador (ve o gabarito, nao pontua).
        </p>

        <label className="q-label">Senha da sala (opcional)</label>
        <input
          className="q-input"
          type="password"
          placeholder="deixe vazio p/ sala publica"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          maxLength={64}
        />

        <button className="q-btn" onClick={create} disabled={busy}>
          {busy ? 'Aguarde...' : 'Criar sala'}
        </button>
      </div>

      <div style={{ textAlign: 'center', marginTop: 12 }}>
        <button className="q-btn small secondary" onClick={props.onLogout}>Sair do admin</button>
      </div>
    </div>
  );
}
