import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './modules/auth/decorators/public.decorator';

@SkipThrottle()
@ApiTags('Health')
@Controller({ path: 'health', version: '1' })
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  async getHealth() {
    return this.appService.getHealth();
  }
}
