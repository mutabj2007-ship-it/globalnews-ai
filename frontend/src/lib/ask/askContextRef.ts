import type { StoryContext } from '@globalnews-ai/shared';
import type { AskV2ContextRef } from '@/lib/api/askV2Api';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * UNIFIED INTELLIGENCE BINDING R2C — THE ONE CONTEXT-REFERENCE BUILDER
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Every first-party surface that hands context to the canonical Ask V2 engine (the /ask frame,
 * the global dock, /search) builds its reference HERE, so the chip a reader sees and the
 * reference the engine receives cannot disagree.
 *
 * REFERENCES ONLY. A story is named by the persisted article id it already carries; a country by
 * its ISO code. The title, source name and any other text the browser holds are display data
 * and are never sent — the server resolves every fact from its own records (R2B).
 *
 * PRECEDENCE, STATED: a story (the more specific anchor) wins; otherwise a country; never both.
 *   1. story with a persisted articleId         → { kind: 'STORY', articleId }
 *   2. story context without an article, with a
 *      country code (e.g. /search?countryCode=)  → { kind: 'GEOGRAPHY', countryCode }
 *   3. published Map geography                   → { kind: 'GEOGRAPHY', countryCode }
 *   4. nothing                                   → undefined (a generic Ask)
 *
 * Shape is checked here only so a malformed value is not sent at all; governance (does this id
 * exist, is this code a governed country) is the server's, and a refusal is shown truthfully —
 * the question is never silently re-run without its context.
 */

/** The persisted Article id shape the server accepts (mirrors the backend DTO). */
const ARTICLE_ID_SHAPE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
/** ISO 3166 alpha-2 / alpha-3 shape (governance is server-side). */
const COUNTRY_CODE_SHAPE = /^[A-Za-z]{2,3}$/;

export function askContextRefOf(
  story: StoryContext | undefined,
  geography: { readonly countryCode: string } | undefined,
): AskV2ContextRef | undefined {
  if (story !== undefined) {
    if (typeof story.articleId === 'string' && ARTICLE_ID_SHAPE.test(story.articleId)) {
      return { kind: 'STORY', articleId: story.articleId };
    }
    if (typeof story.countryCode === 'string' && COUNTRY_CODE_SHAPE.test(story.countryCode)) {
      return { kind: 'GEOGRAPHY', countryCode: story.countryCode };
    }
  }
  if (geography !== undefined && COUNTRY_CODE_SHAPE.test(geography.countryCode)) {
    return { kind: 'GEOGRAPHY', countryCode: geography.countryCode };
  }
  return undefined;
}

/** A stable identity of a reference, for "the context changed" decisions (no request). */
export function askContextKey(ref: AskV2ContextRef | undefined): string {
  if (ref === undefined) return 'none';
  if (ref.kind === 'GEOGRAPHY') return `GEOGRAPHY:${ref.countryCode.toUpperCase()}`;
  return 'articleId' in ref ? `STORY:id:${ref.articleId}` : `STORY:ref:${ref.articleRef}`;
}
