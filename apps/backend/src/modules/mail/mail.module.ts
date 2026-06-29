import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
import { MAIL_PROVIDER } from './mail-provider.interface';
import { NodemailerMailProvider } from './providers/nodemailer.provider';
import { ResendMailProvider } from './providers/resend.provider';

@Global()
@Module({
  providers: [
    MailService,
    NodemailerMailProvider,
    ResendMailProvider,
    {
      provide: MAIL_PROVIDER,
      useFactory: (config: ConfigService, nodemailer: NodemailerMailProvider, resend: ResendMailProvider) =>
        config.get<string>('mail.provider') === 'resend' ? resend : nodemailer,
      inject: [ConfigService, NodemailerMailProvider, ResendMailProvider],
    },
  ],
  exports: [MailService],
})
export class MailModule {}
