import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  GEOGRAPHY_COUNTRY_CODE_PATTERN,
  MAX_SELECTED_STORIES,
  MULTI_STORY_ACTIONS,
  type MultiStoryAction,
} from '@globalnews-ai/shared';
import { SelectedStoryRefDto } from '../analysis/dto/analyze-news.dto';
import type { Intent, Language } from './ask-compute.contract';
import { ASK_CONTEXT_ENTRIES, type AskContextEntry } from './ask-context';

export class CreateThreadDto {
  @IsString() @Length(1, 128) idempotencyKey!: string;
  @IsIn(['en', 'pl']) language!: Language;
  @IsOptional() @IsString() @Length(1, 500) returnPath?: string;
}
/**
 * HOME, DISCUSSIONS, ALERTS & PAID R1 · STAGE A — the ONE reviewed DTO change (Claude H §5,
 * CTO contract §6). Governed identifiers only: a closed entry, up to MAX_SELECTED_STORIES
 * {articleRef, url} pairs (the existing My Intelligence DTO, re-verified server-side), an
 * optional action from the existing closed set and an optional governed country code. No
 * free text of any kind, so nothing the client sends can become evidence. Resolution is
 * returned on the operation, never accepted. Applied only behind ASK_CONTEXT_REFS_ENABLED
 * (see ask-context.ts).
 */
export class AskContextRefDto {
  @IsIn(ASK_CONTEXT_ENTRIES) entry!: AskContextEntry;
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SELECTED_STORIES)
  @ValidateNested({ each: true })
  @Type(() => SelectedStoryRefDto)
  stories?: SelectedStoryRefDto[];
  @IsOptional() @IsIn(MULTI_STORY_ACTIONS) action?: MultiStoryAction;
  @IsOptional() @IsString() @Matches(GEOGRAPHY_COUNTRY_CODE_PATTERN) country?: string;
}
export class QuoteTurnDto {
  @IsString() @Length(1, 128) idempotencyKey!: string;
  @IsString() @Length(2, 1000) question!: string;
  @IsIn(['en', 'pl']) language!: Language;
  @IsIn(['ask', 'deep-analysis', 'research-report']) intent!: Intent;
  @IsOptional() @ValidateNested() @Type(() => AskContextRefDto) context?: AskContextRefDto;
}
export class HistoryPageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(2147483647) after = 0;
}

/**
 * PUBLIC BETA ASK CONTINUITY R1 — the body of a bookmark write.
 *
 * A turn id and nothing else. The question and the answer are NOT accepted from a
 * client: they already exist on `AskTurn` and its operation, and accepting copies
 * would let a caller store text the product never produced.
 *
 * `@IsUUID` because `AskTurn.id` is `@default(uuid())` — a malformed id is a 400
 * from the pipe rather than a database round trip.
 */
export class BookmarkTurnDto {
  @IsUUID() turnId!: string;
}

/* ASK GUEST TRIAL R3 — the guest names ITS OWN thread to continue after sign-in. */
export class ClaimGuestThreadDto {
  @IsUUID() threadId!: string;
}
