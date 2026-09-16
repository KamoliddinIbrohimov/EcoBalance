import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';

import { StorageModule } from '../storage/storage.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CaslAbilityFactory } from './authorization/casl-ability.factory';
import { PermissionsGuard } from './authorization/permissions.guard';
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
    StorageModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    PasswordService,
    AuditService,
    JwtAccessStrategy,
    JwtRefreshStrategy,
    CaslAbilityFactory,
    PermissionsGuard,
  ],
  // Exported so feature modules (Users, Organizations, Roles, ...) can import
  // AuthModule once and get PasswordService/AuditService for their own
  // services plus PermissionsGuard/CaslAbilityFactory for their controllers'
  // `@UseGuards(PermissionsGuard)` + `@RequirePermissions(...)`.
  exports: [AuthService, TokenService, PasswordService, AuditService, CaslAbilityFactory, PermissionsGuard],
})
export class AuthModule {}
