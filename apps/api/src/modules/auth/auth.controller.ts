import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { changePasswordSchema, updateProfileSchema } from '@eco/shared';
import { createZodDto } from 'nestjs-zod';
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

class UpdateProfileDto extends createZodDto(updateProfileSchema) {}
class ChangePasswordDto extends createZodDto(changePasswordSchema) {}

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
    return this.stripRefresh(result);
  }

  @Public()
  @SkipThrottle()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Tizimdan chiqish (refresh tokenni bekor qiladi). Public: token noto‘g‘ri/eskirgan bo‘lsa ham 204 qaytadi va cookie tozalanadi.',
  })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ) {
    const raw = req.cookies?.[REFRESH_COOKIE];
    // Refresh cookie'dan foydalanuvchi ID'ni topib, sessiya yozuvini bekor qilamiz.
    // Cookie yo'q yoki yaroqsiz bo'lsa ham 204 qaytadi — brauzer cookie'ni tozalaydi.
    await this.auth.logoutByRefresh(raw, { ip, userAgent: req.headers['user-agent'] });
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

  @Patch('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Foydalanuvchi profil ma‘lumotlarini tahrirlash' })
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.auth.updateProfile(userId, dto, {
      ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('me/avatar')
  @ApiBearerAuth('access-token')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Profil rasmini yuklash (JPG/PNG/WEBP/GIF, maks 5 MB)' })
  async uploadAvatar(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.auth.uploadAvatar(userId, file, {
      ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Delete('me/avatar')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Profil rasmini o‘chirish' })
  async removeAvatar(
    @CurrentUser('id') userId: string,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.auth.removeAvatar(userId, {
      ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('me/change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Parolni o‘zgartirish (joriy parolni verifikatsiya qilib)',
  })
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.auth.changePassword(userId, dto, {
      ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ---- helpers -----------------------------------------------------

  private setRefreshCookie(res: Response, token: string) {
    res.cookie(REFRESH_COOKIE, token, this.tokens.getRefreshCookieOptions());
  }

  private clearRefreshCookie(res: Response) {
    const opts = this.tokens.getRefreshCookieOptions();
    res.clearCookie(REFRESH_COOKIE, { path: opts.path, domain: opts.domain });
  }

  private stripRefresh<T extends { accessToken: string; expiresIn: number; refreshToken: string }>(
    result: T,
  ) {
    const { refreshToken: _refreshToken, ...rest } = result;
    void _refreshToken;
    return {
      ...rest,
      tokenType: 'Bearer' as const,
    };
  }
}
