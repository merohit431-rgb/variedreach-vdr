import { Injectable } from '@nestjs/common';
import { EmailLog, EmailStatus, EmailTemplate } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface RecordEmailLogInput {
  template: EmailTemplate;
  status: EmailStatus;
  recipientEmail: string;
  subject: string;
  userId?: string;
  dataRoomId?: string;
  providerMessageId?: string;
  errorMessage?: string;
  resentFromId?: string;
}

// This is the only place app code writes EmailLog rows. MailService calls
// record() after every send attempt (success or failure) so logging is
// automatic for every template, not something each caller has to remember.
// markDelivered/markBounced are called only by the Resend webhook handler.
@Injectable()
export class EmailLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordEmailLogInput): Promise<EmailLog> {
    return this.prisma.emailLog.create({ data: input });
  }

  async markDelivered(providerMessageId: string): Promise<void> {
    await this.prisma.emailLog.updateMany({
      where: { providerMessageId },
      data: { status: 'DELIVERED', deliveredAt: new Date() },
    });
  }

  async markBounced(providerMessageId: string): Promise<void> {
    await this.prisma.emailLog.updateMany({
      where: { providerMessageId },
      data: { status: 'BOUNCED', bouncedAt: new Date() },
    });
  }
}
