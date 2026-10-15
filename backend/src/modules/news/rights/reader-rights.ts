import { FEED_SOURCES, type FeedSourceEntry } from '../providers/feed-source-registry';
import { sourceUseDecision } from './source-use-policy';
export { __setReaderRightsFixtureModeForTests, readerRightsEnforced } from './rights-enforcement';
import { __setRightsTestFeeds } from './rights-enforcement';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MASTER CTO R48 / #96 — EMERGENCY PRODUCTION SOURCE-USE CONTAINMENT (E1-R46 adapted to e7b8105)
 * CTO R81 / E1 D2 — forward-adapted onto the Alpha lineage from aab73f4; the decision delegates to
 * source-use-policy.ts (one authority), the switch lives in rights-enforcement.ts.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * E1-R46: IMMEDIATE_CONTAINMENT_REQUIRED. Third-party news material (headline, snippet, publisher
 * name, date, original link, image) may reach an EXTERNAL reader or the model only on an AFFIRMATIVE,
 * recorded per-use basis. Every reader of this service is external — anonymous, guest and ordinary
 * signed-in alike (CTO R47/R48: a sign-in establishes no GNews or publisher right). Production has no
 * licensed internal-evaluation role, so there is no internal exception here.
 *
 * THE ONLY AFFIRMATIVE BASIS IN THIS CODE BASE: a publisher-direct feed row (`feed:*` sourceId) whose
 * entry in the reviewed feed registry records `rights.state === 'CLEARED'`. GNews / GDELT / other
 * provider items (publisher-slug sourceIds), unknown provenance, and stored rows whose acquisition
 * cannot be verified carry NO such basis and are withheld. Nothing reads the environment; there is
 * no global switch; stored rows are never rewritten — withholding happens where material leaves the
 * service (reader responses) or enters the model.
 */
/* TEST-ONLY: the reviewed registry has no CLEARED feed, so the no-false-negative specs (E1 R46-12)
   add one here. Production never calls the setter; the registry itself is never modified. */
let testFeeds: readonly FeedSourceEntry[] | null = null;
export function __setReaderRightsTestFeeds(feeds: readonly FeedSourceEntry[] | null): void {
  testFeeds = feeds;
  /* CTO R81 — one table for every gate: the source-use policy reads the same test feeds */
  __setRightsTestFeeds(feeds);
}
function activeFeeds(): readonly FeedSourceEntry[] {
  return testFeeds ?? FEED_SOURCES;
}

/*
  CTO R81 / E1 D2 P-4 — ONE AUTHORITY. On the Alpha lineage the reader-rights decision is not a
  second rule: it IS the source-use policy's external-reader decision (`enforce`, METADATA — what a
  reader is shown), the same function the model gate and the Ask payload gate call with AI_INPUT.
  Under `enforce` the only affirmative bases are FEED_CLEARED, PROVIDER_CLEARED (none recorded) and,
  for display only, FEED_METADATA_ONLY (E1's recorded links-and-excerpt grant). PROVIDER_PENDING_REVIEW,
  unknown provenance, social items and a publisher-host hold are withheld.
*/
export type ReaderRightsDecision =
  | { readonly allowed: true; readonly basis: string }
  | { readonly allowed: false; readonly reason: string };

export function readerRightsDecision(
  sourceId: string | null | undefined,
  feeds: readonly FeedSourceEntry[] = activeFeeds(),
  url?: string | null,
): ReaderRightsDecision {
  const decision = sourceUseDecision({ sourceId, url }, 'METADATA', { enforcement: 'enforce', feeds });
  return decision.allowed ? { allowed: true, basis: decision.basis } : { allowed: false, reason: decision.reason };
}

/** Splits news articles by the affirmative decision; order preserved. */
export function partitionReaderRights<T extends { readonly sourceId?: string | null }>(
  items: readonly T[],
  feeds: readonly FeedSourceEntry[] = activeFeeds(),
): { readonly allowed: T[]; readonly withheld: number } {
  const allowed: T[] = [];
  let withheld = 0;
  for (const item of items) {
    if (readerRightsDecision(item.sourceId, feeds).allowed) allowed.push(item);
    else withheld += 1;
  }
  return { allowed, withheld };
}

/** CTO R52 · U-1 — the fields that carry a hotlinked third-party image in reader JSON. */
const IMAGE_KEYS: ReadonlySet<string> = new Set(['imageUrl', 'image', 'urlToImage', 'thumbnail', 'thumbnailUrl', 'heroImageUrl']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * A third-party ARTICLE (or a reference to one) as it appears in reader JSON: a link plus a
 * headline, with the publisher identity next to them — NewsArticle, AnalysisSourceRef, briefing
 * EvidenceRef and story/alert evidence rows all share this shape. Official-data contributions
 * (`source: { name, url, licence }`) carry no headline and are not matched.
 */
export function isThirdPartyArticle(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const link = typeof value.url === 'string' && value.url.length > 0;
  const headline = typeof value.title === 'string' && value.title.length > 0;
  const identity =
    typeof value.sourceId === 'string' ||
    typeof value.publisher === 'string' ||
    typeof value.sourceName === 'string' ||
    typeof value.articleId === 'string';
  return link && headline && identity;
}

/**
 * Deep read-time withholding for reader JSON: every third-party article object without an
 * affirmative basis is removed (from arrays) or dropped (as a property). Returns a NEW value; the
 * input — possibly a stored row — is never mutated.
 */
export function withholdThirdPartyArticles<T>(
  value: T,
  feeds: readonly FeedSourceEntry[] = activeFeeds(),
): { readonly value: T; readonly withheld: number } {
  let withheld = 0;
  /* A reference without its own sourceId (a cited AnalysisSourceRef: articleId) is cleared only when
     it points at an article in the SAME response that is itself cleared. Everything else fails closed. */
  const clearedIds = new Set<string>();
  const collect = (node: unknown, depth: number): void => {
    if (depth > 40) return;
    if (Array.isArray(node)) return node.forEach((item) => collect(item, depth + 1));
    if (!isRecord(node)) return;
    if (
      typeof node.sourceId === 'string' &&
      typeof node.id === 'string' &&
      readerRightsDecision(node.sourceId, feeds, typeof node.url === 'string' ? node.url : undefined).allowed
    ) {
      clearedIds.add(node.id);
    }
    for (const child of Object.values(node)) collect(child, depth + 1);
  };
  collect(value, 0);
  const allowedArticle = (item: Record<string, unknown>): boolean =>
    typeof item.sourceId === 'string'
      ? readerRightsDecision(item.sourceId, feeds, typeof item.url === 'string' ? item.url : undefined).allowed
      : typeof item.articleId === 'string' && clearedIds.has(item.articleId);
  const walk = (node: unknown, depth: number): unknown => {
    if (depth > 40) return node;
    if (Array.isArray(node)) {
      const out: unknown[] = [];
      for (const item of node) {
        if (isThirdPartyArticle(item) && !allowedArticle(item)) {
          withheld += 1;
          continue;
        }
        out.push(walk(item, depth + 1));
      }
      return out;
    }
    if (isRecord(node)) {
      /* only plain JSON objects are rebuilt; Date, Decimal, Buffer and other instances pass as is */
      const proto = Object.getPrototypeOf(node);
      if (proto !== Object.prototype && proto !== null) return node;
      /*
        CTO R52 · U-1 — an image is a third-party asset in its own right (E1 M-18 UNCLEARED). It may
        reach a reader only on a CLEARED article object; on ANY other object — a story card or hero
        block that copied the lead image, a thumbnail, an object that is not a full article — an
        http(s) image field is dropped. Fail closed: no image survives without a recorded right.
      */
      const clearedArticle = isThirdPartyArticle(node) && allowedArticle(node);
      const out: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(node)) {
        if (isThirdPartyArticle(child) && !allowedArticle(child)) {
          withheld += 1;
          continue;
        }
        if (!clearedArticle && IMAGE_KEYS.has(key) && typeof child === 'string' && /^https?:\/\//i.test(child.trim())) {
          withheld += 1;
          continue;
        }
        out[key] = walk(child, depth + 1);
      }
      return out;
    }
    return node;
  };
  const next = walk(value, 0) as T;
  return { value: withheld > 0 ? next : value, withheld };
}
