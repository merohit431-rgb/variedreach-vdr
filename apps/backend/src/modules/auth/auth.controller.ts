import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { VerifyMfaSetupDto } from './dto/verify-mfa-setup.dto';
import { VerifyMfaLoginDto } from './dto/verify-mfa-login.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedUser } from './types/jwt-payload.interface';

const REFRESH_COOKIE_NAME = 'refresh_token';

@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Throttle({ global: { ttl: 900, limit: 5 } })
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    if (result.requiresMfa) {
      return { requiresMfa: true, mfaChallengeToken: result.mfaChallengeToken };
    }

    this.setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);

    return { accessToken: result.accessToken, user: result.user };
  }

  @Public()
  @Throttle({ global: { ttl: 60, limit: 30 } })
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const result = await this.authService.refresh(refreshToken, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    this.setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);

    return { accessToken: result.accessToken };
  }

  @SkipThrottle()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(req.cookies?.[REFRESH_COOKIE_NAME], user?.id);
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/v1/auth' });
  }

  @SkipThrottle()
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @Public()
  @Throttle({ global: { ttl: 900, limit: 5 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Throttle({ global: { ttl: 900, limit: 5 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @Public()
  @Throttle({ global: { ttl: 900, limit: 10 } })
  @Post('accept-invite')
  @HttpCode(HttpStatus.NO_CONTENT)
  async acceptInvite(@Body() dto: AcceptInviteDto) {
    await this.authService.acceptInvite(dto.token, dto.password);
  }

  @SkipThrottle()
  @Get('mfa/status')
  async mfaStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMfaStatus(user);
  }

  @Post('mfa/setup')
  async mfaSetup(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.setupMfa(user);
  }

  @Post('mfa/verify-setup')
  @HttpCode(HttpStatus.NO_CONTENT)
  async mfaVerifySetup(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyMfaSetupDto,
  ) {
    await this.authService.verifyMfaSetup(user, dto.totpCode);
  }

  @Delete('mfa/disable')
  @HttpCode(HttpStatus.NO_CONTENT)
  async mfaDisable(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyMfaSetupDto,
  ) {
    await this.authService.disableMfa(user, dto.totpCode);
  }

  @Public()
  @Throttle({ global: { ttl: 900, limit: 10 } })
  @Post('mfa/verify-login')
  async mfaVerifyLogin(
    @Body() dto: VerifyMfaLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyMfaLogin(
      dto.mfaChallengeToken,
      dto.totpCode,
      Boolean(dto.rememberMe),
      { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
    );
    this.setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);
    return { accessToken: result.accessToken, user: result.user };
  }

  private setRefreshCookie(res: Response, token: string, expiresAt: Date) {
    res.cookie(REFRESH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: this.configService.get<string>('app.nodeEnv') === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth',
      expires: expiresAt,
    });
  }
}
