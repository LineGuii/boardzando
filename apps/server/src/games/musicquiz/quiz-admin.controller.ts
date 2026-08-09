import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  Allow,
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
import type {
  QuizDefinition,
  QuizSummary,
  QuizTrack,
} from '@boardzando/contracts';
import { AdminGuard } from '../../auth/admin.guard';
import { TracksRepository } from './tracks.repository';
import {
  SpotifyService,
  type DistractorField,
  type SpotifyTrackResult,
} from './spotify.service';

// ---------- DTOs ----------

/**
 * `source` e union discriminada; class-validator nao suporta union nativa.
 * Marcamos com @Allow() para passar pelo ValidationPipe (whitelist) e o
 * TracksRepository.validateSource valida o shape em runtime.
 */
class TrackInputDto {
  @IsOptional() @IsString() @MaxLength(64) id?: string;
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(200) artist?: string;

  @Allow() source!: unknown;

  @IsOptional() @IsString() @MaxLength(500) coverUrl?: string;
  @IsString() @IsNotEmpty() @MaxLength(300) questionText!: string;

  @IsArray() @ArrayMinSize(4) @ArrayMaxSize(4)
  @IsString({ each: true })
  options!: [string, string, string, string];

  @IsInt() @Min(0) @Max(3) correctIndex!: 0 | 1 | 2 | 3;

  @IsOptional() @IsString() @IsIn(['easy', 'medium', 'hard'])
  difficulty?: 'easy' | 'medium' | 'hard';

  @IsOptional() @IsInt() @Min(0) startSec?: number;
  @IsOptional() @IsInt() @Min(1) @Max(120) durationSec?: number;
}

class TrackPatchDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(200) artist?: string;
  @IsOptional() @Allow() source?: unknown;
  @IsOptional() @IsString() @MaxLength(500) coverUrl?: string;
  @IsOptional() @IsString() @MaxLength(300) questionText?: string;
  @IsOptional() @IsArray() @ArrayMinSize(4) @ArrayMaxSize(4) @IsString({ each: true })
  options?: [string, string, string, string];
  @IsOptional() @IsInt() @Min(0) @Max(3) correctIndex?: 0 | 1 | 2 | 3;
  @IsOptional() @IsString() @IsIn(['easy', 'medium', 'hard'])
  difficulty?: 'easy' | 'medium' | 'hard';
  @IsOptional() @IsInt() @Min(0) startSec?: number;
  @IsOptional() @IsInt() @Min(1) @Max(120) durationSec?: number;
}

class QuizInputDto {
  @IsString() @IsNotEmpty() @MaxLength(80) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) trackIds?: string[];
}

class QuizPatchDto {
  @IsOptional() @IsString() @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) trackIds?: string[];
}

class SpotifyDistractorsDto {
  @IsString() @IsNotEmpty() @MaxLength(64) trackId!: string;
  @IsString() @MaxLength(200) trackName!: string;
  @IsString() @MaxLength(200) artistName!: string;
  @IsOptional() @IsString() @MaxLength(64) artistId?: string;
  @IsString() @IsIn(['title', 'artist']) field!: DistractorField;
}

/**
 * Rotas de administracao do editor de quizzes. Todas exigem
 * `Authorization: Bearer <admin-jwt>` (AdminGuard). Publicos apenas:
 *   - GET /quiz/quizzes (lista resumida, usada pelo seletor de sala)
 *   - GET /quiz/rooms (nao esta aqui — vive em QuizController)
 */
@Controller('quiz')
export class QuizAdminController {
  constructor(
    private readonly repo: TracksRepository,
    private readonly spotify: SpotifyService,
  ) {}

  /** Publico — o formulario de criar sala precisa listar quizzes disponiveis. */
  @Get('quizzes')
  listPublicQuizzes(): QuizSummary[] {
    return this.repo.listQuizSummaries().filter((q) => q.trackCount > 0);
  }

  // ---------- Tracks ----------
  @Get('admin/tracks')
  @UseGuards(AdminGuard)
  listTracks(): QuizTrack[] {
    return this.repo.listTracks();
  }

  @Post('admin/tracks')
  @UseGuards(AdminGuard)
  createTrack(@Body() dto: TrackInputDto): QuizTrack {
    return this.repo.createTrack(dto as unknown as Omit<QuizTrack, 'id'> & { id?: string });
  }

  @Put('admin/tracks/:id')
  @UseGuards(AdminGuard)
  updateTrack(@Param('id') id: string, @Body() dto: TrackPatchDto): QuizTrack {
    try {
      return this.repo.updateTrack(id, dto as Partial<QuizTrack>);
    } catch (e) {
      throw new NotFoundException((e as Error).message);
    }
  }

  @Delete('admin/tracks/:id')
  @UseGuards(AdminGuard)
  @HttpCode(204)
  deleteTrack(@Param('id') id: string): void {
    try { this.repo.deleteTrack(id); }
    catch (e) { throw new NotFoundException((e as Error).message); }
  }

  // ---------- Quizzes ----------
  @Get('admin/quizzes')
  @UseGuards(AdminGuard)
  listQuizzes(): QuizDefinition[] {
    return this.repo.listQuizzes();
  }

  @Post('admin/quizzes')
  @UseGuards(AdminGuard)
  createQuiz(@Body() dto: QuizInputDto): QuizDefinition {
    return this.repo.createQuiz(dto);
  }

  @Put('admin/quizzes/:id')
  @UseGuards(AdminGuard)
  updateQuiz(@Param('id') id: string, @Body() dto: QuizPatchDto): QuizDefinition {
    try { return this.repo.updateQuiz(id, dto); }
    catch (e) { throw new NotFoundException((e as Error).message); }
  }

  @Delete('admin/quizzes/:id')
  @UseGuards(AdminGuard)
  @HttpCode(204)
  deleteQuiz(@Param('id') id: string): void {
    try { this.repo.deleteQuiz(id); }
    catch (e) { throw new NotFoundException((e as Error).message); }
  }

  // ---------- Spotify (admin) ----------

  /** Indica ao cliente se o server tem credenciais Spotify configuradas. */
  @Get('admin/spotify/status')
  @UseGuards(AdminGuard)
  spotifyStatus(): { configured: boolean } {
    return { configured: this.spotify.isConfigured };
  }

  @Get('admin/spotify/search')
  @UseGuards(AdminGuard)
  async spotifySearch(@Query('q') q: string): Promise<SpotifyTrackResult[]> {
    return this.spotify.searchTracks(q ?? '', 12);
  }

  @Post('admin/spotify/distractors')
  @UseGuards(AdminGuard)
  async spotifyDistractors(@Body() dto: SpotifyDistractorsDto): Promise<{ options: string[] }> {
    const options = await this.spotify.buildDistractors(
      { trackId: dto.trackId, trackName: dto.trackName, artistName: dto.artistName, artistId: dto.artistId },
      dto.field,
    );
    return { options };
  }
}
