import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { LanguageCode } from '@globalnews-ai/shared';

/**
 * Milestone #51 Phase B — bounded, optional story-context nested DTO.
 * Mirrors StoryContext in shared/src/analysis.ts field-for-field.
 * Every field is optional except `title`. Length caps mirror the
 * top-level `query` field's own cap where relevant (title/url are
 * user-influenced text that reaches the backend the same way `query`
 * does — the same class-validator convention already used for
 * `query` below, no new validation approach introduced).
 */
export class StoryContextDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  articleId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  sourceName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  countryCode?: string;
}

/**
 * Milestone #47 — the exact closed set the DTO validates
 * `requestedLanguage` against. Deliberately duplicated as a plain
 * array (not imported as a runtime value from shared/src/analysis.ts,
 * which only exports LanguageCode as a compile-time type) so
 * class-validator's @IsIn() has a concrete runtime list to check
 * against.
 */
export const SUPPORTED_LANGUAGE_CODES: readonly LanguageCode[] = [
  'en',
  'pl',
  'sw',
  'fr',
  'es',
  'ar',
  'rw',
] as const;

export class AnalyzeNewsDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(300)
  query!: string;

  /**
   * Milestone #47 — optional and backward compatible: a request body
   * containing only `{ query }` (every pre-Milestone-#47 caller)
   * continues to validate successfully, with `requestedLanguage` left
   * `undefined` — the controller resolves that to English, unchanged
   * from prior behavior.
   *
   * @IsIn() (not a free-form @IsString()) is what prevents an
   * arbitrary string from ever reaching AnalysisService as a
   * LanguageCode — an unsupported value fails DTO validation here,
   * using this repository's existing class-validator/ValidationPipe
   * convention, the same mechanism that already rejects an invalid
   * `query`. Nothing downstream ever needs to re-check this value's
   * validity.
   */
  @IsOptional()
  @IsIn(SUPPORTED_LANGUAGE_CODES)
  requestedLanguage?: LanguageCode;

  /**
   * Milestone #51 Phase B — optional, bounded story context (e.g. from
   * a World Map country-feed article) so retrieval can be anchored to
   * a real, known country/topic instead of relying solely on free-text
   * parsing of `query`. Absent for every pre-Milestone-#51 caller and
   * for ordinary homepage/search Q&A — existing behavior is completely
   * unchanged when this is omitted. See StoryContextDto and
   * AnalysisService.analyzeNews for how it's used.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => StoryContextDto)
  storyContext?: StoryContextDto;
}
