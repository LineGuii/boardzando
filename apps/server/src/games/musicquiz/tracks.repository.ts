import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  watch,
  writeFileSync,
} from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import type {
  QuizAudioSource,
  QuizDefinition,
  QuizSummary,
  QuizTrack,
} from '@boardzando/contracts';

/** Diretorio base dos assets do quiz (audios + capas + tracks.json).
 *  Default: `<repo-root>/data/musicquiz`. Em dev, `process.cwd()` do nest e
 *  `apps/server`; subimos duas pastas. Sobrescreva com QUIZ_DATA_DIR se quiser. */
function resolveDataDir(): string {
  if (process.env.QUIZ_DATA_DIR) return resolve(process.env.QUIZ_DATA_DIR);
  const cwd = process.cwd();
  const asMonorepoApp = resolve(cwd, '../../data/musicquiz');
  const asRoot = resolve(cwd, 'data/musicquiz');
  return cwd.includes('apps') ? asMonorepoApp : asRoot;
}
export const QUIZ_DATA_DIR = resolveDataDir();
export const QUIZ_TRACKS_FILE = join(QUIZ_DATA_DIR, 'tracks.json');
export const QUIZ_ASSETS_DIR = join(QUIZ_DATA_DIR, 'assets');
export const QUIZ_MEDIA_PREFIX = '/media/musicquiz';

/** Shape em disco. v1 (legado) tinha `tracks` com `audioFile` no topo.
 *  v2 introduz `source` discriminado e `quizzes` nomeados. */
interface TracksFileV2 {
  version: 2;
  /** Preservado se presente — anotacao editorial no JSON. */
  _readme?: string;
  tracks: QuizTrack[];
  quizzes: QuizDefinition[];
}

/** Formato v1 legado — migrado no boot. */
interface TrackV1 {
  id: string;
  title?: string;
  artist?: string;
  audioFile: string;
  coverFile?: string;
  questionText: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  startSec?: number;
  durationSec?: number;
}
interface TracksFileV1 {
  version?: 1;
  _readme?: string;
  tracks: TrackV1[];
}

/** Id do quiz gerado automaticamente na migracao v1->v2. */
const ALL_QUIZ_ID = 'acervo-completo';

@Injectable()
export class TracksRepository implements OnModuleInit {
  private readonly logger = new Logger(TracksRepository.name);
  private data: TracksFileV2 = { version: 2, tracks: [], quizzes: [] };
  /** Marca inicio de save() para o watcher ignorar o proprio evento. */
  private saving = false;
  private saveGuardUntil = 0;

  onModuleInit(): void {
    this.ensureLayout();
    this.reload();
    try {
      watch(QUIZ_TRACKS_FILE, { persistent: false }, () => {
        // Debounce curto — editores gravam em 2 eventos (rename+change).
        // Alem disso, ignora eventos disparados por nosso proprio save().
        setTimeout(() => {
          if (this.saving || Date.now() < this.saveGuardUntil) return;
          this.reload();
        }, 100);
      });
      this.logger.log(`Watching ${QUIZ_TRACKS_FILE}`);
    } catch (e) {
      this.logger.warn(`fs.watch nao ativou em ${QUIZ_TRACKS_FILE}: ${(e as Error).message}`);
    }
  }

  // ---------- leitura ----------

  listTracks(): QuizTrack[] { return this.data.tracks; }
  listQuizzes(): QuizDefinition[] { return this.data.quizzes; }

  listQuizSummaries(): QuizSummary[] {
    return this.data.quizzes.map((q) => ({
      id: q.id,
      name: q.name,
      description: q.description,
      trackCount: q.trackIds.length,
    }));
  }

  getTrack(id: string): QuizTrack | undefined {
    return this.data.tracks.find((t) => t.id === id);
  }

  getQuiz(id: string): QuizDefinition | undefined {
    return this.data.quizzes.find((q) => q.id === id);
  }

  /** Amostra `n` faixas de um quiz especifico (sem repeticao se possivel). */
  sampleFromQuiz(quizId: string, n: number): QuizTrack[] {
    const quiz = this.getQuiz(quizId);
    if (!quiz || quiz.trackIds.length === 0) return [];
    const trackMap = new Map(this.data.tracks.map((t) => [t.id, t]));
    const pool = quiz.trackIds.map((id) => trackMap.get(id)).filter((t): t is QuizTrack => !!t);
    if (pool.length === 0) return [];
    const out: QuizTrack[] = [];
    let remaining = [...pool];
    while (out.length < n) {
      if (remaining.length === 0) remaining = [...pool];
      const idx = Math.floor(Math.random() * remaining.length);
      out.push(remaining.splice(idx, 1)[0]!);
    }
    return out;
  }

  /** Fallback quando ninguem passa quizId — sorteia da biblioteca inteira. */
  sampleFromLibrary(n: number): QuizTrack[] {
    if (this.data.tracks.length === 0) return [];
    const out: QuizTrack[] = [];
    let pool = [...this.data.tracks];
    while (out.length < n) {
      if (pool.length === 0) pool = [...this.data.tracks];
      const idx = Math.floor(Math.random() * pool.length);
      out.push(pool.splice(idx, 1)[0]!);
    }
    return out;
  }

  // ---------- escrita ----------

  createTrack(input: Omit<QuizTrack, 'id'> & { id?: string }): QuizTrack {
    const id = input.id?.trim() || this.slug(input.title ?? input.questionText ?? randomUUID());
    if (this.getTrack(id)) throw new Error(`Faixa com id "${id}" ja existe.`);
    const track: QuizTrack = { ...input, id };
    this.assertValidTrack(track);
    this.data.tracks.push(track);
    this.save();
    return track;
  }

  updateTrack(id: string, patch: Partial<Omit<QuizTrack, 'id'>>): QuizTrack {
    const cur = this.getTrack(id);
    if (!cur) throw new Error('Faixa nao encontrada.');
    const next: QuizTrack = { ...cur, ...patch, id };
    this.assertValidTrack(next);
    const idx = this.data.tracks.findIndex((t) => t.id === id);
    this.data.tracks[idx] = next;
    this.save();
    return next;
  }

  deleteTrack(id: string): void {
    const before = this.data.tracks.length;
    this.data.tracks = this.data.tracks.filter((t) => t.id !== id);
    if (this.data.tracks.length === before) throw new Error('Faixa nao encontrada.');
    // Remove referencia da faixa em todos os quizzes
    for (const q of this.data.quizzes) {
      q.trackIds = q.trackIds.filter((tid) => tid !== id);
      q.updatedAt = Date.now();
    }
    this.save();
  }

  createQuiz(input: { name: string; description?: string; trackIds?: string[] }): QuizDefinition {
    if (!input.name.trim()) throw new Error('Nome do quiz obrigatorio.');
    const id = this.slug(input.name);
    if (this.getQuiz(id)) throw new Error(`Quiz com id "${id}" ja existe.`);
    const now = Date.now();
    const quiz: QuizDefinition = {
      id,
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      trackIds: (input.trackIds ?? []).filter((tid) => this.getTrack(tid)),
      createdAt: now,
      updatedAt: now,
    };
    this.data.quizzes.push(quiz);
    this.save();
    return quiz;
  }

  updateQuiz(
    id: string,
    patch: Partial<Pick<QuizDefinition, 'name' | 'description' | 'trackIds'>>,
  ): QuizDefinition {
    const cur = this.getQuiz(id);
    if (!cur) throw new Error('Quiz nao encontrado.');
    const next: QuizDefinition = {
      ...cur,
      ...patch,
      trackIds: patch.trackIds
        ? patch.trackIds.filter((tid) => this.getTrack(tid))
        : cur.trackIds,
      updatedAt: Date.now(),
    };
    const idx = this.data.quizzes.findIndex((q) => q.id === id);
    this.data.quizzes[idx] = next;
    this.save();
    return next;
  }

  deleteQuiz(id: string): void {
    const before = this.data.quizzes.length;
    this.data.quizzes = this.data.quizzes.filter((q) => q.id !== id);
    if (this.data.quizzes.length === before) throw new Error('Quiz nao encontrado.');
    this.save();
  }

  // ---------- interno ----------

  private ensureLayout(): void {
    try {
      if (!existsSync(QUIZ_DATA_DIR)) mkdirSync(QUIZ_DATA_DIR, { recursive: true });
      if (!existsSync(QUIZ_ASSETS_DIR)) mkdirSync(QUIZ_ASSETS_DIR, { recursive: true });
      if (!existsSync(join(QUIZ_ASSETS_DIR, 'audio'))) {
        mkdirSync(join(QUIZ_ASSETS_DIR, 'audio'), { recursive: true });
      }
      if (!existsSync(join(QUIZ_ASSETS_DIR, 'covers'))) {
        mkdirSync(join(QUIZ_ASSETS_DIR, 'covers'), { recursive: true });
      }
      if (!existsSync(QUIZ_TRACKS_FILE)) {
        const seed: TracksFileV2 = { version: 2, tracks: [], quizzes: [] };
        writeFileSync(QUIZ_TRACKS_FILE, JSON.stringify(seed, null, 2), 'utf-8');
        this.logger.log(`Criado tracks.json vazio em ${QUIZ_TRACKS_FILE}`);
      }
    } catch (e) {
      this.logger.error(`Nao consegui inicializar ${QUIZ_DATA_DIR}: ${(e as Error).message}`);
    }
  }

  private reload(): void {
    try {
      const raw = readFileSync(QUIZ_TRACKS_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as TracksFileV1 | TracksFileV2;
      const version = (parsed as TracksFileV2).version;
      if (version === 2) {
        this.data = this.normalizeV2(parsed as TracksFileV2);
        this.logger.log(
          `tracks.json v2 carregado: ${this.data.tracks.length} faixa(s), ${this.data.quizzes.length} quiz(zes)`,
        );
      } else {
        this.data = this.migrateV1ToV2(parsed as TracksFileV1);
        this.logger.log(
          `tracks.json v1 detectado — migrando para v2 (${this.data.tracks.length} faixa(s) envolvidas no quiz "${ALL_QUIZ_ID}")`,
        );
        this.save(); // grava a versao migrada de volta
      }
    } catch (e) {
      this.logger.error(`Falha lendo tracks.json: ${(e as Error).message}`);
    }
  }

  private normalizeV2(f: TracksFileV2): TracksFileV2 {
    const validTracks: QuizTrack[] = [];
    const rejected: string[] = [];
    const seenIds = new Set<string>();
    for (const t of f.tracks ?? []) {
      const problem = this.validateTrack(t);
      if (problem) { rejected.push(`${t.id ?? '(sem id)'}: ${problem}`); continue; }
      if (seenIds.has(t.id)) { rejected.push(`${t.id}: id duplicado`); continue; }
      seenIds.add(t.id);
      validTracks.push(t);
    }
    if (rejected.length) {
      this.logger.warn(`Faixas rejeitadas:\n  - ${rejected.join('\n  - ')}`);
    }
    const validQuizzes: QuizDefinition[] = (f.quizzes ?? [])
      .filter((q) => typeof q.id === 'string' && q.id && typeof q.name === 'string' && q.name)
      .map((q) => ({
        ...q,
        trackIds: (q.trackIds ?? []).filter((id) => seenIds.has(id)),
        createdAt: q.createdAt ?? Date.now(),
        updatedAt: q.updatedAt ?? Date.now(),
      }));
    return {
      version: 2,
      _readme: f._readme,
      tracks: validTracks,
      quizzes: validQuizzes,
    };
  }

  private migrateV1ToV2(v1: TracksFileV1): TracksFileV2 {
    const now = Date.now();
    const tracks: QuizTrack[] = [];
    const rejected: string[] = [];
    for (const t of v1.tracks ?? []) {
      if (!t.id || !t.audioFile || !t.questionText) {
        rejected.push(`${t.id ?? '(sem id)'}: campos obrigatorios ausentes`);
        continue;
      }
      const migrated: QuizTrack = {
        id: t.id,
        title: t.title,
        artist: t.artist,
        source: { kind: 'local', audioFile: t.audioFile },
        coverUrl: t.coverFile,
        questionText: t.questionText,
        options: t.options,
        correctIndex: t.correctIndex,
        startSec: t.startSec,
        durationSec: t.durationSec,
      };
      const problem = this.validateTrack(migrated);
      if (problem) { rejected.push(`${t.id}: ${problem}`); continue; }
      tracks.push(migrated);
    }
    if (rejected.length) {
      this.logger.warn(`Faixas v1 rejeitadas na migracao:\n  - ${rejected.join('\n  - ')}`);
    }
    const quiz: QuizDefinition = {
      id: ALL_QUIZ_ID,
      name: 'Acervo completo',
      description: 'Todas as faixas importadas da versao antiga.',
      trackIds: tracks.map((t) => t.id),
      createdAt: now,
      updatedAt: now,
    };
    return {
      version: 2,
      _readme: v1._readme,
      tracks,
      quizzes: tracks.length > 0 ? [quiz] : [],
    };
  }

  /** Escrita atomica: escreve `.tmp` e faz rename. Watcher ignora via flag. */
  private save(): void {
    this.saving = true;
    this.saveGuardUntil = Date.now() + 500;
    const tmp = `${QUIZ_TRACKS_FILE}.tmp`;
    try {
      const json = JSON.stringify(this.data, null, 2) + '\n';
      writeFileSync(tmp, json, 'utf-8');
      renameSync(tmp, QUIZ_TRACKS_FILE);
    } catch (e) {
      this.logger.error(`Falha escrevendo tracks.json: ${(e as Error).message}`);
      try { unlinkSync(tmp); } catch { /* ignore */ }
      throw e;
    } finally {
      this.saving = false;
    }
  }

  private assertValidTrack(t: QuizTrack): void {
    const problem = this.validateTrack(t);
    if (problem) throw new Error(problem);
  }

  private validateTrack(t: Partial<QuizTrack>): string | null {
    if (!t || typeof t !== 'object') return 'nao e objeto';
    if (typeof t.id !== 'string' || !t.id) return 'id ausente';
    if (typeof t.questionText !== 'string' || !t.questionText) return 'questionText ausente';
    if (!Array.isArray(t.options) || t.options.length !== 4) return 'options precisa ter exatamente 4 strings';
    if (!t.options.every((o) => typeof o === 'string' && o.length > 0)) return 'alguma option esta vazia';
    if (typeof t.correctIndex !== 'number' || t.correctIndex < 0 || t.correctIndex > 3) return 'correctIndex fora de 0..3';
    if (!this.validateSource(t.source)) return 'source invalida';
    return null;
  }

  private validateSource(s?: QuizAudioSource): s is QuizAudioSource {
    if (!s || typeof s !== 'object' || typeof (s as { kind?: unknown }).kind !== 'string') return false;
    if (s.kind === 'local') return typeof s.audioFile === 'string' && s.audioFile.length > 0;
    if (s.kind === 'spotify') return typeof s.trackId === 'string' && s.trackId.length > 0;
    return false;
  }

  private slug(input: string): string {
    return input
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || randomUUID().slice(0, 8);
  }
}
