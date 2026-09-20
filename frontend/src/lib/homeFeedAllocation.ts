import { normalizeArticleUrl, type NewsArticle } from '@globalnews-ai/shared';

export interface HomeFeedAllocation {
  /** The single lead story — currently selected by response order (position 0); no popularity/engagement claim is made or implied by this selection. */
  featured: NewsArticle | null;
  /** A small set of additional notable stories, guaranteed distinct from `featured` by article id. Replaces the former "trending" concept — this is a curated selection, not a measured popularity signal. */
  inFocus: NewsArticle[];
  /** A further set of stories for exploration, guaranteed distinct from both `featured` and `inFocus` by article id. */
  discovery: NewsArticle[];
  /**
   * The chronological stream, sorted by publishedAt descending.
   *
   * ALPHA POST-CUTOVER R1 — GOVERNED BY `streamPolicy`, NOT BY A STANDING
   * EXEMPTION. This field previously declared a blanket permission to repeat a
   * story already shown in featured/inFocus/discovery. That permission is
   * withdrawn as the DEFAULT: under `'exclusive'` (the default) a story placed
   * in a rail role is not shown again here, so one story occupies exactly one
   * governed Home placement. The chronological-stream reading is preserved and
   * still reachable, but only when a caller asks for it BY NAME — see
   * `HomeFeedStreamPolicy`.
   */
  latestUpdates: NewsArticle[];
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ALPHA POST-CUTOVER R1 — HOW THE STREAM RELATES TO THE RAIL, STATED EXPLICITLY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE CARRIED DEFECT. The Model-A cutover measurement found `homeFeed` and
 * `homeFeedAllocation` failing together, and they are one product defect: a
 * story consumed by a rail role (featured / inFocus / discovery) reappeared in
 * the main Home feed. The two suites were not disagreeing with each other —
 * they were both stating the same governed placement rule the allocator had
 * stopped honouring. The defect predates the cutover; the cutover measured it.
 *
 * WHY THE PREVIOUS BEHAVIOUR WAS NOT SIMPLY "THE C907 RULING". C907 withdrew
 * cross-surface subtraction because subtracting twelve rail-consumed records
 * from a TWELVE-record response emptied the stream, and the hero panel then
 * reported a healthy provider as unavailable. That arithmetic no longer holds:
 * `getHomeFeed` retrieves 24, the rail consumes 1 + 5 + 6 = 12, and the stream
 * receives the remaining 12. The emptiness C907 was correcting is not produced
 * by exclusivity at the released retrieval width — so the blanket exemption no
 * longer pays for itself, and it costs a visible duplicate on every load.
 *
 * WHAT IS THEREFORE ENCODED HERE. Exclusivity is the governed default, and the
 * chronological-stream reading survives as an EXPLICIT CONTRACT a caller opts
 * into by name rather than as an unstated property of the return shape. "Not
 * repeated across governed Home placements unless an explicit contract permits
 * it" is the rule; this type is that contract, made addressable so that the
 * permission can never again be the silent default.
 *
 * NOTHING ABOUT RETRIEVAL CHANGES. Both policies read the SAME single, already
 * fetched response. Neither issues a request, and this module still performs no
 * I/O of any kind.
 */
export type HomeFeedStreamPolicy =
  /**
   * DEFAULT. A story placed in featured / inFocus / discovery is not repeated
   * in `latestUpdates`. Within the stream itself a story still appears at most
   * once, on the same normalized-url identity the rail roles use.
   */
  | 'exclusive'
  /**
   * THE EXPLICIT PERMISSION. `latestUpdates` is the complete chronological
   * record and MAY carry a story the rail roles also surfaced. Still
   * deduplicated WITHIN itself — two provider records of one story collapse to
   * one row under either policy, because that half was never a placement
   * question but a truthfulness one.
   */
  | 'chronological-inclusive';

export const DEFAULT_STREAM_POLICY: HomeFeedStreamPolicy = 'exclusive';

/**
 * R4 — the key the allocator treats as "the same story".
 *
 * DEFENCE IN DEPTH, NOT THE CORRECTION. The correction is upstream, in
 * NewsService, where duplicate records are collapsed before they are ever
 * served; this exists so that a payload which somehow still carries two
 * records of one story cannot be placed into two homepage positions in
 * front of a reader. It is deliberately the WEAKER of the two guards and
 * must never be treated as a substitute for the backend one — a duplicate
 * that reaches here has already travelled through persistence, the API and
 * the analysis candidate pool.
 *
 * `normalizeArticleUrl` is the SAME function the backend identity ladder
 * uses, imported from `shared/` rather than reimplemented, so the two
 * surfaces cannot drift apart on what counts as one address. The
 * `article.id` fallback preserves the previous behaviour exactly for any
 * record without a usable url.
 */
const allocationKey = (article: NewsArticle): string => {
  const url = article.url?.trim();
  return url ? `url:${normalizeArticleUrl(url)}` : `id:${article.id}`;
};

const DEFAULT_IN_FOCUS_COUNT = 5;
const DEFAULT_DISCOVERY_COUNT = 6;

/**
 * Milestone #51 Phase B — pure curation/partition helper, extracted
 * out of page.tsx (which previously contained this positional slicing
 * directly: `headlines[0]`, `headlines.slice(1, 6)`,
 * `headlines.slice(6, 12)`). Deliberately pure: no fetching, no I/O,
 * fully unit-testable in isolation. Takes the SAME single
 * already-fetched article list every homepage section draws from —
 * this function does not introduce any new request.
 *
 * `featured`, `inFocus`, and `discovery` are guaranteed to contain no
 * duplicate article across the three of them — an article selected as
 * `featured` can never also appear in `inFocus` or `discovery`, and an
 * article in `inFocus` can never also appear in `discovery`.
 *
 * ALPHA POST-CUTOVER R1 — `latestUpdates` IS NO LONGER EXEMPT BY DEFAULT.
 * Under the default `streamPolicy` of `'exclusive'` the stream is held to
 * the SAME governed-placement rule as the three rail roles, so one story
 * occupies one Home placement and the reader is never shown it twice.
 * `'chronological-inclusive'` restores the complete-record reading, and a
 * caller must request it by name — see `HomeFeedStreamPolicy`.
 *
 * Never mutates the input array or any article object within it —
 * `latestUpdates` is sorted on the NEW array `filter()` returns, never
 * on `articles` itself; `inFocus`/`discovery` are built by pushing
 * existing article references into new arrays, never altering them.
 *
 * Handles empty and undersupplied input gracefully: with fewer than
 * 12 articles (or zero), each role simply receives as many genuinely
 * distinct articles as are available, down to `featured: null` and
 * empty arrays for a fully empty input — never throws.
 */
export function allocateHomeFeed(
  articles: NewsArticle[],
  inFocusCount: number = DEFAULT_IN_FOCUS_COUNT,
  discoveryCount: number = DEFAULT_DISCOVERY_COUNT,
  streamPolicy: HomeFeedStreamPolicy = DEFAULT_STREAM_POLICY,
): HomeFeedAllocation {
  const featured = articles[0] ?? null;
  // R4 — keyed on STORY identity, not on `id` alone. Two records of one
  // story arrive with two ids (GNewsProvider hashes the raw url), and the
  // previous id-only set placed both: one as `featured`, the next as the
  // first `inFocus` card, which is the adjacent-duplicate pair the rail
  // rendered.
  const usedKeys = new Set<string>();
  if (featured) {
    usedKeys.add(allocationKey(featured));
  }

  const inFocus: NewsArticle[] = [];
  for (const article of articles) {
    if (inFocus.length >= inFocusCount) break;
    const key = allocationKey(article);
    if (usedKeys.has(key)) continue;
    inFocus.push(article);
    usedKeys.add(key);
  }

  const discovery: NewsArticle[] = [];
  for (const article of articles) {
    if (discovery.length >= discoveryCount) break;
    const key = allocationKey(article);
    if (usedKeys.has(key)) continue;
    discovery.push(article);
    usedKeys.add(key);
  }

  /*
    ════════════════════════════════════════════════════════════════════════
    ALPHA POST-CUTOVER R1 — THE GOVERNED PLACEMENT RULE, RESTORED AS DEFAULT.
    ════════════════════════════════════════════════════════════════════════

    THE DEFECT THIS CLOSES, EXACTLY. `latestUpdates` was built from the whole
    response unconditionally, so every story the rail had already placed was
    published a second time in the main Home feed directly beneath it. At the
    released retrieval width of 24 that is 12 stories shown twice on a single
    render — the duplication `homeFeed` and `homeFeedAllocation` both measured.

    WHAT CHANGED, AND WHAT DID NOT. The subtraction below is back, but it is no
    longer unconditional in the other direction either: it is what the DEFAULT
    policy does, and `'chronological-inclusive'` still produces the complete
    record for any caller that names it. Both branches share one identity
    function and one sort, so the two readings cannot drift on what counts as
    one story or on what order stories come in.

    WHY THIS NO LONGER EMPTIES THE STREAM — the concern C907 raised, answered
    with arithmetic rather than with a rule change. `getHomeFeed` retrieves 24
    and the rail consumes 1 + 5 + 6 = 12, so the stream receives 12. The
    twelve-in/zero-out case that made a healthy provider look unavailable
    required a twelve-record retrieval, and that is not the released width.
    THE WIDTH IS LOAD-BEARING AGAIN: see the note in homeFeed.ts before
    reducing it.

    AND THE SURFACE STILL DOES NOT DIAGNOSE. Even at zero this function makes
    no claim about the provider — `HeroLiveFeedPanel` is where "never infer
    provider failure from latestUpdates.length === 0" is enforced, and that
    enforcement is untouched by this correction.

    NO SECOND REQUEST. Nothing here fetches. This is the same single response
    the rail roles were allocated from, read a second way.
  */
  const streamKeys = new Set<string>();
  const latestUpdates = articles
    .filter((article) => {
      const key = allocationKey(article);

      /*
        The governed-placement half. Under the default policy a key the rail
        already consumed is not eligible for the stream at all; under the
        explicit permission it is, and only the within-stream duplicate check
        below applies.
      */
      if (streamPolicy === 'exclusive' && usedKeys.has(key)) return false;

      /*
        The truthfulness half, binding under BOTH policies: however many
        provider records carry one story, the stream shows it once.
      */
      if (streamKeys.has(key)) return false;
      streamKeys.add(key);
      return true;
    })
    /*
      Newest first. `Array.prototype.sort` is stable in every engine this
      product targets, so records sharing a publishedAt keep the provider's
      own response order rather than being reshuffled between renders — which
      is what `allocation is deterministic across repeated runs` asserts.
    */
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  return { featured, inFocus, discovery, latestUpdates };
}

/**
 * R2 — one country's share of today's retrieval.
 *
 * `countryName` is the CANONICAL English name the backend resolver produced,
 * carried here so the ordering tie-break is locale-independent. The rendered
 * label is resolved separately, per locale, through the repository's one
 * canonical getCountryDisplayName() — this shape is not a display string.
 */
export interface TodayCountryCount {
  /** ISO 3166-1 alpha-2, matching CountryMeta.iso2. */
  countryCode: string;
  /** Canonical English name, matching CountryMeta.name. */
  countryName: string;
  /** Records in THIS retrieval, first observed inside the window. */
  count: number;
}

/**
 * R2 — everything the Today surface renders, derived from the SAME single
 * response the rest of the homepage already uses.
 */
export interface TodayAllocation {
  /** Deduplicated by `url`, first observed inside the window, newest first. */
  records: NewsArticle[];
  /** Countries present in `records`, count descending. */
  countries: TodayCountryCount[];
  /** Records inside the window whose country did not resolve. */
  unresolvedCount: number;
  /**
   * Records in the response that carry NO firstSeenAt at all — the honest
   * degraded signal. R0.5 attaches firstSeenAt from persisted Article.fetchedAt
   * and leaves it ABSENT when persistence did not record the article, so this
   * is a real count of "we have not recorded a first observation", never a
   * count of "not today".
   */
  withoutFirstSeenCount: number;
  /** The window this allocation describes, as an ISO-8601 UTC instant pair. */
  windowStart: string;
  windowEnd: string;
}

export const EMPTY_TODAY_ALLOCATION: TodayAllocation = {
  records: [],
  countries: [],
  unresolvedCount: 0,
  withoutFirstSeenCount: 0,
  windowStart: '',
  windowEnd: '',
};

/**
 * R2 — selects the articles this system FIRST OBSERVED inside the UTC day
 * containing `observedAt`, and counts them by country.
 *
 * ── WHAT firstSeenAt IS, AND WHAT THIS FUNCTION THEREFORE CLAIMS ──────────
 *
 * R0.5 exposes the persisted `Article.fetchedAt` as `NewsArticle.firstSeenAt`,
 * merged onto the live response BY URL. It is written once, at first insert,
 * and re-observing the same URL never moves it. It is NOT a database-clock
 * value in the strict sense — Prisma's `@default(now())` supplies the instant
 * from the backend application process before the INSERT — so this function
 * describes it as "first observed by GlobalNews AI", never as a database
 * clock reading, and never as when the news happened.
 *
 * ABSENCE IS NOT "NOT TODAY". An article with no `firstSeenAt` is excluded
 * from `records` AND counted in `withoutFirstSeenCount`, so the surface can
 * say what it does not know instead of silently shrinking. Persistence can
 * fail; when it does, the honest answer is that we have no first observation
 * for that article, not that it is old.
 *
 * ── IDENTITY IS `url`, NEVER `id` ─────────────────────────────────────────
 *
 * `buildStableId()` is a 32-bit rolling hash, and two providers carrying one
 * story produce two ids for a single stored row. `url` is the key the database
 * itself upserts on and the key R0.5 merges on, so it is the key here too.
 * The FIRST occurrence of a url wins, which preserves response order.
 *
 * ── NO BATCH INFERENCE ────────────────────────────────────────────────────
 *
 * Two records sharing a firstSeenAt value are NOT treated as one ingestion
 * batch, and nothing here groups, rounds or clusters on that value. Native
 * evidence disproved byte-identical batch timestamps, so any such rule would
 * be a claim about our own pipeline that the data does not support.
 *
 * Pure: never mutates the input array or any article in it, performs no I/O,
 * and reads no clock of its own — `observedAt` is supplied by the caller.
 */
export function allocateToday(articles: NewsArticle[], observedAt: string): TodayAllocation {
  const observed = new Date(observedAt);

  if (Number.isNaN(observed.getTime())) {
    return EMPTY_TODAY_ALLOCATION;
  }

  const start = new Date(
    Date.UTC(observed.getUTCFullYear(), observed.getUTCMonth(), observed.getUTCDate()),
  );
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const startMs = start.getTime();
  const endMs = end.getTime();

  // R4 — the same normalization the allocator and the backend use. This
  // set already deduplicated by url; it just did so on the RAW string, so
  // a tracking-parameter or fragment variant of one address counted twice.
  const seenUrls = new Set<string>();
  const records: NewsArticle[] = [];
  let withoutFirstSeenCount = 0;

  for (const article of articles) {
    const key = allocationKey(article);
    if (seenUrls.has(key)) continue;
    seenUrls.add(key);

    if (!article.firstSeenAt) {
      withoutFirstSeenCount += 1;
      continue;
    }

    const firstSeenMs = new Date(article.firstSeenAt).getTime();
    if (Number.isNaN(firstSeenMs)) {
      withoutFirstSeenCount += 1;
      continue;
    }

    if (firstSeenMs >= startMs && firstSeenMs < endMs) {
      records.push(article);
    }
  }

  records.sort(
    (a, b) => new Date(b.firstSeenAt as string).getTime() - new Date(a.firstSeenAt as string).getTime(),
  );

  const byCountry = new Map<string, TodayCountryCount>();
  let unresolvedCount = 0;

  for (const record of records) {
    if (!record.countryCode || !record.countryName) {
      unresolvedCount += 1;
      continue;
    }

    const existing = byCountry.get(record.countryCode);
    if (existing) {
      existing.count += 1;
      continue;
    }

    byCountry.set(record.countryCode, {
      countryCode: record.countryCode,
      countryName: record.countryName,
      count: 1,
    });
  }

  /*
    Deterministic ordering: count descending, then the CANONICAL English name
    ascending. The tie-break deliberately does not use the localized label —
    that would make row order depend on the interface language, and two readers
    of the same retrieval would see different rankings of the same data.
  */
  const countries = [...byCountry.values()].sort(
    (a, b) => b.count - a.count || a.countryName.localeCompare(b.countryName, 'en'),
  );

  return {
    records,
    countries,
    unresolvedCount,
    withoutFirstSeenCount,
    windowStart: start.toISOString(),
    windowEnd: end.toISOString(),
  };
}
