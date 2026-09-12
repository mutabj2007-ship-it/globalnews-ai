import { Transform } from 'class-transformer';
import { IsIn, IsString } from 'class-validator';
import { ALL_ISO3_CODES } from '@globalnews-ai/shared';

/**
 * R1/T3 — the follow request body.
 *
 * THE MOST IMPORTANT PROPERTY OF THIS FILE IS WHAT IT DOES NOT DECLARE.
 * There is no `userId` and no `id` field. Ownership comes from the
 * session via `@CurrentUser()`, and the global ValidationPipe runs with
 * `forbidNonWhitelisted: true`, so a request that tries to supply one is
 * rejected with a 400 BEFORE the controller body executes. That is a
 * stronger guarantee than accepting the field and ignoring it.
 *
 * THE COUNTRY CODE IS VALIDATED AGAINST THE CANONICAL LIST, NOT A SHAPE.
 * `@IsIn(ALL_ISO3_CODES)` means a well-formed but non-existent code such
 * as "XXX" is a 400 that never reaches the database — a length check
 * would have let it through. Upper-cased first so a lower-case client
 * still resolves, which is the same transform convention the support
 * reference parameter uses.
 */
export class FollowCountryDto {
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsIn(ALL_ISO3_CODES)
  countryCode!: string;
}
