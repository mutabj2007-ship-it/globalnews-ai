/*
  MASTER CTO P0 RIGHTS CONTAINMENT R1 — may this stored or retrieved article be USED, and how?

  Two uses are governed separately:
    AI_INPUT   the article's title/summary reach the answer model or become an answer's evidence;
    METADATA   publisher, title, date and link are shown to the reader (no model processing).

  Provenance is read from the article's `sourceId`, the only acquisition fact the store holds:
    `feed:<id>`   collected by this product's RSS lane → decided by that row's rights state in the
                  governed registry (FEED_SOURCES). Being stored, or once enabled, is not permission.
                  CLEARED → both uses. RESTRICTED / PROHIBITED → neither. Every other state
                  (LIMITED_SCOPE_REVIEW, UNRESOLVED, UNREVIEWED, …) → METADATA only: never AI input.
                  A `feed:` id the registry does not know → UNKNOWN_PROVENANCE, neither use.
    empty         UNKNOWN_PROVENANCE, neither use.
    anything else a publisher slug stored from a live aggregator-provider response (the store is
                  written for live provider responses only) → the provider path, unchanged here.
                  Its own entitlement (GNews plan) is a separate, open E1 item.

  A rights exclusion is never "not relevant" and never evidence that no reporting exists: callers
  record it as a rights exclusion with its reason.
*/
import { FEED_SOURCES, type FeedSourceEntry } from '../providers/feed-source-registry';

export type EvidenceUse = 'AI_INPUT' | 'METADATA';

export type RightsExclusionReason =
  | 'RIGHTS_PROHIBITED'
  | 'RIGHTS_RESTRICTED'
  | 'RIGHTS_NOT_CLEARED_FOR_AI'
  | 'UNKNOWN_PROVENANCE';

export type SourceUseDecision =
  | { readonly allowed: true; readonly basis: 'PROVIDER_PATH' | 'FEED_CLEARED' | 'FEED_METADATA_ONLY' }
  | { readonly allowed: false; readonly reason: RightsExclusionReason };

export interface RightsExclusionSummary {
  readonly count: number;
  readonly reasons: Readonly<Partial<Record<RightsExclusionReason, number>>>;
  readonly sourceIds: readonly string[];
}

const FEED_PREFIX = 'feed:';

export function sourceUseDecision(
  sourceId: string | null | undefined,
  use: EvidenceUse,
  registry: readonly FeedSourceEntry[] = FEED_SOURCES,
): SourceUseDecision {
  const id = (sourceId ?? '').trim();
  if (id === '') return { allowed: false, reason: 'UNKNOWN_PROVENANCE' };
  if (!id.startsWith(FEED_PREFIX)) return { allowed: true, basis: 'PROVIDER_PATH' };
  const entry = registry.find((row) => row.sourceId === id);
  if (entry === undefined) return { allowed: false, reason: 'UNKNOWN_PROVENANCE' };
  const state = entry.rights.state;
  if (state === 'PROHIBITED') return { allowed: false, reason: 'RIGHTS_PROHIBITED' };
  if (state === 'RESTRICTED') return { allowed: false, reason: 'RIGHTS_RESTRICTED' };
  if (state === 'CLEARED') return { allowed: true, basis: 'FEED_CLEARED' };
  return use === 'METADATA'
    ? { allowed: true, basis: 'FEED_METADATA_ONLY' }
    : { allowed: false, reason: 'RIGHTS_NOT_CLEARED_FOR_AI' };
}

/** Splits articles by the decision for `use`; excluded entries keep their reason. */
export function partitionByRights<T extends { readonly sourceId?: string | null }>(
  articles: readonly T[],
  use: EvidenceUse,
  registry: readonly FeedSourceEntry[] = FEED_SOURCES,
): { readonly allowed: T[]; readonly excluded: Array<{ readonly sourceId: string; readonly reason: RightsExclusionReason }> } {
  const allowed: T[] = [];
  const excluded: Array<{ sourceId: string; reason: RightsExclusionReason }> = [];
  for (const article of articles) {
    const decision = sourceUseDecision(article.sourceId, use, registry);
    if (decision.allowed) allowed.push(article);
    else excluded.push({ sourceId: (article.sourceId ?? '').trim() || '<none>', reason: decision.reason });
  }
  return { allowed, excluded };
}

export function summarizeExclusions(
  excluded: ReadonlyArray<{ readonly sourceId: string; readonly reason: RightsExclusionReason }>,
): RightsExclusionSummary | undefined {
  if (excluded.length === 0) return undefined;
  const reasons: Partial<Record<RightsExclusionReason, number>> = {};
  for (const { reason } of excluded) reasons[reason] = (reasons[reason] ?? 0) + 1;
  return { count: excluded.length, reasons, sourceIds: [...new Set(excluded.map((e) => e.sourceId))].sort() };
}
