import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { NEWS_CATEGORIES, type LanguageCode, type NewsCategory } from '@globalnews-ai/shared';
import { TOP_HEADLINES_SUPPORTED_LANGUAGE_CODES } from '../dto/top-headlines-query.dto';

export class CountryParamsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  countryCode!: string;
}

export class CountryNewsQueryDto {
  @IsOptional()
  @IsIn(NEWS_CATEGORIES)
  category?: NewsCategory;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  limit?: number;

  /**
   * Milestone #49 (World Map EN/PL integration) — optional and backward
   * compatible: GET /news/country/:countryCode with no `lang` (every
   * pre-existing caller) continues to validate and behave exactly as
   * before, with `lang` left `undefined`. Reuses the EXACT SAME
   * TOP_HEADLINES_SUPPORTED_LANGUAGE_CODES constant already established
   * for the homepage feed in Milestone #47/#48 — the same narrow en/pl
   * scope, not a new or duplicate language architecture. An
   * unsupported/invalid value is rejected here by the existing
   * class-validator/ValidationPipe convention.
   */
  @IsOptional()
  @IsIn(TOP_HEADLINES_SUPPORTED_LANGUAGE_CODES)
  lang?: LanguageCode;
}
