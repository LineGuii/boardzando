/**
 * Tipos e DTOs do jogo Music Quiz. Diferente dos demais jogos, o Music Quiz nao
 * usa a engine `GameInstance` (que exige moves puros e sincronos): o servidor
 * detem o timer real de 30s por pergunta, agenda audio a partir de um instante
 * absoluto (`serverStartAt`) e computa pontos por tempo de resposta.
 */

import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export type QuizAudioMode = 'remote' | 'presenter';

/**
 * Fonte do audio de uma faixa. Uniao discriminada por `kind`:
 *   - `local`   : arquivo em data/musicquiz/assets/, servido em /media/musicquiz/
 *   - `spotify` : id de faixa do Spotify (reproduzido via Web Playback SDK; fase 4)
 * Formato explicito para permitir novas fontes no futuro sem quebrar quem le.
 */
export type QuizAudioSource =
  | { kind: 'local'; audioFile: string }
  | { kind: 'spotify'; trackId: string; trackName: string; artistName: string };

/** Uma pergunta da biblioteca. `correctIndex` NUNCA vai para jogadores. */
export interface QuizTrack {
  id: string;
  title?: string;
  artist?: string;
  source: QuizAudioSource;
  /** URL absoluta da capa (Spotify) OU caminho relativo em assets/ (local). */
  coverUrl?: string;
  questionText: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  /** Segundo inicial do trecho (default 0). */
  startSec?: number;
  /** Duracao do trecho (default 30s). Apenas hint visual — timer real e 30s no server. */
  durationSec?: number;
}

/** Um quiz nomeado — colecao de faixas da biblioteca. */
export interface QuizDefinition {
  id: string;
  name: string;
  description?: string;
  trackIds: string[];
  createdAt: number;
  updatedAt: number;
}

/** Resumo de um quiz para o seletor no formulario de criar sala. */
export interface QuizSummary {
  id: string;
  name: string;
  description?: string;
  trackCount: number;
}

/** Opcoes escolhidas pelo host ao iniciar a partida. */
export interface QuizOptions {
  /** Numero de perguntas. Default 10, minimo 1, maximo 50. */
  rounds: number;
  /** 'remote': todos os clientes tocam o audio sincronizado.
   *  'presenter': so o host toca (TV compartilhada); jogadores so veem UI. */
  audioMode: QuizAudioMode;
  /** Se true, o host tambem responde e pontua. Se false, so apresenta. */
  hostIsPlayer: boolean;
  /** Qual quiz sortear as faixas. undefined = pool inteiro (compat v1). */
  quizId?: string;
}

export const QUIZ_DEFAULTS: QuizOptions = {
  rounds: 10,
  audioMode: 'remote',
  hostIsPlayer: true,
};

export type QuizPhase =
  | 'lobby'
  | 'preloading'
  | 'playing'
  | 'reveal'
  | 'finished';

/** Pergunta enviada ao cliente (SEM correctIndex, exceto para o host apresentador). */
export interface QuizQuestionPublic {
  index: number;
  total: number;
  audioUrl: string;
  coverUrl?: string;
  questionText: string;
  options: [string, string, string, string];
  /** Timestamp absoluto (Date.now do servidor) em que o audio deve comecar. */
  serverStartAt: number;
  /** Segundo inicial do arquivo. */
  startSec: number;
  /** Duracao do trecho (para UI). */
  durationSec: number;
  /** Janela de resposta em ms (sempre 30_000). */
  answerWindowMs: number;
  /** Correto — vai apenas para o host quando `hostIsPlayer=false`. */
  correctIndex?: 0 | 1 | 2 | 3;
}

export interface QuizPlayerScore {
  playerId: string;
  name: string;
  color?: string;
  score: number;
  /** Rank 1-based no ranking apos esta rodada (ou geral, no final). */
  rank: number;
  /** Rank ANTES desta rodada — permite animar subida/descida no cliente. */
  rankBefore?: number;
  /** Pontos ganhos na rodada corrente (0 se errou/nao respondeu). */
  lastGain?: number;
  /** ms desde inicio da pergunta ate a resposta (undefined se nao respondeu). */
  lastElapsedMs?: number;
  /** true se acertou a ultima pergunta. */
  lastCorrect?: boolean;
  /** true se o jogador e apenas apresentador (nao pontua). */
  presenter?: boolean;
}

/** Payload de `quiz:reveal`: mostra a resposta correta + ranking animado. */
export interface QuizRevealPayload {
  index: number;
  total: number;
  correctIndex: 0 | 1 | 2 | 3;
  ranking: QuizPlayerScore[];
  /** Seq monotonico — cliente usa para idempotencia da animacao. */
  seq: number;
  /** Timestamp servidor em que a proxima pergunta comecara (host pode antecipar). */
  nextAt: number;
}

/** Payload de `quiz:final`: ranking definitivo + estatisticas. */
export interface QuizFinalPayload {
  ranking: QuizPlayerScore[];
  /** Estatisticas por jogador. */
  stats: {
    playerId: string;
    correctCount: number;
    bestElapsedMs?: number;
  }[];
  seq: number;
}

/** Snapshot completo enviado a quem (re)conecta no meio da partida. */
export interface QuizSnapshot {
  phase: QuizPhase;
  options: QuizOptions;
  scores: QuizPlayerScore[];
  currentIndex: number;
  totalRounds: number;
  /** Presente quando `phase === 'playing'` ou `'preloading'`. */
  question?: QuizQuestionPublic;
  /** Presente quando `phase === 'reveal'`. */
  reveal?: QuizRevealPayload;
  /** Presente quando `phase === 'finished'`. */
  final?: QuizFinalPayload;
}

// ---------- DTOs (validados via ValidationPipe no gateway) ----------

export class QuizStartOptionsDto {
  @IsInt() @Min(1) @Max(50)
  rounds!: number;

  @IsString() @IsIn(['remote', 'presenter'])
  audioMode!: QuizAudioMode;

  @IsOptional()
  hostIsPlayer?: boolean;
}

export class QuizAnswerDto {
  @IsString() @IsNotEmpty() @MaxLength(64)
  roomId!: string;

  /** Indice da alternativa clicada (0-3). */
  @IsInt() @Min(0) @Max(3)
  optionIndex!: number;

  /** Indice da pergunta a que a resposta se refere (evita respostas atrasadas
   *  cairem na pergunta seguinte apos race). */
  @IsInt() @Min(0)
  questionIndex!: number;
}

export class QuizNextDto {
  @IsString() @IsNotEmpty() @MaxLength(64)
  roomId!: string;
}

export class QuizPingDto {
  @IsString() @IsNotEmpty() @MaxLength(64)
  roomId!: string;

  /** performance.now() do cliente (opaco para o server). */
  @IsInt()
  clientT!: number;
}

export class QuizReadyDto {
  @IsString() @IsNotEmpty() @MaxLength(64)
  roomId!: string;

  @IsInt() @Min(0)
  questionIndex!: number;
}
