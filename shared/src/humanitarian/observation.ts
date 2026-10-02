/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE CANONICAL HUMANITARIAN RETAINED RECORD — HUM-DATA-R1
 * ════════════════════════════════════════════════════════════════════════════
 *
 * MAIN-HUMANITARIAN-DATA-AUTHORITY-R1. PROPOSED for `shared/src/humanitarian/observation.ts`.
 * Nothing lands without authorization. No provider, no transport, no activation, no deployment.
 *
 * ── THIS FILE ADDS NO EVIDENCE ARCHITECTURE ───────────────────────────────
 *
 * Everything structural here is the platform's, under its accepted names. Measured at the
 * accepted baseline `9ba738b` before a line was written:
 *
 *   identity + canonical key   `DomainObservationIdentity` · `domainObservationKey()`
 *   temporal axes              `ObservationTemporal` · `assertTemporalBasisIsSupported()`
 *   asserted vs estimated      `AttributeAuthorship` (PUBLISHER_STATED | LOCALLY_ASSERTED)
 *   revision chain             `ObservationRevision` · `assertObservationRevisionAppends()`
 *   provenance                 `SourceProvenance` (institution, language, evidenceRole,
 *                              authorityClass, sourceType)
 *   source reference           `ObservationSourceReference` (citation, sourceUrl)
 *   absence                    `OBSERVATION_ABSENCE_STATES` · `readerAbsence()` · `degradeTo()`
 *   bounded geography          `SourceEvidenceRecord` (geometryKind, denotation, origin, crs,
 *                              coordinates) — REFERENCED, never re-declared
 *   domain id                  `'HUMANITARIAN'`, the string `COPERNICUS_DOMAIN_ID` already uses
 *
 * **What was missing is only the claim layer.** The existing intake port admits GEOMETRY
 * (`SourceEvidenceRecord`); nothing in the tree carries a hazard occurrence, a publisher
 * report, or an asserted impact. That gap is what this file closes, and it closes it as three
 * claim types on the ONE existing `DomainObservation<TClaim>` carrier.
 *
 * ── WHY THREE KINDS AND NOT ONE FLAT RECORD ───────────────────────────────
 *
 * The three have different identity, different sources, and different revision lifetimes. One
 * flat row would force a publisher's report date, a hazard's onset, and a fatality count's
 * as-of date into one `date` column — which is the precise collapse
 * `assertTemporalBasisIsSupported` exists to refuse. Three kinds keep one spine and three
 * claims.
 */

import type { SourceProvenance } from '../source-provenance';
import type {
  DomainObservation,
  DomainObservationIdentity,
  AttributeAuthorship,
} from '../observation/domain-observation';

/** Reused, not minted: this is the string the Copernicus scaffold already emits. */
export const HUMANITARIAN_DOMAIN_ID = 'HUMANITARIAN' as const;

/** The domain registry `DomainObservation.observationKind` is drawn from. Closed. */
export const HUMANITARIAN_OBSERVATION_KINDS = [
  'HUMANITARIAN_EVENT',
  'HUMANITARIAN_REPORT',
  'HUMANITARIAN_IMPACT_ASSERTION',
] as const;
export type HumanitarianObservationKind = (typeof HUMANITARIAN_OBSERVATION_KINDS)[number];

export class HumanitarianRecordRefused extends Error {}

/* ═══════════════════════════════════════════════════════════════════════════
 * 1 · HAZARD TYPE — THE SOURCE'S OWN CODE IS RETAINED; THE CANONICAL TYPE IS MAPPED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * NO HAZARD VOCABULARY EXISTS IN THE TREE — measured, 0 hits for HAZARD_ · GDACS · RELIEFWEB
 * across `shared/src` and the humanitarian module. So one is proposed here, and it is
 * constructed so that it cannot be used to assert a hazard a source did not state:
 *
 *   1. the source's own code is retained VERBATIM in `sourceNativeType`, never parsed away;
 *   2. the canonical type comes only from an explicit mapping table;
 *   3. an unmapped code is a REFUSAL, not an `OTHER` bucket. An `OTHER` member would let an
 *      unrecognised hazard be stored as a recognised record of unknown kind, and a reader
 *      cannot tell those apart.
 *
 * Reader labels are NOT here, in either language. L owns wording; a vocabulary that carried
 * English would make English the authority.
 */
export const HUMANITARIAN_HAZARD_TYPES = [
  'EARTHQUAKE',
  'TROPICAL_CYCLONE',
  'FLOOD',
  'DROUGHT',
  'WILDFIRE',
  'VOLCANIC_ACTIVITY',
  'ARMED_CONFLICT_DISPLACEMENT',
  'EPIDEMIC',
] as const;
export type HumanitarianHazardType = (typeof HUMANITARIAN_HAZARD_TYPES)[number];

/** GDACS publishes its own two-letter `eventtype`. Mapped explicitly, never inferred. */
export const GDACS_EVENTTYPE_TO_HAZARD: Readonly<Record<string, HumanitarianHazardType>> =
  Object.freeze({
    EQ: 'EARTHQUAKE',
    TC: 'TROPICAL_CYCLONE',
    FL: 'FLOOD',
    DR: 'DROUGHT',
    WF: 'WILDFIRE',
    VO: 'VOLCANIC_ACTIVITY',
  });

/**
 * ReliefWeb publishes a `disaster_type` taxonomy whose members do not correspond one-to-one
 * with GDACS's. Only the terms this contract can state without widening meaning are mapped;
 * everything else refuses, and the refusal names the term so the gap is reviewable.
 */
export const RELIEFWEB_DISASTER_TYPE_TO_HAZARD: Readonly<Record<string, HumanitarianHazardType>> =
  Object.freeze({
    Earthquake: 'EARTHQUAKE',
    'Tropical Cyclone': 'TROPICAL_CYCLONE',
    Flood: 'FLOOD',
    Drought: 'DROUGHT',
    'Wild Fire': 'WILDFIRE',
    'Volcano': 'VOLCANIC_ACTIVITY',
    Epidemic: 'EPIDEMIC',
  });

export function hazardFromSourceCode(
  system: 'GDACS' | 'RELIEFWEB',
  code: string,
): HumanitarianHazardType {
  const table = system === 'GDACS' ? GDACS_EVENTTYPE_TO_HAZARD : RELIEFWEB_DISASTER_TYPE_TO_HAZARD;
  const mapped = table[code];
  if (mapped === undefined) {
    throw new HumanitarianRecordRefused(
      `HUM-HAZ-1: ${system} code '${code}' has no canonical hazard type. It is REFUSED rather ` +
        'than stored as an unknown kind, because a record of unrecognised hazard is ' +
        'indistinguishable to a reader from a recognised one. Extend the table under a ruling.',
    );
  }
  return mapped;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2 · HUMANITARIAN_EVENT — a hazard occurrence
 * ═══════════════════════════════════════════════════════════════════════════ */

/** As the SOURCE states the event's lifecycle. Not our assessment of it. */
export const HUMANITARIAN_EVENT_STATUSES = ['ONGOING', 'CLOSED', 'NOT_STATED'] as const;
export type HumanitarianEventStatus = (typeof HUMANITARIAN_EVENT_STATUSES)[number];

export interface HumanitarianEventClaim {
  readonly claimType: 'HUMANITARIAN_EVENT';
  readonly hazardType: HumanitarianHazardType;
  /** The source's own code, VERBATIM. Retained so the mapping stays auditable. */
  readonly sourceNativeType: string;
  /** The source's own name for the event. Never composed by us. */
  readonly sourceTitle: string;
  readonly eventStatus: HumanitarianEventStatus;
  /**
   * The source's own severity expression, verbatim and UNINTERPRETED — GDACS writes an alert
   * level, others write words. There is deliberately no numeric `severity`: a cross-source
   * severity scale is an assessment, and this contract retains statements, not assessments.
   */
  readonly sourceSeverityStated?: string;
  /** ISO3, only where the source itself scoped the event to countries. Never derived. */
  readonly countryIso3: readonly string[];
  /**
   * The bounded geography, BY REFERENCE to the governed geometry record. This contract
   * declares no coordinates: `SourceEvidenceRecord` owns geometry and its protection rules.
   */
  readonly geometryRecordKey?: string;
  /**
   * CONVERGENCE (E1 R2, CTO disclosure-chain ruling): the agency that MEASURED the event when the
   * publisher RELAYS it — GDACS's `source` field (NOAA, NEIC, JTWC, GLOFAS, GWIS), VERBATIM.
   * Attributing NEIC's magnitude to GDACS is a provenance error, so this name travels with the
   * record into model context, citations and stored results. Absent when the publisher names none.
   */
  readonly originatingAgency?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3 · HUMANITARIAN_REPORT — a retained publisher report
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface HumanitarianReportClaim {
  readonly claimType: 'HUMANITARIAN_REPORT';
  /** The publisher's own headline, verbatim. */
  readonly sourceTitle: string;
  /** The source's own format term (ReliefWeb `format`), verbatim where supplied. */
  readonly sourceFormat?: string;
  /** ISO3 as the publisher scoped the report. Never inferred from body text. */
  readonly countryIso3: readonly string[];
  /** The event(s) the PUBLISHER linked this report to, by their observation keys. */
  readonly aboutEventKeys: readonly string[];
  /**
   * NO BODY TEXT. A report's body is a retained artifact under
   * `hum_authority.retained_capture`, bounded at 2 MiB with a sha256 self-check. Inlining it
   * here would put an unbounded string in a contract whose other fields are all bounded, and
   * would duplicate bytes the capture table already holds immutably.
   */
  readonly captureKey?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4 · HUMANITARIAN_IMPACT_ASSERTION — one asserted impact fact, and only when supplied
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * AN ASSERTION IS ITS OWN OBSERVATION, NOT A FIELD ON AN EVENT. Three reasons, and the third
 * is the one that matters most:
 *
 *   1. it has its own source, its own as-of date and its own revision chain — GDACS asserting
 *      a fatality count at T1 and ReliefWeb asserting a different one at T2 are two
 *      assertions about one event, not one field overwritten;
 *   2. it has its own authorship: a publisher-stated count and a locally-derived estimate are
 *      different facts and `AttributeAuthorship` already distinguishes them;
 *   3. **"never infer zero from missing" becomes structural rather than a rule to remember.**
 *      There is no `fatalities` field anywhere that could be absent and read as 0. There is
 *      either an assertion record or there is no record, and no part of this contract can
 *      represent "zero affected" without a source having asserted it.
 */
export const HUMANITARIAN_IMPACT_MEASURES = [
  'PEOPLE_AFFECTED',
  'PEOPLE_DISPLACED',
  'FATALITIES',
  'INJURED',
  'PEOPLE_IN_NEED',
  'HOUSES_DAMAGED',
  'HOUSES_DESTROYED',
] as const;
export type HumanitarianImpactMeasure = (typeof HUMANITARIAN_IMPACT_MEASURES)[number];

/** Status measures are categorical, not countable, and are kept apart from counts. */
export const HUMANITARIAN_STATUS_MEASURES = [
  'SHELTER_STATUS',
  'HEALTH_STATUS',
  'FOOD_SECURITY_STATUS',
  'WATER_STATUS',
  'HUMANITARIAN_ACCESS_STATUS',
] as const;
export type HumanitarianStatusMeasure = (typeof HUMANITARIAN_STATUS_MEASURES)[number];

/** Did the source state this figure, or did it state an estimate? Its own words decide. */
export const IMPACT_ASSERTION_BASES = ['SOURCE_STATED', 'SOURCE_ESTIMATED'] as const;
export type ImpactAssertionBasis = (typeof IMPACT_ASSERTION_BASES)[number];

export interface HumanitarianImpactAssertionClaim {
  readonly claimType: 'HUMANITARIAN_IMPACT_ASSERTION';
  /** EXACTLY ONE measure per assertion. A multi-measure record has one date for many facts. */
  readonly measure: HumanitarianImpactMeasure | HumanitarianStatusMeasure;
  /**
   * REQUIRED AND NOT NULLABLE, following the Economy rule verbatim: *"a reading that does not
   * exist is not an observation with a null in it."* A count carries a number; a status
   * measure carries the source's own term.
   */
  readonly value: number | string;
  /** Required for a count ('PERSONS', 'HOUSEHOLDS', …). Absent only for a status measure. */
  readonly unit?: string;
  readonly basis: ImpactAssertionBasis;
  /** The source's own sentence for this figure, verbatim. What `basis` was read from. */
  readonly sourceBasisStatement: string;
  /** The event this is about, by observation key. An assertion about nothing is refused. */
  readonly aboutEventKey: string;
  /** ISO3 scope of the figure where the source scopes it. */
  readonly countryIso3: readonly string[];
}

export type HumanitarianClaim =
  | HumanitarianEventClaim
  | HumanitarianReportClaim
  | HumanitarianImpactAssertionClaim;

export type HumanitarianObservation = DomainObservation<HumanitarianClaim>;

/* ═══════════════════════════════════════════════════════════════════════════
 * 5 · THE ONE ENTRY POINT
 * ═══════════════════════════════════════════════════════════════════════════
 * Humanitarian-specific invariants only. The spine is validated by
 * `assertDomainObservationIsWellFormed`, which a caller must also run; this function does not
 * duplicate it, because two copies of one check drift.
 */
export function assertHumanitarianClaimIsWellFormed(
  kind: string,
  claim: HumanitarianClaim,
): void {
  if ((HUMANITARIAN_OBSERVATION_KINDS as readonly string[]).indexOf(kind) === -1) {
    throw new HumanitarianRecordRefused(
      `HUM-K-1: '${kind}' is not a Humanitarian observation kind. The registry is closed.`,
    );
  }
  if (kind !== claim.claimType) {
    throw new HumanitarianRecordRefused(
      `HUM-K-2: observationKind '${kind}' and claimType '${claim.claimType}' disagree. ` +
        'A record whose kind and claim differ can be read two ways.',
    );
  }
  for (const iso of claim.countryIso3) {
    if (!/^[A-Z]{3}$/.test(iso)) {
      throw new HumanitarianRecordRefused(
        `HUM-C-1: '${iso}' is not an ISO3 code. Country scope is the source's, verbatim or absent.`,
      );
    }
  }
  if (claim.claimType === 'HUMANITARIAN_EVENT') {
    if (claim.sourceNativeType.trim().length === 0) {
      throw new HumanitarianRecordRefused(
        'HUM-E-1: the source-native hazard code is retained verbatim and is never empty — it ' +
          'is what makes the canonical mapping auditable after the fact.',
      );
    }
    if (claim.sourceTitle.trim().length === 0) {
      throw new HumanitarianRecordRefused('HUM-E-2: an event carries the source\'s own title.');
    }
    if (claim.originatingAgency !== undefined && claim.originatingAgency.trim().length === 0) {
      throw new HumanitarianRecordRefused(
        'HUM-E-3: an originating agency is named verbatim or absent — never an empty string.',
      );
    }
  }
  if (claim.claimType === 'HUMANITARIAN_IMPACT_ASSERTION') {
    if (claim.aboutEventKey.trim().length === 0) {
      throw new HumanitarianRecordRefused(
        'HUM-I-1: an impact assertion names the event it is about. An unattached figure is a ' +
          'number with no subject, and a reader would attach it to the nearest one.',
      );
    }
    const isCount =
      (HUMANITARIAN_IMPACT_MEASURES as readonly string[]).indexOf(claim.measure) !== -1;
    if (isCount) {
      if (typeof claim.value !== 'number' || !Number.isFinite(claim.value)) {
        throw new HumanitarianRecordRefused(
          `HUM-I-2: '${claim.measure}' is a count and its value must be a finite number.`,
        );
      }
      if (claim.value < 0) {
        throw new HumanitarianRecordRefused(`HUM-I-3: a count may not be negative.`);
      }
      if ((claim.unit ?? '').trim().length === 0) {
        throw new HumanitarianRecordRefused(
          `HUM-I-4: '${claim.measure}' is a count and states its unit. A bare number is not a ` +
            'quantity, and the unit is where "households" stops being read as "people".',
        );
      }
    } else {
      if (typeof claim.value !== 'string' || claim.value.trim().length === 0) {
        throw new HumanitarianRecordRefused(
          `HUM-I-5: '${claim.measure}' is a status measure and carries the source's own term.`,
        );
      }
    }
    if (claim.sourceBasisStatement.trim().length === 0) {
      throw new HumanitarianRecordRefused(
        'HUM-I-6: the assertion states the source sentence its basis was read from. Without it ' +
          'SOURCE_STATED vs SOURCE_ESTIMATED is our opinion of the source, not the source.',
      );
    }
  }
}

/**
 * Authorship rows an impact assertion must declare, so the asserted/estimated distinction is
 * carried on the platform's own axis rather than only in this claim's `basis` field.
 */
export function impactAuthorship(basis: ImpactAssertionBasis): readonly AttributeAuthorship[] {
  return Object.freeze([
    Object.freeze({
      attribute: 'value',
      authorship: basis === 'SOURCE_STATED' ? ('PUBLISHER_STATED' as const) : ('LOCALLY_ASSERTED' as const),
    }),
  ]);
}

/** Identity for a Humanitarian observation. `domainId` is never a caller's choice. */
export function humanitarianIdentity(
  upstreamAuthority: string,
  upstreamId: string,
): DomainObservationIdentity {
  return Object.freeze({ domainId: HUMANITARIAN_DOMAIN_ID, upstreamAuthority, upstreamId });
}

/** Re-exported by reference so the provenance model is provably one model, not two. */
export type { SourceProvenance };
