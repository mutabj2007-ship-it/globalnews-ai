import { IsIn, IsString, Length, Matches, ValidateIf } from 'class-validator';
import { ARTICLE_REF_PATTERN, GEOGRAPHY_COUNTRY_CODE_PATTERN } from '@globalnews-ai/shared';

/**
 * UNIFIED INTELLIGENCE BINDING R2B — the ONE optional context a client may attach to an Ask V2
 * turn. REFERENCES ONLY: the browser may name a story or a country; it may never supply a title,
 * a source, a summary, a body, a display name or any other evidence. Every other field is
 * rejected by the controllers' `whitelist + forbidNonWhitelisted` pipe (this class is nested
 * with `@ValidateNested` + `@Type`, so the pipe reaches it).
 *
 * ONE kind per turn:
 *
 *   { kind: 'STORY', articleRef, url }
 *     The repository's existing story reference (My Intelligence `SelectedStoryRef`, saved
 *     stories): `articleRef = sha256(normalizeArticleUrl(url))`, 64 lowercase hex. The URL is
 *     LOOKUP DATA ONLY — it is matched against RETAINED articles in the local database and is
 *     never fetched. `articleRef` must be exactly the identity of `url` (checked server-side).
 *
 *   { kind: 'GEOGRAPHY', countryCode }
 *     An ISO 3166 alpha-2 or alpha-3 code of a GOVERNED country. A name ("Poland"), an alias or
 *     an unknown code is rejected by the server resolver; the display name always comes from
 *     the shared registry.
 *
 * Cross-kind fields are refused: a STORY carrying `countryCode`, or a GEOGRAPHY carrying
 * `articleRef`/`url`, is rejected by the resolver's exact key-set check (ASK_CONTEXT_KEYS),
 * which runs before any read, operation, slot or meter.
 */
export const ASK_CONTEXT_KINDS = ['STORY', 'GEOGRAPHY'] as const;
export type AskContextKind = (typeof ASK_CONTEXT_KINDS)[number];

/** Bound on the story URL used as lookup data (the legacy StoryContextDto bound). */
export const ASK_CONTEXT_URL_MAX = 500;

export class AskTurnContextDto {
  @IsIn(ASK_CONTEXT_KINDS as unknown as string[]) kind!: AskContextKind;

  /* STORY — present and well-formed for STORY; absent (undefined) for GEOGRAPHY. */
  @ValidateIf((o: AskTurnContextDto) => o.kind === 'STORY' || o.articleRef !== undefined)
  @IsString()
  @Matches(ARTICLE_REF_PATTERN)
  articleRef?: string;

  @ValidateIf((o: AskTurnContextDto) => o.kind === 'STORY' || o.url !== undefined)
  @IsString()
  @Length(8, ASK_CONTEXT_URL_MAX)
  @Matches(/^https?:\/\/\S+$/i)
  url?: string;

  /* GEOGRAPHY — present and code-shaped for GEOGRAPHY; absent for STORY. */
  @ValidateIf((o: AskTurnContextDto) => o.kind === 'GEOGRAPHY' || o.countryCode !== undefined)
  @IsString()
  @Matches(GEOGRAPHY_COUNTRY_CODE_PATTERN)
  countryCode?: string;
}

/**
 * The exact key sets each kind may carry. The DTO pipe already rejects unknown keys; this is
 * the resolver's own defence in depth (it is also called directly, without the pipe) and the
 * place the cross-kind rule is enforced.
 */
export const ASK_CONTEXT_KEYS: Readonly<Record<AskContextKind, readonly string[]>> = {
  STORY: ['kind', 'articleRef', 'url'],
  GEOGRAPHY: ['kind', 'countryCode'],
};
