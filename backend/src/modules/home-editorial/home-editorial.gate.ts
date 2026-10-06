import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * ASK RELIABILITY R1 — the corrected Home's backend reads (GET /home/editorial, GET /stories/search)
 * exist only where the platform Home is served: HOME_EDITORIAL_ENABLED=true (Alpha). Absent or any
 * other value → 404, so shipping the shared Ask corrections to Production (Standalone Ask root) can
 * never expose these surfaces incidentally on its public backend domain.
 */
@Injectable()
export class HomeEditorialGate implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(): boolean {
    if (this.config.get<string>('HOME_EDITORIAL_ENABLED') !== 'true') throw new NotFoundException();
    return true;
  }
}
