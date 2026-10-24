import { Body, Controller, Header, HttpCode, Module, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { CoverageLeadsService, type CoverageLeadsResponse } from './coverage-leads.service';

export class CoverageLeadsRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  question!: string;
}

/*
  CTO R168 — POST, not GET: the reader's question must not land in a URL, an access log or a cache
  key. It is read here, reduced to closed-vocabulary keywords by the service, and dropped. The route
  is session-blind and returns no article, so the reader-rights interceptor has nothing to act on.
*/
@Controller('news')
export class CoverageLeadsController {
  constructor(private readonly coverageLeads: CoverageLeadsService) {}

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('coverage-leads')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  leads(@Body() { question }: CoverageLeadsRequestDto): Promise<CoverageLeadsResponse> {
    return this.coverageLeads.leadsFor(question);
  }
}

@Module({
  controllers: [CoverageLeadsController],
  providers: [CoverageLeadsService],
})
export class CoverageLeadsModule {}
