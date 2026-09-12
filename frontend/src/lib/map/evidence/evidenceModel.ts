
import type { DisplayPrecision } from '@/lib/map/spatial/precisionModel';
import { countsAsVerified, displayPrecisionFor } from '@/lib/map/spatial/precisionModel';
import type { EvidenceScope, MapMode, MapPeriod } from '@/lib/map/state/mapState';
import { PERIOD_HOURS } from '@/lib/map/state/mapState';
import type { LocationProvenance } from '@/lib/spatial/spatialPrecision';

/**
 * SPATIAL M2 — THE EVIDENCE SET THE MAP DRAWS.
 *
 * Part II §3: `evidenceSet { records[], scope, loadedAt }`. This module owns
 * the record shape, which records QUALIFY for a given mode and period, and the
 * totals the context panel and the selection card state.
 *
 * ── THE ONE THING THIS MODULE WILL NOT DO ─────────────────────────────────
 *
 * It does not derive evidence. Every field here is carried from the backend or
 * absent; nothing is inferred from a country code, a query, a publisher or a
 * retrieval context. A record without geography does not acquire one by being
 * near records that have it, and a country with no records does not become
 * "probably quiet" — it becomes an explicit no-evidence entry, which Part II
 * §6's M2 acceptance requires by name: "a country with no retained evidence
 * says so explicitly rather than rendering as empty."
 *
 * ── AND THE ONE THING IT REFUSES TO RETURN ────────────────────────────────
 *
 * A single confidence number. Part I §G: the two axes "must never be collapsed
 * into a single confidence score in the interface". `confidence` below is the
 * backend's own rating of the reporting, and it is deliberately NOT combined
 * with precision or provenance anywhere in this file.
 */

export interface EvidenceGeography {
  /** ISO3 for a country, or a gazetteer id for a finer place. */
  readonly id: string;
  readonly countryIso3: string;
  readonly displayName: string;
  /** Present only where the record legitimately holds a point. */
  readonly point?: readonly [number, number];
}

export interface EvidenceRecord {
  readonly id: string;
  readonly geography: EvidenceGeography;
  /** The level actually asserted. Never inferred here. */
  readonly precision: DisplayPrecision;
  /** How that level was reached. Absent is treated as STATED by `countsAsVerified`. */
  readonly provenance?: LocationProvenance;
  readonly reportCount: number;
  readonly sourceCount: number;
  /**
   * ── THE PUBLISHER'S OWN IDENTITY, SO SOURCES CAN BE COUNTED HONESTLY ─────
   *
   * `NewsArticle.sourcesCount` is unusable as a distinct-outlet count — Main's
   * SelectionCallout action contract §3.4 records that all three providers
   * hard-code it to `1` (G-owned, C-4). Summing or maxing it therefore reports
   * "1 SOURCE" for a geography five different outlets reported on, which is a
   * wrong number derived from real data.
   *
   * `sourceId` is the outlet and it is real on every article. Carried here so
   * `geographyTotals` can count DISTINCT publishers rather than trusting a
   * field the providers do not populate. Optional, so a producer with no
   * publisher identity degrades to the previous behaviour rather than to zero.
   */
  readonly publisherId?: string;
  /** Backend's rating of the reporting. NOT a precision score. */
  readonly confidence?: number;
  /** ISO timestamp of the most recent observation. */
  readonly lastObservedAt: string;
  /** Reports first seen since the user's last visit. */
  readonly newSinceLastVisit?: number;
  readonly headline?: string;
  readonly topics?: readonly string[];
  readonly situationIds?: readonly string[];
}

export interface EvidenceSet {
  readonly records: readonly EvidenceRecord[];
  readonly scope: EvidenceScope;
  /** ISO timestamp. The period window is measured from here, not from Date.now(). */
  readonly loadedAt: string;
}

export const EMPTY_EVIDENCE_SET: EvidenceSet = {
  records: [],
  scope: 'GLOBAL',
  loadedAt: new Date(0).toISOString(),
};

/**
 * Which records qualify for a mode and period.
 *
 * MEASURED FROM `loadedAt`, NOT FROM THE WALL CLOCK. A pure function of its
 * inputs is testable and cannot drift between a render and a re-render; a
 * function that read `Date.now()` would silently drop a record from the map
 * between two frames while the data underneath had not changed.
 *
 * Part I §C: "Mode switching never moves the camera. It changes WHICH RECORDS
 * QUALIFY for the overlay." This function is that sentence, and it returns
 * records only — no camera, no bounds, nothing a caller could fly to by
 * accident.
 */
export function qualifyingRecords(
  set: EvidenceSet,
  mode: MapMode,
  period: MapPeriod,
  watch: ReadonlySet<string> = new Set(),
): readonly EvidenceRecord[] {
  const horizon = Date.parse(set.loadedAt) - PERIOD_HOURS[period] * 3600_000;

  return set.records.filter((record) => {
    const observed = Date.parse(record.lastObservedAt);

    if (Number.isFinite(observed) && observed < horizon) return false;

    switch (mode) {
      case 'WATCH':
        return watch.has(record.geography.countryIso3);
      case 'CHANGE':
        return (record.newSinceLastVisit ?? 0) > 0;
      case 'SITUATIONS':
        return (record.situationIds?.length ?? 0) > 0;
      case 'SOURCES':
        /*
          Part II §8 question 8: source geography is a DIFFERENT QUESTION from
          evidence geography and "must never be visible in the same visual
          register". No evidence record qualifies for SOURCES — the mode draws
          from the source registry, which is Partial · M5 and not this set.
        */
        return false;
      case 'WORLD':
      case 'EVIDENCE':
      default:
        return true;
    }
  });
}

export interface GeographyTotal {
  readonly geographyId: string;
  readonly countryIso3: string;
  readonly displayName: string;
  readonly recordCount: number;
  readonly reportCount: number;
  readonly sourceCount: number;
  readonly newSinceLastVisit: number;
  /** The FINEST precision any record here asserts. */
  readonly finestPrecision: DisplayPrecision;
  /** True when at least one record is INTERPRETED or CONTESTED. */
  readonly hasUnverified: boolean;
  /** Reports whose provenance is STATED or absent. */
  readonly verifiedReportCount: number;
}

/**
 * Totals per geography, for the context panel's ranked list and the card.
 *
 * `finestPrecision` is the finest any record CLAIMS, before any surface's
 * geometry budget is applied — the claim and the drawing are separate facts
 * and the card states both. Applying the budget here would destroy exactly the
 * precision Main's ruling protects.
 */
export function geographyTotals(records: readonly EvidenceRecord[]): readonly GeographyTotal[] {
  const byId = new Map<string, GeographyTotal>();
  /** Distinct outlets per geography. See `EvidenceRecord.publisherId`. */
  const publishersById = new Map<string, Set<string>>();

  for (const record of records) {
    const key = record.geography.id;
    const existing = byId.get(key);
    const verified = countsAsVerified(record.provenance);

    if (record.publisherId !== undefined) {
      const publishers = publishersById.get(key) ?? new Set<string>();

      publishers.add(record.publisherId);
      publishersById.set(key, publishers);
    }

    if (!existing) {
      byId.set(key, {
        geographyId: key,
        countryIso3: record.geography.countryIso3,
        displayName: record.geography.displayName,
        recordCount: 1,
        reportCount: record.reportCount,
        sourceCount: record.sourceCount,
        newSinceLastVisit: record.newSinceLastVisit ?? 0,
        finestPrecision: record.precision,
        hasUnverified: !verified,
        verifiedReportCount: verified ? record.reportCount : 0,
      });
      continue;
    }

    byId.set(key, {
      ...existing,
      recordCount: existing.recordCount + 1,
      reportCount: existing.reportCount + record.reportCount,
      sourceCount: Math.max(existing.sourceCount, record.sourceCount),
      newSinceLastVisit: existing.newSinceLastVisit + (record.newSinceLastVisit ?? 0),
      finestPrecision: finer(existing.finestPrecision, record.precision),
      hasUnverified: existing.hasUnverified || !verified,
      verifiedReportCount: existing.verifiedReportCount + (verified ? record.reportCount : 0),
    });
  }

  /*
    The distinct-outlet count replaces the provider's own number wherever the
    records actually carried a publisher identity. Applied after the fold so
    the merge above stays pure and the substitution is one statement.
  */
  const totals = [...byId.values()].map((total) => {
    const publishers = publishersById.get(total.geographyId);

    return publishers === undefined || publishers.size === 0
      ? total
      : { ...total, sourceCount: publishers.size };
  });

  return totals.sort((a, b) => b.reportCount - a.reportCount);
}

/**
 * The finer of two levels.
 *
 * `displayPrecisionFor(a, b)` returns `a` clamped to `b`, so it equals `a`
 * exactly when `a` is not finer than `b` — in which case `b` is the finer of
 * the two. Reusing the model's comparison rather than re-deriving one keeps a
 * single definition of "finer than" in the codebase, which is what stops the
 * arbitrated REGION ordering from being contradicted somewhere downstream.
 */
const finer = (a: DisplayPrecision, b: DisplayPrecision): DisplayPrecision =>
  displayPrecisionFor(a, b) === a ? b : a;

export interface EvidenceTotals {
  readonly recordCount: number;
  readonly reportCount: number;
  readonly geographyCount: number;
  readonly newSinceLastVisit: number;
  /**
   * Reports from records with STATED or absent provenance.
   *
   * Reported SEPARATELY from `reportCount` rather than as the only total,
   * because Part II §8 question 9 forbids counting an interpreted record in a
   * verified total "without the qualifier" — and the way to keep a qualifier
   * attached to a number is to make the unqualified number a different field.
   */
  readonly verifiedReportCount: number;
}

export function evidenceTotals(records: readonly EvidenceRecord[]): EvidenceTotals {
  let reportCount = 0;
  let verifiedReportCount = 0;
  let newSinceLastVisit = 0;
  const geographies = new Set<string>();

  for (const record of records) {
    reportCount += record.reportCount;
    newSinceLastVisit += record.newSinceLastVisit ?? 0;
    geographies.add(record.geography.id);
    if (countsAsVerified(record.provenance)) verifiedReportCount += record.reportCount;
  }

  return {
    recordCount: records.length,
    reportCount,
    geographyCount: geographies.size,
    newSinceLastVisit,
    verifiedReportCount,
  };
}

/**
 * THE EXPLICIT NO-EVIDENCE ENTRIES.
 *
 * Part II §6, M2 acceptance: "a country with no retained evidence SAYS SO
 * EXPLICITLY rather than rendering as empty." Part II §8 question 7 says the
 * same thing about search: "the ability to look somewhere and be told plainly
 * that nothing is known is itself an intelligence answer."
 *
 * So a surface asks for these deliberately, and gets back the countries it is
 * INTERESTED IN that have no qualifying records — not a silence to be
 * interpreted. `interest` is passed in because the honest answer depends on
 * what the user asked about: the whole world is not "no evidence in 190
 * countries", it is a world map with evidence in some places.
 */
export function noEvidenceGeographies(
  interest: readonly EvidenceGeography[],
  records: readonly EvidenceRecord[],
): readonly EvidenceGeography[] {
  const covered = new Set(records.map((record) => record.geography.id));

  return interest.filter((geography) => !covered.has(geography.id));
}
