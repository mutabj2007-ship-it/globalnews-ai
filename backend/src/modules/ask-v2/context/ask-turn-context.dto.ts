import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsString,
  Length,
  Matches,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ARTICLE_REF_PATTERN,
  GEOGRAPHY_COUNTRY_CODE_PATTERN,
  MAX_SELECTED_STORIES,
  MULTI_STORY_ACTIONS,
  type MultiStoryAction,
} from '@globalnews-ai/shared';

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
 *   { kind: 'STORY', articleId }                                   (R2C)
 *     The persisted Article row's primary key — what the product's surfaces already hold (Map
 *     source cards, /search?articleId, /ask?articleId) and what AnalysisService's own anchor
 *     path resolves (findArticleById). A database key, resolved server-side; the canonical
 *     identity is still the stored row's articleRef, so both forms of one story are ONE identity.
 *
 *   { kind: 'GEOGRAPHY', countryCode }
 *     An ISO 3166 alpha-2 or alpha-3 code of a GOVERNED country. A name ("Poland"), an alias or
 *     an unknown code is rejected by the server resolver; the display name always comes from
 *     the shared registry.
 *
 *   { kind: 'SELECTION', action, stories: [{ articleRef, url }, …] }   (R2D)
 *     A My Intelligence selection: one of the existing MultiStoryAction values and 1..8 unique
 *     story references in the SelectedStoryRef format. Every story is resolved server-side from
 *     retained reporting; one unresolvable story refuses the whole turn (never a silent drop).
 *
 * Cross-kind fields are refused: a STORY carrying `countryCode`, or a GEOGRAPHY carrying
 * `articleRef`/`url`, is rejected by the resolver's exact key-set check (ASK_CONTEXT_KEY_SETS),
 * which runs before any read, operation, slot or meter.
 */
export const ASK_CONTEXT_KINDS = ['STORY', 'GEOGRAPHY', 'SELECTION', 'MODULE'] as const;

/**
 * R2F — the closed set of dashboard modules a MODULE reference may name. Naming one is not
 * binding it: the resolver binds only modules with a governed contributor and refuses the rest
 * with ASK_CONTEXT_MODULE_NOT_BINDABLE (never a silent generic Ask, never a pretend binding).
 */
export const ASK_CONTEXT_MODULES = [
  'CONFLICT',
  'ECONOMY',
  'MARKET',
  'ENERGY',
  'HUMANITARIAN',
  'POLITICS',
  'ELECTIONS',
  'IMIHIGO',
] as const;
export type AskContextModule = (typeof ASK_CONTEXT_MODULES)[number];
/** R2F — a module record's stable key: printable, bounded (keys may carry ':' '/' and spaces). */
export const ASK_CONTEXT_OBSERVATION_KEY_PATTERN = /^[^\u0000-\u001f\u007f]{1,300}$/;
export type AskContextKind = (typeof ASK_CONTEXT_KINDS)[number];

/** Bound on the story URL used as lookup data (the legacy StoryContextDto bound). */
export const ASK_CONTEXT_URL_MAX = 500;

/** R2C — the persisted Article id shape (e.g. `gnews-123`), bounded like the legacy DTO (≤200). */
export const ASK_CONTEXT_ARTICLE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;

const storyByRef = (o: AskTurnContextDto): boolean =>
  o.kind === 'STORY' && o.articleId === undefined;

/** R2D — one selected story: the existing SelectedStoryRef format (references only). */
export class AskSelectedStoryRefDto {
  @IsString() @Matches(ARTICLE_REF_PATTERN) articleRef!: string;
  @IsString() @Length(8, ASK_CONTEXT_URL_MAX) @Matches(/^https?:\/\/\S+$/i) url!: string;
}

export class AskTurnContextDto {
  @IsIn(ASK_CONTEXT_KINDS as unknown as string[]) kind!: AskContextKind;

  /* STORY — present and well-formed for STORY; absent (undefined) for GEOGRAPHY. */
  @ValidateIf((o: AskTurnContextDto) => storyByRef(o) || o.articleRef !== undefined)
  @IsString()
  @Matches(ARTICLE_REF_PATTERN)
  articleRef?: string;

  @ValidateIf((o: AskTurnContextDto) => storyByRef(o) || o.url !== undefined)
  @IsString()
  @Length(8, ASK_CONTEXT_URL_MAX)
  @Matches(/^https?:\/\/\S+$/i)
  url?: string;

  /* R2C — STORY by persisted Article id (instead of articleRef + url). */
  @ValidateIf((o: AskTurnContextDto) => o.articleId !== undefined)
  @IsString()
  @Matches(ASK_CONTEXT_ARTICLE_ID_PATTERN)
  articleId?: string;

  /* GEOGRAPHY — present and code-shaped for GEOGRAPHY; absent for STORY. */
  @ValidateIf((o: AskTurnContextDto) => o.kind === 'GEOGRAPHY' || o.countryCode !== undefined)
  @IsString()
  @Matches(GEOGRAPHY_COUNTRY_CODE_PATTERN)
  countryCode?: string;

  /* R2F — MODULE: a dashboard record by its stable key (references only, never its values). */
  @ValidateIf((o: AskTurnContextDto) => o.kind === 'MODULE' || o.module !== undefined)
  @IsIn(ASK_CONTEXT_MODULES as unknown as string[])
  module?: AskContextModule;

  @ValidateIf((o: AskTurnContextDto) => o.kind === 'MODULE' || o.observationKey !== undefined)
  @IsString()
  @Matches(ASK_CONTEXT_OBSERVATION_KEY_PATTERN)
  observationKey?: string;

  /* R2D — SELECTION: the action and its bounded story references. */
  @ValidateIf((o: AskTurnContextDto) => o.kind === 'SELECTION' || o.action !== undefined)
  @IsIn(MULTI_STORY_ACTIONS as unknown as string[])
  action?: MultiStoryAction;

  @ValidateIf((o: AskTurnContextDto) => o.kind === 'SELECTION' || o.stories !== undefined)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SELECTED_STORIES)
  @ValidateNested({ each: true })
  @Type(() => AskSelectedStoryRefDto)
  stories?: AskSelectedStoryRefDto[];
}

/**
 * The exact key sets each kind may carry. The DTO pipe already rejects unknown keys; this is
 * the resolver's own defence in depth (it is also called directly, without the pipe) and the
 * place the cross-kind rule is enforced.
 */
export const ASK_CONTEXT_KEY_SETS: Readonly<
  Record<AskContextKind, readonly (readonly string[])[]>
> = {
  STORY: [
    ['kind', 'articleRef', 'url'],
    /* R2C */
    ['kind', 'articleId'],
  ],
  GEOGRAPHY: [['kind', 'countryCode']],
  /* R2D */
  SELECTION: [['kind', 'action', 'stories']],
  /* R2F */
  MODULE: [['kind', 'module', 'observationKey']],
};
