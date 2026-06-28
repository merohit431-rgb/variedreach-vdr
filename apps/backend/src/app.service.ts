import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      service: 'insolvency-vdr-backend',
      timestamp: new Date().toISOString(),
    };
  }
}
