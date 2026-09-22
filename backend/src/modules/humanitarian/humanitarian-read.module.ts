import { Controller, Get, Header, Module } from '@nestjs/common';
import { humanitarianReadAbsence, type HumanitarianRetainedRead } from '@globalnews-ai/shared';

/**
 * Public capability read, separate from authority boot. No store, producer, transport,
 * scheduler, query filters or acquisition dependency. The release has no approved
 * retained observation reader: this is NOT_ASSESSED, never a zero-incident finding.
 * Provisioning the authority module alone does not change that fact.
 */
@Controller('humanitarian')
export class HumanitarianReadController {
  @Get('observations')
  @Header('Cache-Control', 'no-store')
  read(): HumanitarianRetainedRead {
    return humanitarianReadAbsence('NOT_ASSESSED');
  }
}

@Module({ controllers: [HumanitarianReadController] })
export class HumanitarianReadModule {}