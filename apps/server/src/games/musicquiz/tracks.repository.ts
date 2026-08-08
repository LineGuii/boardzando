import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readFileSync, watch, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { QuizTrack } from '@boardzando/contracts';

/** Diretorio base dos assets do quiz (audios + capas + tracks.json).
 *  Default: `<repo-root>/data/musicquiz`. Em dev, `process.cwd()` do nest e
 *  `apps/server`; subimos duas pastas. Sobrescreva com QUIZ_DATA_DIR se quiser. */
function resolveDataDir(): string {
  if (process.env.QUIZ_DATA_DIR) return resolve(process.env.QUIZ_DATA_DIR);
  const cwd = process.cwd();
  // Se estamos em apps/server, sobe para root; senao usa cwd.
  const asMonorepoApp = resolve(cwd, '../../data/musicquiz');
  const asRoot = resolve(cwd, 'data/musicquiz');
  return cwd.includes('apps') ? asMonorepoApp : asRoot;
}
export const QUIZ_DATA_DIR = resolveDataDir();
export const QUIZ_TRACKS_FILE = join(QUIZ_DATA_DIR, 'tracks.json');
export const QUIZ_ASSETS_DIR = join(QUIZ_DATA_DIR, 'assets');
/** Prefixo HTTP sob o qual os assets sao servidos (ver main.ts). */
export const QUIZ_MEDIA_PREFIX = '/media/musicquiz';

interface TracksFile {
  version: number;
  tracks: QuizTrack[];
}

/**
 * Le `tracks.json` do disco no boot e reobserva o arquivo com `fs.watch` para
 * hot-reload. Em produ??o, o operador edita o JSON via SSH/deploy e o servidor
 * atualiza a lista automaticamente para as PROXIMAS partidas (partidas em
 * andamento carregam suas perguntas no `startMatch`).
 */
@Injectable()
export class TracksRepository implements OnModuleInit {
  private readonly logger = new Logger(TracksRepository.name);
  private tracks: QuizTrack[] = [];

  onModuleInit(): void {
    this.ensureLayout();
    this.reload();
    try {
      watch(QUIZ_TRACKS_FILE, { persistent: false }, () => {
        // Debounce curto — editores gravam em 2 eventos (rename+change).
        setTimeout(() => this.reload(), 100);
      });
      this.logger.log(`Watching ${QUIZ_TRACKS_FILE}`);
    } catch (e) {
      this.logger.warn(`fs.watch nao ativou em ${QUIZ_TRACKS_FILE}: ${(e as Error).message}`);
    }
  }

  /** Chama sempre que precisar da lista mais recente. */
  list(): QuizTrack[] {
    return this.tracks;
  }

  /** Amostra `n` tracks sem repetir. Se pedir mais do que existe, repete a lista. */
  sample(n: number): QuizTrack[] {
    if (this.tracks.length === 0) return [];
    const pool = [...this.tracks];
    const out: QuizTrack[] = [];
    while (out.length < n) {
      if (pool.length === 0) pool.push(...this.tracks); // permite repetir se n > len
      const idx = Math.floor(Math.random() * pool.length);
      out.push(pool.splice(idx, 1)[0]!);
    }
    return out;
  }

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
        const seed: TracksFile = { version: 1, tracks: [] };
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
      const parsed = JSON.parse(raw) as TracksFile;
      const valid = (parsed.tracks ?? []).filter((t) => this.isValid(t));
      this.tracks = valid;
      this.logger.log(`tracks.json carregado: ${valid.length} pergunta(s)`);
    } catch (e) {
      this.logger.error(`Falha lendo tracks.json: ${(e as Error).message}`);
    }
  }

  private isValid(t: unknown): t is QuizTrack {
    if (!t || typeof t !== 'object') return false;
    const r = t as Record<string, unknown>;
    if (typeof r.id !== 'string' || !r.id) return false;
    if (typeof r.audioFile !== 'string' || !r.audioFile) return false;
    if (typeof r.questionText !== 'string' || !r.questionText) return false;
    if (!Array.isArray(r.options) || r.options.length !== 4) return false;
    if (!r.options.every((o) => typeof o === 'string')) return false;
    if (typeof r.correctIndex !== 'number' || r.correctIndex < 0 || r.correctIndex > 3) return false;
    return true;
  }
}
