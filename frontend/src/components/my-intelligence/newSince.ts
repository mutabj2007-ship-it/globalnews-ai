/**
 * NEW SINCE YOUR PREVIOUS VISIT — THE GOVERNED RULE, AND ONLY IT.
 *
 * Frozen authority: MY-INTELLIGENCE-R1.2 `FOLLOWING_AND_NEW_SINCE.md`.
 * Capability authority: MY INTELLIGENCE DATA CAPABILITY SHEET R1 §2 —
 *   "Count new items with `firstSeenAt > previousSeenAt`, never `publishedAt`."
 *
 * ── WHY OBSERVATION AND NOT PUBLICATION ──────────────────────────────────
 *
 * `firstSeenAt` is when GLOBALNEWS AI first wrote the article down; the
 * backend derives it from the immutable `Article.fetchedAt` and merges it onto
 * the feed by `url` (`news.service.ts` `attachFirstSeen`). `publishedAt` is a
 * provider-reported, mutable claim about the publisher's clock.
 *
 * A report published last week that we retrieved an hour ago IS new to this
 * reader. One published an hour ago that we retrieved last week is NOT. Using
 * `publishedAt` would make the first kind vanish — a late-ingested story
 * silently dropped because a publisher's timestamp predates the visit — which
 * is exactly the failure the Product Owner ruled out.
 *
 * ── ABSENCE IS NOT ZERO, AND IT IS NEVER GUESSED ─────────────────────────
 *
 * `NewsArticle.firstSeenAt` is optional. Absence is the honest degraded
 * signal: persistence did not record that article, so no first observation
 * exists. R1.2 rules that such an item is NOT ELIGIBLE — it is never
 * classified or counted as new, and `publishedAt`, the current time, a
 * provider timestamp or any other substitute is never put in its place. The
 * item may still appear in Saved, Following or For you; it simply carries no
 * "identified …" label and no new-since claim.
 *
 * Filling the hole would manufacture a missed development out of a gap in our
 * own records, which is the one thing this surface must never do.
 *
 * ── ONE RULE, PROVED EQUIVALENT TO THE EXISTING ONE ──────────────────────
 *
 * `components/today/useReturnState.ts` already carries the accepted counting
 * rule as `countSince`. This module does not fork it: `newSinceSpec` asserts
 * that `countNewSince` returns exactly what `countSince` returns for the same
 * inputs. The predicate lives here so that rendering code can ask "is THIS row
 * new?" without importing a retired surface's hook module.
 */

/** The only two fields the rule reads. Anything else is irrelevant to newness. */
export interface ObservableRecord {
  readonly firstSeenAt?: string;
}

/**
 * Is this record one this system first observed AFTER the boundary?
 *
 * Returns false — never throws, never guesses — when the boundary is absent
 * (no previous visit), when either timestamp is unparseable, and when the
 * record carries no `firstSeenAt` at all.
 */
export function isNewSince(record: ObservableRecord, boundary: string | null): boolean {
  if (boundary === null) return false;
  if (record.firstSeenAt === undefined) return false;

  const at = Date.parse(boundary);
  if (Number.isNaN(at)) return false;

  const seen = Date.parse(record.firstSeenAt);
  if (Number.isNaN(seen)) return false;

  return seen > at;
}

/** How many of these records are new. Derived from `isNewSince`, never re-stated. */
export function countNewSince(
  records: ReadonlyArray<ObservableRecord>,
  boundary: string | null,
): number {
  return records.filter((record) => isNewSince(record, boundary)).length;
}

/**
 * The records eligible to be SHOWN in "New since your previous visit".
 *
 * Order is preserved from the feed. Nothing is re-sorted by `publishedAt`,
 * because a section about observation must not be ordered by publication.
 */
export function selectNewSince<T extends ObservableRecord>(
  records: ReadonlyArray<T>,
  boundary: string | null,
): T[] {
  return records.filter((record) => isNewSince(record, boundary));
}

/**
 * Does this record have an observation time at all?
 *
 * Drives the "identified … · published …" meta line: the "identified" half is
 * omitted when this is false, rather than being filled with a substitute.
 */
export function hasObservationTime(record: ObservableRecord): boolean {
  if (record.firstSeenAt === undefined) return false;
  return !Number.isNaN(Date.parse(record.firstSeenAt));
}
