import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { type Env, ENV } from '../../config/env';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { TokenCleanupService } from './token-cleanup.service';
import { TokenService } from './token.service';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({ secret: env.JWT_ACCESS_SECRET }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    PasswordService,
    TokenCleanupService,
  ],
  exports: [AuthService, PasswordService, TokenService],
})
export class AuthModule {}
