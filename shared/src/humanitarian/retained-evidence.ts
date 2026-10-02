import {
  assertDomainObservationIsWellFormed,
  type ObservationSourceReference,
  type ObservationTemporal,
} from '../observation/domain-observation';
import type { EvidenceRole } from '../source-provenance';
import { assertHumanitarianClaimIsWellFormed, type HumanitarianObservation } from './observation';
import type { HumanitarianRetainedRecord } from './retained-read';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * HUMANITARIAN RETAINED EVIDENCE — normalization · dedup · bounded cache · citation · fact status
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Lane A's HUMANITARIAN-RETAINED-EVIDENCE-R1 (`086db67`, Claude A), TRANSPLANTED onto Main's
 * canonical record by Claude Code convergence (CTO ruling). A's behaviour is kept; A's temporary
 * `AdmittedHumanitarianRecord` is NOT — there is one Humanitarian record authority, Main's
 * `HumanitarianObservation`, carried in the retained-read row `HumanitarianRetainedRecord`.
 *
 *   A field                        → Main authority
 *   sourceNativeRecordId           → observation.identity.upstreamId (verbatim)
 *   provider                       → observation.identity.upstreamAuthority
 *   sourceRevisionId               → observation.revision.revisionOrdinal (Main's revision chain)
 *   geography (unknown, verbatim)  → NOT carried: only the claim's source-stated countryIso3
 *   citationText                   → observation.sourceReference.citation
 *   isEventMetadata                → derived from the claim type (EVENT = event metadata)
 *
 * PURE and SYNCHRONOUS throughout: no I/O, no clock (every time is caller-supplied), no model, no
 * provider, no network — normalization cannot be "AI normalization" because nothing here can call
 * one. Internal layer: geometry-bearing records may be normalized here; whether a record may reach
 * a READER is decided only by `humanitarianRetainedRead` (reader admission, no geometry).
 */

/* ═══ A · DETERMINISTIC NORMALIZATION ═══════════════════════════════════════ */

export interface NormalizedRetainedEvidence {
  readonly observationKey: string;
  readonly provider: string;
  readonly sourceNativeRecordId: string;
  /** Main's revision chain position for this observationKey. */
  readonly revisionOrdinal: number;
  readonly observationKind: HumanitarianObservation['observationKind'];
  readonly captureKey: string;
  readonly publisher?: string;
  /** Raw, exactly as the source published it. Never rewritten. */
  readonly rawSourceUrl?: string;
  /** Matching-only normalization (see `normalizeSourceUrlForMatching`). */
  readonly normalizedSourceUrl?: string;
  readonly temporal: ObservationTemporal;
  readonly language?: string;
  /** The source-stated ISO3 scope, verbatim (never derived from geometry). */
  readonly countryIso3: readonly string[];
  readonly evidenceRole?: EvidenceRole;
  readonly citationText?: string;
  readonly isEventMetadata: boolean;
}

export class HumanitarianRetainedEvidenceRefused extends Error {
  readonly name = 'HumanitarianRetainedEvidenceRefused';
}

/**
 * Normalize ONLY for matching, never for display: lower-case scheme/host, drop a bare `/` path and
 * any fragment; the path and the query are kept verbatim and unsorted (reordering could merge two
 * distinct resources). `undefined`, never a throw, for a missing or unparseable URL.
 */
export function normalizeSourceUrlForMatching(raw: string | undefined): string | undefined {
  if (raw === undefined || raw.trim().length === 0) return undefined;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  const port = url.port ? `:${url.port}` : '';
  const path = url.pathname === '/' ? '' : url.pathname;
  return `${url.protocol.toLowerCase()}//${url.hostname.toLowerCase()}${port}${path}${url.search}`;
}

/** THE entry point. Main's invariants are enforced; a field the record lacks is omitted, never invented. */
export function normalizeRetainedEvidence(
  row: HumanitarianRetainedRecord,
): NormalizedRetainedEvidence {
  const o = row.observation;
  assertDomainObservationIsWellFormed(o);
  assertHumanitarianClaimIsWellFormed(o.observationKind, o.claim);
  if (typeof row.captureKey !== 'string' || row.captureKey.length === 0) {
    throw new HumanitarianRetainedEvidenceRefused(
      'HUM-RET-1: a retained row carries its capture key.',
    );
  }
  const rawSourceUrl = o.sourceReference.sourceUrl ?? o.provenance.sourceUrl;
  const normalizedSourceUrl = normalizeSourceUrlForMatching(rawSourceUrl);
  return {
    observationKey: o.observationKey,
    provider: o.identity.upstreamAuthority,
    sourceNativeRecordId: o.identity.upstreamId,
    revisionOrdinal: o.revision.revisionOrdinal,
    observationKind: o.observationKind,
    captureKey: row.captureKey,
    ...(o.provenance.institution !== undefined ? { publisher: o.provenance.institution } : {}),
    ...(rawSourceUrl !== undefined ? { rawSourceUrl } : {}),
    ...(normalizedSourceUrl !== undefined ? { normalizedSourceUrl } : {}),
    temporal: o.temporal,
    ...(o.provenance.language !== undefined ? { language: o.provenance.language } : {}),
    countryIso3: o.claim.countryIso3,
    ...(o.provenance.evidenceRole !== undefined ? { evidenceRole: o.provenance.evidenceRole } : {}),
    ...(o.sourceReference.citation !== undefined
      ? { citationText: o.sourceReference.citation }
      : {}),
    isEventMetadata: o.claim.claimType === 'HUMANITARIAN_EVENT',
  };
}

/* ═══ B · DEDUP — STRONG IDENTITY ONLY, PROVIDER-SCOPED, NO TEXT AXIS ════════════
 *
 * Two phases, both deterministic and independent of input order:
 *   1. SAME observationKey (same provider + same source-native id, Main's identity spine): this is
 *      ONE record — the highest revisionOrdinal supersedes (Main's append-only revision chain).
 *      A's "earliest retrieved survives" is NOT applied here: on Main it would discard corrections.
 *   2. DIFFERENT keys, SAME provider, normalized-exact source URL: A's survivor rule — earliest
 *      retrievedAt, then smallest observationKey. (A asked for product sign-off on this rule.)
 * Never across providers (two providers = two origins, never one record); never on title,
 * description, place or date proximity — "uncertain same-story records may both survive" is the
 * specification, not a limitation.
 */

export interface DedupeCollapse {
  readonly keptObservationKey: string;
  readonly discardedObservationKey: string;
  readonly discardedRevisionOrdinal: number;
  readonly matchedOn: 'REVISION_SUPERSEDED' | 'SOURCE_URL';
}

export interface DedupeResult {
  readonly survivors: readonly NormalizedRetainedEvidence[];
  readonly collapsed: readonly DedupeCollapse[];
}

const byKeyThenRevision = (a: NormalizedRetainedEvidence, b: NormalizedRetainedEvidence) =>
  a.observationKey.localeCompare(b.observationKey) || a.revisionOrdinal - b.revisionOrdinal;

export function dedupeRetainedEvidence(
  records: readonly NormalizedRetainedEvidence[],
): DedupeResult {
  const collapsed: DedupeCollapse[] = [];

  /* phase 1 — one record per observationKey: the latest revision */
  const latest = new Map<string, NormalizedRetainedEvidence>();
  for (const r of [...records].sort(byKeyThenRevision)) {
    const prior = latest.get(r.observationKey);
    if (prior !== undefined) {
      collapsed.push({
        keptObservationKey: r.observationKey,
        discardedObservationKey: prior.observationKey,
        discardedRevisionOrdinal: prior.revisionOrdinal,
        matchedOn: 'REVISION_SUPERSEDED',
      });
    }
    latest.set(r.observationKey, r);
  }

  /* phase 2 — provider-scoped exact normalized URL, union-find over distinct keys */
  const phase1 = [...latest.values()].sort(byKeyThenRevision);
  const parent = phase1.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  const byUrl = new Map<string, number>();
  phase1.forEach((r, i) => {
    if (r.normalizedSourceUrl === undefined) return;
    const key = `${r.provider}\u0000${r.normalizedSourceUrl}`;
    const seen = byUrl.get(key);
    if (seen === undefined) byUrl.set(key, i);
    else parent[find(i)] = find(seen);
  });
  const groups = new Map<number, NormalizedRetainedEvidence[]>();
  phase1.forEach((r, i) => {
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), r]);
  });

  const survivors: NormalizedRetainedEvidence[] = [];
  for (const group of groups.values()) {
    const [survivor, ...rest] = [...group].sort(
      (a, b) =>
        a.temporal.retrievedAt.localeCompare(b.temporal.retrievedAt) ||
        a.observationKey.localeCompare(b.observationKey),
    );
    survivors.push(survivor!);
    for (const r of rest) {
      collapsed.push({
        keptObservationKey: survivor!.observationKey,
        discardedObservationKey: r.observationKey,
        discardedRevisionOrdinal: r.revisionOrdinal,
        matchedOn: 'SOURCE_URL',
      });
    }
  }

  survivors.sort(byKeyThenRevision);
  collapsed.sort(
    (a, b) =>
      a.discardedObservationKey.localeCompare(b.discardedObservationKey) ||
      a.discardedRevisionOrdinal - b.discardedRevisionOrdinal,
  );
  return { survivors, collapsed };
}

/* ═══ C · BOUNDED RETAINED CACHE — IN MEMORY, NO DURABILITY CLAIM, NO PROVIDER ═══ */

export interface RetainedCacheEntry {
  readonly record: NormalizedRetainedEvidence;
  /** Caller-supplied; never the system clock. */
  readonly cachedAt: string;
  /**
   * Change cursor (lane A R2, transplanted): strictly increasing, never reused. Stamped when a key
   * is first held (`NEW`) or a HIGHER revision replaces it (`REVISED`). A same-revision re-put only
   * refreshes LRU position — Main's chain gives new content a new revision, so an identical re-put
   * is not a change and must not wake a Watch/Alert.
   */
  readonly sequence: number;
  readonly change: RetainedChangeKind;
}

export const RETAINED_CHANGE_KINDS = ['NEW', 'REVISED'] as const;
export type RetainedChangeKind = (typeof RETAINED_CHANGE_KINDS)[number];

/** The best time this record states about itself: occurrence, then publisher vintage, then retrieval. */
function bestStatedTime(r: NormalizedRetainedEvidence): string {
  return r.temporal.occurredAt ?? r.temporal.publisherVintage ?? r.temporal.retrievedAt;
}

export class RetainedEvidenceCache {
  private readonly entries = new Map<string, RetainedCacheEntry>();
  private lastSequence = 0;
  /** Highest sequence ever evicted for capacity; 0 when nothing has been evicted. */
  private evictedThrough = 0;

  constructor(private readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new HumanitarianRetainedEvidenceRefused(
        'HUM-RET-CACHE-1: capacity must be a positive integer.',
      );
    }
  }

  /**
   * Synchronous. Re-putting a key refreshes its LRU position. Revision-aware: an OLDER revision
   * never overwrites a newer one already held (Main's chain only moves forward).
   */
  put(record: NormalizedRetainedEvidence, cachedAt: string): void {
    const held = this.entries.get(record.observationKey);
    if (held !== undefined && held.record.revisionOrdinal > record.revisionOrdinal) return;
    const changed = held === undefined || record.revisionOrdinal > held.record.revisionOrdinal;
    this.entries.delete(record.observationKey);
    this.entries.set(
      record.observationKey,
      changed
        ? {
            record,
            cachedAt,
            sequence: ++this.lastSequence,
            change: held === undefined ? 'NEW' : 'REVISED',
          }
        : { ...held, record, cachedAt },
    );
    while (this.entries.size > this.capacity) {
      const oldestKey = this.entries.keys().next().value as string;
      const evicted = this.entries.get(oldestKey)!;
      if (evicted.sequence > this.evictedThrough) this.evictedThrough = evicted.sequence;
      this.entries.delete(oldestKey);
    }
  }

  /** Held entries changed after `sinceSequence`, ascending by sequence. Synchronous, local. */
  entriesSince(sinceSequence: number): readonly RetainedCacheEntry[] {
    return [...this.entries.values()]
      .filter((e) => e.sequence > sinceSequence)
      .sort((a, b) => a.sequence - b.sequence);
  }

  /** The newest sequence ever stamped (0 when nothing was ever held). */
  get latestSequence(): number {
    return this.lastSequence;
  }

  /** The highest sequence ever evicted for capacity (0 when nothing was evicted). */
  get evictedThroughSequence(): number {
    return this.evictedThrough;
  }

  /** Display-only reopen: reads this in-memory map and nothing else (no provider, no network). */
  get(observationKey: string): RetainedCacheEntry | undefined {
    return this.entries.get(observationKey);
  }

  list(): readonly RetainedCacheEntry[] {
    return [...this.entries.values()].sort((a, b) =>
      a.record.observationKey.localeCompare(b.record.observationKey),
    );
  }

  get size(): number {
    return this.entries.size;
  }

  /** The newest time any held record states about itself, or undefined when empty — never "now". */
  newestRetainedTimestamp(): string | undefined {
    let newest: string | undefined;
    for (const { record } of this.entries.values()) {
      const t = bestStatedTime(record);
      if (newest === undefined || Date.parse(t) > Date.parse(newest)) newest = t;
    }
    return newest;
  }

  /** Explicit staleness against a caller-supplied now; a missing entry is stale (not retained). */
  isStale(observationKey: string, nowIso: string, maxAgeMs: number): boolean {
    const entry = this.entries.get(observationKey);
    if (entry === undefined) return true;
    return Date.parse(nowIso) - Date.parse(bestStatedTime(entry.record)) > maxAgeMs;
  }
}

/* ═══ C2 · BOUNDED CHANGED-SINCE FEED — MY INTELLIGENCE AND FUTURE WATCH/ALERTS ═══
 * Lane A's HUMANITARIAN-RETAINED-CORPUS-CHANGE-FEED-R2 (`de714b7`), TRANSPLANTED onto Main's
 * record by Claude Code convergence. Kept: the cache-sequence cursor, the page bound (500), refusal
 * of a malformed cursor/limit, a synchronous reopen with no provider or model path. Changed:
 *   - a page carries INTERNAL retained entries, not A's own reader projection. Whether a row may
 *     reach a reader is decided only by `humanitarianRetainedRead` under E1's reader admission —
 *     one reader authority, and no second projection that could bypass it;
 *   - only a new key or a higher revision is a change (see `RetainedCacheEntry.sequence`);
 *   - A's documented limit ("cannot tell 'nothing changed' from 'changed and evicted'") becomes an
 *     explicit `gapPossible`: a consumer whose cursor predates an evicted change is told it may have
 *     missed something instead of seeing a clean page. Missing stays explicitly missing.
 * In memory and bounded: NOT a durable append log (storage substrate selection remains open).
 */

export const MAX_RETAINED_CHANGE_FEED_PAGE = 500;

export interface RetainedChangeFeedPage {
  readonly changes: readonly RetainedCacheEntry[];
  /** Pass back as `sinceSequence`. Equal to the input when the page is empty. */
  readonly nextSinceSequence: number;
  /** More held changes exist beyond this page. */
  readonly truncated: boolean;
  /** A change after `sinceSequence` was evicted before it could be read: this feed is incomplete. */
  readonly gapPossible: boolean;
}

export function retainedChangeFeedSince(
  cache: RetainedEvidenceCache,
  sinceSequence: number,
  limit: number = MAX_RETAINED_CHANGE_FEED_PAGE,
): RetainedChangeFeedPage {
  if (!Number.isInteger(sinceSequence) || sinceSequence < 0) {
    throw new HumanitarianRetainedEvidenceRefused(
      'HUM-RET-FEED-1: sinceSequence must be a non-negative integer.',
    );
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_RETAINED_CHANGE_FEED_PAGE) {
    throw new HumanitarianRetainedEvidenceRefused(
      `HUM-RET-FEED-2: limit must be an integer between 1 and ${MAX_RETAINED_CHANGE_FEED_PAGE}.`,
    );
  }
  const all = cache.entriesSince(sinceSequence);
  const page = all.slice(0, limit);
  return {
    changes: page,
    nextSinceSequence: page.length > 0 ? page[page.length - 1]!.sequence : sinceSequence,
    truncated: all.length > limit,
    gapPossible: cache.evictedThroughSequence > sinceSequence,
  };
}

/* ═══ D · CITATION PROJECTION — ONE SHAPE FOR EVERY CONSUMER ═════════════════
 * Event metadata (a GDACS-style event record) is NEVER presented as a citation of retained text;
 * a report or an impact assertion cites its source. A missing citation/URL is absent, never a
 * fabricated placeholder.
 */

export const CITATION_PROJECTION_KINDS = ['RETAINED_CITATION', 'EVENT_METADATA'] as const;
export type CitationProjectionKind = (typeof CITATION_PROJECTION_KINDS)[number];

export interface CitationProjection {
  readonly observationKey: string;
  readonly kind: CitationProjectionKind;
  readonly sourceReference: ObservationSourceReference;
  readonly provider: string;
  readonly publisher?: string;
  readonly language?: string;
  readonly retrievedAt: string;
}

export function projectCitation(record: NormalizedRetainedEvidence): CitationProjection {
  const kind: CitationProjectionKind = record.isEventMetadata
    ? 'EVENT_METADATA'
    : 'RETAINED_CITATION';
  const sourceReference: ObservationSourceReference =
    kind === 'RETAINED_CITATION'
      ? {
          ...(record.citationText !== undefined ? { citation: record.citationText } : {}),
          ...(record.rawSourceUrl !== undefined ? { sourceUrl: record.rawSourceUrl } : {}),
        }
      : {};
  return {
    observationKey: record.observationKey,
    kind,
    sourceReference,
    provider: record.provider,
    ...(record.publisher !== undefined ? { publisher: record.publisher } : {}),
    ...(record.language !== undefined ? { language: record.language } : {}),
    retrievedAt: record.temporal.retrievedAt,
  };
}

/* ═══ E · FACT STATUS — internal four states, lossy reader projection ═══════════
 * CTO freshness ruling (from C): CURRENT_PROVIDER_OBSERVATION only when a governed provider call
 * actually succeeded THIS request. A retained record, however recent, stays RETAINED_REPORTING —
 * an Ask read performs no provider fetch, so it can never be "current".
 * CTO topology ruling: SOURCE_UNAVAILABLE is internal/Admin detail; readers get the lossy
 * COVERAGE_GAP, never the source-connectivity state.
 */

export const RETAINED_FACT_STATUSES = [
  'CURRENT_PROVIDER_OBSERVATION',
  'RETAINED_REPORTING',
  'SOURCE_UNAVAILABLE',
  'NOT_ASSESSED',
] as const;
export type RetainedFactStatus = (typeof RETAINED_FACT_STATUSES)[number];

export const READER_FACT_STATUSES = [
  'CURRENT_PROVIDER_OBSERVATION',
  'RETAINED_REPORTING',
  'COVERAGE_GAP',
  'NOT_ASSESSED',
] as const;
export type ReaderFactStatus = (typeof READER_FACT_STATUSES)[number];

export interface FactAvailability {
  /** A governed provider call was attempted THIS request and succeeded. */
  readonly freshProviderCallSucceeded: boolean;
  /** A governed provider call was attempted this request (success or not). */
  readonly freshProviderCallAttempted: boolean;
  /** A retained record exists for this fact, regardless of its age. */
  readonly hasRetainedRecord: boolean;
  /** This scope has been evaluated at all. */
  readonly evaluated: boolean;
}

export function deriveRetainedFactStatus(input: FactAvailability): RetainedFactStatus {
  if (input.freshProviderCallSucceeded) return 'CURRENT_PROVIDER_OBSERVATION';
  if (input.hasRetainedRecord) return 'RETAINED_REPORTING';
  if (!input.evaluated && !input.freshProviderCallAttempted) return 'NOT_ASSESSED';
  return 'SOURCE_UNAVAILABLE';
}

/** The public projection: lossy, so source topology never reaches a reader. */
export function readerFactStatus(status: RetainedFactStatus): ReaderFactStatus {
  return status === 'SOURCE_UNAVAILABLE' ? 'COVERAGE_GAP' : status;
}

export function assertRetainedFactStatusIsKnown(value: string): value is RetainedFactStatus {
  if (!(RETAINED_FACT_STATUSES as readonly string[]).includes(value)) {
    throw new HumanitarianRetainedEvidenceRefused(
      `HUM-RET-STATUS-1: '${value}' is not one of the four closed statuses.`,
    );
  }
  return true;
}
