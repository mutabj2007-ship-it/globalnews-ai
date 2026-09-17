import {
  type EconomyObservation,
  economyObservationKey,
  economySeriesPeriodKey,
} from '@globalnews-ai/shared';

/**
 * ECON-DATA-CONTRACT-ADAPT-1 - THE IMMUTABLE OBSERVATION LEDGER, BOUND TO THE
 * ACCEPTED SHARED CONTRACT.
 *
 * APPEND-ONLY BY CONSTRUCTION. There is no update method, no delete method and
 * no setter. A revision is `append()` of a later vintage for the same Series +
 * Period; the prior observation stays exactly where it was and stays readable.
 *
 * -- WHAT CHANGED, AND WHY IT MATTERED ------------------------------------
 *
 * This ledger previously keyed on a LOCAL `observationKey` that joined the
 * three caller-supplied parts with a space. MAIN-ECON-CONTRACT-1 section 5
 * found that encoding is NOT INJECTIVE, and the counterexample is short:
 *
 *     { 'RW CPI', 'Q1',     'v1' }  ->  "RW CPI Q1 v1"
 *     { 'RW',     'CPI Q1', 'v1' }  ->  "RW CPI Q1 v1"    <- one key, two facts
 *
 * A ledger keyed like that SILENTLY MERGES two different observations: nothing
 * throws, one row simply wins. In a store whose entire premise is that no
 * reading is ever overwritten, that is a load-bearing failure - and my own
 * acceptance tests did not catch it, because they exercised the immutability
 * rule only on well-behaved ids and never on an id containing the separator.
 *
 * The canonical `economyObservationKey` is length-prefixed and version-stamped
 * (`eco:1`), so a decoder always knows where each part ends and no caller input
 * can collide. The keys stay LEDGER-LOCAL and mint nothing: every part is still
 * caller-supplied, which is the identity rule this module has followed from the
 * start.
 *
 * NOT SITUATION IDENTITY. Injectivity here is a property of a string encoding
 * over Economy's own inputs. D1's partitioning, discriminator space, similarity
 * threshold and attachment semantics are Situation-domain concerns; nothing in
 * this file imports or asserts about them.
 *
 * FREEZING IS DELIBERATE. `Object.freeze` on the stored record means a caller
 * holding a reference cannot mutate history in place - the type system's
 * `readonly` vanishes at runtime, and this ledger's entire purpose is a runtime
 * guarantee.
 *
 * NOT A DATABASE, NOT A CACHE, NOT A SECOND EVIDENCE PIPELINE. In-memory,
 * process-local, and holds only what a caller appends. This deployment appends
 * NOTHING in production: see economy-capability.contract.ts, which records that
 * no numeric economic time-series producer exists.
 */
export class EconomyObservationLedger {
  /** Insertion-ordered. The key carries the vintage, so revisions coexist. */
  private readonly entries = new Map<string, EconomyObservation>();

  /**
   * Record one observation.
   *
   * Appending the SAME (series, period, vintage) twice with the same content is
   * idempotent and allowed - re-ingesting an unchanged release is normal and is
   * not a revision. Appending the same key with DIFFERENT content is rejected:
   * that is an attempt to rewrite a specific historical reading, which is the
   * one thing this class exists to prevent.
   */
  append(observation: EconomyObservation): EconomyObservation {
    const key = economyObservationKey(observation);
    const existing = this.entries.get(key);

    if (existing) {
      if (!sameReading(existing, observation)) {
        throw new Error(
          `ECON-IMMUTABLE-1: observation ${key} already exists with a different reading. ` +
            'A revision must be appended as a LATER VINTAGE for the same Series and Period; ' +
            'an existing vintage is never overwritten.',
        );
      }

      return existing;
    }

    const frozen = Object.freeze({ ...observation });
    this.entries.set(key, frozen);

    return frozen;
  }

  /** Every vintage held for a Series + Period, oldest vintage first. */
  vintagesFor(seriesId: string, periodId: string): readonly EconomyObservation[] {
    const slot = economySeriesPeriodKey({ seriesId, periodId });

    return [...this.entries.values()]
      .filter((o) => economySeriesPeriodKey(o) === slot)
      .sort((a, b) => (a.vintage < b.vintage ? -1 : a.vintage > b.vintage ? 1 : 0));
  }

  /**
   * The reading that was current AS AT a moment - the latest vintage issued at
   * or before `asOf`.
   *
   * This is the method that makes the ledger worth having. "What did we believe
   * when we published that analysis?" is answerable only if earlier vintages
   * were never overwritten, and `asOf` is how a caller asks it.
   */
  asAt(seriesId: string, periodId: string, asOf: string): EconomyObservation | undefined {
    const eligible = this.vintagesFor(seriesId, periodId).filter((o) => o.vintage <= asOf);

    return eligible.length === 0 ? undefined : eligible[eligible.length - 1];
  }

  /** The most recent vintage held, regardless of when it was issued. */
  latest(seriesId: string, periodId: string): EconomyObservation | undefined {
    const all = this.vintagesFor(seriesId, periodId);

    return all.length === 0 ? undefined : all[all.length - 1];
  }

  /** Total observations held, counting every vintage separately. */
  size(): number {
    return this.entries.size;
  }

  /** Every observation, insertion-ordered. Read-only by construction. */
  all(): readonly EconomyObservation[] {
    return [...this.entries.values()];
  }
}

/**
 * Two records of the same (series, period, vintage) are the same reading when
 * every value-bearing field agrees.
 *
 * THREE FIELDS ARE DELIBERATELY EXCLUDED, ALL FOR THE SAME REASON: they change
 * with the clock rather than with the publisher.
 *
 *   `provenance.retrievedAt`    - re-fetching an unchanged release legitimately
 *       produces a new retrieval time.
 *   `semantics.freshness`       - a FRESH reading becomes STALE while the
 *       number, its release status and its kind all stay exactly what they
 *       were. That is the whole point of freshness being its own axis.
 *   `semantics.revisionOrdinal` - display ordering of a revision, not the
 *       reading itself.
 *
 * Comparing any of them would make ordinary re-ingestion, or the mere passage
 * of time, look like the publisher revising a figure.
 */
function sameReading(a: EconomyObservation, b: EconomyObservation): boolean {
  return (
    a.value === b.value &&
    a.unit === b.unit &&
    a.semantics.releaseStatus === b.semantics.releaseStatus &&
    a.semantics.valueKind === b.semantics.valueKind &&
    a.provenance.sourceType === b.provenance.sourceType &&
    a.provenance.institution === b.provenance.institution &&
    a.provenance.sourceUrl === b.provenance.sourceUrl
  );
}
