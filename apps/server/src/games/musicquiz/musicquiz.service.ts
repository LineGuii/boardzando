import { forwardRef, Global, Injectable, Logger, Module } from '@nestjs/common';
import type { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  PlayerId,
  QuizFinalPayload,
  QuizOptions,
  QuizPhase,
  QuizPlayerScore,
  QuizQuestionPublic,
  QuizRevealPayload,
  QuizSnapshot,
  QuizTrack,
  RoomId,
  ServerToClientEvents,
} from '@boardzando/contracts';
import { QUIZ_DEFAULTS } from '@boardzando/contracts';
import { RoomService } from '../../core/room/room.service';
import { CoreModule } from '../../core/core.module';
import { QUIZ_MEDIA_PREFIX, TracksRepository } from './tracks.repository';
import { MusicQuizGame } from './musicquiz.game';
import { QuizAdminController } from './quiz-admin.controller';
import { SpotifyService } from './spotify.service';

const ANSWER_WINDOW_MS = 30_000;
/** Tempo entre `quiz:preload` e `quiz:question` — janela para pre-carregar audio. */
const PRELOAD_LEAD_MS = 4_000;
/** Tempo em que o reveal fica na tela antes de auto-avancar (host pode pular). */
const REVEAL_MS = 7_000;
/** Tempo entre `quiz:final` sinalizado e o efetivo dispose (para animacao lenta). */
const FINAL_DRAMA_MS = 0; // o cliente controla o drama; o server so envia o ranking

type QuizGameServer = Server<ClientToServerEvents, ServerToClientEvents>;

interface AnswerRecord {
  optionIndex: number;
  elapsedMs: number;
  correct: boolean;
  gain: number;
}

interface RoundState {
  track: QuizTrack;
  question: QuizQuestionPublic;
  /** playerId -> AnswerRecord (jogadores nao-presenters). */
  answers: Map<PlayerId, AnswerRecord>;
  /** playerId -> true, coletado via `quiz:ready` (nao bloqueia hoje). */
  ready: Set<PlayerId>;
  /** Timeout do 30s + reveal auto. */
  answerTimeout?: NodeJS.Timeout;
  revealTimeout?: NodeJS.Timeout;
}

interface QuizMatch {
  roomId: RoomId;
  hostId: PlayerId;
  options: QuizOptions;
  tracks: QuizTrack[];
  currentIndex: number;
  phase: QuizPhase;
  /** playerId -> total acumulado. */
  scores: Map<PlayerId, number>;
  /** Rank de cada player ANTES da rodada atual (para animar). */
  ranksBefore: Map<PlayerId, number>;
  /** Historico agregado por jogador. */
  stats: Map<PlayerId, { correctCount: number; bestElapsedMs?: number }>;
  round?: RoundState;
  lastReveal?: QuizRevealPayload;
  lastFinal?: QuizFinalPayload;
  /** Sequencia monotonica para animacoes idempotentes no cliente. */
  seq: number;
}

/**
 * Coracao do Music Quiz. Detem uma partida por sala em memoria e emite
 * `quiz:*` diretamente pelo Socket.IO Server. E o unico lugar do servidor que
 * usa `Date.now()` como fonte de sincronia (a engine dos outros jogos e
 * deliberadamente pura). Reconexao: `snapshotFor` monta o estado atual para
 * quem volta no meio.
 */
@Injectable()
export class MusicQuizService {
  private readonly logger = new Logger(MusicQuizService.name);
  private readonly matches = new Map<RoomId, QuizMatch>();
  /** Injetado pelo gateway apos WebSocketServer estar pronto. */
  private server?: QuizGameServer;

  constructor(
    private readonly rooms: RoomService,
    private readonly tracks: TracksRepository,
  ) {}

  /** Chamado uma unica vez pelo gateway. */
  setServer(server: QuizGameServer): void {
    this.server = server;
  }

  isQuiz(gameId: string): boolean {
    return gameId === 'musicquiz' || gameId === new MusicQuizGame().id;
  }

  hasMatch(roomId: RoomId): boolean {
    return this.matches.has(roomId);
  }

  /** Snapshot para reconexao (ou undefined se nao ha partida ativa). */
  snapshotFor(roomId: RoomId, _playerId: PlayerId): QuizSnapshot | undefined {
    const m = this.matches.get(roomId);
    if (!m) return undefined;
    // NUNCA vaza correctIndex durante playing/preloading — nem para o host
    // apresentador. O host projeta a tela na TV e nao deve saber a resposta
    // (surpresa vale para todo mundo). No reveal, o correctIndex vai no
    // proprio payload de quiz:reveal.
    const question = m.round ? this.stripCorrect(m.round.question, false) : undefined;
    return {
      phase: m.phase,
      options: m.options,
      scores: this.rankingSnapshot(m),
      currentIndex: m.currentIndex,
      totalRounds: m.options.rounds,
      question,
      reveal: m.phase === 'reveal' ? m.lastReveal : undefined,
      final: m.phase === 'finished' ? m.lastFinal : undefined,
    };
  }

  /**
   * Inicia (ou reinicia) a partida. Chamado pelo gateway no lugar de
   * `RoomService.startGame` quando `room.gameId === 'musicquiz'`.
   */
  startMatch(roomId: RoomId, requesterId: PlayerId, rawOptions: unknown): void {
    const room = this.rooms.getOrThrow(roomId);
    if (requesterId !== room.hostId) throw new Error('ONLY_HOST_CAN_START');
    if (room.status === 'playing') throw new Error('ALREADY_STARTED');

    const options = this.readOptions(rawOptions);

    // Cancela partida antiga (se reiniciando)
    this.disposeMatch(roomId);

    // Se o host escolheu um quiz especifico, sorteia dele; caso contrario
    // usa a biblioteca inteira (fallback / compat com salas antigas).
    const orderMode = options.orderMode ?? 'random';
    const chosen = options.quizId
      ? this.tracks.sampleFromQuiz(options.quizId, options.rounds, orderMode)
      : this.tracks.sampleFromLibrary(options.rounds, orderMode);
    if (chosen.length === 0) {
      throw new Error(
        options.quizId ? `QUIZ_VAZIO:${options.quizId}` : 'SEM_MUSICAS_CADASTRADAS',
      );
    }
    const match: QuizMatch = {
      roomId,
      hostId: room.hostId,
      options,
      tracks: chosen,
      currentIndex: -1,
      phase: 'lobby',
      scores: new Map(),
      ranksBefore: new Map(),
      stats: new Map(),
      seq: 0,
    };
    // Presenters (host quando !hostIsPlayer) tambem entram, mas nunca pontuam.
    for (const pid of room.players.keys()) {
      match.scores.set(pid, 0);
      match.stats.set(pid, { correctCount: 0 });
    }
    this.matches.set(roomId, match);
    room.status = 'playing';
    room.lastGameOptions = options;
    this.logger.log(`Quiz iniciado ${roomId} — ${options.rounds} rodadas, modo ${options.audioMode}`);
    // Dispara a 1a rodada
    this.nextQuestion(match);
  }

  /** Host pula o reveal — proxima pergunta agora. */
  requestNext(roomId: RoomId, requesterId: PlayerId): void {
    const m = this.matches.get(roomId);
    if (!m) throw new Error('SEM_PARTIDA');
    if (requesterId !== m.hostId) throw new Error('ONLY_HOST');
    if (m.phase !== 'reveal') return;
    if (m.round?.revealTimeout) clearTimeout(m.round.revealTimeout);
    this.nextQuestion(m);
  }

  /**
   * Host pausa/retoma o auto-advance do reveal. Enquanto pausado, o
   * `revealTimeout` fica desarmado — proxima pergunta so vem via
   * `quiz:next` (Continuar) ou nova chamada de pause(false) que reagenda.
   */
  pauseReveal(roomId: RoomId, requesterId: PlayerId, paused: boolean): void {
    const m = this.matches.get(roomId);
    if (!m) throw new Error('SEM_PARTIDA');
    if (requesterId !== m.hostId) throw new Error('ONLY_HOST');
    if (m.phase !== 'reveal' || !m.round || !m.lastReveal) return;
    if (paused) {
      if (m.round.revealTimeout) {
        clearTimeout(m.round.revealTimeout);
        m.round.revealTimeout = undefined;
      }
      m.lastReveal = { ...m.lastReveal, paused: true };
    } else {
      // Retoma com uma janela nova (mesma duracao do reveal).
      const nextAt = Date.now() + REVEAL_MS;
      m.round.revealTimeout = setTimeout(() => this.nextQuestion(m), REVEAL_MS);
      m.lastReveal = { ...m.lastReveal, paused: false, nextAt };
    }
    m.seq += 1;
    m.lastReveal = { ...m.lastReveal, seq: m.seq };
    this.server?.to(`room:${m.roomId}`).emit('quiz:reveal', { roomId: m.roomId, reveal: m.lastReveal });
  }

  /** Cliente respondeu. */
  submitAnswer(
    roomId: RoomId,
    playerId: PlayerId,
    questionIndex: number,
    optionIndex: number,
  ): { acceptedAt: number } {
    const m = this.matches.get(roomId);
    if (!m || !m.round || m.phase !== 'playing') throw new Error('NAO_ESTA_RESPONDENDO');
    if (m.currentIndex !== questionIndex) throw new Error('PERGUNTA_DEFASADA');
    // Presenter host nao responde
    if (playerId === m.hostId && !m.options.hostIsPlayer) throw new Error('HOST_APRESENTADOR');
    if (m.round.answers.has(playerId)) throw new Error('JA_RESPONDEU');

    const elapsedMs = Date.now() - m.round.question.serverStartAt;
    if (elapsedMs < 0) throw new Error('ANTES_DO_INICIO');
    if (elapsedMs > ANSWER_WINDOW_MS) throw new Error('FORA_DO_TEMPO');

    const correct = optionIndex === m.round.track.correctIndex;
    const gain = correct ? this.scoreFor(elapsedMs) : 0;
    m.round.answers.set(playerId, { optionIndex, elapsedMs, correct, gain });

    if (correct) {
      const st = m.stats.get(playerId)!;
      st.correctCount += 1;
      st.bestElapsedMs =
        st.bestElapsedMs === undefined ? elapsedMs : Math.min(st.bestElapsedMs, elapsedMs);
    }

    // Se todos os jogadores nao-apresentadores ja responderam, antecipa o reveal
    const playing = this.playingPlayerIds(m);
    if (playing.every((pid) => m.round!.answers.has(pid))) {
      if (m.round.answerTimeout) clearTimeout(m.round.answerTimeout);
      this.revealQuestion(m);
    }
    return { acceptedAt: Date.now() };
  }

  /** Chamado pelo gateway quando um room termina (disconnect completo etc). */
  disposeMatch(roomId: RoomId): void {
    const m = this.matches.get(roomId);
    if (!m) return;
    if (m.round?.answerTimeout) clearTimeout(m.round.answerTimeout);
    if (m.round?.revealTimeout) clearTimeout(m.round.revealTimeout);
    this.matches.delete(roomId);
  }

  markReady(roomId: RoomId, playerId: PlayerId, questionIndex: number): void {
    const m = this.matches.get(roomId);
    if (!m?.round) return;
    if (m.currentIndex !== questionIndex) return;
    m.round.ready.add(playerId);
  }

  // ---------- interno ----------

  private nextQuestion(m: QuizMatch): void {
    const nextIdx = m.currentIndex + 1;
    if (nextIdx >= m.options.rounds) {
      this.finishMatch(m);
      return;
    }
    // Snapshot dos ranks ANTES desta rodada (para animar depois)
    const currentRanking = this.rankingSnapshot(m);
    m.ranksBefore = new Map(currentRanking.map((r) => [r.playerId, r.rank]));

    m.currentIndex = nextIdx;
    m.phase = 'preloading';
    const track = m.tracks[nextIdx]!;
    const serverStartAt = Date.now() + PRELOAD_LEAD_MS;

    // URL do audio depende da fonte:
    //   - local:   /media/musicquiz/<audioFile>  (proxy do Vite passa)
    //   - spotify: URI reproduzido pelo cliente via Web Playback SDK (fase 4);
    //              por ora expomos o trackId como "spotify:track:<id>" e o
    //              cliente ramifica em source.kind na hora de tocar.
    let audioUrl: string;
    if (track.source.kind === 'local') {
      audioUrl = `${QUIZ_MEDIA_PREFIX}/${track.source.audioFile}`;
    } else {
      audioUrl = `spotify:track:${track.source.trackId}`;
    }
    // Capa: se vier absoluta (Spotify), usa direto; senao concatena o prefixo.
    const coverUrl = track.coverUrl
      ? (/^https?:/i.test(track.coverUrl)
          ? track.coverUrl
          : `${QUIZ_MEDIA_PREFIX}/${track.coverUrl}`)
      : undefined;

    const publicQ: QuizQuestionPublic = {
      index: nextIdx,
      total: m.options.rounds,
      audioUrl,
      coverUrl,
      questionText: track.questionText,
      options: track.options,
      serverStartAt,
      startSec: track.startSec ?? 0,
      durationSec: track.durationSec ?? 30,
      answerWindowMs: ANSWER_WINDOW_MS,
    };

    m.round = {
      track,
      question: publicQ,
      answers: new Map(),
      ready: new Set(),
    };

    // Emite preload para todos; a versao com correctIndex vai APENAS ao host
    // apresentador. Depois de PRELOAD_LEAD_MS, emite `quiz:question` (mesma
    // versao filtrada) e liga o timer do 30s.
    this.emitPreload(m);

    const untilStart = Math.max(0, serverStartAt - Date.now());
    setTimeout(() => this.startQuestion(m), untilStart);
  }

  private startQuestion(m: QuizMatch): void {
    if (!m.round) return;
    m.phase = 'playing';
    this.emitQuestion(m);
    m.round.answerTimeout = setTimeout(() => this.revealQuestion(m), ANSWER_WINDOW_MS + 200);
  }

  private revealQuestion(m: QuizMatch): void {
    if (!m.round || m.phase === 'reveal') return;

    // Consolida pontos ANTES de decidir o fluxo (ranking final precisa).
    for (const [pid, rec] of m.round.answers) {
      const cur = m.scores.get(pid) ?? 0;
      m.scores.set(pid, cur + rec.gain);
    }

    // Na ULTIMA pergunta pula o placar da rodada e vai direto pro reveal
    // final (a tela "Fim da Partida" ja faz o suspense com drum roll).
    const isLastRound = m.currentIndex >= m.options.rounds - 1;
    if (isLastRound) {
      this.finishMatch(m);
      return;
    }

    m.phase = 'reveal';

    // Monta ranking com rankBefore e lastGain/lastCorrect/lastElapsedMs
    const nowRanking = this.rankingSnapshot(m).map<QuizPlayerScore>((r) => {
      const rec = m.round!.answers.get(r.playerId);
      return {
        ...r,
        rankBefore: m.ranksBefore.get(r.playerId),
        lastGain: rec?.gain ?? (r.presenter ? undefined : 0),
        lastCorrect: rec?.correct,
        lastElapsedMs: rec?.elapsedMs,
      };
    });

    m.seq += 1;
    const nextAt = Date.now() + REVEAL_MS;
    const reveal: QuizRevealPayload = {
      index: m.currentIndex,
      total: m.options.rounds,
      correctIndex: m.round.track.correctIndex,
      ranking: nowRanking,
      seq: m.seq,
      nextAt,
    };
    m.lastReveal = reveal;
    this.server?.to(`room:${m.roomId}`).emit('quiz:reveal', { roomId: m.roomId, reveal });

    m.round.revealTimeout = setTimeout(() => this.nextQuestion(m), REVEAL_MS);
  }

  private finishMatch(m: QuizMatch): void {
    m.phase = 'finished';
    m.seq += 1;
    const ranking = this.rankingSnapshot(m).map<QuizPlayerScore>((r) => ({
      ...r,
      rankBefore: m.ranksBefore.get(r.playerId),
    }));
    const stats = [...m.stats.entries()].map(([playerId, s]) => ({
      playerId,
      correctCount: s.correctCount,
      bestElapsedMs: s.bestElapsedMs,
    }));
    const final: QuizFinalPayload = { ranking, stats, seq: m.seq };
    m.lastFinal = final;
    this.server?.to(`room:${m.roomId}`).emit('quiz:final', { roomId: m.roomId, final });

    const room = this.rooms.get(m.roomId);
    if (room) room.status = 'finished';
    // Nao deleta o match — clientes reconectando precisam do lastFinal.
    // Sera limpo quando a sala for reiniciada ou destruida.
    if (FINAL_DRAMA_MS > 0) setTimeout(() => {}, FINAL_DRAMA_MS);
  }

  private emitPreload(m: QuizMatch): void {
    if (!m.round || !this.server) return;
    const room = this.rooms.get(m.roomId);
    if (!room) return;
    // Ver comentario em emitQuestion — correctIndex nunca vai antes do reveal.
    const q = this.stripCorrect(m.round.question, false);
    for (const [, player] of room.players) {
      if (!player.connected || !player.socketId) continue;
      this.server.to(player.socketId).emit('quiz:preload', { roomId: m.roomId, question: q });
    }
  }

  private emitQuestion(m: QuizMatch): void {
    if (!m.round || !this.server) return;
    const room = this.rooms.get(m.roomId);
    if (!room) return;
    // Ninguem recebe correctIndex durante playing — nem o host. A tela do
    // host tende a ser projetada e nao pode revelar o gabarito antes do
    // reveal para nao entregar a resposta a todo mundo na sala.
    const q = this.stripCorrect(m.round.question, false);
    for (const [, player] of room.players) {
      if (!player.connected || !player.socketId) continue;
      this.server.to(player.socketId).emit('quiz:question', { roomId: m.roomId, question: q });
    }
  }

  private stripCorrect(q: QuizQuestionPublic, includeCorrect: boolean): QuizQuestionPublic {
    if (includeCorrect) {
      // Anexa correctIndex baseado no track corrente
      const match = [...this.matches.values()].find((m) => m.round?.question === q);
      const track = match?.round?.track;
      return { ...q, correctIndex: track?.correctIndex };
    }
    // Garante que nunca vaza
    const { correctIndex: _c, ...rest } = q;
    return rest as QuizQuestionPublic;
  }

  private scoreFor(elapsedMs: number): number {
    const t = Math.max(0, Math.min(1, elapsedMs / ANSWER_WINDOW_MS));
    return Math.round(500 + 500 * (1 - t));
  }

  private playingPlayerIds(m: QuizMatch): PlayerId[] {
    const room = this.rooms.get(m.roomId);
    if (!room) return [];
    const out: PlayerId[] = [];
    for (const [pid] of room.players) {
      if (pid === m.hostId && !m.options.hostIsPlayer) continue;
      out.push(pid);
    }
    return out;
  }

  /** Snapshot do ranking com nomes/cores atuais. Ordena por score desc, name asc. */
  private rankingSnapshot(m: QuizMatch): QuizPlayerScore[] {
    const room = this.rooms.get(m.roomId);
    if (!room) return [];
    const rows: QuizPlayerScore[] = [];
    for (const [pid, player] of room.players) {
      const presenter = pid === m.hostId && !m.options.hostIsPlayer;
      rows.push({
        playerId: pid,
        name: player.name,
        color: player.color,
        score: m.scores.get(pid) ?? 0,
        rank: 0,
        presenter,
      });
    }
    // Presenters ficam sempre por ultimo (nao participam do rank)
    const players = rows.filter((r) => !r.presenter).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    const presenters = rows.filter((r) => r.presenter);
    players.forEach((r, i) => (r.rank = i + 1));
    presenters.forEach((r) => (r.rank = players.length + 1));
    return [...players, ...presenters];
  }

  private readOptions(raw: unknown): QuizOptions {
    const o = (raw ?? {}) as Partial<QuizOptions>;
    const rounds = typeof o.rounds === 'number' && o.rounds >= 1 && o.rounds <= 50
      ? Math.floor(o.rounds)
      : QUIZ_DEFAULTS.rounds;
    const audioMode = o.audioMode === 'presenter' ? 'presenter' : 'remote';
    const hostIsPlayer = typeof o.hostIsPlayer === 'boolean' ? o.hostIsPlayer : QUIZ_DEFAULTS.hostIsPlayer;
    const quizId = typeof o.quizId === 'string' && o.quizId ? o.quizId : undefined;
    const orderMode = (o.orderMode === 'difficulty' || o.orderMode === 'sequence')
      ? o.orderMode
      : 'random';
    return { rounds, audioMode, hostIsPlayer, quizId, orderMode };
  }
}

/**
 * Modulo global — a instancia do servico e injetada no `GameGateway` (que fica
 * no CoreModule) SEM criar dependencia circular. E tambem o registrador do
 * plugin `MusicQuizGame` para que apareca em `GET /games`.
 */
@Global()
@Module({
  // forwardRef quebra o ciclo de imports ES: CoreModule -> GameGateway ->
  // MusicQuizService -> MusicQuizModule -> CoreModule. Sem forwardRef, um dos
  // lados chega como `undefined` no tempo de leitura do modulo.
  imports: [forwardRef(() => CoreModule)],
  controllers: [QuizAdminController],
  providers: [TracksRepository, MusicQuizGame, MusicQuizService, SpotifyService],
  exports: [MusicQuizService, MusicQuizGame],
})
export class MusicQuizModule {}
