import { Injectable, Module } from '@nestjs/common';
import {
  RetainedEvidenceCache,
  humanitarianReadAbsence,
  normalizeRetainedEvidence,
  retainedChangeFeedSince,
  type HumanitarianRetainedRead,
  type HumanitarianRetainedRecord,
  type RetainedChangeKind,
} from '@globalnews-ai/shared';
import { buildHumanitarianReaderRead } from './humanitarian-reader-read';
import { READER_CLEARED_SOURCE_IDS, sourceIsReaderCleared } from './reader-clearance.ruling';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE ONE HUMANITARIAN RETAINED CORPUS (runtime) — convergence glue, CTO ruling
 * ════════════════════════════════════════════════════════════════════════════
 *
 * One in-memory instance of lane A's `RetainedEvidenceCache` (transplanted onto Main's record,
 * bfc537a) holding Main's canonical `HumanitarianRetainedRecord`s. Every reader surface projects
 * from THIS instance and nothing else — there is no second Humanitarian store:
 *
 *   corpus → readerRead()      → /humanitarian/observations → H brief → G gate → Home
 *   corpus → changesSince(n)   → A's delta feed            → My Intelligence "new since"
 *
 * NO ACQUISITION. Nothing here fetches, schedules or reads a provider, and no producer calls
 * `retain` today: E1 clears no source for reader runtime, so the corpus is empty in every
 * deployment. `retain` is the single write seam an E1-cleared producer will use.
 *
 * READER SCOPE IS E1's. A reader read covers records from READER-CLEARED sources only (scope
 * selection by E1's ruling — the same predicate the reader constructor binds); within that scope
 * the read is never thinned: a row that still fails Main's reader contract (e.g. governed
 * geometry) refuses the WHOLE read, which is reported lossily as a coverage gap.
 *
 * While no source is reader-cleared the public statement is unchanged: NOT_ASSESSED — there is no
 * approved reader, which is a larger truth than "our store is empty".
 *
 * BOUNDED AND NOT DURABLE: capacity-bounded LRU in process memory. Eviction is reported, never
 * hidden (`gapPossible`). A durable substrate remains an open platform decision.
 */
export const HUMANITARIAN_CORPUS_CAPACITY = 200;

export interface HumanitarianReaderChange {
  readonly sequence: number;
  readonly change: RetainedChangeKind;
  /** When GLOBALNEWS AI wrote this record (or this revision) down — never a publisher time. */
  readonly firstSeenAt: string;
  readonly record: HumanitarianRetainedRecord;
}

export interface HumanitarianReaderChangePage {
  readonly changes: readonly HumanitarianReaderChange[];
  readonly nextSinceSequence: number;
  readonly truncated: boolean;
  /** A change after the cursor was evicted unread: this page may be incomplete. */
  readonly gapPossible: boolean;
  /** A reader-scoped row failed Main's reader contract, so the WHOLE page was withheld. */
  readonly readerRefused: boolean;
}

const anySourceReaderCleared = (): boolean => READER_CLEARED_SOURCE_IDS.length > 0;

@Injectable()
export class HumanitarianRetainedCorpus {
  private readonly cache = new RetainedEvidenceCache(HUMANITARIAN_CORPUS_CAPACITY);
  /** Main's record for each key the cache holds — kept in lock-step with the cache. */
  private readonly records = new Map<string, HumanitarianRetainedRecord>();

  /**
   * THE write seam (no production caller today). Synchronous, local. Internal: A's normalization
   * validates the record; governed geometry may be HELD and is refused only at the reader boundary.
   * The cache decides revision order (an older revision never replaces a newer one) and
   * eviction; this map follows it.
   */
  retain(record: HumanitarianRetainedRecord, cachedAt: string): void {
    const normalized = normalizeRetainedEvidence(record);
    this.cache.put(normalized, cachedAt);
    if (this.cache.get(normalized.observationKey)?.record === normalized) {
      this.records.set(normalized.observationKey, record);
    }
    for (const key of [...this.records.keys()]) {
      if (this.cache.get(key) === undefined) this.records.delete(key);
    }
  }

  get size(): number {
    return this.cache.size;
  }

  /** The reader read every Humanitarian reader surface uses (Home, the Humanitarian page). */
  readerRead(): HumanitarianRetainedRead {
    if (!anySourceReaderCleared()) return humanitarianReadAbsence('NOT_ASSESSED');
    const scoped = this.cache
      .list()
      .map((entry) => this.records.get(entry.record.observationKey))
      .filter((r): r is HumanitarianRetainedRecord => r !== undefined)
      .filter((r) => sourceIsReaderCleared(r.observation.identity.upstreamAuthority));
    try {
      return buildHumanitarianReaderRead(scoped);
    } catch {
      return humanitarianReadAbsence('SOURCE_TEMPORARILY_UNAVAILABLE');
    }
  }

  /** Lane A's bounded delta feed, reader-scoped and reader-checked. Synchronous, local. */
  changesSince(sinceSequence: number, limit?: number): HumanitarianReaderChangePage {
    const page = retainedChangeFeedSince(this.cache, sinceSequence, limit);
    const base = {
      nextSinceSequence: page.nextSinceSequence,
      truncated: page.truncated,
      gapPossible: page.gapPossible,
    };
    if (!anySourceReaderCleared()) return { ...base, changes: [], readerRefused: false };
    const visible = page.changes
      .map((entry) => ({ entry, record: this.records.get(entry.record.observationKey) }))
      .filter(
        (v): v is { entry: (typeof page.changes)[number]; record: HumanitarianRetainedRecord } =>
          v.record !== undefined &&
          sourceIsReaderCleared(v.record.observation.identity.upstreamAuthority),
      );
    try {
      buildHumanitarianReaderRead(visible.map((v) => v.record));
    } catch {
      return { ...base, changes: [], readerRefused: true };
    }
    return {
      ...base,
      readerRefused: false,
      changes: visible.map(({ entry, record }) => ({
        sequence: entry.sequence,
        change: entry.change,
        firstSeenAt: entry.cachedAt,
        record,
      })),
    };
  }
}

/** One module, one provider instance — imported by the read module and by My Intelligence. */
@Module({ providers: [HumanitarianRetainedCorpus], exports: [HumanitarianRetainedCorpus] })
export class HumanitarianRetainedCorpusModule {}
