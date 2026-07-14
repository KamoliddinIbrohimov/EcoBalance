import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './services/token.service';
import { PasswordService } from './services/password.service';
import { AuditService } from './services/audit.service';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt-access' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_ACCESS_TTL', '15m') as unknown as number,
          issuer: 'eco-balance-api',
          audience: 'eco-balance-web',
        },
      }),
    }),
    ThrottlerModule.forRoot([
      { name: 'auth', ttl: 60_000, limit: Number(process.env.RATE_LIMIT_AUTH ?? 10) },
      {
        name: 'forgot',
        ttl: 60 * 60_000,
        limit: Number(process.env.RATE_LIMIT_FORGOT_PASSWORD ?? 3),
      },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    PasswordService,
    AuditService,
    JwtAccessStrategy,
    JwtRefreshStrategy,
  ],
  exports: [AuthService, TokenService, PasswordService, AuditService],
})
export class AuthModule {}
