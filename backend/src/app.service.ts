import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getServiceInfo(): { name: string; status: string } {
    return {
      name: 'globalnews-ai-backend',
      status: 'foundation-ready',
    };
  }
}
