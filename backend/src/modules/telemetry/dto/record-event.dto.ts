import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ALL_ISO3_CODES } from '@globalnews-ai/shared';
// READ-ONLY IMPORT. SUPPORTED_LANGUAGE_CODES is the platform's existing
// seven-member language list and already lives here as an exported
// constant. Importing it binds telemetry to the real vocabulary instead of
// duplicating a list that could silently drift; NO FILE UNDER
// modules/analysis/ IS MODIFIED BY THIS MILESTONE.
import { SUPPORTED_LANGUAGE_CODES } from '../../analysis/dto/analyze-news.dto';
import { ProductEventName } from '../../../generated/prisma/enums';

const PRODUCT_EVENT_NAMES = Object.values(ProductEventName) as string[];

/**
 * R3/T7 — the client telemetry ingest contract.
 *
 * EVERY FIELD IS AN ENUMERATION OR AN IDENTIFIER. There is no free-text
 * field anywhere in this DTO, and there is no field for an email
 * address, an IP, a user-agent, an article title, a URL or a body. A
 * client cannot send those because there is nowhere to put them, and the
 * global ValidationPipe's `forbidNonWhitelisted` rejects any property
 * this class does not declare with a 400.
 *
 * `name` IS VALIDATED AGAINST THE PRISMA ENUM ITSELF, so the vocabulary
 * cannot drift: adding a name to the database and forgetting the DTO, or
 * the reverse, is impossible. An unknown name is a 400, which is what
 * stops the table from accumulating junk names that would later have to
 * be reasoned about.
 *
 * NO userId FIELD, EVER. Account linkage is decided server-side from the
 * event name and the session, and only for the three account-scoped
 * events — see `account-scoped-events.ts`. A client cannot nominate whom
 * an event belongs to.
 */
export class RecordEventDto {
  @IsIn(PRODUCT_EVENT_NAMES)
  name!: ProductEventName;

  /** ISO-3166 alpha-3, validated against the canonical list. */
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsIn(ALL_ISO3_CODES)
  countryCode?: string;

  /** A supported UI language code, validated against the shared list. */
  @IsOptional()
  @IsString()
  @IsIn(SUPPORTED_LANGUAGE_CODES as readonly string[])
  language?: string;

  /**
   * An article identifier, when the event is about one article.
   *
   * Bounded and opaque. It is NEVER a title, a URL or any body text — a
   * length bound alone would not make that true, so the privacy spec
   * asserts the absence of text columns rather than trusting this field
   * to stay well-behaved.
   */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  subjectId?: string;
}
