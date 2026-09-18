import type {
  CountryNewsResponse,
  NewsArticle,
  NewsCategory,
} from '@globalnews-ai/shared';
import { calculateCoverageQuality, type CoverageQualityLevel } from '@/lib/coverageQuality';
import { PERIOD_HOURS, type MapPeriod } from '@/lib/map/state/mapState';
import type { DisplayPrecision } from '@/lib/map/spatial/precisionModel';
import { articleSpatialPrecision } from '@/lib/spatial/spatialPrecision';

/**
 * SPATIAL M2 · DESIGN REVISION 1.2 — THE SELECTED-COUNTRY BLOCKS.
 *
 * Design's amendment of 2026-09-01 replaced the intelligence card's one-line
 * description with a TWELVE-BLOCK fixed order, and named five capabilities that
 * the current World Map had and the M2 card did not:
 *
 *   02 provider status
 *   05 coverage state, with freshness and a staleness flag
 *   06 selection-scoped category filters
 *   09 source cards — thumbnail, publisher, time, named source affordance
 *   11 an explicit unfollow path
 *
 * This module owns the four of those that are DATA rather than presentation. It
 * derives them from the country feed the route already has, and the components
 * render what it returns.
 *
 * ── WHY DERIVATION LIVES HERE AND NOT IN THE CARD ─────────────────────────
 *
 * Because every one of these is a claim about the reader's evidence, and a
 * claim computed inside a JSX tree cannot be tested without a renderer. A
 * coverage band that says STRONG is an assertion; it belongs in a pure function
 * with a spec against it.
 *
 * ── AND WHY IT DERIVES NOTHING IT WAS NOT GIVEN ───────────────────────────
 *
 * There is no parameter here through which a query, a selection or a retrieval
 * context could reach a block. Provider status comes from the response envelope
 * the provider itself filled in; the coverage band comes from the accepted
 * `calculateCoverageQuality`; categories come from the retained articles' own
 * `category` field. Nothing is inferred from the country, and no block is
 * fabricated to avoid an empty one — Design's rule is that a block with no data
 * is OMITTED, and omission is expressed here by returning `null`.
 */

/* ════════════════════════════════════════════════════════════════════════════
   BLOCK 02 · PROVIDER STATUS
   ════════════════════════════════════════════════════════════════════════════

   Part I §E: "One line stating which retrieval provider served this geography
   and its condition — Live feed, Delayed feed, No provider configured. Amber
   when delayed or degraded, muted when absent. ABSENCE OF A PROVIDER IS A
   DIFFERENT FACT FROM ABSENCE OF EVIDENCE and must read differently."

   That last sentence is the whole reason this block exists, and it is why
   `NONE` is returned for `dataMode: 'unavailable'` rather than letting the card
   fall through to its no-evidence state. "We asked nobody" and "we asked and
   there was nothing" are different answers, and only one of them is about the
   world.
*/

export type ProviderCondition = 'LIVE' | 'DELAYED' | 'NONE';

export interface ProviderStatus {
  readonly condition: ProviderCondition;
  /** The provider's own display name, or null when there is none to name. */
  readonly providerName: string | null;
  /**
   * Why the feed is degraded, when the envelope says. Carried verbatim from
   * `fallbackReason` — this module does not translate or interpret it.
   */
  readonly fallbackReason?: CountryNewsResponse['fallbackReason'];
  /**
   * True when the data did not come from a live provider call at all — cached
   * reporting or the mock feed. Kept SEPARATE from `condition` because a reader
   * being shown stored reporting is entitled to know that specifically, and
   * folding it into DELAYED would lose it.
   */
  readonly isStored: boolean;
}

export function providerStatusFrom(response: CountryNewsResponse): ProviderStatus {
  /*
    ── R5 · SELECTION-INTELLIGENCE-UNGUARDED-TRIM-1 ─────────────────────────

    `providerDisplayName` is REQUIRED by `CountryNewsResponse`, and that
    requirement is not weakened here: the shared contract still declares it
    `string`, the backend still always sends it, and nothing downstream is
    given permission to omit it.

    What changes is the blast radius when an envelope arrives malformed
    anyway. The bare `response.providerDisplayName.trim()` that stood here
    threw `TypeError: Cannot read properties of undefined (reading 'trim')` on
    a response missing the field, React followed with #310, and **the entire
    map shell unmounted** — a blank page where one panel should have said it
    did not know the provider. That was measured against the deployed Alpha
    build during R3.2 validation.

    An unreadable provider name is a fact about one panel. It is not a reason
    to take the map away from the reader, and `providerName: null` is a state
    this type already models and every consumer already handles.

    NOT a coercion: a non-string is treated as ABSENT, never stringified into
    a label like "undefined" that would be shown to a reader as if a provider
    had been named.
  */
  const rawProviderName = response.providerDisplayName;

  const providerName =
    typeof rawProviderName === 'string' && rawProviderName.trim().length > 0
      ? rawProviderName
      : null;

  switch (response.dataMode) {
    case 'live':
      /*
        `feedTier` is the provider's own statement about its latency, and it is
        the discriminant Design's DELAYED state is for. A live call to a delayed
        feed is still a delayed feed.
      */
      return {
        condition: response.feedTier === 'delayed' ? 'DELAYED' : 'LIVE',
        providerName,
        isStored: false,
      };

    case 'cached':
      return {
        condition: 'DELAYED',
        providerName,
        fallbackReason: response.fallbackReason,
        isStored: true,
      };

    case 'mock':
      /*
        NOT 'LIVE', WHATEVER IT LOOKS LIKE. The mock feed produces
        well-formed articles, which is exactly why it must be labelled: a
        surface that reports a demonstration feed as a live provider is lying
        with a green dot.
      */
      return { condition: 'DELAYED', providerName, isStored: true };

    case 'unavailable':
    default:
      return {
        condition: 'NONE',
        providerName,
        fallbackReason: response.fallbackReason,
        isStored: false,
      };
  }
}

/* ════════════════════════════════════════════════════════════════════════════
   BLOCK 05 · COVERAGE STATE
   ════════════════════════════════════════════════════════════════════════════

   Part I §E: "A named strength band — STRONG · MODERATE · THIN · NONE — with
   freshness age and a staleness flag (aging, stale) when the newest retained
   item passes the period threshold. ... This is a statement about COVERAGE,
   never about the truth of what is covered."

   ── THE BAND REUSES THE ACCEPTED COMPUTATION ──────────────────────────────

   `calculateCoverageQuality` already scores publisher count, article count and
   freshness, and it is what the existing World Map shelf shows. Writing a
   second scorer here would let the Spatial card and the country panel disagree
   about the same country on the same screen. So the accepted levels are MAPPED
   onto Design's four bands, and the mapping is the only new decision:

     strong      -> STRONG
     developing  -> MODERATE
     limited     -> THIN
     none        -> NONE

   The /100 NUMERAL IS DELIBERATELY NOT CARRIED OVER. Design's change log lists
   "coverage-score numerals" among the things not restored, and a score invites
   exactly the comparison between countries that a coverage band refuses to
   support.
*/

export type CoverageBand = 'STRONG' | 'MODERATE' | 'THIN' | 'NONE';
export type FreshnessFlag = 'AGING' | 'STALE';

const BAND_FOR_LEVEL: Readonly<Record<CoverageQualityLevel, CoverageBand>> = {
  strong: 'STRONG',
  developing: 'MODERATE',
  limited: 'THIN',
  none: 'NONE',
};

export interface CoverageState {
  readonly band: CoverageBand;
  readonly publisherCount: number;
  /** ISO timestamp of the newest retained item, or null when there is none. */
  readonly newestAt: string | null;
  /** Hours since `newestAt`, or null. The card formats; this measures. */
  readonly ageHours: number | null;
  /**
   * Set only when the newest item has passed a threshold of the SELECTED
   * PERIOD. Absent is the normal case and means the coverage is current for the
   * window the reader chose — not that freshness was not checked.
   */
  readonly flag?: FreshnessFlag;
  /**
   * True when the newest retained item's timestamp is an OBSERVATION time
   * rather than a publication time. `NewsArticle.publishedAtBasis` makes this
   * distinction part of the contract, and its UI rule is explicit: an observed
   * timestamp "may be rendered as 'Seen 3h ago' and must NEVER be rendered as
   * 'Published 3h ago'". Absent basis is UNPROVEN and fails closed to observed.
   */
  readonly ageIsObservedOnly: boolean;
}

/**
 * AGING at half the period, STALE past it.
 *
 * Measured against the reader's own selected window rather than a fixed number
 * of hours, because "stale" is a claim relative to the question being asked: an
 * item from yesterday is current in a 30-day view and stale in a 24-hour one.
 */
export function coverageStateFrom(
  response: CountryNewsResponse,
  period: MapPeriod,
  now: number,
  language: Parameters<typeof calculateCoverageQuality>[1] = 'en',
): CoverageState {
  const quality = calculateCoverageQuality(response.articles, language);
  const band = BAND_FOR_LEVEL[quality.level];

  if (quality.latestPublishedAt === null) {
    return {
      band,
      publisherCount: quality.publisherCount,
      newestAt: null,
      ageHours: null,
      ageIsObservedOnly: false,
    };
  }

  const newestMs = Date.parse(quality.latestPublishedAt);
  const ageHours = (now - newestMs) / 3_600_000;
  const windowHours = PERIOD_HOURS[period];

  /*
    The newest article, found by timestamp rather than by position: the feed's
    order is the provider's, and reading `articles[0]` would make the basis flag
    depend on a sort this module does not control.
  */
  const newest = response.articles.reduce<NewsArticle | null>((best, article) => {
    if (best === null) return article;

    return Date.parse(article.publishedAt) > Date.parse(best.publishedAt) ? article : best;
  }, null);

  const flag: FreshnessFlag | undefined =
    ageHours > windowHours ? 'STALE' : ageHours > windowHours / 2 ? 'AGING' : undefined;

  return {
    band,
    publisherCount: quality.publisherCount,
    newestAt: quality.latestPublishedAt,
    ageHours: Math.max(0, ageHours),
    ...(flag === undefined ? {} : { flag }),
    /* ABSENT BASIS IS UNPROVEN, AND FAILS CLOSED. See the field's note. */
    ageIsObservedOnly: newest?.publishedAtBasis !== 'publisher',
  };
}

/* ════════════════════════════════════════════════════════════════════════════
   BLOCK 06 · CATEGORY DISTRIBUTION, AS SELECTION-SCOPED FILTERS
   ════════════════════════════════════════════════════════════════════════════

   Part II §3 adds `cardFilters Set<categoryId>` and a row that states the
   distinction in one sentence: card filters "narrow the retained list and the
   evidence markers FOR THE CURRENT SELECTION ONLY, and are discarded when the
   selection changes. They are NOT MODES, are not URL-serialised, and never
   alter the evidence set the surface was given."

   All four of those constraints are structural rather than documented:

     not a mode          this file exports no mode value and imports no mode
                         type; nothing here can reach the mode switcher.
     selection-scoped    the filter set is a component-level state in the route,
                         cleared by the same handler that changes the selection.
     not URL-serialised  `mapUrl.ts` has no key for it, and this module has no
                         serialiser.
     never alters the    `applyCardFilters` returns a NARROWED VIEW and takes
     evidence set        `readonly` inputs. The set handed to the shell is
                         untouched — filtering happens where the list and the
                         markers are chosen, not where evidence is assembled.
*/

export interface CategoryCount {
  readonly category: NewsCategory;
  readonly count: number;
  /** 0..1, against the largest category. Presentation gets a ratio, not a width. */
  readonly share: number;
}

/**
 * Ranked categories over the RETAINED set.
 *
 * Ranked by count, descending, then by name so the order is stable between
 * renders — an unstable order would make the bars reshuffle when nothing about
 * the data had changed.
 */
export function categoryDistribution(
  articles: readonly NewsArticle[],
): readonly CategoryCount[] {
  const counts = new Map<NewsCategory, number>();

  for (const article of articles) {
    counts.set(article.category, (counts.get(article.category) ?? 0) + 1);
  }

  const max = Math.max(1, ...counts.values());

  return [...counts.entries()]
    .map(([category, count]) => ({ category, count, share: count / max }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}

/**
 * The retained items a filter set admits.
 *
 * AN EMPTY SET MEANS ALL, not none. "All clears" is Design's own wording, and
 * an empty multi-select that hid everything would make the cleared state
 * indistinguishable from a filter matching nothing.
 */
export function applyCardFilters<T extends { readonly category: NewsCategory }>(
  items: readonly T[],
  filters: ReadonlySet<NewsCategory>,
): readonly T[] {
  return filters.size === 0 ? items : items.filter((item) => filters.has(item.category));
}

/* ════════════════════════════════════════════════════════════════════════════
   BLOCK 09 · RETAINED REPORTING — THE SOURCE CARD'S DATA
   ════════════════════════════════════════════════════════════════════════════

   Part I §E card anatomy: "a 44 x 44 thumbnail at the leading edge, a category
   label above the headline in the evidence colour, the headline at two lines
   maximum, then a metadata line carrying publisher, publication age and the
   item's OWN precision."

   The item's own precision — not the country's. An article that states a city
   carries CITY here even when the geography around it is held at COUNTRY, and
   `articleSpatialPrecision` is the accepted reader for that field.
*/

export interface RetainedItem {
  readonly id: string;
  readonly headline: string;
  readonly category: NewsCategory;
  readonly publisher: string;
  readonly publishedAt: string;
  /**
   * See `CoverageState.ageIsObservedOnly`. Carried per item because the basis
   * is per article: one feed can mix a publisher timestamp and an aggregator's
   * observation time, and the card must not describe the second as the first.
   */
  readonly timeIsObservedOnly: boolean;
  /** The item's OWN level. Never the selection's. */
  readonly precision: DisplayPrecision;
  /**
   * OPTIONAL, AND ITS ABSENCE IS A LAYOUT DECISION, NOT AN ERROR. Design: when
   * absent "the slot collapses to a monospace category glyph rather than a
   * broken frame or a placeholder image", and "the card must read identically
   * with every image removed".
   */
  readonly thumbnailUrl?: string;
  /** The canonical source. Opened in a new tab by a NAMED affordance. */
  readonly url: string;
}

export function retainedItemsFrom(articles: readonly NewsArticle[]): readonly RetainedItem[] {
  return articles.map((article) => ({
    id: article.id,
    headline: article.title,
    category: article.category,
    publisher: article.sourceName,
    publishedAt: article.publishedAt,
    timeIsObservedOnly: article.publishedAtBasis !== 'publisher',
    precision: articleSpatialPrecision(article) as DisplayPrecision,
    ...(article.imageUrl !== undefined && article.imageUrl.length > 0
      ? { thumbnailUrl: article.imageUrl }
      : {}),
    url: article.url,
  }));
}

/* ════════════════════════════════════════════════════════════════════════════
   BLOCK 10 · TOPICS
   ════════════════════════════════════════════════════════════════════════════

   Retained topic pills. Drawn from the articles' own `tag`, deduplicated, and
   RETURNED EMPTY WHEN THERE ARE NONE so the card can omit the block rather than
   render a heading over nothing.
*/

export function retainedTopics(articles: readonly NewsArticle[]): readonly string[] {
  const topics = new Set<string>();

  for (const article of articles) {
    if (article.tag !== undefined && article.tag.length > 0) topics.add(article.tag);
  }

  return [...topics].sort();
}
