/**
 * NATURAL SOURCE-ATTRIBUTED QUESTION R1 — WHO THE USER ASKED ABOUT, AND
 * WHETHER A GIVEN RECORD IS ACTUALLY THEIRS.
 *
 * A frame in ../../analysis/query/derive-source-attributed-query.util.ts can
 * tell that a sentence names a source. It cannot tell whether that span names
 * a publisher this product actually carries, and it must not try: a regular
 * expression that decided "Statistics Poland" is a publisher would decide the
 * same about any capitalised pair of words, and the product would start
 * answering questions about publishers it has never ingested.
 *
 * SO THE CURATED REGISTRY IS THE AUTHORITY, NOT THE SENTENCE. A requested
 * source resolves only when it matches an entry in the recovered C55 feed
 * registry — the same `FEED_SOURCES` the RSS connector already stamps onto
 * every record it produces. Nothing is added to that registry here and
 * nothing is inferred from it beyond identity.
 *
 * RSS IS TRANSPORT, NOT PUBLISHER — AND SO IS GNEWS. The registry's own header
 * states the first half; the second half follows from it by exactly the same
 * argument. `providerId` therefore plays NO part in either function below. A
 * Statistics Poland bulletin is a Statistics Poland record whether it arrived
 * through the feed connector, GNews or GDELT DOC, and a GNews record about
 * Polish labour statistics is NOT a Statistics Poland record no matter which
 * connector delivered it.
 *
 * ADMISSION IS FAIL-CLOSED ON `sourceName`. resolvePublisherIdentity() in this
 * same directory prefers the registrable domain and falls back to the
 * normalized name when there is no usable URL — the right precedence for
 * COUNTING distinct publishers, where an unverifiable name is better than
 * nothing. It is the wrong rule for CONSTRAINING admission, because
 * NewsArticle.sourceName's own doc comment says plainly that it is free text a
 * provider supplied and is "not verified publisher identity". A constraint
 * that trusted it could be satisfied by any record whose provider happened to
 * type the right string. So a record is admitted on exactly two grounds, both
 * of which the pipeline itself established:
 *
 *   1. `sourceId` — the curated identity the feed connector stamps. Exact.
 *   2. the registrable domain of the record's own URL, versus the registry's
 *      `canonicalHost` for that publisher. Something the publisher controls
 *      and the pipeline observed.
 *
 * A matching `sourceName` alone NEVER admits. This is a deliberate narrowing
 * of the general-purpose precedence, not a competing identity system: the
 * domain comparison below is resolveRegistrableDomain() — the existing
 * authority — called directly.
 */

import type { NewsArticle } from '@globalnews-ai/shared';

import { FEED_SOURCES } from '../providers/feed-source-registry';
import { normalizePublisherName, resolveRegistrableDomain } from './publisher-identity.util';

export interface RequestedSource {
  /** The curated `FeedSourceEntry.sourceId`, e.g. 'feed:gus-pl'. */
  readonly sourceId: string;
  /** The publisher's own name as the registry records it, e.g. 'Statistics Poland'. */
  readonly displayName: string;
  /** The registrable domain of the registry's `canonicalHost`, e.g. 'stat.gov.pl'. */
  readonly canonicalDomain: string | undefined;
}

/** Strips exactly one leading "the " so "the Standard" reaches "The Standard". */
function withoutLeadingThe(value: string): string {
  return value.replace(/^the\s+/i, '').trim();
}

/**
 * Resolves a requested-source phrase to a curated publisher, or undefined.
 *
 * EXACT NORMALIZED NAME EQUALITY ONLY. normalizePublisherName() — the existing
 * comparison normalizer — folds case, whitespace and punctuation, so
 * "statistics poland", "Statistics Poland" and "Statistics  Poland." are one
 * key. Nothing else is attempted: no substring containment, no token overlap,
 * no fuzzy distance, no "closest match". Each of those would let a phrase the
 * user wrote about one publisher resolve to a different one, which is the
 * precise failure this whole correction exists to prevent.
 *
 * A leading "the " is stripped from both sides before comparison — the only
 * accommodation made — because "What does the Standard report about X?" and
 * "What does The Standard report about X?" are the same question, and the
 * registry already carries the article in its own `displayName`.
 *
 * UNKNOWN STAYS UNKNOWN. An unrecognised phrase returns undefined, and the
 * caller's contract is that an unresolved source does NOT become an
 * unrestricted topic search.
 */
export function resolveRequestedSource(sourcePhrase: string): RequestedSource | undefined {
  const requested = normalizePublisherName(sourcePhrase);

  if (!requested) return undefined;

  const requestedBare = withoutLeadingThe(requested);

  for (const entry of FEED_SOURCES) {
    const registered = normalizePublisherName(entry.displayName);

    if (!registered) continue;

    const registeredBare = withoutLeadingThe(registered);

    if (requested === registered || requestedBare === registeredBare) {
      return {
        sourceId: entry.sourceId,
        displayName: entry.displayName,
        canonicalDomain: resolveRegistrableDomain(`https://${entry.canonicalHost}`),
      };
    }
  }

  return undefined;
}

/**
 * Whether a retrieved record is genuinely attributable to the requested
 * publisher.
 *
 * Fail-closed: anything this cannot establish is a REJECT. A record with no
 * usable URL and a non-curated `sourceId` is not admitted on the strength of
 * its `sourceName`, however exactly that name matches.
 */
export function isAttributableToRequestedSource(
  article: Pick<NewsArticle, 'sourceId' | 'url'>,
  requested: RequestedSource,
): boolean {
  if (article.sourceId === requested.sourceId) return true;

  if (!requested.canonicalDomain) return false;

  return resolveRegistrableDomain(article.url ?? '') === requested.canonicalDomain;
}

/**
 * The admitted subset, in the order retrieval produced it.
 *
 * Order is preserved rather than re-ranked: this is a CONSTRAINT, and a
 * constraint that also reordered evidence would be quietly making a relevance
 * judgement the existing gates already own.
 */
export function filterToRequestedSource<T extends Pick<NewsArticle, 'sourceId' | 'url'>>(
  articles: readonly T[],
  requested: RequestedSource,
): T[] {
  return articles.filter((article) => isAttributableToRequestedSource(article, requested));
}
