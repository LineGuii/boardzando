import { useEffect, useState, type JSX } from 'react';
import type { QuizDefinition, QuizTrack } from '@boardzando/contracts';
import { adminApi, AdminUnauthorizedError } from '../net/adminApi';

/**
 * Editor de faixas (biblioteca) e quizzes. Duas abas: "Faixas" e "Quizzes".
 * - Faixas: lista + botao "Nova" que abre o formulario. Edicao inline via
 *   modal simples. Deletar remove das quizzes automaticamente (server-side).
 * - Quizzes: lista + criacao; ao clicar num quiz, mostra as faixas dele e
 *   permite adicionar/remover checkboxando na biblioteca.
 */
export function QuizEditor(props: { onUnauthorized: () => void }): JSX.Element {
  const [tab, setTab] = useState<'tracks' | 'quizzes'>('tracks');

  return (
    <div>
      <div className="q-tabs" style={{ marginBottom: 16 }}>
        <button
          className={`q-tab ${tab === 'tracks' ? 'active' : ''}`}
          onClick={() => setTab('tracks')}
        >
          Faixas
        </button>
        <button
          className={`q-tab ${tab === 'quizzes' ? 'active' : ''}`}
          onClick={() => setTab('quizzes')}
        >
          Quizzes
        </button>
      </div>

      {tab === 'tracks'
        ? <TracksTab onUnauthorized={props.onUnauthorized} />
        : <QuizzesTab onUnauthorized={props.onUnauthorized} />}
    </div>
  );
}

// ==========================================================
// FAIXAS
// ==========================================================

function TracksTab(props: { onUnauthorized: () => void }): JSX.Element {
  const [tracks, setTracks] = useState<QuizTrack[]>([]);
  const [editing, setEditing] = useState<QuizTrack | 'new' | null>(null);
  const [error, setError] = useState<string | undefined>();

  const refresh = async (): Promise<void> => {
    try {
      const list = await adminApi.listTracks();
      setTracks(list);
    } catch (e) {
      if (e instanceof AdminUnauthorizedError) props.onUnauthorized();
      else setError((e as Error).message);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const remove = async (id: string): Promise<void> => {
    if (!confirm(`Remover faixa "${id}"? Sera removida de todos os quizzes tambem.`)) return;
    try { await adminApi.deleteTrack(id); await refresh(); }
    catch (e) { setError((e as Error).message); }
  };

  return (
    <div>
      {error && (
        <div className="q-alert">
          <span>⚠ {error}</span>
          <button onClick={() => setError(undefined)}>×</button>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ color: '#a5b4fc', fontSize: 13, fontWeight: 700 }}>
          {tracks.length} faixa(s)
        </div>
        <button className="q-btn small" onClick={() => setEditing('new')}>+ Nova faixa</button>
      </div>

      <div className="q-track-list">
        {tracks.length === 0 && (
          <div className="q-room-empty">Nenhuma faixa cadastrada. Clique em "Nova faixa".</div>
        )}
        {tracks.map((t) => (
          <div key={t.id} className="q-track-item">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="who">{t.title || t.questionText}</div>
              <div className="meta">
                {t.artist ? `${t.artist} · ` : ''}
                {t.source.kind === 'local' ? `local: ${t.source.audioFile}` : `spotify: ${t.source.trackName}`}
              </div>
            </div>
            <button className="q-btn small secondary" onClick={() => setEditing(t)}>Editar</button>
            <button className="q-btn small danger" onClick={() => void remove(t.id)}>Remover</button>
          </div>
        ))}
      </div>

      {editing !== null && (
        <TrackFormModal
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void refresh(); }}
          onError={setError}
        />
      )}
    </div>
  );
}

function TrackFormModal(props: {
  initial: QuizTrack | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}): JSX.Element {
  const isNew = props.initial === null;
  const [title, setTitle] = useState(props.initial?.title ?? '');
  const [artist, setArtist] = useState(props.initial?.artist ?? '');
  const [audioFile, setAudioFile] = useState(
    props.initial?.source.kind === 'local' ? props.initial.source.audioFile : '',
  );
  const [coverUrl, setCoverUrl] = useState(props.initial?.coverUrl ?? '');
  const [questionText, setQuestionText] = useState(props.initial?.questionText ?? 'Qual e essa musica?');
  const [opt0, setOpt0] = useState(props.initial?.options[0] ?? '');
  const [opt1, setOpt1] = useState(props.initial?.options[1] ?? '');
  const [opt2, setOpt2] = useState(props.initial?.options[2] ?? '');
  const [opt3, setOpt3] = useState(props.initial?.options[3] ?? '');
  const [correctIndex, setCorrectIndex] = useState<0 | 1 | 2 | 3>(props.initial?.correctIndex ?? 0);
  const [startSec, setStartSec] = useState(props.initial?.startSec ?? 0);
  const [durationSec, setDurationSec] = useState(props.initial?.durationSec ?? 20);
  const [busy, setBusy] = useState(false);

  const save = async (): Promise<void> => {
    setBusy(true);
    const options: [string, string, string, string] = [opt0, opt1, opt2, opt3];
    if (options.some((o) => !o.trim())) { props.onError('Preencha as 4 alternativas.'); setBusy(false); return; }
    if (!audioFile.trim()) { props.onError('Informe o arquivo de audio (ex: audio/nome.mp3).'); setBusy(false); return; }
    const payload = {
      title: title.trim() || undefined,
      artist: artist.trim() || undefined,
      source: { kind: 'local' as const, audioFile: audioFile.trim() },
      coverUrl: coverUrl.trim() || undefined,
      questionText: questionText.trim(),
      options,
      correctIndex,
      startSec,
      durationSec,
    };
    try {
      if (isNew) await adminApi.createTrack(payload);
      else await adminApi.updateTrack(props.initial!.id, payload);
      props.onSaved();
    } catch (e) {
      props.onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="q-modal-backdrop" onClick={props.onClose}>
      <div className="q-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isNew ? 'Nova faixa' : `Editar: ${props.initial!.id}`}</h2>

        <div className="q-row">
          <div>
            <label className="q-label">Titulo</label>
            <input className="q-input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </div>
          <div>
            <label className="q-label">Artista</label>
            <input className="q-input" value={artist} onChange={(e) => setArtist(e.target.value)} maxLength={200} />
          </div>
        </div>

        <label className="q-label">Arquivo de audio (relativo a assets/)</label>
        <input
          className="q-input"
          placeholder="audio/minha-musica.mp3"
          value={audioFile}
          onChange={(e) => setAudioFile(e.target.value)}
          maxLength={256}
        />

        <label className="q-label">Capa (opcional — URL ou covers/foo.jpg)</label>
        <input
          className="q-input"
          value={coverUrl}
          onChange={(e) => setCoverUrl(e.target.value)}
          maxLength={500}
        />

        <label className="q-label">Enunciado</label>
        <input
          className="q-input"
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          maxLength={300}
        />

        <label className="q-label">Alternativas (marque a correta)</label>
        {[opt0, opt1, opt2, opt3].map((val, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <input
              type="radio"
              name="correct"
              checked={correctIndex === i}
              onChange={() => setCorrectIndex(i as 0 | 1 | 2 | 3)}
              style={{ accentColor: '#22d3ee', width: 20, height: 20 }}
            />
            <input
              className="q-input"
              value={val}
              onChange={(e) => {
                const setters = [setOpt0, setOpt1, setOpt2, setOpt3];
                setters[i]!(e.target.value);
              }}
              maxLength={120}
              placeholder={`Alternativa ${String.fromCharCode(65 + i)}`}
            />
          </div>
        ))}

        <div className="q-row">
          <div>
            <label className="q-label">Inicio (s)</label>
            <input
              className="q-input"
              type="number"
              min={0}
              value={startSec}
              onChange={(e) => setStartSec(Math.max(0, Number(e.target.value) || 0))}
            />
          </div>
          <div>
            <label className="q-label">Duracao (s)</label>
            <input
              className="q-input"
              type="number"
              min={1}
              max={120}
              value={durationSec}
              onChange={(e) => setDurationSec(Math.max(1, Math.min(120, Number(e.target.value) || 20)))}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="q-btn secondary" onClick={props.onClose} disabled={busy}>Cancelar</button>
          <button className="q-btn" onClick={() => void save()} disabled={busy}>
            {busy ? 'Salvando...' : (isNew ? 'Criar faixa' : 'Salvar')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================================
// QUIZZES
// ==========================================================

function QuizzesTab(props: { onUnauthorized: () => void }): JSX.Element {
  const [quizzes, setQuizzes] = useState<QuizDefinition[]>([]);
  const [tracks, setTracks] = useState<QuizTrack[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [error, setError] = useState<string | undefined>();

  const refresh = async (): Promise<void> => {
    try {
      const [qs, ts] = await Promise.all([adminApi.listQuizzes(), adminApi.listTracks()]);
      setQuizzes(qs);
      setTracks(ts);
    } catch (e) {
      if (e instanceof AdminUnauthorizedError) props.onUnauthorized();
      else setError((e as Error).message);
    }
  };
  useEffect(() => { void refresh(); }, []);

  const create = async (): Promise<void> => {
    if (!newName.trim()) return;
    try {
      await adminApi.createQuiz({ name: newName.trim(), description: newDesc.trim() || undefined });
      setNewName(''); setNewDesc(''); setCreating(false); void refresh();
    } catch (e) { setError((e as Error).message); }
  };

  const remove = async (id: string): Promise<void> => {
    if (!confirm(`Remover quiz "${id}"? As faixas continuam na biblioteca.`)) return;
    try { await adminApi.deleteQuiz(id); if (openId === id) setOpenId(null); void refresh(); }
    catch (e) { setError((e as Error).message); }
  };

  // Enfileirado por quiz para evitar race condition ao clicar varios checkboxes
  // rapidamente (cada request usaria o mesmo trackIds inicial, sobrescrevendo).
  const [toggleQueue, setToggleQueue] = useState<Map<string, Promise<void>>>(new Map());
  const toggleTrack = (quizId: string, trackId: string): void => {
    const prev = toggleQueue.get(quizId) ?? Promise.resolve();
    const chained = prev.then(async () => {
      // Recupera o estado MAIS RECENTE do quiz apos qualquer update anterior
      const latest = await adminApi.listQuizzes().then((qs) => qs.find((q) => q.id === quizId));
      if (!latest) return;
      const next = latest.trackIds.includes(trackId)
        ? latest.trackIds.filter((id) => id !== trackId)
        : [...latest.trackIds, trackId];
      try { await adminApi.updateQuiz(quizId, { trackIds: next }); }
      catch (e) { setError((e as Error).message); }
    }).finally(() => void refresh());
    setToggleQueue(new Map(toggleQueue).set(quizId, chained));
  };

  const open = quizzes.find((q) => q.id === openId);

  return (
    <div>
      {error && (
        <div className="q-alert">
          <span>⚠ {error}</span>
          <button onClick={() => setError(undefined)}>×</button>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ color: '#a5b4fc', fontSize: 13, fontWeight: 700 }}>{quizzes.length} quiz(zes)</div>
        <button className="q-btn small" onClick={() => setCreating(true)}>+ Novo quiz</button>
      </div>

      <div className="q-track-list">
        {quizzes.length === 0 && (
          <div className="q-room-empty">Nenhum quiz. Crie um e adicione faixas.</div>
        )}
        {quizzes.map((q) => (
          <div key={q.id} className="q-track-item">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="who">{q.name}</div>
              <div className="meta">
                {q.trackIds.length} faixa(s){q.description ? ` · ${q.description}` : ''}
              </div>
            </div>
            <button className="q-btn small secondary" onClick={() => setOpenId(openId === q.id ? null : q.id)}>
              {openId === q.id ? 'Fechar' : 'Faixas'}
            </button>
            <button className="q-btn small danger" onClick={() => void remove(q.id)}>Remover</button>
          </div>
        ))}
      </div>

      {open && (
        <div style={{ marginTop: 16, padding: 12, background: 'rgba(11,20,50,0.5)', borderRadius: 12, border: '1px solid rgba(148,163,255,0.15)' }}>
          <div style={{ color: '#67e8f9', fontSize: 13, fontWeight: 800, marginBottom: 8 }}>
            Faixas em "{open.name}"
          </div>
          {tracks.length === 0 ? (
            <div className="q-room-empty">Nenhuma faixa na biblioteca. Vá para "Faixas" e crie algumas.</div>
          ) : (
            tracks.map((t) => {
              const inQuiz = open.trackIds.includes(t.id);
              return (
                <label key={t.id} className="q-check-row">
                  <input
                    type="checkbox"
                    checked={inQuiz}
                    onChange={() => toggleTrack(open.id, t.id)}
                    style={{ accentColor: '#22d3ee', width: 18, height: 18 }}
                  />
                  <span style={{ flex: 1 }}>{t.title || t.questionText} <span style={{ color: '#7b88b8' }}>· {t.artist ?? '(sem artista)'}</span></span>
                </label>
              );
            })
          )}
        </div>
      )}

      {creating && (
        <div className="q-modal-backdrop" onClick={() => setCreating(false)}>
          <div className="q-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Novo quiz</h2>
            <label className="q-label">Nome</label>
            <input className="q-input" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={80} autoFocus />
            <label className="q-label">Descricao (opcional)</label>
            <input className="q-input" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} maxLength={500} />
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="q-btn secondary" onClick={() => setCreating(false)}>Cancelar</button>
              <button className="q-btn" onClick={() => void create()}>Criar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
