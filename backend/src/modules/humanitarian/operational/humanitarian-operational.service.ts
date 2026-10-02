import { Injectable } from '@nestjs/common';
import {
  COPERNICUS_PRODUCER_ENABLED,
  COPERNICUS_SOURCE_ID,
  HUMANITARIAN_PRODUCER_ACTIVATION,
} from '../producers/copernicus-ems.producer';
import {
  HUMANITARIAN_SOURCE_IDS,
  HUMANITARIAN_SOURCE_RULINGS,
  verdictPermitsRuntimeAcquisition,
  type HumanitarianSourceId,
  type SourceActivationVerdict,
} from '../source-activation.ruling';
import {
  COVERAGE_GRANULARITY,
  HUMANITARIAN_ALERT_IDS,
  WITHHOLD_REPORTING,
  deriveSourceReadiness,
  measured,
  notInstrumented,
  readinessRequirement,
  type HumanitarianAlertCondition,
  type HumanitarianModuleStatus,
  type HumanitarianOperationalStatus,
  type HumanitarianSourceStatus,
  type MeasuredFact,
} from './humanitarian-operational.contract';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * HUMANITARIAN OPERATIONAL STATUS — DERIVED FROM WHAT IS TRUE, NOT FROM LIVENESS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * READ-ONLY, AND STRUCTURALLY INCAPABLE OF ACQUISITION. This service holds no
 * HTTP client, no Prisma client, and reads no environment variable. There is no
 * argument through which a source could be contacted, so "opening Admin must
 * not call a source" is not a rule it follows — it is a thing it cannot do.
 * `humanitarianOperational.spec.ts` proves it with `fetch` mocked at the wire.
 *
 * IT ALSO TAKES NO LIVENESS INPUT. `deriveModuleStatus` has no parameter for
 * process health, uptime or probe state, so the brief's "never display healthy
 * merely because the HTTP process is healthy" cannot be violated by a future
 * edit here without first adding an argument that does not exist.
 *
 * WHAT IT READS INSTEAD: constants the programme already maintains as the
 * authority on activation — `COPERNICUS_PRODUCER_ENABLED`,
 * `HUMANITARIAN_PRODUCER_ACTIVATION` — plus the measured absence of any
 * acquisition path. Those are facts about the build, and they are the only
 * facts available.
 */

/** The one reason string used wherever persistence does not exist yet. */
const NO_STORE =
  'No humanitarian table exists in the applied schema. Persistence is unapplied SQL in schemas Prisma never sees, so there is nothing to read.';
const NO_ACQUISITION =
  'No acquisition path exists: there is no HTTP client and no environment variable in the humanitarian tree.';
const NO_SOURCE_CODE =
  'No implementation exists for this source anywhere in the repository — no producer, no configuration, nothing to configure.';
const NO_COUNTERS =
  'Nothing counts admitted or withheld records. The write receipt is a returned value, not a stored row, and nothing aggregates it.';
const NO_LANGUAGE =
  'The humanitarian domain declares no language field, column or type, so a language count cannot be derived.';
const NO_CACHE = 'No humanitarian cache exists, so there is no age to report.';
const NO_ERROR_LOG =
  'No error or attempt table exists. A failed authority load throws and writes nothing.';
const NO_PARSER_LOG =
  'Nothing counts parser refusals. The geometry refusal sink emits to observability and stores no row, and no transform refusal is persisted or aggregated.';

/** Every quantity is unmeasured today; this keeps the reason attached to each. */
const unmeasured = <T>(because: string): MeasuredFact<T> => notInstrumented<T>(because);

@Injectable()
export class HumanitarianOperationalService {
  /**
   * The module status.
   *
   * NOT_ASSESSED is returned because no observation has been admitted — not
   * because a check failed. The distinction matters: `SOURCE_UNAVAILABLE` would
   * assert that a source exists and is unreachable, which for GDACS and
   * ReliefWeb would be a claim about software that does not exist.
   *
   * A POSITIVE status is unreachable from here BY CONSTRUCTION: the only input
   * is the admitted-record count, and that count is `NOT_INSTRUMENTED`, so no
   * branch can produce PARTIAL, RETAINED or CURRENT. When persistence lands,
   * this function gains a real count and the positive branches become reachable
   * — and not one moment earlier.
   */
  private deriveModuleStatus(admitted: MeasuredFact<number>): {
    status: HumanitarianModuleStatus;
    basis: string;
  } {
    if (admitted.state !== 'MEASURED')
      return {
        status: 'NOT_ASSESSED',
        basis:
          'No humanitarian observation has been admitted and nothing counts admissions. This is an absence of assessment, not a finding of none.',
      };
    if (admitted.value === 0)
      return {
        status: 'COVERAGE_GAP',
        basis: 'Admission is instrumented and has admitted nothing.',
      };
    return { status: 'PARTIAL', basis: `Admission is instrumented; ${admitted.value} admitted.` };
  }

  /** E1's ruling for one source: the verdict, verbatim, and the activation it permits. */
  private e1(sourceId: HumanitarianSourceId) {
    const ruling = HUMANITARIAN_SOURCE_RULINGS[sourceId];
    /*
      READINESS IS DERIVED, NOT CHOSEN. One expression over E1's verdict, so the
      three situations R2 names (dev capture only, credential missing, protection
      authority missing) are three outputs of one rule rather than three branches
      that could each be written to disagree with E1.
    */
    const readiness = deriveSourceReadiness(ruling.verdict);
    return {
      activation: deriveSourceActivation(ruling.verdict),
      e1Verdict: ruling.verdict,
      e1RuledAt: ruling.ruledAt,
      readiness,
      readinessRequires: readinessRequirement(readiness),
      /* Verbatim. A restated blocking condition is a second opinion on E1's gate. */
      blockingConditions: ruling.blockingConditions,
    };
  }

  /** One row per source in E1's registry (exhaustive: a new E1 source is a compile error). */
  private row(sourceId: HumanitarianSourceId): HumanitarianSourceStatus {
    switch (sourceId) {
      case 'GDACS':
        return this.gdacs();
      case 'RELIEFWEB':
        return this.reliefweb();
      case 'COPERNICUS_EMS':
        return this.copernicus();
    }
  }

  private gdacs(): HumanitarianSourceStatus {
    return {
      sourceId: 'GDACS',
      implementation: 'NOT_IMPLEMENTED',
      ...this.e1('GDACS'),
      basis: NO_SOURCE_CODE,
      lastSuccessfulAcquisition: unmeasured(NO_ACQUISITION),
      lastAttemptedAcquisition: unmeasured(NO_ACQUISITION),
      lastRetainedRecordAt: unmeasured(NO_STORE),
      recordsAdmitted: unmeasured(NO_COUNTERS),
      recordsWithheld: unmeasured(NO_COUNTERS),
      withholdReasons: unmeasured(NO_COUNTERS),
      parserRefusals: unmeasured(NO_PARSER_LOG),
      sourceErrors: unmeasured(NO_ERROR_LOG),
      coverage: unmeasured(NO_STORE),
      languageCounts: unmeasured(NO_LANGUAGE),
      cacheAgeSeconds: unmeasured(NO_CACHE),
      /*
        NO CREDENTIAL ROW AT ALL — not `present: false`. `false` asserts that a
        credential is expected and missing, which would send an operator looking
        for a variable to set. No variable is declared for a source that does not
        exist.
      */
      credentials: [],
    };
  }

  private reliefweb(): HumanitarianSourceStatus {
    return {
      ...this.gdacs(),
      sourceId: 'RELIEFWEB',
      ...this.e1('RELIEFWEB'),
      basis:
        NO_SOURCE_CODE +
        ' Its only occurrence in the repository is a frontend guard that forbids naming it.',
    };
  }

  private copernicus(): HumanitarianSourceStatus {
    /*
      THE ONE SOURCE WITH CODE. A transform producer exists and is cleared as an
      implementation; execution is not. Both constants are read rather than
      restated, so this row cannot drift from the activation authority.
    */
    /* Both authorities must permit: E1's source verdict AND the producer's own activation. */
    const e1 = this.e1('COPERNICUS_EMS');
    const activation =
      e1.activation === 'NOT_CLEARED' || HUMANITARIAN_PRODUCER_ACTIVATION === 'NOT_CLEARED'
        ? ('NOT_CLEARED' as const)
        : COPERNICUS_PRODUCER_ENABLED
          ? ('RUNNING' as const)
          : ('CLEARED_NOT_RUNNING' as const);

    return {
      sourceId: 'COPERNICUS_EMS',
      implementation: 'TRANSFORM_ONLY_NO_ACQUISITION',
      ...e1,
      activation,
      basis:
        `A transform producer exists for ${COPERNICUS_SOURCE_ID}; it takes an already-obtained payload. ` +
        `Activation is ${HUMANITARIAN_PRODUCER_ACTIVATION} and assertActivationPermitted() throws unconditionally. ` +
        NO_ACQUISITION,
      lastSuccessfulAcquisition: unmeasured(NO_ACQUISITION),
      lastAttemptedAcquisition: unmeasured(NO_ACQUISITION),
      lastRetainedRecordAt: unmeasured(NO_STORE),
      recordsAdmitted: unmeasured(NO_COUNTERS),
      recordsWithheld: unmeasured(NO_COUNTERS),
      withholdReasons: unmeasured(NO_COUNTERS),
      parserRefusals: unmeasured(NO_PARSER_LOG),
      sourceErrors: unmeasured(NO_ERROR_LOG),
      /*
        COVERAGE IS NOT REPORTED PER SOURCE FOR COPERNICUS, and would not be even
        with a store: Article 53 forbids publishing an activation inventory and
        forbids publishing "no activation here". Module-level coverage only.
      */
      coverage: unmeasured(
        'Coverage is reported at module granularity only. Article 53 of Regulation (EU) 2021/696 forbids publishing an activation inventory, and forbids publishing "no activation here".',
      ),
      languageCounts: unmeasured(NO_LANGUAGE),
      cacheAgeSeconds: unmeasured(NO_CACHE),
      /*
        NO CREDENTIAL IS DECLARED for Copernicus either — the rights record is a
        licence, not a key, and nothing in the tree reads a Copernicus secret.
        An empty list is the honest answer; inventing a row would imply a
        variable an operator should go and set.
      */
      credentials: [],
    };
  }

  /** The six conditions, each with the instrument it needs before it can fire. */
  private alerts(): readonly HumanitarianAlertCondition[] {
    const conditions: Record<
      (typeof HUMANITARIAN_ALERT_IDS)[number],
      Omit<HumanitarianAlertCondition, 'id'>
    > = {
      FEED_STALE: {
        describes: 'No successful acquisition for longer than the source’s expected interval.',
        canFireToday: false,
        requires: 'A recorded acquisition time. No acquisition exists and nothing records one.',
      },
      REPEATED_SOURCE_FAILURE: {
        describes: 'Consecutive failed acquisition attempts from one source.',
        canFireToday: false,
        requires:
          'An attempt log with a failure outcome. The only run log records SUBSTANTIVE or NO_OP, both successes, and is governance refresh rather than acquisition.',
      },
      ALL_SOURCES_UNAVAILABLE: {
        describes: 'Every configured source failing at once.',
        canFireToday: false,
        requires:
          'At least one configured source. None is configured, so the condition has an empty subject.',
      },
      PARSER_REJECTION_SPIKE: {
        describes: 'Admitted-to-rejected ratio falling sharply against its recent baseline.',
        canFireToday: false,
        requires:
          'Admitted and rejected counters, and a retained baseline to compare against. Neither exists.',
      },
      PROTECTED_GEOMETRY_REFUSAL_SPIKE: {
        describes:
          'A rise in protected-geometry refusals, which can indicate an upstream shape change rather than a data defect.',
        canFireToday: false,
        requires:
          'A persisted refusal count. Refusals are emitted to an observability sink, not stored or aggregated.',
      },
      DATA_VOLUME_UNEXPECTEDLY_ZERO: {
        describes: 'A source that normally returns records returning none.',
        canFireToday: false,
        requires:
          'A volume history establishing what is normal. Nothing has ever been acquired, so there is no normal.',
      },
    };
    return Object.freeze(
      HUMANITARIAN_ALERT_IDS.map((id) => Object.freeze({ id, ...conditions[id] })),
    );
  }

  /** The whole surface. Pure: same output for the same build, bar the timestamp. */
  status(now: Date = new Date()): HumanitarianOperationalStatus {
    const sources = HUMANITARIAN_SOURCE_IDS.map((sourceId) => this.row(sourceId));
    /*
      Module status is derived from ADMISSION, which no source instruments — so
      the aggregate is unmeasured and the status is NOT_ASSESSED. Deriving it
      from the sources rather than hard-coding it means the day admission is
      instrumented, this starts answering differently without an edit here.
    */
    const admitted = sources.every((s) => s.recordsAdmitted.state === 'MEASURED')
      ? measured(
          sources.reduce(
            (total, s) =>
              total + (s.recordsAdmitted.state === 'MEASURED' ? s.recordsAdmitted.value : 0),
            0,
          ),
        )
      : unmeasured<number>(NO_COUNTERS);
    const { status, basis } = this.deriveModuleStatus(admitted);

    return {
      moduleStatus: status,
      moduleStatusBasis: basis,
      coverageGranularity: COVERAGE_GRANULARITY,
      withholdReporting: WITHHOLD_REPORTING,
      sources,
      alerts: this.alerts(),
      generatedAt: now.toISOString(),
    };
  }
}

/**
 * Activation as E1 permits it. Only E1's runtime verdict can lift a source out of NOT_CLEARED, and
 * even then this surface reports CLEARED_NOT_RUNNING: nothing here runs or starts acquisition, and
 * no Admin control exists that could (no activation bypass).
 */
export function deriveSourceActivation(
  verdict: SourceActivationVerdict,
): 'NOT_CLEARED' | 'CLEARED_NOT_RUNNING' {
  return verdictPermitsRuntimeAcquisition(verdict) ? 'CLEARED_NOT_RUNNING' : 'NOT_CLEARED';
}
