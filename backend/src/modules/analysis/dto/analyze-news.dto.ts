import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { LanguageCode } from '@globalnews-ai/shared';

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
}
