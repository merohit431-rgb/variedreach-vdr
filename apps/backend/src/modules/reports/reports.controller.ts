import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ReportsService, ReportTable, StorageReportTable } from './reports.service';
import { ReportQueryDto } from './dto/report-query.dto';
import { toCsv } from './exporters/csv.exporter';
import { toExcelBuffer } from './exporters/excel.exporter';
import { toPdfBuffer } from './exporters/pdf.exporter';
import { sendFileResponse } from '../../common/utils/http-file-response.util';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';
import { DATA_ROOM_MANAGER_ROLES as MANAGER_ROLES } from '../../common/constants/content-roles';

@ApiTags('Reports')
@Controller({ path: 'data-rooms/:dataRoomId/reports', version: '1' })
@Roles(...MANAGER_ROLES)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  async summary(
    @Param('dataRoomId') dataRoomId: string,
    @Query() query: ReportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reportsService.getSummaryStats(dataRoomId, user, query);
  }

  @Get('download-trends')
  async downloadTrends(
    @Param('dataRoomId') dataRoomId: string,
    @Query() query: ReportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reportsService.getDownloadTrends(dataRoomId, user, query);
  }

  @Get('storage')
  async storageReport(
    @Param('dataRoomId') dataRoomId: string,
    @Query() query: ReportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const report = await this.reportsService.getStorageReport(dataRoomId, user);

    if (query.format === 'json') {
      res.json({ success: true, statusCode: 200, message: 'Operation successful', data: report });
      return;
    }

    await this.reportsService.recordExport(dataRoomId, 'storage', query.format, user);
    const baseName = `storage-report-${new Date().toISOString().slice(0, 10)}`;

    if (query.format === 'csv') {
      const csv = toCsv(report.headers, report.rows);
      sendFileResponse(res, { buffer: Buffer.from(csv, 'utf-8'), filename: `${baseName}.csv`, mimeType: 'text/csv' });
      return;
    }

    if (query.format === 'xlsx') {
      const buffer = await toExcelBuffer(report.title, report.headers, report.rows);
      sendFileResponse(res, {
        buffer,
        filename: `${baseName}.xlsx`,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      return;
    }

    const buffer = await toPdfBuffer(report.title, report.headers, report.rows);
    sendFileResponse(res, { buffer, filename: `${baseName}.pdf`, mimeType: 'application/pdf' });
  }

  @Get('download-activity')
  async downloadActivity(
    @Param('dataRoomId') dataRoomId: string,
    @Query() query: ReportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const table = await this.reportsService.getDownloadActivityReport(dataRoomId, user, query);
    await this.respond(res, dataRoomId, 'download-activity', table, query.format, user);
  }

  @Get('user-activity')
  async userActivity(
    @Param('dataRoomId') dataRoomId: string,
    @Query() query: ReportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const table = await this.reportsService.getUserActivityReport(dataRoomId, user);
    await this.respond(res, dataRoomId, 'user-activity', table, query.format, user);
  }

  private async respond(
    res: Response,
    dataRoomId: string,
    reportName: string,
    table: ReportTable | StorageReportTable,
    format: ReportQueryDto['format'],
    actor: AuthenticatedUser,
  ) {
    if (format === 'json') {
      res.json({ success: true, statusCode: 200, message: 'Operation successful', data: table });
      return;
    }

    await this.reportsService.recordExport(dataRoomId, reportName, format, actor);
    const baseName = `${reportName}-${new Date().toISOString().slice(0, 10)}`;

    if (format === 'csv') {
      const csv = toCsv(table.headers, table.rows);
      sendFileResponse(res, { buffer: Buffer.from(csv, 'utf-8'), filename: `${baseName}.csv`, mimeType: 'text/csv' });
      return;
    }

    if (format === 'xlsx') {
      const buffer = await toExcelBuffer(table.title, table.headers, table.rows);
      sendFileResponse(res, {
        buffer,
        filename: `${baseName}.xlsx`,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      return;
    }

    const buffer = await toPdfBuffer(table.title, table.headers, table.rows);
    sendFileResponse(res, { buffer, filename: `${baseName}.pdf`, mimeType: 'application/pdf' });
  }
}
