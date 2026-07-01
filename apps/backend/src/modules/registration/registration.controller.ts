import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { RegistrationService } from './registration.service';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { CompleteRegistrationDto } from './dto/complete-registration.dto';
import { Public } from '../auth/decorators/public.decorator';

const REFRESH_COOKIE_NAME = 'refresh_token';

@ApiTags('Registration')
@Controller({ path: 'registrations', version: '1' })
export class RegistrationController {
  constructor(
    private readonly registrationService: RegistrationService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  async register(@Body() dto: CreateRegistrationDto) {
    await this.registrationService.register(dto);
  }

  @Public()
  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.registrationService.verifyEmail(dto.token);
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resendVerification(@Body() dto: ResendVerificationDto) {
    await this.registrationService.resendVerification(dto.email);
  }

  @Public()
  @Get('details')
  async getDetails(@Query('email') email: string) {
    if (!email) throw new NotFoundException();
    const details = await this.registrationService.getDetails(email);
    if (!details) throw new NotFoundException('Registration not found or already provisioned');
    return details;
  }

  @Public()
  @Post('create-order')
  async createOrder(@Body() dto: CreateOrderDto) {
    return this.registrationService.createOrder(dto);
  }

  @Public()
  @Post('complete')
  async complete(
    @Body() dto: CompleteRegistrationDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.registrationService.complete(dto);
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, {
      httpOnly: true,
      secure: this.configService.get<string>('app.nodeEnv') === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth',
      expires: result.refreshExpiresAt,
    });
    return { accessToken: result.accessToken, user: result.user };
  }
}
