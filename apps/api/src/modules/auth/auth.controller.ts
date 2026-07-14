import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TokenService } from './services/token.service';
import type { AuthenticatedUser } from './strategies/jwt-access.strategy';

const REFRESH_COOKIE = 'refresh_token';

@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
  ) {}

  @Public()
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Fuqaro sifatida ro‘yxatdan o‘tish' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ) {
    const ua = req.headers['user-agent'];
    const result = await this.auth.register(dto, { ip, userAgent: ua });
    this.setRefreshCookie(res, result.refreshToken);
    return this.stripRefresh(result);
  }

  @Public()
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tizimga kirish' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ) {
    const ua = req.headers['user-agent'];
    const result = await this.auth.login(dto, { ip, userAgent: ua });
    this.setRefreshCookie(res, result.refreshToken);
    return this.stripRefresh(result);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Access tokenni yangilash (refresh cookie orqali)' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ) {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (!raw) throw new UnauthorizedException('Refresh token topilmadi');

    const ua = req.headers['user-agent'];
    const result = await this.auth.refresh(raw, { ip, userAgent: ua });
    this.setRefreshCookie(res, result.refreshToken);
    return {
      accessToken: result.accessToken,
      tokenType: 'Bearer',
      expiresIn: result.expiresIn,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Tizimdan chiqish (refresh tokenni bekor qiladi)' })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ) {
    const raw = req.cookies?.[REFRESH_COOKIE];
    await this.auth.logout(user.id, raw, { ip, userAgent: req.headers['user-agent'] });
    this.clearRefreshCookie(res);
  }

  @Public()
  @Throttle({ forgot: { limit: 3, ttl: 60 * 60_000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Parolni tiklash uchun so‘rov yuborish' })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.auth.forgotPassword(dto, { ip, userAgent: req.headers['user-agent'] });
  }

  @Public()
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Parolni yangi qiymatga o‘zgartirish' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.auth.resetPassword(dto, { ip, userAgent: req.headers['user-agent'] });
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Joriy foydalanuvchi profili + rollari + ruxsatlari' })
  async me(@CurrentUser('id') userId: string) {
    return this.auth.me(userId);
  }

  // ---- helpers -----------------------------------------------------

  private setRefreshCookie(res: Response, token: string) {
    res.cookie(REFRESH_COOKIE, token, this.tokens.getRefreshCookieOptions());
  }

  private clearRefreshCookie(res: Response) {
    const opts = this.tokens.getRefreshCookieOptions();
    res.clearCookie(REFRESH_COOKIE, { path: opts.path, domain: opts.domain });
  }

  private stripRefresh(result: { accessToken: string; expiresIn: number }) {
    return {
      accessToken: result.accessToken,
      tokenType: 'Bearer' as const,
      expiresIn: result.expiresIn,
    };
  }
}
