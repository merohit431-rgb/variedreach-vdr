import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { DashboardService } from './dashboard.service';
import { RecentActivityQueryDto } from './dto/recent-activity-query.dto';
import { StorageUpgradeRequestDto } from './dto/storage-upgrade-request.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';

@ApiTags('Dashboard')
@Controller({ path: 'dashboard', version: '1' })
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  getStats(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getStats(user);
  }

  @Get('activity')
  getRecentActivity(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RecentActivityQueryDto,
  ) {
    return this.dashboardService.getRecentActivity(user, query);
  }

  @Post('storage/upgrade-request')
  @Roles(UserRole.ORG_ADMIN)
  requestStorageUpgrade(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StorageUpgradeRequestDto,
  ) {
    return this.dashboardService.requestStorageUpgrade(user, dto);
  }
}
