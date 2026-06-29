import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OfficeConversionService {
  private readonly logger = new Logger(OfficeConversionService.name);

  constructor(private readonly configService: ConfigService) {}

  async convertToPdf(buffer: Buffer, filename: string): Promise<Buffer> {
    const gotenbergUrl = this.configService.get<string>('conversion.gotenbergUrl')!;
    const timeoutMs = this.configService.get<number>('conversion.timeoutMs')!;

    const formData = new FormData();
    formData.append('files', new Blob([new Uint8Array(buffer)]), filename);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${gotenbergUrl}/forms/libreoffice/convert`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`Gotenberg returned ${response.status}: ${errorBody.slice(0, 200)}`);
      }

      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      this.logger.error(`Failed to convert "${filename}" to PDF: ${(error as Error).message}`);
      throw new Error('Unable to prepare this file for secure viewing right now');
    } finally {
      clearTimeout(timeout);
    }
  }
}
