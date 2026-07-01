import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import appConfig from './config/app.config';
import jwtConfig from './config/jwt.config';
import mailConfig from './config/mail.config';
import storageThresholdConfig from './config/storage-threshold.config';
import conversionConfig from './config/conversion.config';
import paymentConfig from './config/payment.config';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
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
import { PaymentModule } from './modules/payment/payment.module';
import { SuperAdminModule } from './modules/super-admin/super-admin.module';
import { NdaModule } from './modules/nda/nda.module';
import { QnaModule } from './modules/qna/qna.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, jwtConfig, mailConfig, storageThresholdConfig, conversionConfig, paymentConfig],
      envFilePath: ['.env'],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'global',
            ttl: config.get<number>('app.throttle.globalTtl', 60),
            limit: config.get<number>('app.throttle.globalLimit', 300),
          },
        ],
      }),
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
    PaymentModule,
    SuperAdminModule,
    NdaModule,
    QnaModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
