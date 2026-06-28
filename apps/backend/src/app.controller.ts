import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './modules/auth/decorators/public.decorator';

@ApiTags('Health')
@Controller({ path: 'health', version: '1' })
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getHealth() {
    return this.appService.getHealth();
  }
}
