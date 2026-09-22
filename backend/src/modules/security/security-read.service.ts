import { Injectable } from '@nestjs/common';
import type { SecurityReadResponse } from '@globalnews-ai/shared';
import { publicSecurityRead } from './security-public-content';
export interface SecurityReadOptions {
  countryCode: string;
  countryName?: string;
  limit?: number;
  maxAgeMinutes?: number;
}
/** Public GET is deliberately incapable of producing evidence or accessing a writer.
 * NOT_ASSESSED remains the accepted Alpha authority until the two governance gates close. */
@Injectable()
export class SecurityReadService {
  async readForGeography(options: SecurityReadOptions): Promise<SecurityReadResponse> {
    const code = options.countryCode.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) throw new Error('Invalid country code');
    return publicSecurityRead(code);
  }
}
