import 'reflect-metadata';
import { join } from 'node:path';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AuthIoAdapter } from './auth/auth.io-adapter';
import { QUIZ_ASSETS_DIR } from './games/musicquiz/tracks.repository';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  // `WEB_ORIGIN` aceita lista separada por virgula para varios frontends
  // (ex: boardzando.rpgzando.com + quiz.rpgzando.com + localhost:5173,5174).
  const webOrigins = (config.get<string>('WEB_ORIGIN', 'http://localhost:5173,http://localhost:5174'))
    .split(',').map((s) => s.trim()).filter(Boolean);
  app.enableCors({
    origin: webOrigins.length === 1 ? webOrigins[0] : webOrigins,
    credentials: true,
  });

  // validacao HTTP (DTOs). A validacao WS e configurada no proprio gateway.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  // Assets do Music Quiz (audios + capas). Servidos com cache longo — arquivos
  // sao imutaveis por convencao (id no nome). O tracks.json em si nao e servido.
  app.useStaticAssets(QUIZ_ASSETS_DIR, {
    prefix: '/media/musicquiz/',
    maxAge: '7d',
    fallthrough: true,
  });

  // adapter que valida o JWT no handshake do WebSocket
  app.useWebSocketAdapter(new AuthIoAdapter(app));

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  new Logger('Bootstrap').log(`Servidor on em http://localhost:${port}`);
  new Logger('Bootstrap').log(`Media do Quiz servida em /media/musicquiz/  (${join(QUIZ_ASSETS_DIR)})`);
}

void bootstrap();
