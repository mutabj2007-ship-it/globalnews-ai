import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import {
  SUPPORT_CATEGORIES,
  SUPPORT_REFERENCE_PATTERN,
  type SupportCategory,
} from '@globalnews-ai/shared';

/**
 * S2 — the request contracts for the user support API.
 *
 * THE MOST IMPORTANT PROPERTY OF THIS FILE IS WHAT IT DOES NOT DECLARE.
 * No DTO here has a `userId`, an `authorId`, a `visibility` or a
 * `status` field. SUPPORT-AI-1 adds exactly one field -- a two-value
 * `language` -- and adds none of those. The global ValidationPipe runs with
 * `forbidNonWhitelisted: true`, so a browser that sends any of them
 * gets a 400 before the controller body executes. Ownership comes from
 * the session and status is derived by the server; neither is
 * expressible as input, which is a stronger guarantee than checking for
 * them and ignoring them.
 *
 * WHITESPACE IS TRIMMED BEFORE LENGTH IS CHECKED, AND THAT ORDER
 * MATTERS. `@IsNotEmpty()` accepts "   " — it is not empty, it is
 * blank. Every text field below is trimmed by @Transform first, so a
 * whitespace-only submission becomes "" and fails @MinLength. The
 * global pipe's `transform: true` is what makes the transform run, and
 * the trimmed value is what reaches the service and the database — the
 * transform is not cosmetic.
 *
 * Both classes follow the file layout of `country-news.dto.ts`, which
 * already keeps a body DTO and a params DTO side by side.
 */
const trimmed = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));

export class CreateSupportTicketDto {
  /**
   * One of the seven S1 categories, validated against the shared array
   * so the API and the Prisma enum cannot disagree about the vocabulary.
   */
  @IsIn(SUPPORT_CATEGORIES)
  category!: SupportCategory;

  @IsString()
  @trimmed()
  @MinLength(3)
  @MaxLength(200)
  subject!: string;

  @IsString()
  @trimmed()
  @MinLength(10)
  @MaxLength(5000)
  message!: string;

  /**
   * SUPPORT-AI-1 — the language the agent's stored reply is written in.
   *
   * WHY THIS IS A FIELD AND NOT A DICTIONARY KEY. The agent's reply is a
   * durable SupportMessage.body that an administrator reads back later,
   * so it has to BE the words the requester saw, not a token the client
   * renders. A stored key would show an operator "supportAi.bugReport"
   * where the requester saw a paragraph, and the admin thread has to show
   * what the AI actually said.
   *
   * DELIBERATELY NARROWER THAN LanguageCode. The Support surface has
   * reviewed copy in exactly two languages; accepting a third would mean
   * silently writing English into a thread that asked for something else.
   * Optional, defaulting to English, so every existing caller is
   * unaffected.
   *
   * It is also what reaches AnalysisService as requestedLanguage. It is
   * NOT an identifier, carries nothing about the account, and is the only
   * field this milestone adds to any request contract.
   */
  @IsOptional()
  @IsIn(['en', 'pl'])
  language?: 'en' | 'pl';
}

export class CreateSupportMessageDto {
  @IsString()
  @trimmed()
  @MinLength(2)
  @MaxLength(5000)
  message!: string;
}

/**
 * The `:reference` path parameter.
 *
 * Validated against the shared pattern BEFORE any query runs, so a
 * malformed reference is a 400 that never reaches the database, and the
 * database is never asked to match arbitrary caller-supplied text.
 * Upper-cased first so a lower-case paste still resolves.
 */
export class SupportTicketReferenceParamsDto {
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(SUPPORT_REFERENCE_PATTERN)
  reference!: string;
}
