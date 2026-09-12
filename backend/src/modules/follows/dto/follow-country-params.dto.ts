import { Transform } from 'class-transformer';
import { IsIn, IsString } from 'class-validator';
import { ALL_ISO3_CODES } from '@globalnews-ai/shared';

/**
 * R1/T3 — the `:countryCode` path parameter on DELETE.
 *
 * Validation is deliberately IDENTICAL to the body DTO's: an unfollow
 * must not accept a value a follow would have rejected, or the two ends
 * of the same resource would disagree about what a country is.
 *
 * A separate class rather than a shared one because a params DTO and a
 * body DTO are validated by different decorators on the handler, and this
 * repository already keeps the two side by side elsewhere.
 */
export class FollowCountryParamsDto {
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsIn(ALL_ISO3_CODES)
  countryCode!: string;
}
