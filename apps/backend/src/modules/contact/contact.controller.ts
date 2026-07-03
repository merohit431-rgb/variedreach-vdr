import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { ContactService } from './contact.service';
import { DemoRequestDto } from './dto/demo-request.dto';
import { CallbackRequestDto } from './dto/callback-request.dto';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Contact')
@Controller({ path: 'contact', version: '1' })
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Public()
  @Throttle({ global: { ttl: 3600, limit: 5 } })
  @Post('demo')
  async demo(@Body() dto: DemoRequestDto) {
    return this.contactService.submitDemoRequest(dto);
  }

  @Public()
  @Throttle({ global: { ttl: 3600, limit: 5 } })
  @Post('callback')
  async callback(@Body() dto: CallbackRequestDto) {
    return this.contactService.submitCallbackRequest(dto);
  }
}
