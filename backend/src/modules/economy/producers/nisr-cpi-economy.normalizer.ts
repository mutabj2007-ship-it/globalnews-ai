/**
 * ════════════════════════════════════════════════════════════════════════════
 * NISR CPI → THE ACCEPTED ECONOMY SPINE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * DORMANT. Nothing here fetches, schedules or activates anything. `rw-nisr` remains
 * `enabled: false` / `ingestionMethod: 'none'`. Production HOLD, no UI binding.
 *
 * ── THE TARGET, AND WHY NOTHING WAS CREATED FOR IT ────────────────────────
 *
 * Main's ruling C: `EconomySeries` → `EconomyPeriod` → `EconomyObservation`, with
 * `EconomyObservationLineage`. NOT `DomainObservation`, whose own header says *"ONE
 * NON-NUMERIC OBSERVATION … There is no `value` and no `unit`, DELIBERATELY."*
 *
 * And `R-NUM-2`: **NO ECONOMY FIELD IS ADDED.** `sourceLanguage`, `parserId` and
 * `parserVersion` occur zero times in `shared/src/economy/` and still do — they arrive
 * through `lineage.retrieval`, which is an `OfficialDataRetrieval`. This file imports the
 * Economy types and adds nothing to them.
 *
 * `EconomySeries`'s own doc comment reads *"A measured quantity through time — 'Rwanda
 * headline CPI, year on year'."* The canonical numeric model already names this case.
 *
 * ── WHAT IS READ, AND WHAT IS REFUSED ─────────────────────────────────────
 *
 * ONE observation: the All Rwanda GENERAL INDEX row's twelve-month percentage change.
 * It is READ FROM THE PUBLISHER'S OWN ANNEX. There is no arithmetic in this file that
 * combines urban and rural, and the decoder has none either — *"a parser averaging
 * components produces a number that looks official, is not, and is attributed to NISR."*
 *
 * Absence is an `EconomyFigureSlot` of kind `GAP` WITH A REASON, which is the only place
 * absence may be expressed: *"A gap is never a zero and never an empty cell with no
 * explanation."*
 */

import {
  assertDimensionsArePinned,
  assertLineageAgreesWithProvenance,
  assertReleaseStatusIsApplicable,
  assertRetrievalIsProvable,
  assertVintageBasisIsHonest,
  economyObservationIsPublishable,
  economyUpstreamSeriesKey,
  economyVintageBasisOf,
  economyVintageOf,
  retrievalMaySupplyValues,
  type EconomyFigureGapReason,
  type EconomyFigureSlot,
  type EconomyObservation,
  type EconomyObservationLineage,
  type EconomyPeriod,
  type EconomySeries,
  type EconomyUpstreamSeriesRef,
  type EconomyValueSemantics,
  type EditionOrder,
  type NisrCpiDecoded,
  type OfficialDataRetrieval,
  type SourceProvenance,
} from '@globalnews-ai/shared';

/* ══════════════════════════════════════════════════════════════════════════
 * 0 · EDITION ORDER — THERE IS NO COMPARATOR, AND THAT IS THE MEASUREMENT
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `R-REV-4` and `G-PDF-6`: do not supply an edition comparator you did not measure.
 * *"If you have not yet measured it, say so and write no comparator. `AMBIGUOUS` is the
 * correct outcome and ruling D depends on it being honest."*
 *
 * NISR PUBLISHES NOTHING THAT ORDERS TWO RELEASES. Measured across two editions and six
 * release pages by G, and re-measured on the retained August artifact this round:
 * `editionAnnotations` is EMPTY, and `R-AID-6` records that an empty record is a
 * MEASUREMENT rather than a missing field to fill. The running footer carries `N° 8`,
 * which `NISR_CPI_ISSUE_ORDINAL_DETECTS` states detects a MISSED RELEASE and never a
 * revision — so it is not an ordering either.
 *
 * WHAT IS NOT EVIDENCE OF ORDER: a changed checksum, a newer filename, a later
 * `Last-Modified`, a bigger file, or our own fetch order. `R-REV-5` names each and
 * refuses it; `R-AID-1` adds the filename.
 *
 * So the function below is NOT a comparator that happens to return `AMBIGUOUS`. It takes
 * no annotations, because there are none to compare, and it cannot return anything else.
 * `NISR_CPI_HAS_EDITION_COMPARATOR` is the fact, stated so a reader does not have to
 * infer it from a function body.
 */
export const NISR_CPI_HAS_EDITION_COMPARATOR = false as const;

/**
 * R1 RULING D, EXECUTED.
 *
 *   nothing seen before        ADVANCED   a first sighting is behind nothing
 *   these exact bytes seen     SAME       identical bytes are ONE artifact, not two
 *   different bytes, same period                                     AMBIGUOUS
 *
 * The third is the case the ruling is about: a second payload and a third retrieval,
 * BOTH RETAINED, no comparator, so `retrievalMaySupplyValues` is false and the second
 * artifact is EVIDENCE THAT SUPPLIES NO VALUES. Nothing is revised and nothing is
 * overwritten — both vintages survive, because *"the prior value is a prior
 * Observation, not a property of its successor."*
 *
 * FIRST-SEEN-WINS is deliberate and is not a preference for old data: it refuses the
 * shape "retry until a preferred number appears".
 */
export function nisrCpiEditionOrderFor(
  seenContentAddresses: readonly string[],
  incomingContentAddress: string,
): EditionOrder {
  if (seenContentAddresses.length === 0) return 'ADVANCED';
  if (seenContentAddresses.includes(incomingContentAddress)) return 'SAME';
  return 'AMBIGUOUS';
}
/* ══════════════════════════════════════════════════════════════════════════
 * 1 · THE UPSTREAM IDENTITY — DERIVED FROM THE PUBLISHER, NEVER MINTED
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `R-AID-4`: the logical document is a SERIES reference, not a document reference.
 * *"'Rwanda headline CPI, year on year' is the thing that persists across releases; the
 * PDF is an artifact that happened to carry a period of it."*
 *
 * `R-AID-1`/`R-AID-2`: nothing below is keyed on the filename or the URL. The artifact's
 * own filename contains "AUGUST 2026" and its upload folder is `2026-09` — a reference
 * period and a month that is not it, both in the path, both unused.
 */

/**
 * The publication's own title, verbatim from the artifact's cover. NISR publishes no
 * dataset codes, dataflow ids or table identifiers, so this is the most specific
 * publisher-owned designation that exists — and it is stable across releases, which the
 * annex numbering and the filename are not.
 */
export const NISR_CPI_DATASET_CODE = 'Consumer Price Index' as const;

/**
 * THE PUBLISHER DECLARES NO MACHINE DIMENSION LIST, SO THE DIMENSIONS ARE THE ONES ITS
 * OWN PUBLICATION DISTINGUISHES — three, each read from the artifact.
 *
 *   `geography`  the annex it is published in — "Urban", "Rural", "All Rwanda"
 *   `coicop`     the row's own COICOP code — "00" is the general index
 *   `basis`      the publication's own word for the comparison: it says the index
 *                "increased by 15.7 percent ON ANNUAL BASIS (August 2026 compared to
 *                August 2025)" and, separately, on a monthly basis
 *
 * WHY `basis` IS NOT THE COLUMN HEADER, WHICH WOULD HAVE BEEN MORE VERBATIM STILL. The
 * annual-change column is headed `on Aug. 2025` in August and `on Jul. 2025` in July: the
 * header NAMES THE PERIOD COMPARED AGAINST, so it is a function of the reference period.
 * Pinning it would make the series identity change every month, which `ECON-CL-1` forbids
 * for a reason this exact case illustrates — *"a series that carries it is a series whose
 * identity changes every period, and the accepted revision semantics require one series
 * to span many periods."* The publication's prose word is the publisher's own, says the
 * same thing, and does not move.
 *
 * NOTHING ELSE IS PINNED. `ECON-CL-2` makes the rule SET EQUALITY, so an extra pin fails
 * loudly rather than being dropped, and the base period (`Feb 2014=100`) is deliberately
 * absent: a rebasing is a new series the publisher announces, not a dimension we carry.
 */
export const NISR_CPI_DECLARED_DIMENSION_KEYS: readonly string[] = Object.freeze([
  'geography',
  'coicop',
  'basis',
]);

/** The annex titles, in the publisher's own words. Not our geography vocabulary. */
const PUBLISHER_GEOGRAPHY_SPELLING: Readonly<Record<string, string>> = Object.freeze({
  URBAN: 'Urban',
  RURAL: 'Rural',
  ALL_RWANDA: 'All Rwanda',
});

/** The general index row. The publisher's own code for "everything in the basket". */
export const NISR_CPI_GENERAL_INDEX_COICOP = '00' as const;

export function nisrCpiUpstreamRef(geographyKey: 'URBAN' | 'RURAL' | 'ALL_RWANDA'): EconomyUpstreamSeriesRef {
  return {
    providerId: 'rw-nisr',
    datasetCode: NISR_CPI_DATASET_CODE,
    /* ABSENT rather than guessed. NISR declares no dataset version; the issue ordinal in
       the running footer is a release counter and `NISR_CPI_ISSUE_ORDINAL_DETECTS` records
       that it detects a MISSED RELEASE and never a revision, so it is not one. */
    dimensions: [
      { key: 'geography', value: PUBLISHER_GEOGRAPHY_SPELLING[geographyKey] ?? '' },
      { key: 'coicop', value: NISR_CPI_GENERAL_INDEX_COICOP },
      { key: 'basis', value: 'annual' },
    ],
  };
}

/* ══════════════════════════════════════════════════════════════════════════
 * 2 · SERIES AND PERIOD
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * `seriesId` is CALLER-SUPPLIED — *"This contract mints no identifiers"* — so it is
 * derived from the upstream key rather than invented here, and the derivation is
 * injective because `economyUpstreamSeriesKey` is.
 */
export function nisrCpiSeriesId(geographyKey: 'URBAN' | 'RURAL' | 'ALL_RWANDA'): string {
  return economyUpstreamSeriesKey(nisrCpiUpstreamRef(geographyKey));
}

export function nisrCpiNationalSeries(): EconomySeries {
  return {
    seriesId: nisrCpiSeriesId('ALL_RWANDA'),
    label: 'Rwanda headline CPI, year on year (All Rwanda)',
    /* NEVER INFERRED FROM A SOURCE. NISR is Rwanda's national statistical authority under
       Law N° 53 bis/2013, which the official-source registry records; the code is read
       from that registration, not from the document or the hostname. */
    economyIso2: 'RW',
    /* As the publication states it: a percentage change. Not an index level. */
    unit: 'PERCENT',
    category: 'INFLATION_CPI',
    /* Publisher-stated: "Publishes CPI monthly on the 10th" — the registry's own
       measured note. Present, so freshness is judgeable rather than UNDETERMINED. */
    cadence: 'MONTHLY',
  };
}

/**
 * `YYYY-MM` → the interval the observation is ABOUT.
 *
 * *"'2026-Q1' is a period; the release date of the Q1 figure is not."* The publication
 * date never reaches this function, and there is no argument through which it could.
 */
export function nisrCpiPeriod(referencePeriod: string): EconomyPeriod | null {
  const m = /^(\d{4})-(\d{2})$/.exec(referencePeriod);
  if (m === null) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isInteger(year) || month < 1 || month > 12) return null;
  /* Day 0 of the NEXT month is the last day of this one, and it is right for February in
     a leap year without a leap-year rule being written. */
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    periodId: referencePeriod,
    start: `${referencePeriod}-01`,
    end: `${referencePeriod}-${String(lastDay).padStart(2, '0')}`,
    label: `${referencePeriod}`,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
 * 3 · FRESHNESS — DERIVED FROM THE PUBLISHER'S CADENCE, NOT ASSERTED
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Freshness is *"a property of TIME, and the only one of the three that changes without
 * anybody publishing anything"*, so it cannot be a constant. `UNDETERMINED` would be
 * dishonest here in the other direction: it means *"we hold no cadence for this Series"*
 * and we do hold one — NISR publishes monthly, which the registry records as measured.
 *
 * So it is computed from two dates that are both evidenced: the vintage the publisher
 * issued, and the moment we fetched. Nothing consults a wall clock.
 */
export function nisrCpiFreshness(vintageIso: string, retrievedAtIso: string): EconomyValueSemantics['freshness'] {
  const vintage = Date.parse(vintageIso);
  const retrieved = Date.parse(retrievedAtIso);
  if (!Number.isFinite(vintage) || !Number.isFinite(retrieved)) return 'UNDETERMINED';

  const dueNext = new Date(vintage);
  dueNext.setUTCMonth(dueNext.getUTCMonth() + 1);
  const overdueBy = retrieved - dueNext.getTime();
  const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

  /* Within the cadence: the next release is not yet due. */
  if (overdueBy <= 0) return 'FRESH';
  /* Past the cadence but inside a tolerance the series can defend — NISR publishes on a
     stated day of the month, so a week is the slack a stated day already implies. */
  if (overdueBy <= ONE_WEEK) return 'AGEING';
  return 'STALE';
}

/* ══════════════════════════════════════════════════════════════════════════
 * 4 · THE NORMALIZATION
 * ══════════════════════════════════════════════════════════════════════════ */

export interface NisrCpiNormalizationInput {
  readonly decoded: NisrCpiDecoded;
  readonly retrieval: OfficialDataRetrieval;
  readonly provenance: SourceProvenance;
  /**
   * REQUIRED, FOR THE REASON `admission` IS REQUIRED ON THE STORE PORT: an optional
   * verdict defaults to absent, and absent is not `AMBIGUOUS` — it is a third state no
   * rule describes. Required here means a caller cannot normalise an artifact without
   * having decided where it stands against what was already seen.
   */
  readonly editionOrder: EditionOrder;
}

export type NisrCpiNormalization =
  | {
      readonly ok: true;
      readonly series: EconomySeries;
      readonly period: EconomyPeriod;
      readonly observation: EconomyObservation;
      readonly lineage: EconomyObservationLineage;
    }
  | { readonly ok: false; readonly slot: EconomyFigureSlot; readonly detail: string };

/**
 * ONE OBSERVATION, READ FROM THE PUBLISHER'S OWN NATIONAL ANNEX.
 *
 * Every refusal below produces a `GAP` slot WITH A REASON rather than a null value, and
 * the reason is `NO_PRODUCER` where the failure is ours and `WITHHELD` where the
 * publisher's own annex did not carry the figure. The distinction is the point: a fact
 * about us must never be reported as a fact about the publisher.
 */
export function normalizeNisrCpiNationalObservation(
  input: NisrCpiNormalizationInput,
): NisrCpiNormalization {
  const { decoded, retrieval, provenance } = input;

  const series = nisrCpiNationalSeries();
  const period = nisrCpiPeriod(decoded.referencePeriod);
  const gap = (reason: EconomyFigureGapReason, detail: string): NisrCpiNormalization => ({
    ok: false,
    slot: {
      kind: 'GAP',
      seriesId: series.seriesId,
      periodId: period?.periodId ?? decoded.referencePeriod,
      reason,
    },
    detail,
  });

  if (period === null) return gap('NO_PRODUCER', 'REFERENCE_PERIOD_NOT_A_MONTH');

  /*
    R1 RULING D, AND IT RUNS BEFORE THE FIGURE IS READ RATHER THAN AFTER.

    An `AMBIGUOUS` retrieval SUPPLIES NO VALUES. Placing the check here means the value
    is never assembled and then discarded — there is no moment at which a figure from an
    unorderable edition exists in this process, so there is nothing for a later caller
    to reach past. The artifact is still retained; it is evidence.

    The reason is `NO_PRODUCER` and not `WITHHELD`: the publisher released the document.
    What is missing is OUR ability to order two editions of it, and a fact about us must
    never be reported as a fact about the publisher.
  */
  if (!retrievalMaySupplyValues(input.editionOrder)) {
    return gap('NO_PRODUCER', `EDITION_ORDER_${input.editionOrder}_SUPPLIES_NO_VALUES`);
  }

  /* THE NATIONAL ROW IS READ OR THE FIGURE IS ABSENT. The decoder already refuses an
     artifact with no All Rwanda annex, so reaching this branch means the annex was there
     and the general-index row was not — which is the publisher's omission, not ours. */
  const nationalRow = decoded.rows.find(
    (r) => r.geography === 'ALL_RWANDA' && r.coicopCode === NISR_CPI_GENERAL_INDEX_COICOP,
  );
  if (nationalRow === undefined) return gap('WITHHELD', 'NO_ALL_RWANDA_GENERAL_INDEX_ROW');

  const cell = nationalRow.cells.find((c) => c.role === 'PCT_CHANGE_ON_YEAR_AGO');
  if (cell === undefined) return gap('WITHHELD', 'NO_ANNUAL_CHANGE_CELL');
  if (cell.unit !== 'PERCENT') return gap('NO_PRODUCER', `UNEXPECTED_UNIT_${cell.unit}`);

  /* THREE DATES, THREE HOMES, AND THE VINTAGE IS RETURNED RATHER THAN ASSEMBLED — so the
     value and the basis cannot disagree. `economyVintageOf` reads the retrieval, which is
     where the publisher's own timestamps live. */
  const vintage = economyVintageOf(retrieval);

  const semantics: EconomyValueSemantics = {
    /*
      `R-NUM-4` · NISR STATES NO RELEASE STATUS, SO NONE IS WRITTEN.

      Re-measured on the retained artifact this round: zero occurrences of
      provisional|revised|revision|preliminary|final. `null` is permitted on an `ACTUAL`,
      and `revisionOrdinal` is unreachable without `REVISED` — the assert refuses an
      ordinal unless the status is exactly that. REVISED IS NEVER WRITTEN FROM A CHANGED
      CHECKSUM; it means "a later vintage THE PUBLISHER HAS ISSUED".
    */
    releaseStatus: null,
    /* Observed and published by the statistical authority. Not DERIVED: nothing here
       computed it, and the whole file has no arithmetic over publisher values. */
    valueKind: 'ACTUAL',
    freshness: nisrCpiFreshness(vintage, retrieval.retrievedAt),
  };
  assertReleaseStatusIsApplicable(semantics);

  const observation: EconomyObservation = {
    seriesId: series.seriesId,
    periodId: period.periodId,
    vintage,
    /* READ. The publisher's own national figure, from its own annex. */
    value: cell.value,
    unit: cell.unit,
    semantics,
    provenance,
  };

  const lineage: EconomyObservationLineage = {
    upstream: nisrCpiUpstreamRef('ALL_RWANDA'),
    retrieval,
  };

  /* EVERY GUARD THE CONTRACT OFFERS, RUN — a figure that cannot pass them is not
     published, and each throws with its own name rather than returning a boolean. */
  assertDimensionsArePinned(lineage.upstream, NISR_CPI_DECLARED_DIMENSION_KEYS);
  assertLineageAgreesWithProvenance(lineage, provenance);
  assertVintageBasisIsHonest(lineage);
  assertRetrievalIsProvable(lineage.retrieval);

  return { ok: true, series, period, observation, lineage };
}

/* ══════════════════════════════════════════════════════════════════════════
 * 5 · THE INTERNAL READ
 * ══════════════════════════════════════════════════════════════════════════
 *
 * INTERNAL ONLY. `SNAPSHOT_EXPOSURE` is `'INTERNAL_ONLY'` and it is a constant rather
 * than a config; no UI binding is in scope and none exists. This returns the contract's
 * own read type — an `EconomyFigureSlot`, which is *"either a reading, or a stated
 * gap"* — so a caller cannot receive an absence without a reason attached to it.
 */
export function readNisrCpiNationalFigureSlot(
  input: NisrCpiNormalizationInput,
): { readonly slot: EconomyFigureSlot; readonly publishable: boolean; readonly detail?: string } {
  const n = normalizeNisrCpiNationalObservation(input);
  if (!n.ok) return { slot: n.slot, publishable: false, detail: n.detail };

  return {
    slot: { kind: 'OBSERVATION', observation: n.observation },
    /* The single predicate the route-activation contract depends on. Deliberately not a
       score, a percentage or a readiness level. */
    publishable: economyObservationIsPublishable(
      n.lineage,
      input.provenance,
      NISR_CPI_DECLARED_DIMENSION_KEYS,
    ),
  };
}

/** The basis the retrieval actually supports, for the evidence record. */
export function nisrCpiVintageBasis(retrieval: OfficialDataRetrieval): string {
  return economyVintageBasisOf(retrieval);
}
