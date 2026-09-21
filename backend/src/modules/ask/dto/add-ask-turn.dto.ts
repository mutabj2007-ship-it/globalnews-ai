import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { BetaCategory, LanguageCode } from '@globalnews-ai/shared';
import { BETA_CATEGORIES } from '@globalnews-ai/shared';
import { SUPPORTED_LANGUAGE_CODES } from '../../analysis/dto/analyze-news.dto';

/**
 * BETA-SIMPLE-ASK-SAND-1 §3/§4 — request validation for an Ask turn.
 *
 * Follows this repository's existing class-validator/ValidationPipe
 * convention exactly (see AnalyzeNewsDto), including reusing that
 * DTO's own SUPPORTED_LANGUAGE_CODES runtime array rather than
 * declaring a second copy — a second list would drift.
 *
 * Every bound below exists because this payload reaches a database
 * column and, for `question`, an AI provider. An unbounded string
 * field on a route that triggers cost-bearing work is a denial-of-
 * wallet vector, not merely untidy.
 */

/** §4 — the navigation context carried into Ask. Every field optional. */
export class AskContextDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  originRoute?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  originLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  countryCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  countryName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subjectId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  subjectLabel?: string;

  /**
   * Validated against the closed BETA_CATEGORIES set rather than as a
   * free string: this value becomes part of the stored-result
   * fingerprint's `analysisType` dimension, so an arbitrary value
   * would let a caller mint unlimited distinct cache identities for
   * one question — each one a cache miss, each miss a fresh AI call.
   */
  @IsOptional()
  @IsIn(BETA_CATEGORIES as readonly string[])
  module?: BetaCategory;

  /**
   * Bounded to the small set the product actually offers, for the
   * same cache-identity reason as `module` above.
   */
  @IsOptional()
  @IsIn(['24h', '7d', '30d', '90d'])
  timeWindow?: string;
}

export class AddAskTurnDto {
  /**
   * Same 2..1000 bounds as AnalyzeNewsDto.query — an Ask turn and a
   * single-shot analysis ask the same kind of question, and two
   * different limits for the same thing would be arbitrary.
   */
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(1000)
  question!: string;

  @IsOptional()
  @IsIn(SUPPORTED_LANGUAGE_CODES)
  language?: LanguageCode;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  threadId?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AskContextDto)
  context?: AskContextDto;

  /**
   * §12 — REQUIRED, not optional.
   *
   * §12 calls idempotency a release requirement and names double
   * click, browser retry, refresh, frontend reconnect, HTTP retry,
   * Railway retry and worker retry as the cases that must never
   * double-charge. An optional key would be omitted by exactly the
   * naive caller those cases describe, so the contract makes it
   * mandatory and this DTO enforces it — a request without one is
   * rejected with a 400 before it can reach any cost-bearing path.
   */
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  idempotencyKey!: string;

  /**
   * §9 — echoed back from a quote the server issued. Never grants a
   * cheaper class: the server recomputes the classification on every
   * request and only checks whether this value MATCHES the operation
   * it just quoted.
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  confirmedOperationId?: string;
}
