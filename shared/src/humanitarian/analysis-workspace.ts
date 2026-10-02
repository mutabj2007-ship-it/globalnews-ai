import { ClaimAssertionKind } from '../analysis';
import {
  ABSENCE_MUST_NOT_IMPLY,
  OBSERVATION_ABSENCE_FLOOR,
  ONLY_REASSURING_ABSENCE_STATE,
  type ObservationAbsenceState,
} from '../observation/absence';
import type { AttributeAuthorshipKind } from '../observation/domain-observation';
import {
  HUMANITARIAN_IMPACT_MEASURES,
  HUMANITARIAN_STATUS_MEASURES,
  type HumanitarianClaim,
  type HumanitarianImpactAssertionClaim,
  type HumanitarianImpactMeasure,
  type HumanitarianStatusMeasure,
} from './observation';
import type { HumanitarianRetainedRead, HumanitarianRetainedRecord } from './retained-read';

/**
 * PART X · HUMANITARIAN — THE ANALYSIS WORKSPACE SEMANTICS (R2).
 *
 * WHAT THIS IS. A pure projection from the ADMITTED retained Humanitarian read to the set
 * of dimensions a reader may be shown, where every carried claim names the records it came
 * from and every empty dimension names why it is empty. It is the semantics only: it
 * fetches nothing, acquires nothing, and carries no reader-facing string (that rule is
 * `observation/absence.ts`'s, and it is right).
 *
 * WHAT IT IS NOT. Not an analysis engine, not a prompt, not a retrieval, not a second
 * intelligence service. It never calls a model. The handoff to Ask is a SUBJECT, resolved
 * here from admitted records, that the one Ask engine turns into a turn.
 *
 * ── WHAT R2 CHANGED, AND WHY ──────────────────────────────────────────────
 *
 * R1 projected a Copernicus EMS geometry extent, because that was the only admitted record
 * in the tree. Three convergence rulings replaced that substrate and this file is corrected
 * against them rather than left to compile on top of them:
 *
 *   1. **Main's canonical record landed.** `HUMANITARIAN_EVENT`, `HUMANITARIAN_REPORT` and
 *      `HUMANITARIAN_IMPACT_ASSERTION` on the one `DomainObservation` spine. So the four
 *      dimensions R1 reported as having no substrate — impact, displacement, access and the
 *      sector statuses — DO have one now, and they are projected here measure by measure.
 *
 *   2. **`NO_RETAINED_EVIDENCE` is not an absence.** It is a fact about OUR STORE: it was
 *      queried and holds nothing. R1 mapped an empty input to `NOT_ASSESSED`, which is a
 *      different and larger claim ("nothing has been assessed"). An empty dimension now
 *      carries EITHER an absence OR the store state, never both and never one wearing the
 *      other's name — `assertWorkspaceIsWellFormed` enforces the exclusivity.
 *
 *   3. **No reader-facing geometry in R1 (C-3).** `HUM-READ-4` refuses a reader row that
 *      references governed geometry, so `WHERE` is now read from the source's own ISO3 scope
 *      at COUNTRY precision and from nothing else. R1's geometry claim is gone, and with it
 *      the possibility of a reader-facing polygon arriving through this surface.
 *
 * ── THE CLAIM LADDER, CORRECTED BY EVIDENCE ───────────────────────────────
 *
 * R1 declared `SOURCE_ASSERTION` and `ESTIMATE` unreachable, because the substrate carried
 * no speaker and no method. Main's impact assertion supplies both — `sourceBasisStatement`
 * is the source's own sentence and `basis` is read from it — so both are now REACHABLE, and
 * the admission table says so with a measured reason rather than being widened quietly.
 * `INTERPRETATION` remains unreachable: that is `analysis.ts`'s accepted ruling, not a
 * substrate limit, and no record will ever change it.
 */

/**
 * THE DIMENSIONS, IN READING ORDER.
 *
 * `WHAT_IS_UNKNOWN` is last and DERIVED: it is the roster of the dimensions that came back
 * empty, computed from the same projection as the known half. A hand-authored unknown list
 * is the first place a workspace starts lying, because it drifts.
 */
export const HUMANITARIAN_WORKSPACE_DIMENSIONS = [
  'WHAT_HAPPENED',
  'WHERE',
  'WHEN',
  'REPORTED_IMPACT',
  'DISPLACEMENT',
  'ACCESS_CONSTRAINTS',
  'SECTOR_CLAIMS',
  'SOURCE_DISAGREEMENT',
  'SOURCE_TIMELINE',
  'WHAT_IS_UNKNOWN',
] as const;

export type HumanitarianWorkspaceDimensionId = (typeof HUMANITARIAN_WORKSPACE_DIMENSIONS)[number];

/** The one derived dimension. Named so a guard asserts against a name, not a position. */
export const DERIVED_WORKSPACE_DIMENSION =
  'WHAT_IS_UNKNOWN' as const satisfies HumanitarianWorkspaceDimensionId;

/**
 * WHICH DIMENSION A MEASURE BELONGS TO — TOTAL, SO A NEW MEASURE CANNOT BE SILENTLY HOMED.
 *
 * Main's registry is closed and this table covers it exactly; `assertMeasureRoutingIsTotal`
 * fails if Main adds a member and nobody decides where it is read. Displacement has a
 * dimension of its own because the contract asks for it separately, and because a displaced
 * count read under "reported impact" loses the distinction the whole programme turns on.
 */
export const MEASURE_DIMENSION: Readonly<
  Record<HumanitarianImpactMeasure | HumanitarianStatusMeasure, HumanitarianWorkspaceDimensionId>
> = Object.freeze({
  PEOPLE_AFFECTED: 'REPORTED_IMPACT',
  FATALITIES: 'REPORTED_IMPACT',
  INJURED: 'REPORTED_IMPACT',
  PEOPLE_IN_NEED: 'REPORTED_IMPACT',
  HOUSES_DAMAGED: 'REPORTED_IMPACT',
  HOUSES_DESTROYED: 'REPORTED_IMPACT',
  PEOPLE_DISPLACED: 'DISPLACEMENT',
  SHELTER_STATUS: 'SECTOR_CLAIMS',
  HEALTH_STATUS: 'SECTOR_CLAIMS',
  FOOD_SECURITY_STATUS: 'SECTOR_CLAIMS',
  WATER_STATUS: 'SECTOR_CLAIMS',
  HUMANITARIAN_ACCESS_STATUS: 'ACCESS_CONSTRAINTS',
});

/**
 * THE CLAIM LADDER — FIVE LABELS, EACH WITH THE ADMISSION IT REQUIRES.
 *
 * `analysis.ts` rules: *"TWO KINDS, NOT THREE. An interpretive characterisation is not a
 * third kind of key fact."* So the five labels are a HUMANITARIAN reading ladder and each
 * one lands on the platform's two-kind axis or does not land at all. Nothing here widens
 * `ClaimAssertionKind`.
 */
export const HUMANITARIAN_CLAIM_CLASSES = [
  'FACT',
  'SOURCE_ASSERTION',
  'ESTIMATE',
  'INTERPRETATION',
  'UNKNOWN',
] as const;

export type HumanitarianClaimClass = (typeof HUMANITARIAN_CLAIM_CLASSES)[number];

/** The classes a claim may actually carry. The other two are states, not entries. */
export type CarriedClaimClass = Extract<
  HumanitarianClaimClass,
  'FACT' | 'SOURCE_ASSERTION' | 'ESTIMATE'
>;

export interface ClaimClassAdmission {
  /** What a record must carry before a claim of this class may be emitted. */
  readonly requires: string;
  /** Where the class lands in the accepted two-kind vocabulary, when it lands at all. */
  readonly assertsAs: ClaimAssertionKind | null;
  /**
   * FALSE means no code path here can produce it from the admitted read, and a test asserts
   * that. It is a measured statement about the substrate, not a preference — which is why
   * two of these flipped to true when Main's record landed.
   */
  readonly reachableFromRetainedEvidence: boolean;
}

export const CLAIM_CLASS_ADMISSION: Readonly<Record<HumanitarianClaimClass, ClaimClassAdmission>> =
  Object.freeze({
    FACT: {
      requires: "an attribute the publisher itself states, on the record's own authorship axis",
      assertsAs: 'FACT',
      reachableFromRetainedEvidence: true,
    },
    SOURCE_ASSERTION: {
      requires:
        "a figure the source stated, with the source's own sentence retained as its basis " +
        '(HUMANITARIAN_IMPACT_ASSERTION, basis SOURCE_STATED)',
      assertsAs: 'REPORTED_STATEMENT',
      /* R2: Main's `sourceBasisStatement` is the speaker's own sentence, which is the
         attribution R1 had no field for. Reachable now, and measured. */
      reachableFromRetainedEvidence: true,
    },
    ESTIMATE: {
      requires:
        'a figure the source presented as an estimate, with the stated basis retained ' +
        '(HUMANITARIAN_IMPACT_ASSERTION, basis SOURCE_ESTIMATED)',
      /* An estimate is still something a source SAID. Reporting that they estimated it is a
         reported statement; it is not the product asserting the figure. */
      assertsAs: 'REPORTED_STATEMENT',
      reachableFromRetainedEvidence: true,
    },
    INTERPRETATION: {
      requires: 'nothing — accepted authority excludes it from key facts entirely',
      assertsAs: null,
      reachableFromRetainedEvidence: false,
    },
    UNKNOWN: {
      requires: 'no record; it is the state of a dimension, never the class of a claim',
      assertsAs: null,
      reachableFromRetainedEvidence: false,
    },
  });

/** Read from the record's own `basis`. Never guessed from the value or the measure. */
export function claimClassForBasis(basis: 'SOURCE_STATED' | 'SOURCE_ESTIMATED'): CarriedClaimClass {
  return basis === 'SOURCE_STATED' ? 'SOURCE_ASSERTION' : 'ESTIMATE';
}

/**
 * ATTRIBUTES A *FACT* CLAIM MAY NEVER NAME.
 *
 * A figure reaches a reader only as an impact ASSERTION with a source, a basis and the
 * source's own sentence. It may never arrive as a fact stated in the product's voice. These
 * are the names that would do that, carried as data so a reviewer sees the list.
 */
export const WORKSPACE_FORBIDDEN_CLAIM_ATTRIBUTES: readonly string[] = Object.freeze([
  'population',
  'populationAffected',
  'affected',
  'displaced',
  'displacement',
  'deaths',
  'fatalities',
  'injured',
  'casualties',
  'severity',
  'confidence',
  'needLevel',
  'accessLevel',
]);

/**
 * WORDS AN EMPTY DIMENSION MAY NOT USE. `ABSENCE_MUST_NOT_IMPLY` is the shared floor;
 * Humanitarian adds the four that would turn silence into relief in this domain.
 */
export const WORKSPACE_MUST_NOT_IMPLY: readonly string[] = Object.freeze([
  ...ABSENCE_MUST_NOT_IMPLY,
  'no impact',
  'no displacement',
  'unaffected',
  'under control',
]);

export class HumanitarianWorkspaceRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HumanitarianWorkspaceRefused';
  }
}

/** A pointer back to the admitted record a claim came from. Never the record itself. */
export interface AdmittedRecordPointer {
  readonly observationKey: string;
  readonly captureKey: string;
  readonly providerId: string;
  /** The publisher's own vintage, when the record states one. */
  readonly publisherVintage: string | null;
  readonly retrievedAt: string;
}

export interface HumanitarianWorkspaceClaim {
  readonly claimClass: CarriedClaimClass;
  readonly assertion: ClaimAssertionKind;
  /** The attribute or measure the source stated — never a sentence, never our wording. */
  readonly attribute: string;
  readonly authorship: AttributeAuthorshipKind;
  /** Present only on an impact assertion: the stated figure, exactly as asserted. */
  readonly value: number | string | null;
  /** Required by Main for a count; absent for a status measure. */
  readonly unit: string | null;
  /** At least one. A claim with no pointer is refused, not rendered. */
  readonly records: readonly AdmittedRecordPointer[];
}

export const WORKSPACE_DIMENSION_STATES = ['CARRIED', 'EMPTY', 'DERIVED'] as const;
export type WorkspaceDimensionState = (typeof WORKSPACE_DIMENSION_STATES)[number];

/**
 * THE STORE STATE IS NOT AN ABSENCE, AND IT HAS ITS OWN FIELD FOR THAT REASON.
 *
 * `NO_RETAINED_EVIDENCE` is deliberately not a member of the seven-state absence authority,
 * so putting it in `absence` would be the exact collapse the CTO ruling forbids. An empty
 * dimension therefore sets exactly one of `absence` and `storeState`.
 */
export const WORKSPACE_STORE_STATES = ['NO_RETAINED_EVIDENCE'] as const;
export type WorkspaceStoreState = (typeof WORKSPACE_STORE_STATES)[number];

export interface HumanitarianWorkspaceDimension {
  readonly id: HumanitarianWorkspaceDimensionId;
  readonly state: WorkspaceDimensionState;
  /** Set on EMPTY when the read could not be answered. Never the reassuring member. */
  readonly absence: ObservationAbsenceState | null;
  /** Set on EMPTY when the store answered and holds nothing. Never an absence. */
  readonly storeState: WorkspaceStoreState | null;
  readonly claims: readonly HumanitarianWorkspaceClaim[];
  /** Present only on the DERIVED dimension: the ids that came back empty. */
  readonly derivedFrom: readonly HumanitarianWorkspaceDimensionId[];
}

export interface HumanitarianAnalysisWorkspace {
  readonly dimensions: readonly HumanitarianWorkspaceDimension[];
  /** Every admitted record the projection read, in `observationKey` order. */
  readonly records: readonly AdmittedRecordPointer[];
  /** Distinct `providerId` count. Source disagreement needs at least two sources. */
  readonly distinctProviders: number;
  /** The event keys the admitted records are about. The cross-domain seam reads these. */
  readonly eventKeys: readonly string[];
  readonly projectedAt: string;
}

const DIMENSION_FIELDS = ['absence', 'claims', 'derivedFrom', 'id', 'state', 'storeState'] as const;
const WORKSPACE_FIELDS = [
  'dimensions',
  'distinctProviders',
  'eventKeys',
  'projectedAt',
  'records',
] as const;

/** Fails if Main adds a measure and nobody decided which dimension reads it. */
export function assertMeasureRoutingIsTotal(): void {
  for (const measure of [...HUMANITARIAN_IMPACT_MEASURES, ...HUMANITARIAN_STATUS_MEASURES]) {
    if (MEASURE_DIMENSION[measure] === undefined) {
      throw new HumanitarianWorkspaceRefused(
        `HUM_WORKSPACE_MEASURE_UNROUTED: '${measure}' has no dimension. A measure with no home ` +
          'would be dropped from a reader view that looks complete.',
      );
    }
  }
}

function pointerFor(record: HumanitarianRetainedRecord): AdmittedRecordPointer {
  const { observation } = record;
  const providerId = observation.provenance.providerId ?? observation.identity.upstreamAuthority;
  return {
    observationKey: observation.observationKey,
    captureKey: record.captureKey,
    providerId,
    publisherVintage: observation.temporal.publisherVintage ?? null,
    retrievedAt: observation.temporal.retrievedAt,
  };
}

function factClaim(
  attribute: string,
  authorship: AttributeAuthorshipKind,
  records: readonly AdmittedRecordPointer[],
): HumanitarianWorkspaceClaim {
  if (WORKSPACE_FORBIDDEN_CLAIM_ATTRIBUTES.includes(attribute)) {
    throw new HumanitarianWorkspaceRefused(
      `HUM_WORKSPACE_FORBIDDEN_ATTRIBUTE: '${attribute}' may not be stated in the product's ` +
        'voice. A figure reaches a reader only as a sourced impact assertion.',
    );
  }
  if (records.length === 0) {
    throw new HumanitarianWorkspaceRefused(
      `HUM_WORKSPACE_CLAIM_WITHOUT_RECORD: '${attribute}' points at no admitted record.`,
    );
  }
  return {
    claimClass: 'FACT',
    assertion: 'FACT',
    attribute,
    authorship,
    value: null,
    unit: null,
    records,
  };
}

function assertionClaim(
  claim: HumanitarianImpactAssertionClaim,
  authorship: AttributeAuthorshipKind,
  pointer: AdmittedRecordPointer,
): HumanitarianWorkspaceClaim {
  const claimClass = claimClassForBasis(claim.basis);
  return {
    claimClass,
    assertion: 'REPORTED_STATEMENT',
    attribute: claim.measure,
    authorship,
    value: claim.value,
    unit: claim.unit ?? null,
    records: [pointer],
  };
}

function carried(
  id: HumanitarianWorkspaceDimensionId,
  claims: readonly HumanitarianWorkspaceClaim[],
): HumanitarianWorkspaceDimension {
  return { id, state: 'CARRIED', absence: null, storeState: null, claims, derivedFrom: [] };
}

function empty(
  id: HumanitarianWorkspaceDimensionId,
  reason:
    | { readonly absence: Exclude<ObservationAbsenceState, typeof ONLY_REASSURING_ABSENCE_STATE> }
    | { readonly storeState: WorkspaceStoreState },
): HumanitarianWorkspaceDimension {
  return {
    id,
    state: 'EMPTY',
    absence: 'absence' in reason ? reason.absence : null,
    storeState: 'storeState' in reason ? reason.storeState : null,
    claims: [],
    derivedFrom: [],
  };
}

/** The record's own authorship for an attribute, read rather than assumed. */
function authorshipFor(
  record: HumanitarianRetainedRecord,
  attribute: string,
): AttributeAuthorshipKind | null {
  const entry = record.observation.attributeAuthorship.find((a) => a.attribute === attribute);
  return entry === undefined ? null : entry.authorship;
}

function derivedUnknown(
  dimensions: readonly HumanitarianWorkspaceDimension[],
): HumanitarianWorkspaceDimension {
  return {
    id: DERIVED_WORKSPACE_DIMENSION,
    state: 'DERIVED',
    absence: null,
    storeState: null,
    claims: [],
    derivedFrom: dimensions.filter((d) => d.state === 'EMPTY').map((d) => d.id),
  };
}

function allEmpty(
  reason:
    | { readonly absence: Exclude<ObservationAbsenceState, typeof ONLY_REASSURING_ABSENCE_STATE> }
    | { readonly storeState: WorkspaceStoreState },
  projectedAt: string,
): HumanitarianAnalysisWorkspace {
  const emptied = HUMANITARIAN_WORKSPACE_DIMENSIONS.filter(
    (id) => id !== DERIVED_WORKSPACE_DIMENSION,
  ).map((id) => empty(id, reason));
  return {
    dimensions: [...emptied, derivedUnknown(emptied)],
    records: [],
    distinctProviders: 0,
    eventKeys: [],
    projectedAt,
  };
}

/**
 * THE READ-AWARE ENTRY POINT — the one the surfaces use.
 *
 * It exists because the three read kinds are three different statements and the workspace
 * must repeat the right one. `UNAVAILABLE` carries the reader absence it was given;
 * `NO_RETAINED_EVIDENCE` carries the store state and NOT an absence; `RETAINED` projects.
 */
export function projectWorkspaceFromRead(
  read: HumanitarianRetainedRead,
  projectedAt: string,
): HumanitarianAnalysisWorkspace {
  if (read.kind === 'UNAVAILABLE') return allEmpty({ absence: read.absence }, projectedAt);
  if (read.kind === 'NO_RETAINED_EVIDENCE') {
    return allEmpty({ storeState: 'NO_RETAINED_EVIDENCE' }, projectedAt);
  }
  return projectHumanitarianWorkspace(read.observations, projectedAt);
}

/**
 * THE PROJECTION over admitted records.
 *
 * Deterministic, total, ordered by `observationKey` so two runs over one set agree.
 * `projectedAt` is passed in; nothing here reads a clock.
 *
 * An empty record list reaching THIS function means the caller had rows and none survived,
 * which is the store-empty statement — never `NOT_ASSESSED`.
 */
export function projectHumanitarianWorkspace(
  records: readonly HumanitarianRetainedRecord[],
  projectedAt: string,
): HumanitarianAnalysisWorkspace {
  assertMeasureRoutingIsTotal();

  const ordered = [...records].sort((a, b) =>
    a.observation.observationKey < b.observation.observationKey
      ? -1
      : a.observation.observationKey > b.observation.observationKey
        ? 1
        : 0,
  );
  if (ordered.length === 0) {
    return allEmpty({ storeState: 'NO_RETAINED_EVIDENCE' }, projectedAt);
  }

  const pointers = ordered.map(pointerFor);
  const distinctProviders = new Set(pointers.map((p) => p.providerId)).size;

  const events: HumanitarianWorkspaceClaim[] = [];
  const where: HumanitarianWorkspaceClaim[] = [];
  const when: HumanitarianWorkspaceClaim[] = [];
  const timeline: HumanitarianWorkspaceClaim[] = [];
  const byDimension = new Map<HumanitarianWorkspaceDimensionId, HumanitarianWorkspaceClaim[]>();
  const assertionsByMeasure = new Map<string, HumanitarianWorkspaceClaim[]>();
  const eventKeys = new Set<string>();

  for (const record of ordered) {
    const pointer = pointerFor(record);
    const claim = record.observation.claim as HumanitarianClaim;

    for (const iso of claim.countryIso3) {
      /* COUNTRY precision and nothing finer. The reader row cannot carry geometry (HUM-READ-4),
         so there is no path from here to a point, a centroid or a polygon. */
      where.push(factClaim(`countryIso3:${iso}`, 'PUBLISHER_STATED', [pointer]));
    }
    when.push(
      factClaim(`temporalBasis:${record.observation.temporal.temporalBasis}`, 'PUBLISHER_STATED', [
        pointer,
      ]),
    );

    if (claim.claimType === 'HUMANITARIAN_EVENT') {
      eventKeys.add(record.observation.observationKey);
      events.push(factClaim(`hazardType:${claim.hazardType}`, 'PUBLISHER_STATED', [pointer]));
      events.push(factClaim(`eventStatus:${claim.eventStatus}`, 'PUBLISHER_STATED', [pointer]));
    }

    if (claim.claimType === 'HUMANITARIAN_REPORT') {
      for (const key of claim.aboutEventKeys) eventKeys.add(key);
      timeline.push(
        factClaim(`report:${record.observation.revision.revisionOrdinal}`, 'PUBLISHER_STATED', [
          pointer,
        ]),
      );
    }

    if (claim.claimType === 'HUMANITARIAN_IMPACT_ASSERTION') {
      eventKeys.add(claim.aboutEventKey);
      const dimension = MEASURE_DIMENSION[claim.measure];
      if (dimension === undefined) {
        throw new HumanitarianWorkspaceRefused(
          `HUM_WORKSPACE_MEASURE_UNROUTED: '${claim.measure}'.`,
        );
      }
      /* Authorship comes from the record. Main writes it from `basis` via `impactAuthorship`;
         reading it back rather than re-deriving keeps one authority for the distinction. */
      const authorship = authorshipFor(record, 'value') ?? 'PUBLISHER_STATED';
      const projected = assertionClaim(claim, authorship, pointer);
      const bucket = byDimension.get(dimension) ?? [];
      bucket.push(projected);
      byDimension.set(dimension, bucket);

      /* Disagreement is a relation between assertions about ONE event and ONE measure. */
      const key = `${claim.aboutEventKey}\u0000${claim.measure}`;
      const group = assertionsByMeasure.get(key) ?? [];
      group.push(projected);
      assertionsByMeasure.set(key, group);
    }
  }

  const disagreeing: HumanitarianWorkspaceClaim[] = [];
  for (const group of assertionsByMeasure.values()) {
    const values = new Set(group.map((c) => String(c.value)));
    /* TWO OR MORE DIFFERENT STATED VALUES FOR ONE MEASURE ON ONE EVENT. Both are carried,
       side by side, with their own sources. Nothing is reconciled, averaged, ranged or
       preferred — `assertNoReconciliation` proves the absence of that code path. */
    if (values.size >= 2) disagreeing.push(...group);
  }

  const substantive: HumanitarianWorkspaceDimension[] = [];
  substantive.push(
    events.length > 0
      ? carried('WHAT_HAPPENED', events)
      : /* Reports or figures with no admitted event record: the store answered, and it holds
           no hazard occurrence for this scope. */
        empty('WHAT_HAPPENED', { storeState: 'NO_RETAINED_EVIDENCE' }),
  );
  substantive.push(
    where.length > 0
      ? carried('WHERE', where)
      : /* Something exists and its place is not displayable here — the source scoped no
           country and governed geometry never reaches a reader in R1. */
        empty('WHERE', { absence: 'EVIDENCE_WITHHELD' }),
  );
  substantive.push(carried('WHEN', when));

  for (const id of [
    'REPORTED_IMPACT',
    'DISPLACEMENT',
    'ACCESS_CONSTRAINTS',
    'SECTOR_CLAIMS',
  ] as const) {
    const claims = byDimension.get(id) ?? [];
    substantive.push(
      claims.length > 0
        ? carried(id, claims)
        : /* No source asserted this measure. NOT zero, NOT nothing-happened: no admitted
             assertion exists, which is a statement about the record set. */
          empty(id, { storeState: 'NO_RETAINED_EVIDENCE' }),
    );
  }

  substantive.push(
    disagreeing.length > 0
      ? carried('SOURCE_DISAGREEMENT', disagreeing)
      : empty('SOURCE_DISAGREEMENT', {
          /* With one source, disagreement is not establishable — which is not the same as
             agreement, and is never rendered as corroboration. */
          absence: distinctProviders < 2 ? 'COVERAGE_GAP' : 'NO_QUALIFYING_EVIDENCE',
        }),
  );
  substantive.push(
    timeline.length > 0
      ? carried('SOURCE_TIMELINE', timeline)
      : empty('SOURCE_TIMELINE', { storeState: 'NO_RETAINED_EVIDENCE' }),
  );

  const byId = new Map(substantive.map((d) => [d.id, d] as const));
  const inOrder = HUMANITARIAN_WORKSPACE_DIMENSIONS.filter(
    (id) => id !== DERIVED_WORKSPACE_DIMENSION,
  ).map((id) => {
    const found = byId.get(id);
    if (found === undefined) {
      throw new HumanitarianWorkspaceRefused(`HUM_WORKSPACE_DIMENSION_MISSING: '${id}'.`);
    }
    return found;
  });

  return {
    dimensions: [...inOrder, derivedUnknown(inOrder)],
    records: pointers,
    distinctProviders,
    eventKeys: [...eventKeys].sort(),
    projectedAt,
  };
}

/**
 * CLOSURE. Field sets exact in both directions, so neither a new field nor a dropped one
 * reaches a reader unreviewed — the shape `assertReaderProjectionIsClosed` uses, for the
 * same reason.
 */
export function assertWorkspaceIsWellFormed(workspace: HumanitarianAnalysisWorkspace): void {
  const workspaceFields = Object.keys(workspace).sort().join(',');
  if (workspaceFields !== WORKSPACE_FIELDS.join(',')) {
    throw new HumanitarianWorkspaceRefused(
      `HUM_WORKSPACE_FIELD_SET_OPEN: got [${workspaceFields}], expected [${WORKSPACE_FIELDS.join(',')}].`,
    );
  }
  const seen = new Set<HumanitarianWorkspaceDimensionId>();
  for (const dimension of workspace.dimensions) {
    const fields = Object.keys(dimension).sort().join(',');
    if (fields !== DIMENSION_FIELDS.join(',')) {
      throw new HumanitarianWorkspaceRefused(
        `HUM_WORKSPACE_DIMENSION_FIELD_SET_OPEN: '${dimension.id}' got [${fields}], expected [${DIMENSION_FIELDS.join(',')}].`,
      );
    }
    if (seen.has(dimension.id)) {
      throw new HumanitarianWorkspaceRefused(
        `HUM_WORKSPACE_DIMENSION_REPEATED: '${dimension.id}'.`,
      );
    }
    seen.add(dimension.id);

    if (dimension.state === 'EMPTY') {
      const hasAbsence = dimension.absence !== null;
      const hasStore = dimension.storeState !== null;
      if (hasAbsence === hasStore) {
        throw new HumanitarianWorkspaceRefused(
          `HUM_WORKSPACE_EMPTY_REASON_AMBIGUOUS: '${dimension.id}' must name exactly one of an ` +
            'absence or the store state. NO_RETAINED_EVIDENCE is a fact about our store and ' +
            'NOT_ASSESSED is a fact about our assessment; they are never interchangeable.',
        );
      }
      if (dimension.absence === ONLY_REASSURING_ABSENCE_STATE) {
        throw new HumanitarianWorkspaceRefused(
          `HUM_WORKSPACE_ABSENCE_REASSURES: '${dimension.id}' claims a positive finding this ` +
            'substrate cannot admit.',
        );
      }
      if (dimension.claims.length > 0) {
        throw new HumanitarianWorkspaceRefused(
          `HUM_WORKSPACE_EMPTY_CARRIES_CLAIMS: '${dimension.id}'.`,
        );
      }
    } else if (dimension.absence !== null || dimension.storeState !== null) {
      throw new HumanitarianWorkspaceRefused(
        `HUM_WORKSPACE_REASON_ON_NON_EMPTY: '${dimension.id}' is '${dimension.state}' and names a reason.`,
      );
    }

    if (dimension.state === 'CARRIED' && dimension.claims.length === 0) {
      throw new HumanitarianWorkspaceRefused(
        `HUM_WORKSPACE_CARRIED_WITHOUT_CLAIM: '${dimension.id}'.`,
      );
    }

    const shouldBeDerived = dimension.id === DERIVED_WORKSPACE_DIMENSION;
    if (shouldBeDerived !== (dimension.state === 'DERIVED')) {
      throw new HumanitarianWorkspaceRefused(
        `HUM_WORKSPACE_DERIVATION_MISPLACED: '${dimension.id}' is state '${dimension.state}'.`,
      );
    }
    if (!shouldBeDerived && dimension.derivedFrom.length > 0) {
      throw new HumanitarianWorkspaceRefused(
        `HUM_WORKSPACE_DERIVATION_MISPLACED: '${dimension.id}' carries a derivation.`,
      );
    }

    for (const claim of dimension.claims) {
      if (claim.records.length === 0) {
        throw new HumanitarianWorkspaceRefused(
          `HUM_WORKSPACE_CLAIM_WITHOUT_RECORD: '${dimension.id}'.`,
        );
      }
      const admission = CLAIM_CLASS_ADMISSION[claim.claimClass];
      if (admission.assertsAs === null || admission.assertsAs !== claim.assertion) {
        throw new HumanitarianWorkspaceRefused(
          `HUM_WORKSPACE_CLAIM_CLASS_UNADMITTED: '${claim.claimClass}' may not assert as '${claim.assertion}'.`,
        );
      }
      if (!admission.reachableFromRetainedEvidence) {
        throw new HumanitarianWorkspaceRefused(
          `HUM_WORKSPACE_CLAIM_CLASS_UNREACHABLE: '${claim.claimClass}' has no admission.`,
        );
      }
      /* A FACT carries no figure, and a figure carries a source. Both directions. */
      if (claim.claimClass === 'FACT' && claim.value !== null) {
        throw new HumanitarianWorkspaceRefused(
          `HUM_WORKSPACE_FACT_CARRIES_FIGURE: '${claim.attribute}' states a value in the ` +
            "product's voice. A figure reaches a reader only as a sourced assertion.",
        );
      }
      if (claim.claimClass !== 'FACT' && claim.value === null) {
        throw new HumanitarianWorkspaceRefused(
          `HUM_WORKSPACE_ASSERTION_WITHOUT_VALUE: '${claim.attribute}'.`,
        );
      }
    }
  }
  const missing = HUMANITARIAN_WORKSPACE_DIMENSIONS.filter((id) => !seen.has(id));
  if (missing.length > 0) {
    throw new HumanitarianWorkspaceRefused(
      `HUM_WORKSPACE_DIMENSION_MISSING: [${missing.join(',')}].`,
    );
  }
}

/**
 * DISAGREEMENT IS PRESERVED, NEVER RESOLVED.
 *
 * Asserts that every claim in SOURCE_DISAGREEMENT is still present in the dimension its
 * measure routes to, with its own value and its own record. A workspace that moved a
 * disputed figure into a single "agreed" row would pass every other check here.
 */
export function assertDisagreementIsPreserved(workspace: HumanitarianAnalysisWorkspace): void {
  const dispute = workspace.dimensions.find((d) => d.id === 'SOURCE_DISAGREEMENT');
  if (dispute === undefined || dispute.state !== 'CARRIED') return;
  for (const claim of dispute.claims) {
    const home = MEASURE_DIMENSION[claim.attribute as HumanitarianImpactMeasure];
    const target = workspace.dimensions.find((d) => d.id === home);
    const stillThere = (target?.claims ?? []).some(
      (c) =>
        c.attribute === claim.attribute &&
        String(c.value) === String(claim.value) &&
        c.records[0]?.observationKey === claim.records[0]?.observationKey,
    );
    if (!stillThere) {
      throw new HumanitarianWorkspaceRefused(
        `HUM_WORKSPACE_DISAGREEMENT_RESOLVED: '${claim.attribute}' = '${String(claim.value)}' is in ` +
          'the disagreement set but no longer in its own dimension. A disputed figure may not be ' +
          'collapsed into one row.',
      );
    }
  }
}

/**
 * Reader text written for an empty dimension must not imply the world is fine. The check is
 * on the TEXT, so it holds for any locale a domain authors.
 */
export function assertNoNarrativeFiller(text: string, where: string): void {
  const haystack = text.toLowerCase();
  for (const forbidden of WORKSPACE_MUST_NOT_IMPLY) {
    if (haystack.includes(forbidden)) {
      throw new HumanitarianWorkspaceRefused(
        `HUM_WORKSPACE_ABSENCE_REASSURES: ${where} contains '${forbidden}'. Source absence is not reassurance.`,
      );
    }
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   THE ASK HANDOFF — A SUBJECT, NOT A PROMPT.
   ──────────────────────────────────────────────────────────────────────────── */

export const ASK_HANDOFF_REFUSALS = ['NO_ADMITTED_RECORD', 'NO_STATED_SUBJECT'] as const;
export type AskHandoffRefusal = (typeof ASK_HANDOFF_REFUSALS)[number];

export interface AskHandoffUnavailable {
  readonly available: false;
  readonly refusal: AskHandoffRefusal;
}

export interface AskHandoffSubject {
  readonly available: true;
  /** The publisher-stated hazard types, de-duplicated and ordered. Never prose. */
  readonly observationKinds: readonly string[];
  /** The records the one Ask engine may cite. Identifiers only. */
  readonly records: readonly AdmittedRecordPointer[];
}

export type HumanitarianAskHandoff = AskHandoffUnavailable | AskHandoffSubject;

/**
 * WHY THIS RETURNS A SUBJECT AND NOT A QUESTION.
 *
 * Ask V2's public turn DTO is four fields — `idempotencyKey, question, language, intent` —
 * and an exact-equality test freezes that list, so a humanitarian context cannot travel as a
 * fifth field and must not try. Ask V2 resolves scope server-side from the question text,
 * which is the seam this uses: the surface composes the reader's question in the reader's
 * own language from the SUBJECT below, and the one Ask engine does the rest. Nothing here
 * builds a prompt, and nothing here computes.
 *
 * With no admitted record the handoff is UNAVAILABLE with a reason. It does not degrade into
 * a general question about the region, because a question composed from nothing would arrive
 * at Ask as if a situation had been established.
 */
export function humanitarianAskHandoff(
  workspace: HumanitarianAnalysisWorkspace,
): HumanitarianAskHandoff {
  if (workspace.records.length === 0) {
    return { available: false, refusal: 'NO_ADMITTED_RECORD' };
  }
  const subject = workspace.dimensions.find((d) => d.id === 'WHAT_HAPPENED');
  if (subject === undefined || subject.state !== 'CARRIED') {
    return { available: false, refusal: 'NO_STATED_SUBJECT' };
  }
  const observationKinds = [
    ...new Set(
      subject.claims
        .filter((c) => c.attribute.startsWith('hazardType:'))
        .map((c) => c.attribute.slice('hazardType:'.length)),
    ),
  ].sort();
  if (observationKinds.length === 0) {
    return { available: false, refusal: 'NO_STATED_SUBJECT' };
  }
  return { available: true, observationKinds, records: workspace.records };
}
