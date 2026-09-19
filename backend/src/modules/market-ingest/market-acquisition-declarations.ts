/**
 * MARKET ACQUISITION DECLARATIONS — ISOLATED CANDIDATE
 *
 * G-MARKET-DATA-ACQUISITION-R2
 *
 * STATUS: INTEGRATED at ALPHA-MARKET-SCHEDULED-INGEST-PLATFORM-R1, per G's own
 * INTEGRATION-INSTRUCTIONS §1. The five mirrors G marked for deletion ARE DELETED and
 * replaced by the real imports below. Nothing here is a second contract, and now nothing
 * here is a copy of one either.
 *
 * WHAT DID NOT CHANGE: every declaration, every number, every justification and every
 * predicate body. G's 23 tests pass unchanged against this file — which is the check that
 * the mirrors were faithful, and the only reason they were safe to write.
 *
 * `RIGHTS_RECORDS`, `CADENCE_DECLARATIONS` and `RATE_DECLARATIONS` stay HERE and were not
 * moved into `shared/`, per the same instruction: they are provider-specific acquisition
 * semantics, which Main's ownership matrix assigns to G. Shared scheduling machinery is
 * Main's, and these are not it.
 *
 * It is `MAIN-MARKET-LINEAGE-SCHEDULED-INGEST-R1` §06 step 3.1, and only that:
 * cadence declarations, rate and concurrency declarations, rights records, and the
 * adapter seam. NO adapter implementation, NO fetch, NO activation.
 *
 * Every number below is either a publisher's own published figure or an accepted
 * in-tree constant, and each is attributed at the point of declaration.
 */

import {
  PROCUREMENT_MERGE_AUTHORITIES,
  UNIT_AUTHORSHIP_KINDS,
  VINTAGE_PROVENANCE_KINDS,
  seamDeclarationIsHonest,
  type EconomyCadence,
  type ProcurementMergeAuthority,
  type StructuredObservationSeamDeclaration,
  type UnitAuthorshipKind,
  type VintageProvenanceKind,
} from '@globalnews-ai/shared';

export {
  PROCUREMENT_MERGE_AUTHORITIES,
  UNIT_AUTHORSHIP_KINDS,
  VINTAGE_PROVENANCE_KINDS,
  seamDeclarationIsHonest,
  type ProcurementMergeAuthority,
  type StructuredObservationSeamDeclaration,
  type UnitAuthorshipKind,
  type VintageProvenanceKind,
};

/* ══════════════════════════════════════════════════════════════════════════
 * THE MIRRORS ARE GONE — see the imports at the top of this file.
 *
 * `VINTAGE_PROVENANCE_KINDS`, `UNIT_AUTHORSHIP_KINDS`,
 * `StructuredObservationSeamDeclaration`, `seamDeclarationIsHonest`,
 * `PROCUREMENT_MERGE_AUTHORITIES` and `ProcurementMergeAuthority` now come from
 * `shared/src/market/index.ts` — the accepted C51 contract, landed in this lineage at
 * ALPHA-MARKET-CANONICAL-LANDING-R1. They are re-exported above so every consumer of this
 * module keeps the import path G's tests were written against.
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * THE CADENCE VOCABULARY IS THE ECONOMY ONE, AND THIS IS HOW THAT IS ENFORCED.
 *
 * `CadenceKind` is now an ALIAS of the shared `EconomyCadence`, so there is genuinely no
 * second cadence vocabulary — a member added to one is added to both, and a member removed
 * from the shared type stops compiling here.
 *
 * The const array stays local because the accepted Economy contract ships the TYPE and no
 * runtime array, and `CADENCE_ORDER` below needs values. `CADENCE_KINDS` is therefore typed
 * as the shared union and pinned by the two exhaustiveness checks beneath it: if the shared
 * vocabulary gains or loses a member and this array does not follow, the file fails to
 * compile rather than drifting quietly.
 */
export type CadenceKind = EconomyCadence;

export const CADENCE_KINDS = [
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'ANNUAL',
  'IRREGULAR',
] as const satisfies readonly CadenceKind[];

/** Every member of this array is a shared cadence — fails to compile if one is invented. */
type _CadenceKindsAreAllShared = (typeof CADENCE_KINDS)[number] extends CadenceKind ? true : never;
/** Every shared cadence is in this array — fails to compile if one is missing. */
type _CadenceKindsAreExhaustive = CadenceKind extends (typeof CADENCE_KINDS)[number] ? true : never;
const _cadenceVocabularyIsShared: [_CadenceKindsAreAllShared, _CadenceKindsAreExhaustive] = [
  true,
  true,
];
void _cadenceVocabularyIsShared;

/**
 * SI-16.2, closed set.
 *
 * KEPT LOCAL DELIBERATELY. This is scheduler vocabulary, which Main's ownership matrix
 * assigns to Main — but Main's D-10 package ships it as a contract clause and not as a
 * shared module, and promoting it into `shared/` from this lane would be inventing a
 * contract Main did not write. It lives here, and moving it is Main's call.
 */
export const RUN_OUTCOMES = [
  'SUCCEEDED',
  'NO_NEW_DATA',
  'DEFERRED',
  'TIMED_OUT',
  'TRANSPORT_FAILED',
  'VALIDATION_FAILED',
  'RIGHTS_REFUSED',
  'PROVIDER_DISABLED',
  'CIRCUIT_OPEN',
] as const;
export type RunOutcome = (typeof RUN_OUTCOMES)[number];

/**
 * The one refusal type this lane raises. Not a mirror — G authored it, and the accepted
 * contracts carry no equivalent.
 */
export class AcquisitionRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AcquisitionRefusal';
  }
}

/* ══════════════════════════════════════════════════════════════════════════
 * 1 · RIGHTS RECORDS — SI-17
 *
 * "A source cannot be activated on a rights position the code cannot see."
 * The rights state lives here as data, with its citable instrument, because
 * SI-17.4 makes a state without an instrument not a state.
 * ══════════════════════════════════════════════════════════════════════════ */

export type RightsClass = 'E-1' | 'E-2a' | 'E-2b' | 'E-3' | 'E-4' | 'E-5';

export interface RightsRecord {
  readonly providerId: string;
  readonly rightsClass: RightsClass;
  /** SI-17.4 — the citable text or URL the class rests on. Empty is not a record. */
  readonly instrument: string;
  /**
   * SI-17.5 — conditions that constrain THE PRODUCT, not the fetch. The ingest layer
   * stores them and does not discharge them.
   */
  readonly productConditions: readonly string[];
  /** True only where the publisher retains prior readings. Feeds `seamDeclarationIsHonest`. */
  readonly publisherRetainsHistory: boolean;
}

export const RIGHTS_RECORDS: Readonly<Record<string, RightsRecord>> = {
  TED: {
    providerId: 'TED',
    rightsClass: 'E-5',
    instrument:
      'Commission Decision 2011/833/EU on the reuse of Commission documents. Read in G-MARKET-SOURCE-1; commercial reuse permitted.',
    productConditions: [
      'SIMAP editorial content is a THIRD regime (CC BY 4.0) and must be distinguished at ingestion, not at display.',
    ],
    publisherRetainsHistory: true,
  },
  GLEIF: {
    providerId: 'GLEIF',
    rightsClass: 'E-5',
    instrument:
      'CC0 1.0 Universal on the LEI data, plus GLEIF’s access conduct clause. Read in G-MARKET-GLEIF-INGESTION-CONTRACT-1 §3.2.',
    productConditions: [
      'Attribution is not required under CC0 and is given regardless.',
      'The conduct clause governs ACCESS, not the data; it survives the CC0 grant.',
    ],
    publisherRetainsHistory: false,
  },
  EUROSTAT: {
    providerId: 'EUROSTAT',
    rightsClass: 'E-5',
    instrument:
      'Eurostat reuse policy: commercial reuse permitted with attribution to Eurostat. Read across G-BETA-DATA-ACQUISITION-R2 and G-ECONOMY-ADAPTER-CONTRACTS-R4.',
    productConditions: [
      'Data on non-EU/EFTA countries is EXCLUDED from the grant and must be excluded structurally, not documented.',
      'Comext carve-outs apply and key on `reporter`.',
      'Eurostat does not version past data, so SI-10.4 snapshot retention is MANDATORY for every cited figure.',
    ],
    publisherRetainsHistory: false,
  },
  WORLD_BANK: {
    providerId: 'WORLD_BANK',
    rightsClass: 'E-3',
    instrument:
      'World Bank API terms read verbatim in G-BETA-DATA-ACQUISITION-R2: "you may not in any event use the APIs to facilitate commercial uses of the Materials". The dataset terms that would override could not be read (robots). CONFLICT MKT-C1 is a Product Owner ruling and is NOT resolved here.',
    productConditions: [],
    publisherRetainsHistory: false,
  },
  ECB: {
    providerId: 'ECB',
    rightsClass: 'E-2a',
    instrument:
      'Licence self-contradiction unresolved (ESCB policy forbids modification; the site disclaimer permits declared modification). Transport separately unverified (robots 503). CONFLICT MKT-C2 is a Product Owner + legal ruling and is NOT resolved here.',
    productConditions: [],
    publisherRetainsHistory: true,
  },
};

/**
 * SI-17.2 and SI-17.3, as a function rather than a paragraph.
 *
 * An absent record is a REFUSAL, not a permission — "no terms found" is not permission,
 * and that invariant is applied here in code rather than in prose.
 */
export function assertProviderRightsPermitRunning(providerId: string): RightsRecord {
  const record = RIGHTS_RECORDS[providerId];
  if (record === undefined) {
    throw new AcquisitionRefusal(
      `RIGHTS_REFUSED: no rights record for '${providerId}'. Absence of a rights record is a refusal, not a permission`,
    );
  }
  if (record.instrument.trim().length === 0) {
    throw new AcquisitionRefusal(
      `RIGHTS_REFUSED: '${providerId}' has a rights class with no instrument; a rights state with no instrument is not a rights state`,
    );
  }
  if (record.rightsClass !== 'E-5') {
    throw new AcquisitionRefusal(
      `RIGHTS_REFUSED: '${providerId}' is ${record.rightsClass}; only E-5 runs. Not a warning, not a dry run`,
    );
  }
  return record;
}

/* ══════════════════════════════════════════════════════════════════════════
 * 2 · CADENCE — SI-2
 * ══════════════════════════════════════════════════════════════════════════ */

export interface CadenceDeclaration {
  readonly providerId: string;
  readonly subjectClass: string;
  /** SI-2.2 — the publisher's OWN release cadence, as the publisher states it. */
  readonly publisherReleaseCadence: CadenceKind;
  /** What we will actually run. Must never be faster than the publisher's. */
  readonly declaredCadence: CadenceKind;
  /** SI-2.3 — required when either side is IRREGULAR. */
  readonly irregularCheckIntervalHours?: number;
  /** SI-2.5 — every provider firing on the hour is a self-inflicted thundering herd. */
  readonly jitterFraction: number;
  readonly justification: string;
  /** The best freshness this cadence can honestly claim. */
  readonly freshnessCeilingHours: number | null;
}

/** Coarser index = slower. Used only to compare two declared cadences. */
const CADENCE_ORDER: Readonly<Record<CadenceKind, number>> = {
  DAILY: 1,
  WEEKLY: 2,
  MONTHLY: 3,
  QUARTERLY: 4,
  ANNUAL: 5,
  IRREGULAR: 6,
};

/**
 * SI-2.2 — "Polling a monthly series hourly does not make it fresher; it makes it 730
 * requests against a rights position that permitted one."
 *
 * IRREGULAR is not comparable on the ladder: SI-2.3 says it means the publisher announces
 * no schedule, NOT "poll fast", so it is handled by requiring an explicit interval instead.
 */
export function assertCadenceIsNotFasterThanPublisher(d: CadenceDeclaration): void {
  if (d.publisherReleaseCadence === 'IRREGULAR') {
    if (d.irregularCheckIntervalHours === undefined) {
      throw new AcquisitionRefusal(
        `${d.providerId}/${d.subjectClass}: publisher cadence is IRREGULAR, which requires a declared check interval with its own justification (SI-2.3)`,
      );
    }
    return;
  }
  if (CADENCE_ORDER[d.declaredCadence] < CADENCE_ORDER[d.publisherReleaseCadence]) {
    throw new AcquisitionRefusal(
      `${d.providerId}/${d.subjectClass}: declared cadence ${d.declaredCadence} is faster than the publisher's ${d.publisherReleaseCadence} (SI-2.2)`,
    );
  }
}

export const CADENCE_DECLARATIONS: readonly CadenceDeclaration[] = [
  {
    providerId: 'TED',
    subjectClass: 'PROCUREMENT_OPPORTUNITY',
    publisherReleaseCadence: 'DAILY',
    declaredCadence: 'DAILY',
    jitterFraction: 0.1,
    justification:
      'TED publishes continuously and is the ONLY Market subject with a genuine freshness argument. Daily is the fastest cadence this lane declares for anything.',
    freshnessCeilingHours: 24,
  },
  {
    providerId: 'GLEIF',
    subjectClass: 'COMMERCIAL_ENTITY',
    publisherReleaseCadence: 'DAILY',
    declaredCadence: 'DAILY',
    jitterFraction: 0.1,
    justification:
      'GLEIF publishes Golden Copy bulk files 3x daily. Declared DAILY because the delta files are retained only 31 days, so falling behind by more than 31 days forces a full re-baseline. Freshness ceiling is 8 hours and LIVE IS UNREACHABLE and must not be implied.',
    freshnessCeilingHours: 8,
  },
  {
    providerId: 'EUROSTAT',
    subjectClass: 'INSTRUMENT',
    publisherReleaseCadence: 'MONTHLY',
    declaredCadence: 'MONTHLY',
    jitterFraction: 0.15,
    justification:
      'Sovereign yield series are monthly. Measured on the Economy lane: irt_lt_mcby_m UPDATE_DATA moves monthly.',
    freshnessCeilingHours: null,
  },
  {
    providerId: 'EUROSTAT',
    subjectClass: 'CORRIDOR',
    publisherReleaseCadence: 'MONTHLY',
    declaredCadence: 'MONTHLY',
    jitterFraction: 0.15,
    justification: 'Comext trade flows are monthly.',
    freshnessCeilingHours: null,
  },
  {
    providerId: 'EUROSTAT',
    subjectClass: 'SECTOR',
    publisherReleaseCadence: 'IRREGULAR',
    declaredCadence: 'IRREGULAR',
    irregularCheckIntervalHours: 24 * 30,
    jitterFraction: 0.2,
    justification:
      'NACE is reference data that changes on a published transition schedule, not a cadence. A monthly structural check is declared with its justification per SI-2.3; it is NOT a guess at a release rhythm.',
    freshnessCeilingHours: null,
  },
];

/* ══════════════════════════════════════════════════════════════════════════
 * 3 · RATE AND CONCURRENCY — SI-3, SI-13
 * ══════════════════════════════════════════════════════════════════════════ */

export interface RateDeclaration {
  readonly providerId: string;
  /** SI-3.2 — the publisher's published number, or lower. Never inferred, never rounded up. */
  readonly maxConcurrent: number;
  /** True only when the publisher published a concurrency figure. */
  readonly concurrencyIsPublished: boolean;
  /** SI-13.2 — the accepted in-tree precedent is 5_500 ms process-wide. */
  readonly minRequestSpacingMs: number;
  readonly publishedLimits: readonly string[];
  /** SI-5.1 — the accepted in-tree external-provider deadline. */
  readonly fetchTimeoutMs: number;
  /** SI-4.5 — the accepted in-tree cooldown. */
  readonly circuitCooldownMs: number;
  readonly acquisitionMode: 'BULK_FILE' | 'PAGED_API';
  readonly note: string;
}

/** SI-3.3 — "No stated limit" is not "no limit". The ceiling is 1. */
export const UNPUBLISHED_CONCURRENCY_CEILING = 1;

export const RATE_DECLARATIONS: Readonly<Record<string, RateDeclaration>> = {
  TED: {
    providerId: 'TED',
    maxConcurrent: 3,
    concurrencyIsPublished: true,
    minRequestSpacingMs: 5_500,
    publishedLimits: ['600 requests per 6 minutes per IP', '700 per minute', '3 concurrent'],
    fetchTimeoutMs: 8_000,
    circuitCooldownMs: 60_000,
    acquisitionMode: 'PAGED_API',
    note: 'The only Market candidate with published numeric limits. 3 is the publisher’s number and is the ceiling; nothing may configure 4.',
  },
  GLEIF: {
    providerId: 'GLEIF',
    maxConcurrent: 1,
    concurrencyIsPublished: false,
    minRequestSpacingMs: 5_500,
    publishedLimits: ['60 requests per minute per user (API)'],
    fetchTimeoutMs: 8_000,
    circuitCooldownMs: 60_000,
    acquisitionMode: 'BULK_FILE',
    note: 'GLEIF publishes a per-minute request limit but NO concurrency figure, so the ceiling is 1 per SI-3.3. Arithmetic that settles the acquisition mode: 60 req/min x 15 records per page = 900 records/minute, and against roughly 3.02m active LEIs a full API traverse is on the order of 56 hours of continuous polling. The producer MUST ingest by Golden Copy bulk file and MUST NOT traverse by API.',
  },
  EUROSTAT: {
    providerId: 'EUROSTAT',
    maxConcurrent: 1,
    concurrencyIsPublished: false,
    minRequestSpacingMs: 5_500,
    publishedLimits: [],
    fetchTimeoutMs: 8_000,
    circuitCooldownMs: 60_000,
    acquisitionMode: 'PAGED_API',
    note: 'Eurostat publishes no rate limit at all. Absence of a published limit is not permission to hammer it, so the ceiling is 1 per SI-3.3.',
  },
};

/** SI-3.2 / SI-3.3, as a check rather than a convention. */
export function assertConcurrencyIsLawful(d: RateDeclaration): void {
  if (!Number.isInteger(d.maxConcurrent) || d.maxConcurrent < 1) {
    throw new AcquisitionRefusal(`${d.providerId}: maxConcurrent must be a positive integer`);
  }
  if (!d.concurrencyIsPublished && d.maxConcurrent > UNPUBLISHED_CONCURRENCY_CEILING) {
    throw new AcquisitionRefusal(
      `${d.providerId}: no published concurrency figure, so the ceiling is ${UNPUBLISHED_CONCURRENCY_CEILING} (SI-3.3). "No stated limit" is not "no limit"`,
    );
  }
}

/* ══════════════════════════════════════════════════════════════════════════
 * 4 · THE SEAM DECLARATIONS
 * ══════════════════════════════════════════════════════════════════════════ */

export const SEAM_DECLARATIONS: Readonly<Record<string, StructuredObservationSeamDeclaration>> = {
  TED: {
    sourceId: 'TED',
    // A notice carries BT-757-notice, a version counter the publisher maintains, and BT-758
    // pointing at the notice it supersedes. That is the publisher saying when it changed,
    // not the publisher dating a reading.
    vintageProvenance: 'PUBLISHER_CHANGED_AT',
    unitAuthorship: 'PUBLISHER_STATED',
    sourceKeyDimensions: ['portalId', 'noticeId', 'noticeVersion'],
  },
  GLEIF: {
    sourceId: 'GLEIF',
    // `LastUpdateDate` is documented as "the date at which the information was most recently
    // updated". Changed-at, not a vintage.
    vintageProvenance: 'PUBLISHER_CHANGED_AT',
    unitAuthorship: 'PUBLISHER_STATED',
    sourceKeyDimensions: ['lei', 'lastUpdateDate'],
  },
  EUROSTAT: {
    sourceId: 'EUROSTAT',
    vintageProvenance: 'PUBLISHER_CHANGED_AT',
    unitAuthorship: 'PUBLISHER_STATED',
    // Comext keys on six parts whose `product` values are digit strings of mixed length and
    // whose `indicators` values contain underscores — the exact collision shape `eco:1` fixed.
    sourceKeyDimensions: ['freq', 'reporter', 'partner', 'product', 'flow', 'indicators'],
  },
};

/* ══════════════════════════════════════════════════════════════════════════
 * 5 · TED AND GLEIF STAY INDEPENDENT — C-15
 *
 * There is no function here that takes a procurement record and an entity record.
 * The prohibition is enforced by absence, and the absence is asserted by a test that
 * scans this module's own source.
 * ══════════════════════════════════════════════════════════════════════════ */

/*
  THE FOUR MERGE AUTHORITIES AND THE TWO NO-SCORER CONSTANTS COME FROM THE ACCEPTED
  CONTRACT NOW — imported and re-exported at the top of this file. G's mirror of them is
  deleted, which is the point of integration: there is one list of merge authorities in
  this product, it lives in `shared/src/market/index.ts`, and the C51 guard's 47 tests are
  written against that one.
*/
export { MARKET_DECLARES_NO_SCORER, PROCUREMENT_TO_COMPANY_JOIN } from '@globalnews-ai/shared';

/**
 * A merge is admissible only with a cited authority. There is deliberately no overload
 * that omits it, and no numeric argument anywhere in the signature.
 *
 * MEASURED, and why this is not merely cautious: TED carries NO LEI field (0 hits) and
 * BT-501 has no scheme attribute, so no deterministic TED-to-GLEIF join exists to cite.
 */
export function assertMergeIsAuthorised(authority: ProcurementMergeAuthority | undefined): void {
  if (authority === undefined) {
    throw new AcquisitionRefusal(
      'MERGE REFUSED: no deterministic merge authority cited. AI similarity alone is not sufficient authority to merge procurement records (C-15)',
    );
  }
  if (!PROCUREMENT_MERGE_AUTHORITIES.includes(authority)) {
    throw new AcquisitionRefusal(
      `MERGE REFUSED: '${authority}' is not one of the four named authorities`,
    );
  }
}
