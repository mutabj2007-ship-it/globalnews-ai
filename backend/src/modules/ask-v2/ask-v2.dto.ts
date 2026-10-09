import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ASK_LANGUAGES, type Intent, type Language } from './ask-compute.contract';
import { AskTurnContextDto } from './context/ask-turn-context.dto';

export class CreateThreadDto {
  @IsString() @Length(1, 128) idempotencyKey!: string;
  @IsIn(ASK_LANGUAGES as readonly string[]) language!: Language;
  @IsOptional() @IsString() @Length(1, 500) returnPath?: string;
}
/**
 * ASK RETRIEVAL / CONVERSATION R2 — a TRANSPORT backstop only. The reader-facing limit is
 * ASK_INPUT_MAX_CHARS (shared/src/ask-input.ts), enforced in AskV2Service.quote with the typed
 * refusal ASK_INPUT_TOO_LONG so the composer can say why; this bound only stops abuse far
 * above it (the 64 kb body limit still applies).
 */
export const ASK_QUESTION_TRANSPORT_MAX = 16_000;
export class QuoteTurnDto {
  @IsString() @Length(1, 128) idempotencyKey!: string;
  @IsString() @Length(2, ASK_QUESTION_TRANSPORT_MAX) question!: string;
  @IsIn(ASK_LANGUAGES as readonly string[]) language!: Language;
  @IsIn(['ask', 'deep-analysis', 'research-report']) intent!: Intent;
  /**
   * UNIFIED INTELLIGENCE BINDING R2B — ONE optional context reference (STORY or GEOGRAPHY).
   * References only; resolved server-side before any compute. Absent = exactly today's turn.
   */
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AskTurnContextDto)
  context?: AskTurnContextDto;
}
export class HistoryPageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(2147483647) after = 0;
}
/** REASON TO RETURN R1 · §7 — optional server-side history search over the reader's own turns. */
export class ThreadListDto {
  @IsOptional() @IsString() @Length(1, 200) q?: string;
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
