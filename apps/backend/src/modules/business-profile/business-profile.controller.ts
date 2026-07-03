import { Body, Controller, Get, Patch } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ApiTags } from '@nestjs/swagger';
import { BusinessProfileService } from './business-profile.service';
import { UpdateBusinessProfileDto } from './dto/update-business-profile.dto';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Business Profile')
@Controller({ path: 'business-profile', version: '1' })
export class BusinessProfileController {
  constructor(private readonly service: BusinessProfileService) {}

  // Public safe subset — marketing footer/contact read support details here.
  @Public()
  @Get()
  getPublic() {
    return this.service.getPublic();
  }

  // Full profile (incl. PAN/GST) — Super Admin editor only.
  @Roles(UserRole.SUPER_ADMIN)
  @Get('admin')
  getFull() {
    return this.service.get();
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Patch()
  update(@Body() dto: UpdateBusinessProfileDto) {
    return this.service.update(dto);
  }
}
