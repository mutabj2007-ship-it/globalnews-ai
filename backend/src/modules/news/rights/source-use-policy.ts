/*
  MASTER CTO P0 RIGHTS CONTAINMENT R1 (R1.1 after the CTO's final-qualification review) — may this
  stored or retrieved article be USED, and how?

  Two uses are governed separately:
    AI_INPUT   the article's title/summary reach the answer model or become an answer's evidence;
    METADATA   publisher, title, date and link are shown to the reader (no model processing).

  Provenance, from the only acquisition facts an article carries:
    `feed:<id>`  collected by this product's RSS lane → that row's rights state in the governed feed
                 registry (FEED_SOURCES). Being stored, or once enabled, is not permission.
                   CLEARED               → AI_INPUT and METADATA
                   LIMITED_SCOPE_REVIEW  → METADATA only (its recorded grant: links + short excerpts)
                   RESTRICTED            → neither (RIGHTS_RESTRICTED)
                   PROHIBITED            → neither (RIGHTS_PROHIBITED)
                   any other state       → neither (RIGHTS_NOT_CLEARED_FOR_AI): no recorded grant
                                           authorizes even display
                 A `feed:` id the registry does not know → UNKNOWN_PROVENANCE.
    publisher slug (`bbc`, `reuters`, …: lowercase letters, digits, single hyphens) acquired by an
                 international aggregator → decided by THAT PROVIDER's recorded rights state
                 (INTERNATIONAL_NEWS_SOURCES), from the article's own `providerId`. A slug with no
                 providerId (stored rows: the store does not persist it) has unverified acquisition
                 provenance.
    anything else (empty, malformed, unknown provider) → UNKNOWN_PROVENANCE, neither use.

  Aggregator rights are recorded, not resolved (GNews RIGHTS_UNDER_E1_REVIEW, GDELT UNRESOLVED). The
  CTO ruled that this must not become a blanket shutdown before E1 rules, so the provider decision is
  decided from the provider's RECORDED state alone — no environment flag can loosen or bypass it
  (CTO R1 ruling): CLEARED → allowed; RESTRICTED / PROHIBITED → excluded; a state recorded as under
  review (RIGHTS_UNDER_E1_REVIEW, UNRESOLVED) → allowed with basis PROVIDER_PENDING_REVIEW — never
  "cleared" — and counted in the answer's diagnostics, until E1 rules. RSS, malformed and unknown
  provenance are always enforced.

  A rights exclusion is never "not relevant" and never evidence that no reporting exists.
*/
import { FEED_SOURCES, type FeedSourceEntry } from '../providers/feed-source-registry';
import { INTERNATIONAL_NEWS_SOURCES } from '../../global-reach/source-coverage.authority';
import type { Prisma } from '../../../generated/prisma/client';

export type EvidenceUse = 'AI_INPUT' | 'METADATA';

export type RightsExclusionReason =
  | 'RIGHTS_PROHIBITED'
  | 'RIGHTS_RESTRICTED'
  | 'RIGHTS_NOT_CLEARED_FOR_AI'
  | 'PROVIDER_RIGHTS_NOT_CLEARED'
  | 'SOCIAL_RIGHTS_NOT_REVIEWED'
  | 'UNKNOWN_PROVENANCE';

export type ProviderEnforcement = 'record' | 'enforce';

export type SourceUseDecision =
  | {
      readonly allowed: true;
      readonly basis: 'PROVIDER_CLEARED' | 'PROVIDER_PENDING_REVIEW' | 'FEED_CLEARED' | 'FEED_METADATA_ONLY';
      /** the provider whose recorded rights decided it (provider path only) */
      readonly provider?: string;
    }
  | { readonly allowed: false; readonly reason: RightsExclusionReason };

export interface RightsExclusionSummary {
  readonly count: number;
  readonly reasons: Readonly<Partial<Record<RightsExclusionReason, number>>>;
  readonly sourceIds: readonly string[];
}

/** Items allowed only pending E1 (record mode), counted per provider — never "cleared". */
export interface RightsPendingSummary {
  readonly count: number;
  readonly providers: Readonly<Record<string, number>>;
}

export interface UseInput {
  readonly sourceId?: string | null;
  readonly providerId?: string | null;
}

export interface PolicyOptions {
  readonly enforcement?: ProviderEnforcement;
  readonly feeds?: readonly FeedSourceEntry[];
  readonly providers?: ReadonlyArray<{ readonly sourceId: string; readonly rightsState: string }>;
}

const FEED_PREFIX = 'feed:';
const PUBLISHER_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/* social discovery lanes (social-search.providers.ts): `social:x:<author>`, `social:youtube:<channel>` */
const SOCIAL_ID = /^social:(?:x|youtube):\S{1,200}$/;
/** Stored provider rows carry no providerId (not persisted); their acquisition is unverified. */
const STORED_PROVIDER_UNVERIFIED = 'stored-provider-unverified';

export function sourceUseDecision(input: UseInput, use: EvidenceUse, options: PolicyOptions = {}): SourceUseDecision {
  const feeds = options.feeds ?? FEED_SOURCES;
  const providers = options.providers ?? INTERNATIONAL_NEWS_SOURCES;
  /* 'enforce' is reachable only through an explicit code-level option, never from the environment */
  const enforcement = options.enforcement ?? 'record';
  const id = (input.sourceId ?? '').trim();

  if (id.startsWith(FEED_PREFIX)) {
    const entry = feeds.find((row) => row.sourceId === id);
    if (entry === undefined) return { allowed: false, reason: 'UNKNOWN_PROVENANCE' };
    const state = entry.rights.state;
    if (state === 'PROHIBITED') return { allowed: false, reason: 'RIGHTS_PROHIBITED' };
    if (state === 'RESTRICTED') return { allowed: false, reason: 'RIGHTS_RESTRICTED' };
    if (state === 'CLEARED') return { allowed: true, basis: 'FEED_CLEARED' };
    if (state === 'LIMITED_SCOPE_REVIEW' && use === 'METADATA') return { allowed: true, basis: 'FEED_METADATA_ONLY' };
    return { allowed: false, reason: 'RIGHTS_NOT_CLEARED_FOR_AI' };
  }

  /*
    Social discovery items are a real provenance class whose platform terms (X API, YouTube API) have
    no recorded rights review: default deny, under their own reason — never mislabelled "malformed".
  */
  if (SOCIAL_ID.test(id)) return { allowed: false, reason: 'SOCIAL_RIGHTS_NOT_REVIEWED' };
  if (!PUBLISHER_SLUG.test(id)) return { allowed: false, reason: 'UNKNOWN_PROVENANCE' };

  const providerId = (input.providerId ?? '').trim();
  const record = providerId === '' ? undefined : providers.find((p) => p.sourceId === providerId);
  if (providerId !== '' && record === undefined) return { allowed: false, reason: 'UNKNOWN_PROVENANCE' };
  if (record?.rightsState === 'CLEARED') return { allowed: true, basis: 'PROVIDER_CLEARED', provider: providerId };
  if (record?.rightsState === 'RESTRICTED' || record?.rightsState === 'PROHIBITED') {
    return { allowed: false, reason: 'PROVIDER_RIGHTS_NOT_CLEARED' };
  }
  if (enforcement === 'enforce') {
    return { allowed: false, reason: record === undefined ? 'UNKNOWN_PROVENANCE' : 'PROVIDER_RIGHTS_NOT_CLEARED' };
  }
  return { allowed: true, basis: 'PROVIDER_PENDING_REVIEW', provider: record?.sourceId ?? STORED_PROVIDER_UNVERIFIED };
}

/** Splits items by the decision for `use`; excluded entries keep their reason, pending ones their provider. */
export function partitionByRights<T extends UseInput>(
  items: readonly T[],
  use: EvidenceUse,
  options: PolicyOptions = {},
): {
  readonly allowed: T[];
  readonly excluded: Array<{ readonly sourceId: string; readonly reason: RightsExclusionReason }>;
  readonly pending: string[];
} {
  const allowed: T[] = [];
  const excluded: Array<{ sourceId: string; reason: RightsExclusionReason }> = [];
  const pending: string[] = [];
  for (const item of items) {
    const decision = sourceUseDecision(item, use, options);
    if (decision.allowed) {
      allowed.push(item);
      if (decision.basis === 'PROVIDER_PENDING_REVIEW') pending.push(decision.provider ?? STORED_PROVIDER_UNVERIFIED);
    } else {
      excluded.push({ sourceId: (item.sourceId ?? '').trim() || '<none>', reason: decision.reason });
    }
  }
  return { allowed, excluded, pending };
}

export function summarizeExclusions(
  excluded: ReadonlyArray<{ readonly sourceId: string; readonly reason: RightsExclusionReason }>,
): RightsExclusionSummary | undefined {
  if (excluded.length === 0) return undefined;
  const reasons: Partial<Record<RightsExclusionReason, number>> = {};
  for (const { reason } of excluded) reasons[reason] = (reasons[reason] ?? 0) + 1;
  return { count: excluded.length, reasons, sourceIds: [...new Set(excluded.map((e) => e.sourceId))].sort() };
}

export function summarizePending(pending: readonly string[]): RightsPendingSummary | undefined {
  if (pending.length === 0) return undefined;
  const providers: Record<string, number> = {};
  for (const p of pending) providers[p] = (providers[p] ?? 0) + 1;
  return { count: pending.length, providers };
}

/*
  E1-TAA-5 (1) — ENFORCE BY ABSENCE. The store's read methods add this condition to their own query,
  so no reader — current or future — can OBTAIN a stored row from an RSS feed below CLEARED or with an
  empty source id. Malformed ids (not expressible in this query) are dropped by
  `storedRowAdmissible` inside the same repository methods before anything is returned.
*/
export function admittedStoredSourceWhere(feeds: readonly FeedSourceEntry[] = FEED_SOURCES): Prisma.ArticleWhereInput {
  const clearedFeedIds = feeds.filter((row) => row.rights.state === 'CLEARED').map((row) => row.sourceId);
  return {
    AND: [
      { NOT: { sourceId: '' } },
      { OR: [{ NOT: { sourceId: { startsWith: FEED_PREFIX } } }, { sourceId: { in: clearedFeedIds } }] },
    ],
  };
}

/** Repository-side check for what the query cannot express (malformed / unknown ids). */
export function storedRowAdmissible(sourceId: string | null | undefined, feeds: readonly FeedSourceEntry[] = FEED_SOURCES): boolean {
  return storedRowExclusionReason(sourceId, feeds) === null;
}

/**
 * Why a stored row is not obtainable, or null when it is. The SAME decision every answer uses, so a
 * stored social post is reported as SOCIAL_RIGHTS_NOT_REVIEWED, a held feed by its rights reason,
 * and only a genuinely malformed / unknown id as UNKNOWN_PROVENANCE. (Stored rows carry no
 * providerId, so a publisher slug is the provider path, recorded as pending review.)
 */
export function storedRowExclusionReason(
  sourceId: string | null | undefined,
  feeds: readonly FeedSourceEntry[] = FEED_SOURCES,
): RightsExclusionReason | null {
  const decision = sourceUseDecision({ sourceId }, 'AI_INPUT', { enforcement: 'record', feeds });
  return decision.allowed ? null : decision.reason;
}
