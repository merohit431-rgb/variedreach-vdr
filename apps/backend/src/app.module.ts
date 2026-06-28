import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from './config/app.config';
import jwtConfig from './config/jwt.config';
import mailConfig from './config/mail.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './modules/audit/audit.module';
import { MailModule } from './modules/mail/mail.module';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DataRoomsModule } from './modules/data-rooms/data-rooms.module';
import { DataRoomAccessModule } from './modules/data-room-access/data-room-access.module';
import { FoldersModule } from './modules/folders/folders.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, jwtConfig, mailConfig],
      envFilePath: ['.env'],
    }),
    PrismaModule,
    AuditModule,
    MailModule,
    AuthModule,
    DataRoomAccessModule,
    DashboardModule,
    FoldersModule,
    DataRoomsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
