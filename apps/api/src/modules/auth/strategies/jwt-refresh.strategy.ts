import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport-jwt';

import type { AuthenticatedUser } from './jwt-access.strategy';

/**
 * Refresh strategy validates the raw refresh cookie exists.
 * Cryptographic validation happens in TokenService.rotateRefresh
 * (the refresh token itself is an opaque `familyId.random` string, not a JWT).
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor() {
    super({
      jwtFromRequest: (req: Request) => req?.cookies?.['refresh_token'] ?? null,
      ignoreExpiration: true,
      secretOrKey: 'not-used-refresh-is-opaque',
    });
  }

  validate(): AuthenticatedUser {
    // This strategy is unused by design — controller reads req.cookies directly.
    // Kept for future JWT-based refresh evolution.
    throw new UnauthorizedException();
  }
}
