import { IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { Intent, Language } from './ask-compute.contract';

export class CreateThreadDto {
  @IsString() @Length(1, 128) idempotencyKey!: string;
  @IsIn(['en', 'pl']) language!: Language;
  @IsOptional() @IsString() @Length(1, 500) returnPath?: string;
}
export class QuoteTurnDto {
  @IsString() @Length(1, 128) idempotencyKey!: string;
  @IsString() @Length(2, 1000) question!: string;
  @IsIn(['en', 'pl']) language!: Language;
  @IsIn(['ask', 'deep-analysis', 'research-report']) intent!: Intent;
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
