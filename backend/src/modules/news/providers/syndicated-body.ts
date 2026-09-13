import type { NewsArticle } from '@globalnews-ai/shared';

/**
 * SYNDICATED BODY — A NON-ENUMERABLE SIDE-CHANNEL ON NewsArticle.
 *
 * WHY A SYMBOL AND NOT A FIELD. `NewsArticle` lives in `shared/`, which is
 * collision-sensitive and Claude Main's to converge. Adding a field here would
 * be exactly the independent shared-contract change the collision rule forbids.
 *
 * This is not an invention for the occasion - it is the pattern this codebase
 * already uses for the same problem: `news.service.ts` carries provider failures
 * on a symbol for precisely the reason that the public response shape is not
 * ours to widen unilaterally.
 *
 * NON-ENUMERABLE, so it never appears in JSON.stringify, never reaches an API
 * response, and never changes a payload shape. It travels in-process from the
 * feed connector to the evidence assessment and nowhere else.
 *
 * THE PROPER FIELD IS SPECIFIED FOR MAIN in the handoff. When `NewsArticle`
 * gains `syndicatedBody` and `bodySource`, this file is deleted and the two
 * call sites read the fields directly.
 */
const SYNDICATED_BODY = Symbol.for('globalnews.syndicatedBody');

export type BodySource = 'content-encoded' | 'description' | 'none';

export interface SyndicatedBody {
  /** Plain text of <content:encoded>, when the publisher syndicated one. */
  readonly text?: string;
  readonly source: BodySource;
}

/** Attaches the body provenance without changing the article's shape. */
export function attachSyndicatedBody<T extends object>(article: T, body: SyndicatedBody): T {
  Object.defineProperty(article, SYNDICATED_BODY, {
    value: body,
    enumerable: false,
    writable: false,
    configurable: true,
  });

  return article;
}

/**
 * Reads the body provenance.
 *
 * FAILS TO 'description' RATHER THAN 'content-encoded'. An article that carries
 * no side-channel came from a provider that does not supply one - GNews, GDELT -
 * and the honest reading is that its text is a summary. Defaulting the other way
 * would let every wire record claim publisher body text it never had.
 */
export function readSyndicatedBody(article: Pick<NewsArticle, 'summary'>): SyndicatedBody {
  const carried = (article as unknown as Record<symbol, unknown>)[SYNDICATED_BODY];

  if (carried && typeof carried === 'object') return carried as SyndicatedBody;

  return { source: (article.summary ?? '').trim().length > 0 ? 'description' : 'none' };
}
