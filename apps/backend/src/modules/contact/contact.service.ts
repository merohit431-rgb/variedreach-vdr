import { Injectable } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { ContactRequestField } from '../mail/templates/contact-request.template';
import { DemoRequestDto, TIME_SLOT_LABELS, USE_CASE_LABELS } from './dto/demo-request.dto';
import { CallbackRequestDto } from './dto/callback-request.dto';

@Injectable()
export class ContactService {
  constructor(private readonly mailService: MailService) {}

  async submitDemoRequest(dto: DemoRequestDto): Promise<{ received: boolean }> {
    // Honeypot filled means a bot -- accept silently so it can't tell.
    if (dto.website) return { received: true };

    const fields: ContactRequestField[] = [
      { label: 'Name', value: dto.fullName },
      { label: 'Firm / Company', value: dto.firmName },
      { label: 'Work email', value: dto.workEmail },
      { label: 'Phone', value: dto.phone },
    ];
    if (dto.role) fields.push({ label: 'Role', value: dto.role });
    fields.push({ label: 'Use case', value: USE_CASE_LABELS[dto.useCase] ?? dto.useCase });
    if (dto.preferredDate) fields.push({ label: 'Preferred date', value: dto.preferredDate });
    if (dto.preferredSlot) fields.push({ label: 'Preferred time', value: TIME_SLOT_LABELS[dto.preferredSlot] ?? dto.preferredSlot });
    if (dto.message) fields.push({ label: 'Message', value: dto.message });

    const result = await this.mailService.sendDemoRequestEmail(dto.fullName, fields);
    return { received: result.sent };
  }

  async submitCallbackRequest(dto: CallbackRequestDto): Promise<{ received: boolean }> {
    if (dto.website) return { received: true };

    const fields: ContactRequestField[] = [
      { label: 'Name', value: dto.fullName },
      { label: 'Phone', value: dto.phone },
      { label: 'Best time to call', value: TIME_SLOT_LABELS[dto.bestTime] ?? dto.bestTime },
    ];

    const result = await this.mailService.sendCallbackRequestEmail(dto.fullName, fields);
    return { received: result.sent };
  }
}
