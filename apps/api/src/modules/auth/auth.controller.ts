import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import {
  type ChangePasswordInput,
  type ForgotPasswordInput,
  type LoginInput,
  type ResetPasswordInput,
  type UpdateProfileInput,
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from '@eco/shared';
import type { Request, Response } from 'express';

import { RawResponse } from '../../common/http/envelope.interceptor';
import { ZBody } from '../../common/http/zod.pipe';
import {
  type Actor,
  AllowWithTempPassword,
  Client,
  type ClientInfo,
  CurrentActor,
  Public,
} from './actor';
import { AVATAR_MAX_BYTES, type AuthResult, AuthService } from './auth.service';
import { REFRESH_COOKIE, TokenService } from './token.service';

// Login IP bo'yicha sanaladi — bitta NAT ortidagi sinf birdan kirishi mumkin.
const AUTH_LIMIT = { default: { limit: 60, ttl: 60_000 } };
// Refresh sessiya bo'yicha sanaladi (AppThrottlerGuard) — har sahifa yuklanishi bitta refresh.
const REFRESH_LIMIT = { default: { limit: 60, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
  ) {}

  @Public()
  @Throttle(AUTH_LIMIT)
  @Post('login')
  @HttpCode(200)
  async login(
    @ZBody(loginSchema) body: LoginInput,
    @Client() client: ClientInfo,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(res, await this.auth.login(body, client));
  }

  @Public()
  @Throttle(REFRESH_LIMIT)
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Client() client: ClientInfo,
    @Res({ passthrough: true }) res: Response,
  ) {
    const presented = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!presented) throw new UnauthorizedException('Sessiya topilmadi');
    try {
      return this.respond(res, await this.auth.refresh(presented, client));
    } catch (err) {
      if (err instanceof UnauthorizedException) this.clearCookie(res);
      throw err;
    }
  }

  /** Ochiq: token eskirgan bo'lsa ham cookie tozalanadi va 204 qaytadi. */
  @Public()
  @SkipThrottle()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() req: Request,
    @Client() client: ClientInfo,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE], client);
    this.clearCookie(res);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60 * 60_000 } })
  @Post('forgot-password')
  @HttpCode(200)
  forgotPassword(@ZBody(forgotPasswordSchema) body: ForgotPasswordInput, @Client() client: ClientInfo) {
    return this.auth.forgotPassword(body, client);
  }

  @Public()
  @Throttle(AUTH_LIMIT)
  @Post('reset-password')
  @HttpCode(200)
  resetPassword(@ZBody(resetPasswordSchema) body: ResetPasswordInput, @Client() client: ClientInfo) {
    return this.auth.resetPassword(body, client);
  }

  @AllowWithTempPassword()
  @Get('me')
  me(@CurrentActor() actor: Actor) {
    return this.auth.profile(actor.id);
  }

  @Patch('me')
  updateProfile(
    @CurrentActor() actor: Actor,
    @ZBody(updateProfileSchema) body: UpdateProfileInput,
    @Client() client: ClientInfo,
  ) {
    return this.auth.updateProfile(actor.id, body, client);
  }

  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: AVATAR_MAX_BYTES } }))
  uploadAvatar(
    @CurrentActor() actor: Actor,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Client() client: ClientInfo,
  ) {
    return this.auth.setAvatar(actor.id, file, client);
  }

  @Delete('me/avatar')
  removeAvatar(@CurrentActor() actor: Actor, @Client() client: ClientInfo) {
    return this.auth.removeAvatar(actor.id, client);
  }

  /** Web klient bu javobni o'ramsiz o'qiydi: `{ok, accessToken?, expiresIn?}`. */
  @AllowWithTempPassword()
  @Throttle(AUTH_LIMIT)
  @RawResponse()
  @Post('me/change-password')
  @HttpCode(200)
  async changePassword(
    @CurrentActor() actor: Actor,
    @ZBody(changePasswordSchema) body: ChangePasswordInput,
    @Req() req: Request,
    @Client() client: ClientInfo,
    @Res({ passthrough: true }) res: Response,
  ) {
    const pair = await this.auth.changePassword(actor.id, body, req.cookies?.[REFRESH_COOKIE], client);
    if (!pair) {
      this.clearCookie(res);
      return { ok: true };
    }
    res.cookie(REFRESH_COOKIE, pair.refreshToken, this.tokens.cookieOptions());
    return { ok: true, accessToken: pair.accessToken, expiresIn: pair.expiresIn };
  }

  private respond(res: Response, result: AuthResult) {
    const { refreshToken, ...rest } = result;
    res.cookie(REFRESH_COOKIE, refreshToken, this.tokens.cookieOptions());
    return { ...rest, tokenType: 'Bearer' as const };
  }

  private clearCookie(res: Response) {
    const { domain, path } = this.tokens.cookieOptions();
    res.clearCookie(REFRESH_COOKIE, { domain, path });
  }
}
