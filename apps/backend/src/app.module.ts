import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from './config/app.config';
import jwtConfig from './config/jwt.config';
import mailConfig from './config/mail.config';
import storageThresholdConfig from './config/storage-threshold.config';
import conversionConfig from './config/conversion.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './modules/audit/audit.module';
import { EmailLogModule } from './modules/email-log/email-log.module';
import { MailModule } from './modules/mail/mail.module';
import { AuthModule } from './modules/auth/auth.module';
import { RegistrationModule } from './modules/registration/registration.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DataRoomsModule } from './modules/data-rooms/data-rooms.module';
import { DataRoomAccessModule } from './modules/data-room-access/data-room-access.module';
import { FoldersModule } from './modules/folders/folders.module';
import { StorageModule } from './modules/storage/storage.module';
import { WatermarkModule } from './modules/watermark/watermark.module';
import { OfficeConversionModule } from './modules/office-conversion/office-conversion.module';
import { FilesModule } from './modules/files/files.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { ReportsModule } from './modules/reports/reports.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, jwtConfig, mailConfig, storageThresholdConfig, conversionConfig],
      envFilePath: ['.env'],
    }),
    PrismaModule,
    AuditModule,
    EmailLogModule,
    MailModule,
    AuthModule,
    RegistrationModule,
    DataRoomAccessModule,
    StorageModule,
    WatermarkModule,
    OfficeConversionModule,
    DashboardModule,
    FoldersModule,
    FilesModule,
    DataRoomsModule,
    AuditLogsModule,
    ReportsModule,
    WebhooksModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
