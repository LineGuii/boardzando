import { useEffect, useState, type JSX } from 'react';
import { AVATAR_COLORS, randomAvatarColor, type QuizOrderMode, type QuizSummary } from '@boardzando/contracts';
import { adminApi, AdminUnauthorizedError } from '../net/adminApi';
import { clearAdmin, loadAdmin, saveAdmin } from '../net/adminSession';
import { connectSocket } from '../net/socket';
import { saveSession } from '../net/session';
import { syncClock } from '../net/clockSync';
import { useQuiz } from '../net/store';
import { QuizEditor } from './QuizEditor';
import { beginLogin, clearToken, completeLoginIfCallback, isLoggedIn as isSpotifyLoggedIn } from '../audio/spotifyAuth';

/**
 * Painel admin. Login primeiro; depois duas abas:
 *   - "Criar sala"  : formulario que aparecia no lobby publico
 *   - "Editor"      : biblioteca de faixas + quizzes nomeados (fase 2)
 */
export function AdminPanel(): JSX.Element {
  const [hasSession, setHasSession] = useState<boolean>(() => loadAdmin() !== null);
  if (!hasSession) return <AdminLogin onLoggedIn={() => setHasSession(true)} />;
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
  const [tab, setTab] = useState<'room' | 'editor'>('room');
  const [spotifyLogged, setSpotifyLogged] = useState<boolean>(false);
  const [spotifyBusy, setSpotifyBusy] = useState(false);

  useEffect(() => {
    // Se voltamos do consent Spotify, finalize; senao carrega estado atual.
    void completeLoginIfCallback().then(() => setSpotifyLogged(isSpotifyLoggedIn()));
  }, []);

  const doSpotifyLogin = async (): Promise<void> => {
    setSpotifyBusy(true);
    try { await beginLogin(); }
    catch (e) { alert((e as Error).message); setSpotifyBusy(false); }
  };
  const doSpotifyLogout = (): void => { clearToken(); setSpotifyLogged(false); };

  return (
    <div className="q-container">
      <div className="q-hero">
        <h1>Music Quiz</h1>
        <p className="tagline">Painel do host — voce esta autenticado.</p>
      </div>
      <div className="q-card">
        <div className="q-tabs">
          <button className={`q-tab ${tab === 'room' ? 'active' : ''}`} onClick={() => setTab('room')}>
            Criar sala
          </button>
          <button className={`q-tab ${tab === 'editor' ? 'active' : ''}`} onClick={() => setTab('editor')}>
            Editor
          </button>
        </div>
        {tab === 'room' ? <CreateRoomForm onUnauthorized={props.onLogout} /> : <QuizEditor onUnauthorized={props.onLogout} />}
      </div>

      <div className="q-card" style={{ marginTop: 12 }}>
        <h2>Conta Spotify</h2>
        <p className="q-help">
          Necessario apenas para tocar faixas com fonte Spotify. Exige Premium.
        </p>
        {spotifyLogged ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span style={{ color: '#86efac', fontWeight: 700 }}>Conectado</span>
            <button className="q-btn small secondary" onClick={doSpotifyLogout}>Desconectar</button>
          </div>
        ) : (
          <button className="q-btn" onClick={() => void doSpotifyLogin()} disabled={spotifyBusy}>
            {spotifyBusy ? 'Redirecionando...' : 'Conectar Spotify'}
          </button>
        )}
      </div>

      <div style={{ textAlign: 'center', marginTop: 12 }}>
        <button className="q-btn small secondary" onClick={props.onLogout}>Sair do admin</button>
      </div>
    </div>
  );
}

function CreateRoomForm(props: { onUnauthorized: () => void }): JSX.Element {
  const [name, setName] = useState<string>(() => localStorage.getItem('quiz:name') ?? '');
  const [color, setColor] = useState<string>(randomAvatarColor());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [rounds, setRounds] = useState(10);
  const [audioMode, setAudioMode] = useState<'remote' | 'presenter'>('remote');
  const [orderMode, setOrderMode] = useState<QuizOrderMode>('random');
  const [hostIsPlayer, setHostIsPlayer] = useState(true);
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [quizId, setQuizId] = useState<string>('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  useEffect(() => { localStorage.setItem('quiz:name', name); }, [name]);

  useEffect(() => {
    void adminApi.listPublicQuizzes().then((qs) => {
      setQuizzes(qs);
      if (qs.length > 0 && !quizId) setQuizId(qs[0]!.id);
    }).catch(() => { /* silent — mostra vazio */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = async (): Promise<void> => {
    setError(undefined);
    if (name.trim().length < 2) { setError('Escolha um nome (2+ caracteres).'); return; }
    if (!quizId) { setError('Nao ha quiz disponivel — crie um em "Editor" primeiro.'); return; }
    setBusy(true);
    try {
      localStorage.setItem(
        'quiz:pending-options',
        JSON.stringify({ rounds, audioMode, hostIsPlayer, quizId, orderMode }),
      );
      const res = await adminApi.createRoom(name.trim(), color, password || undefined);
      saveSession({ roomId: res.roomId, playerId: res.playerId, token: res.token });
      const sock = connectSocket(res.token);
      sock.once('connect', () => {
        useQuiz.getState().setSocket(sock, { roomId: res.roomId, playerId: res.playerId });
        try {
          window.history.replaceState(null, '', `/?room=${res.roomId}`);
        } catch { /* ignore */ }
        void syncClock(sock, res.roomId).then((off) => useQuiz.getState().setClockOffset(off));
      });
    } catch (e) {
      if (e instanceof AdminUnauthorizedError) {
        setError('Sessao expirada — faca login de novo.');
        setTimeout(() => props.onUnauthorized(), 800);
      } else {
        setError((e as Error).message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
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

      <label className="q-label">Quiz</label>
      <select className="q-select" value={quizId} onChange={(e) => setQuizId(e.target.value)}>
        {quizzes.length === 0 && <option value="">Nenhum quiz disponivel</option>}
        {quizzes.map((q) => (
          <option key={q.id} value={q.id}>
            {q.name} ({q.trackCount} faixas)
          </option>
        ))}
      </select>

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

      <label className="q-label">Ordem das perguntas</label>
      <select
        className="q-select"
        value={orderMode}
        onChange={(e) => setOrderMode(e.target.value as QuizOrderMode)}
      >
        <option value="random">🔀 Aleatória</option>
        <option value="difficulty">📈 Por dificuldade (fácil → difícil)</option>
        <option value="sequence">📄 Ordem do arquivo</option>
      </select>

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
  );
}
