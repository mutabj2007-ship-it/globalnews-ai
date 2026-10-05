import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
  ValidateBy,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import {
  ARTICLE_REF_PATTERN,
  GEOGRAPHY_COUNTRY_CODE_PATTERN,
  MAX_GEOGRAPHY_DISPLAY_NAME_LENGTH,
  MAX_SELECTED_STORIES,
  MULTI_STORY_ACTIONS,
  DISPLAY_LOCALES,
  resolveGovernedCountryCode,
  type DisplayLocale,
  type LanguageCode,
  type MultiStoryAction,
} from '@globalnews-ai/shared';

/**
 * MY INTELLIGENCE R1 — one selected story: its sha256 URL identity and the
 * URL it must hash to. Nothing else about the story is accepted from a client;
 * the server resolves it from retained reporting.
 */
export class SelectedStoryRefDto {
  @IsString()
  @Matches(ARTICLE_REF_PATTERN)
  articleRef!: string;

  @IsString()
  @MaxLength(2000)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  url!: string;
}

/**
 * MY INTELLIGENCE R1 — the bounded multi-story input: one action over 1–8
 * selected stories (CTO bound). Per-action minimums are enforced by the
 * controller before anything is recorded or computed.
 */
export class AnalysisSelectionDto {
  @IsIn(MULTI_STORY_ACTIONS)
  action!: MultiStoryAction;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SELECTED_STORIES)
  @ValidateNested({ each: true })
  @Type(() => SelectedStoryRefDto)
  stories!: SelectedStoryRefDto[];
}

/**
 * Milestone #51 Phase B — bounded, optional story-context nested DTO.
 * Mirrors StoryContext in shared/src/analysis.ts field-for-field.
 * Every field is optional except `title`.
 *
 * Query-limit correction — `title` is deliberately kept at its own
 * independent 300-character bound, NOT scaled up alongside `query`
 * (which moved to 1000 to support sophisticated analytical
 * questions). A news article headline has no legitimate reason to
 * approach that length — this DTO's `title` field and the top-level
 * `query` field below use the same class-validator convention, but
 * are no longer coupled to the same numeric cap.
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
 * MAP ASK GEOGRAPHY CONTEXT R1 — the map country the reader had open, with no
 * story selected. Mirrors GeographyContext in shared/src/analysis.ts. Exactly
 * two fields: the global ValidationPipe (whitelist + forbidNonWhitelisted)
 * rejects any article, source, evidence, report or cluster identity sent
 * alongside them.
 */
export class GeographyContextDto {
  /**
   * The retrieval authority. R1.1: it must be the ISO alpha-2 or alpha-3 code
   * of a GOVERNED country in the shared COUNTRIES registry, or the request is
   * rejected with a 400 — a supplied geography is never silently dropped.
   * Lower case is normalized deterministically to upper case (pl -> PL).
   */
  @Transform(({ value }) =>
    typeof value === 'string' && GEOGRAPHY_COUNTRY_CODE_PATTERN.test(value) ? value.toUpperCase() : value,
  )
  @IsString()
  @ValidateBy({
    name: 'isGovernedCountryCode',
    validator: {
      validate: (value: unknown) => resolveGovernedCountryCode(value) !== undefined,
      defaultMessage: () =>
        'geographyContext.countryCode must be the ISO alpha-2 or alpha-3 code of a governed country',
    },
  })
  countryCode!: string;

  /** Presentation only — bounded here, never read by retrieval, cache or prompt. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_GEOGRAPHY_DISPLAY_NAME_LENGTH)
  displayName!: string;
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

/**
 * T2 · GLOBAL LANGUAGE FOUNDATION — the reader's DISPLAY locale, a different axis from
 * `requestedLanguage`. `requestedLanguage` is the retrieval/answer `LanguageCode` (it cannot express
 * `de` or `pt`, and must not be widened: retrieval has no German or Portuguese sources). The display
 * locale is the language the reader SELECTED for the interface — any of the seven, `de` and `pt`
 * included. It is validated against the shared contract's own list (never re-authored here) and is
 * presentation context only: nothing in retrieval, caching or the prompt reads it.
 */
export const ANALYSIS_DISPLAY_LOCALES: readonly DisplayLocale[] = DISPLAY_LOCALES;

export class AnalyzeNewsDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(1000)
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
   * T2 — optional, backward compatible: the reader's selected DISPLAY locale (any of the seven).
   * Kept apart from `requestedLanguage` so `de`/`pt` are accepted without ever becoming a retrieval
   * LanguageCode. Absent for every existing caller, whose requests are therefore unchanged.
   */
  @IsOptional()
  @IsIn(ANALYSIS_DISPLAY_LOCALES as readonly string[])
  displayLocale?: DisplayLocale;

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

  /**
   * ASK CONVERSATION R1 — one preceding USER question only: the immediately
   * preceding one, or (TOPIC CONTINUITY R1) the user question that established
   * the subject the conversation is still continuing. No AI answer, evidence
   * identity, source list or retrieval output may cross this boundary. It
   * exists solely to resolve a bounded follow-up such as "What about Rwanda?"
   * or "How will this affect X?" against what the reader asked about.
   */
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  priorQuestion?: string;

  /**
   * MY INTELLIGENCE R1 — optional multi-story selection. Absent for every
   * existing caller, whose requests are therefore unchanged.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => AnalysisSelectionDto)
  selection?: AnalysisSelectionDto;

  /**
   * MAP ASK GEOGRAPHY CONTEXT R1 — optional map country with no story. The
   * weakest scope: a selection, a typed place and storyContext all outrank it.
   * Absent for every existing caller, whose requests are therefore unchanged.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => GeographyContextDto)
  geographyContext?: GeographyContextDto;
}
