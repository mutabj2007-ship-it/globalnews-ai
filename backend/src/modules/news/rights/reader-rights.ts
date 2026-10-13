import { FEED_SOURCES, type FeedSourceEntry } from '../providers/feed-source-registry';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MASTER CTO R48 / #96 — EMERGENCY PRODUCTION SOURCE-USE CONTAINMENT (E1-R46 adapted to e7b8105)
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
}
function activeFeeds(): readonly FeedSourceEntry[] {
  return testFeeds ?? FEED_SOURCES;
}

export type ReaderRightsDecision =
  | { readonly allowed: true; readonly basis: 'FEED_CLEARED' }
  | { readonly allowed: false; readonly reason: 'NO_RECORDED_RIGHTS' | 'FEED_NOT_CLEARED' | 'UNKNOWN_FEED' };

export function readerRightsDecision(
  sourceId: string | null | undefined,
  feeds: readonly FeedSourceEntry[] = activeFeeds(),
): ReaderRightsDecision {
  const id = typeof sourceId === 'string' ? sourceId.trim() : '';
  if (!id.startsWith('feed:')) return { allowed: false, reason: 'NO_RECORDED_RIGHTS' };
  const entry = feeds.find((row) => row.sourceId === id);
  if (entry === undefined) return { allowed: false, reason: 'UNKNOWN_FEED' };
  return entry.rights.state === 'CLEARED' ? { allowed: true, basis: 'FEED_CLEARED' } : { allowed: false, reason: 'FEED_NOT_CLEARED' };
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
      readerRightsDecision(node.sourceId, feeds).allowed
    ) {
      clearedIds.add(node.id);
    }
    for (const child of Object.values(node)) collect(child, depth + 1);
  };
  collect(value, 0);
  const allowedArticle = (item: Record<string, unknown>): boolean =>
    typeof item.sourceId === 'string'
      ? readerRightsDecision(item.sourceId, feeds).allowed
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

/** The reader-facing state of an Ask answer whose evidence is withheld (read time; stored row untouched). */
export const SOURCE_RIGHTS_WITHHELD_BASIS = 'SOURCE_RIGHTS_WITHHELD' as const;

/** CTO R54 · C-96 — the only payload fields a withheld answer keeps (none can carry source text). */
export const WITHHELD_ANSWER_ALLOWLIST = ['schema', 'route', 'chips', 'checkedAt', 'aiExecuted', 'modelPriorCitable'] as const;

/**
 * An Ask R2 result payload, as read for an external reader. When ANY of its evidence articles or
 * cited sources lacks an affirmative basis — or the analysis recorded that evidence was withheld
 * before the model — the answer itself rests on uncleared material (its prose was written from it),
 * so the answer content is withheld, not just the links: state CAPABILITY_UNAVAILABLE with basis
 * SOURCE_RIGHTS_WITHHELD (never "no reporting found"), analysis / comparison / recent reporting
 * removed, the reader's question untouched. Payloads with no third-party evidence are returned as is.
 */
export function withholdAskPayload<T>(payload: T, feeds: readonly FeedSourceEntry[] = activeFeeds()): { readonly payload: T; readonly withheld: number } {
  if (!isRecord(payload)) return { payload, withheld: 0 };
  const analysis = isRecord(payload.analysis) ? payload.analysis : null;
  const articles = Array.isArray(analysis?.articles) ? (analysis!.articles as unknown[]) : [];
  const inner = isRecord(analysis?.analysis) ? (analysis!.analysis as Record<string, unknown>) : null;
  const sources = Array.isArray(inner?.sources) ? (inner!.sources as unknown[]) : [];
  const context = isRecord(analysis?.retrievalContext) ? (analysis!.retrievalContext as Record<string, unknown>) : null;
  const recordedWithheld =
    isRecord(context?.rightsWithheld) && typeof (context!.rightsWithheld as Record<string, unknown>).count === 'number'
      ? ((context!.rightsWithheld as Record<string, unknown>).count as number)
      : 0;
  const uncleared = (item: unknown): boolean =>
    isRecord(item) && !readerRightsDecision(typeof item.sourceId === 'string' ? item.sourceId : undefined, feeds).allowed;
  /* a cited AnalysisSourceRef carries articleId, not sourceId: it is cleared only when its article is */
  const clearedIds = new Set(
    articles.filter((a) => isRecord(a) && !uncleared(a)).map((a) => String((a as Record<string, unknown>).id)),
  );
  const unclearedSources = sources.filter((s) => isRecord(s) && !clearedIds.has(String(s.articleId)));
  const unclearedArticles = articles.filter(uncleared);
  const answerWithheld = unclearedArticles.length + unclearedSources.length + recordedWithheld;
  /*
    CTO R53 — the stored CONVERSATION ARTIFACT of a sourced answer carries source-derived claim
    points (`components`) and the evidence URLs / refs (`evidenceUrls`, `evidenceRefs`); the reader
    interceptor does not recognise those strings as articles. Fail closed: a SOURCED artifact (or any
    artifact naming evidence) survives only when every URL and ref it names is a CLEARED article of
    this same payload; one naming none cannot be verified and is withheld. An unsourced
    (general-knowledge / reasoning) artifact is untouched. The stored row is never changed.
  */
  const artifact = isRecord(payload.artifact) ? payload.artifact : null;
  const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const artifactUrls = strings(artifact?.evidenceUrls);
  const artifactRefs = strings(artifact?.evidenceRefs);
  const sourcedArtifact =
    artifact !== null && (artifact.provenance === 'SOURCED_REPORTING' || artifactUrls.length > 0 || artifactRefs.length > 0);
  const clearedUrls = new Set(
    articles.filter((a) => isRecord(a) && !uncleared(a)).map((a) => String((a as Record<string, unknown>).url)),
  );
  const artifactCleared =
    !sourcedArtifact ||
    (artifactUrls.length + artifactRefs.length > 0 &&
      artifactUrls.every((url) => clearedUrls.has(url)) &&
      artifactRefs.every((ref) => clearedIds.has(ref)));
  if (answerWithheld > 0) {
    /*
      CTO R54 · C-96 — an EXPLICIT allowlist, never a spread of the rest: every field the payload may
      carry that is or could be derived from the withheld sources (background, intelligence, artifact,
      comparisonTable, recentReporting, guidance, verification, continuation, prior answer, any
      future field) is dropped by default. Kept: the payload's identity and the reader's own words
      and scope (schema, route, chips: plan codes and the reader's terms) and the run's facts
      (checkedAt, aiExecuted, modelPriorCitable). The answer decision is rebuilt from codes too.
    */
    const kept: Record<string, unknown> = {};
    for (const key of WITHHELD_ANSWER_ALLOWLIST) if (key in payload) kept[key] = payload[key];
    const answer = isRecord(payload.answer) ? payload.answer : {};
    const missingRoles = Array.isArray(answer.missingRoles)
      ? answer.missingRoles.filter((r): r is string => typeof r === 'string')
      : [];
    return {
      payload: {
        ...kept,
        analysis: null,
        background: null,
        answer: { state: 'CAPABILITY_UNAVAILABLE', basis: SOURCE_RIGHTS_WITHHELD_BASIS, missingRoles, candidates: [] },
        sourceRightsWithheld: { count: Math.max(answerWithheld, 1) },
      } as T,
      withheld: Math.max(answerWithheld, 1),
    };
  }
  /* no answer evidence was withheld: still strip any uncleared item elsewhere (recentReporting, …) */
  const deep = withholdThirdPartyArticles(payload, feeds);
  if (!artifactCleared) {
    /* CTO R53 — a sourced artifact naming uncleared (or no verifiable) evidence is withheld alone */
    const { artifact: _art, ...rest } = deep.value as Record<string, unknown>;
    void _art;
    const withheld = deep.withheld + 1;
    return { payload: { ...rest, sourceRightsWithheld: { count: withheld } } as T, withheld };
  }
  return { payload: deep.value, withheld: deep.withheld };
}

/*
  TEST-ONLY SWITCH. The suites written before R48 use GNews-shaped fixtures to test OTHER behaviour;
  the backend Jest setup file (test-setup/reader-rights-fixture-mode.ts) turns enforcement off for
  them, and every R48 spec turns it back on. Production code never calls the setter: it is not
  imported anywhere under src/ outside tests, and nothing here reads the environment.
*/
let fixtureMode = false;
export function __setReaderRightsFixtureModeForTests(on: boolean): void {
  fixtureMode = on;
}
/** True in every running service; false only inside pre-R48 Jest suites. */
export function readerRightsEnforced(): boolean {
  return !fixtureMode;
}
