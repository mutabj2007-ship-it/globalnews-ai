import { Controller, Get, Param, Query } from '@nestjs/common';
import type { SecurityReadResponse } from '@globalnews-ai/shared';
import { SecurityGeographyParamsDto, SecurityReadQueryDto } from './security.dto';
import { SecurityReadService } from './security-read.service';

/** Pure public read. Unreviewed content stays withheld; Alpha remains NOT_ASSESSED. */
@Controller('security')
export class SecurityController {
  constructor(private readonly securityRead: SecurityReadService) {}

  /**
   * GET /security/observations/:countryCode?limit=…&maxAgeMinutes=…
   *
   * Returns the provenance-backed Security observations for one geography, together with the
   * coverage declaration that says what could and could not be seen, the partial limitations
   * as codes, and the reader projection of the absence state where there is nothing to show.
   */
  @Get('observations/:countryCode')
  getObservations(
    @Param() { countryCode }: SecurityGeographyParamsDto,
    @Query() { limit, maxAgeMinutes }: SecurityReadQueryDto,
  ): Promise<SecurityReadResponse> {
    return this.securityRead.readForGeography({ countryCode, limit, maxAgeMinutes });
  }
}
