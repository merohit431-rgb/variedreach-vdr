import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { SuperAdminService } from './super-admin.service';
import { UpdateOrgDto } from './dto/update-org.dto';

@Controller({ path: 'super-admin', version: '1' })
@Roles(UserRole.SUPER_ADMIN)
export class SuperAdminController {
  constructor(private readonly service: SuperAdminService) {}

  @Get('dashboard')
  getDashboard() {
    return this.service.getDashboard();
  }

  @Get('organisations')
  getOrganisations(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
    @Query('plan') plan?: string,
  ) {
    return this.service.getOrganisations(+page, +limit, search, plan);
  }

  @Get('organisations/:id')
  getOrganisationById(@Param('id') id: string) {
    return this.service.getOrganisationById(id);
  }

  @Patch('organisations/:id')
  updateOrganisation(@Param('id') id: string, @Body() dto: UpdateOrgDto) {
    return this.service.updateOrganisation(id, dto);
  }

  @Get('registrations')
  getRegistrations(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.service.getRegistrations(+page, +limit);
  }

  @Get('payments')
  getPayments(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.service.getPayments(+page, +limit);
  }

  @Get('subscriptions')
  getSubscriptions(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: string,
  ) {
    return this.service.getSubscriptions(+page, +limit, status);
  }

  @Get('invoices')
  getInvoices(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.service.getInvoices(+page, +limit);
  }

  @Get('revenue')
  getRevenue() {
    return this.service.getRevenue();
  }

  @Get('health')
  getHealth() {
    return this.service.getHealth();
  }

  @Get('activity')
  getActivity(@Query('page') page = '1', @Query('limit') limit = '50') {
    return this.service.getActivity(+page, +limit);
  }
}
