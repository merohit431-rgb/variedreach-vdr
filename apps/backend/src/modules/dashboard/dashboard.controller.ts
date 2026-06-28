import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { RecentActivityQueryDto } from './dto/recent-activity-query.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';

@ApiTags('Dashboard')
@Controller({ path: 'dashboard', version: '1' })
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  getStats(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getStats(user.organisationId);
  }

  @Get('activity')
  getRecentActivity(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RecentActivityQueryDto,
  ) {
    return this.dashboardService.getRecentActivity(user.organisationId, query);
  }
}
