import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { CoreModule } from '../core/core.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { QuizController } from './quiz.controller';
import { AdminGuard } from './admin.guard';

@Module({
  imports: [
    CoreModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '30m') },
      }),
    }),
  ],
  controllers: [AuthController, QuizController],
  providers: [AuthService, AdminGuard],
  exports: [AuthService, AdminGuard],
})
export class AuthModule {}
