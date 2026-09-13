import type { SourceType } from '@globalnews-ai/shared';

/**
 * S1 — THE CURATED FEED REGISTRY.
 *
 * THE ARCHITECTURE RULE THIS FILE EXISTS TO ENFORCE: **RSS is the transport,
 * not the publisher.**
 *
 * One connector fetches all of these, but a record ingested from KT Press is a
 * KT PRESS record — not an "RSS" record. If ingestion flattened them into a
 * single synthetic publisher, then distinct-publisher counts would collapse to
 * one, local-publisher attribution would fail (there is no ccTLD in the word
 * "rss"), cross-provider dedup would stop recognising the same story arriving
 * twice, and clustering would lose the source diversity it measures. Every
 * entry therefore carries the identity the rest of the pipeline needs, and the
 * provider stamps that identity onto each article rather than its own.
 *
 * EVERY ENTRY WAS FETCHED AND VERIFIED on the date in `verifiedAt`. Nothing
 * here is a conventional path guessed from a CMS pattern — three plausible
 * candidates were rejected during verification precisely because their
 * advertised feeds did not work (see the rejected list at the bottom).
 *
 * UNKNOWN STAYS UNKNOWN. `language` is populated only where the feed states it
 * or the publisher's output is unambiguous. No entry claims institutional
 * authority beyond what the official-source registry independently verifies —
 * `sourceType: 'OFFICIAL_SOURCE'` here means "this institution publishes this
 * feed", and authority class still comes from the curated host lookup.
 */
export interface FeedSourceEntry {
  /** Stable id used as NewsArticle.sourceId. Namespaced so it cannot collide. */
  readonly sourceId: string;
  /** The publisher's own name — becomes NewsArticle.sourceName. */
  readonly displayName: string;
  /** ISO2 of the market this publisher serves. */
  readonly countryCode: string;
  readonly sourceType: SourceType;
  readonly feedUrl: string;
  /**
   * The publisher's canonical host. Used to sanity-check that an item's link
   * belongs to the publisher the registry says it does — a feed that starts
   * emitting third-party links must not launder them into this publisher's
   * identity.
   */
  readonly canonicalHost: string;
  /** BCP-47-ish language tag, or undefined when the feed does not state one. */
  readonly language?: string;
  readonly enabled: boolean;
  readonly provenanceNote: string;
  readonly verifiedAt: string;
}

export const FEED_SOURCES: readonly FeedSourceEntry[] = [
  // ---------------- Rwanda ----------------
  {
    sourceId: 'feed:ktpress-rw',
    displayName: 'KT Press',
    countryCode: 'RW',
    sourceType: 'NEWS_PROVIDER',
    feedUrl: 'https://www.ktpress.rw/feed/',
    canonicalHost: 'ktpress.rw',
    language: 'en',
    enabled: false,
    provenanceNote:
      'Fetched 2026-08-31: RSS 2.0, WordPress-generated, <sy:updatePeriod>hourly, current items. ' +
      'Byte-accurate capture retained at __fixtures__/ktpress-feed.sample.xml.',
    verifiedAt: '2026-08-31',
  },
  {
    sourceId: 'feed:taarifa-rw',
    displayName: 'Taarifa Rwanda',
    countryCode: 'RW',
    sourceType: 'NEWS_PROVIDER',
    feedUrl: 'https://taarifa.rw/feed/',
    canonicalHost: 'taarifa.rw',
    language: 'en',
    enabled: false,
    provenanceNote:
      'Fetched 2026-08-31: RSS 2.0, channel "Taarifa Rwanda:", 10 items dated 30 Aug 2026.',
    verifiedAt: '2026-08-31',
  },

  // ---------------- Kenya ----------------
  {
    sourceId: 'feed:standardmedia-ke',
    displayName: 'The Standard',
    countryCode: 'KE',
    sourceType: 'NEWS_PROVIDER',
    feedUrl: 'https://www.standardmedia.co.ke/rss/headlines.php',
    canonicalHost: 'standardmedia.co.ke',
    language: 'en',
    enabled: false,
    provenanceNote:
      'Fetched 2026-08-31: RSS, channel "The Standard News Feeds", 30 items dated 31 Aug 2026.',
    verifiedAt: '2026-08-31',
  },
  {
    sourceId: 'feed:cbk-ke',
    displayName: 'Central Bank of Kenya',
    countryCode: 'KE',
    sourceType: 'OFFICIAL_SOURCE',
    feedUrl: 'https://www.centralbank.go.ke/feed/',
    canonicalHost: 'centralbank.go.ke',
    language: 'en',
    enabled: false,
    provenanceNote:
      'Fetched 2026-08-31: RSS, channel "CBK", 10 items dated 24 Aug 2026. Corresponds to the ' +
      'official-source registry entry ke-cbk, whose base URL was independently verified in C2-3.',
    verifiedAt: '2026-08-31',
  },

  // ---------------- Poland ----------------
  {
    sourceId: 'feed:gus-pl',
    displayName: 'Statistics Poland',
    countryCode: 'PL',
    sourceType: 'OFFICIAL_SOURCE',
    feedUrl: 'https://stat.gov.pl/rss/en/3/3.xml',
    canonicalHost: 'stat.gov.pl',
    language: 'en',
    enabled: false,
    provenanceNote:
      'Fetched 2026-08-31: RSS, channel "Statistics Poland", 10 items. URL taken from the ' +
      "publisher's own feed index at stat.gov.pl/en/rss/, not guessed. Corresponds to the " +
      'official-source registry entry pl-gus. This is the ENGLISH feed.',
    verifiedAt: '2026-08-31',
  },
  {
    sourceId: 'feed:wp-pl',
    displayName: 'Wirtualna Polska — Wiadomości',
    countryCode: 'PL',
    sourceType: 'NEWS_PROVIDER',
    feedUrl: 'https://wiadomosci.wp.pl/rss.xml',
    canonicalHost: 'wp.pl',
    language: 'pl',
    enabled: false,
    provenanceNote: 'Fetched 2026-08-31: RSS, 16 items dated 31 Aug 2026, Polish-language.',
    verifiedAt: '2026-08-31',
  },
];

/**
 * CANDIDATES VERIFIED AND REJECTED — recorded so they are not re-proposed, and
 * so the absence of Rwanda's largest outlets is a documented finding rather
 * than an oversight.
 *
 *   The New Times (RWA)  advertises /rssFeed/14|15|16; every URL redirects to
 *                        the homepage. Advertised, dead.
 *   IGIHE (RWA)          Cloudflare bot challenge.
 *   National Bank of     JavaScript SPA; no feed at the conventional path.
 *     Rwanda             Remains identity-only in the official-source registry.
 *   RNA News (RWA)       robots.txt returned 503; not fetchable.
 *   PAP (POL)            /rss.xml serves stale HTML from 2022.
 *   tvn24.pl (POL)       HTTP 403.
 *   rp.pl (POL)          /rss/1019 returned undecodable binary.
 *
 * NBP (POL) is deliberately absent: its exchange-rate JSON API is PUBLIC_DATA,
 * not news, and was excluded from S1 by CTO ruling.
 */
export const REJECTED_FEED_CANDIDATES: readonly string[] = [
  'The New Times (RW) — advertised feeds redirect to homepage',
  'IGIHE (RW) — Cloudflare bot challenge',
  'National Bank of Rwanda — JavaScript SPA, no feed',
  'RNA News (RW) — robots.txt 503',
  'PAP (PL) — stale 2022 HTML at /rss.xml',
  'tvn24.pl (PL) — HTTP 403',
  'rp.pl (PL) — undecodable binary',
];

export function getEnabledFeedSourcesFrom(
  entries: readonly FeedSourceEntry[],
): readonly FeedSourceEntry[] {
  return entries.filter((entry) => entry.enabled);
}

export function getEnabledFeedSources(): readonly FeedSourceEntry[] {
  return getEnabledFeedSourcesFrom(FEED_SOURCES);
}

/**
 * The outcome of resolving which feeds are actually active for this process.
 * `unknownIds` is carried rather than discarded so a typo in the environment
 * surfaces as a visible state instead of silently activating nothing.
 */
export interface ActiveFeedSelection {
  readonly sources: readonly FeedSourceEntry[];
  readonly unknownIds: readonly string[];
  readonly overridden: boolean;
}

/**
 * PER-SOURCE ACTIVATION BY ENVIRONMENT — `RSS_FEED_SOURCES`.
 *
 * WHY THIS EXISTS. Activation had to be reversible without anyone editing a
 * source file, and the registry's `enabled` flags are code. This makes the
 * activation decision configuration: one line in a local `.env`, removed to
 * roll back, absent everywhere it was never added — so production and Railway
 * keep the shipped state (every entry off) with no diff to revert there.
 *
 * THE OVERRIDE IS AN ALLOWLIST OF EXPLICIT IDS, AND NOTHING ELSE.
 *
 * There is deliberately NO wildcard and no "enable all". A `*` would mean that
 * the next entry added to this registry activates itself in every environment
 * that already carries the variable — a source going live because someone
 * appended to an array, which is exactly the kind of silent promotion this
 * workstream refuses. Naming six ids activates six sources, permanently.
 *
 * An id that matches no registry entry activates nothing and is reported back
 * to the caller for logging and health, because a mistyped id must not look
 * like a working configuration.
 *
 * Unset or blank means "use the shipped `enabled` flags", which are all false.
 */
export function resolveActiveFeedSources(
  entries: readonly FeedSourceEntry[],
  override: string | undefined,
): ActiveFeedSelection {
  const requested = (override ?? '')
    .split(/[,\s]+/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (requested.length === 0) {
    return { sources: getEnabledFeedSourcesFrom(entries), unknownIds: [], overridden: false };
  }

  const byId = new Map(entries.map((entry) => [entry.sourceId, entry]));

  const sources: FeedSourceEntry[] = [];
  const unknownIds: string[] = [];
  const seen = new Set<string>();

  for (const id of requested) {
    if (seen.has(id)) continue;
    seen.add(id);

    const entry = byId.get(id);

    if (entry) {
      // The registry entry is used exactly as verified; only `enabled` is
      // decided here, so no feed URL or identity can be set from environment.
      sources.push({ ...entry, enabled: true });
    } else {
      unknownIds.push(id);
    }
  }

  return { sources, unknownIds, overridden: true };
}
