import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ReportsService, ReportTable } from './reports.service';
import { ReportQueryDto } from './dto/report-query.dto';
import { toCsv } from './exporters/csv.exporter';
import { toExcelBuffer } from './exporters/excel.exporter';
import { toPdfBuffer } from './exporters/pdf.exporter';
import { sendFileResponse } from '../../common/utils/http-file-response.util';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';

@ApiTags('Reports')
@Controller({ path: 'data-rooms/:dataRoomId/reports', version: '1' })
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

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
    table: ReportTable,
    format: ReportQueryDto['format'],
    actor: AuthenticatedUser,
  ) {
    if (format === 'json') {
      res.json({
        success: true,
        statusCode: 200,
        message: 'Operation successful',
        data: table,
      });
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
