import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import type { LanguageCode } from '@globalnews-ai/shared';

/**
 * Milestone #47 (correction round 2, Blocker 4) — deliberately NARROWER
 * than SUPPORTED_LANGUAGE_CODES (the full 7-member application
 * response-language set used by AnalyzeNewsDto). The homepage top-
 * headlines feed and the analysis Q&A response language are different
 * concepts: this endpoint's `lang` controls what GNews Top Headlines
 * itself is asked to return, and only 'en'/'pl' are part of the actual
 * M47 homepage production vertical slice — 'sw'/'rw' (and the rest)
 * must be rejected here even though they're valid AnalyzeNewsDto
 * values, since activating them for the homepage feed was never
 * implemented or accepted. No existing backend constant already
 * captured this narrower, endpoint-specific set, so this is the
 * smallest new one — not a duplicate of SUPPORTED_LANGUAGE_CODES, a
 * genuinely different (and currently smaller) list.
 */
export const TOP_HEADLINES_SUPPORTED_LANGUAGE_CODES: readonly LanguageCode[] = [
  'en',
  'pl',
] as const;

export class TopHeadlinesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  /**
   * Milestone #47 (homepage feed language correction) — optional and
   * backward compatible: GET /news/top-headlines?limit=12 (every
   * pre-existing caller) continues to validate and behave exactly as
   * before, with `lang` left `undefined`. Validated against
   * TOP_HEADLINES_SUPPORTED_LANGUAGE_CODES (en/pl only, see its own
   * doc comment) — NOT the full application LanguageCode set. An
   * unsupported/invalid value (including otherwise-valid application
   * languages like 'sw'/'rw') is rejected here by the existing
   * class-validator/ValidationPipe convention, never silently guessed
   * at or passed through to the provider layer.
   */
  @IsOptional()
  @IsIn(TOP_HEADLINES_SUPPORTED_LANGUAGE_CODES)
  lang?: LanguageCode;
}
