import { FEED_SOURCES, type FeedSourceEntry } from '../providers/feed-source-registry';
import { readerRightsDecision, readerRightsEnforced } from './reader-rights';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MASTER CTO R62 / R64 · #96 — GATE A: PROVIDER ACQUISITION IS DEFAULT-DENY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * E1 E1_R56_GNEWS_ACQUISITION_UNGATED: the deployed output guard (reader-rights.ts, dcf9bd0) withholds
 * third-party material AFTER a provider was asked for it, so a public route could still spend the
 * Free GNews key. A configured key or a registered provider is not a right to acquire material for a
 * public service. This module answers, BEFORE any network request, whether a provider may run at all.
 *
 * ALLOWLIST, NOT DENYLIST (E1 A-6; a denylist is the defect E1 found twice in withholdAskPayload): a
 * provider is admitted only if it can emit an item with a recorded per-use right, which in this code
 * base means a publisher-direct feed row whose OWN registry entry is CLEARED. Today the only provider
 * of that kind is the publisher-feed lane (`rss-feeds`), and it is admitted only while at least one
 * CLEARED feed exists; inside it, each feed is checked separately (admittedFeedSources), so no feed
 * inherits another's clearance. GNews, GDELT (news and signals), social lanes, the mock provider and
 * any provider registered later are NOT admitted. The reviewed registry has no CLEARED feed, so today
 * nothing is admitted and no provider request is made.
 *
 * Nothing reads the environment. Enforcement follows `readerRightsEnforced()` (always on outside the
 * Jest fixture mode), exactly as the output guard does.
 */

/** Providers whose every item is a `feed:*` row from the reviewed registry (per-feed gate inside). */
const FEED_ONLY_PROVIDER_IDS: ReadonlySet<string> = new Set(['rss-feeds']);

/* TEST-ONLY feed table (mirrors reader-rights' hook); production reads the reviewed registry. */
let testFeeds: readonly FeedSourceEntry[] | null = null;
export function __setProviderAdmissionTestFeeds(feeds: readonly FeedSourceEntry[] | null): void {
  testFeeds = feeds;
}
function registry(): readonly FeedSourceEntry[] {
  return testFeeds ?? FEED_SOURCES;
}

export type ProviderAdmission =
  | { readonly admitted: true }
  | { readonly admitted: false; readonly reason: 'NO_RECORDED_RIGHT' | 'NO_CLEARED_FEED' | 'MOCK_NOT_PERMITTED' };

export function providerAdmission(provider: { readonly id: string; readonly isMock?: boolean }): ProviderAdmission {
  if (!readerRightsEnforced()) return { admitted: true };
  if (provider.isMock === true) return { admitted: false, reason: 'MOCK_NOT_PERMITTED' };
  if (!FEED_ONLY_PROVIDER_IDS.has(provider.id)) return { admitted: false, reason: 'NO_RECORDED_RIGHT' };
  return admittedFeedSources(registry()).length > 0 ? { admitted: true } : { admitted: false, reason: 'NO_CLEARED_FEED' };
}

/**
 * The feeds the publisher-feed lane may FETCH: each one on its own registry entry's CLEARED right.
 * Outside enforcement (Jest fixture mode) every given feed is returned unchanged.
 */
export function admittedFeedSources<T extends { readonly sourceId: string }>(feeds: readonly T[]): T[] {
  if (!readerRightsEnforced()) return [...feeds];
  return feeds.filter((feed) => readerRightsDecision(feed.sourceId, registry()).allowed);
}
