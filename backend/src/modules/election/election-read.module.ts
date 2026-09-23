import { Controller, Get, Header, Module, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ElectionReadService } from './election-read.service';

@Controller('election')
export class ElectionController {
  constructor(private readonly reader: ElectionReadService) {}
  @Get('evidence/ke')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  read(@Query('locale') locale?: string) {
    return this.reader.read(locale === 'pl' ? 'pl' : 'en');
  }
}
/** No acquisition provider, scheduler, credentials, or network client in this graph. */
@Module({ controllers: [ElectionController], providers: [ElectionReadService], exports: [ElectionReadService] })
export class ElectionReadModule {}
