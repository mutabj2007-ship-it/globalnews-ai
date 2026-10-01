import { ClaimAssertionKind } from '../analysis';
import {
  ABSENCE_MUST_NOT_IMPLY,
  OBSERVATION_ABSENCE_FLOOR,
  ONLY_REASSURING_ABSENCE_STATE,
  type ObservationAbsenceState,
} from '../observation/absence';
import type { AttributeAuthorshipKind, DomainObservation } from '../observation/domain-observation';

/**
 * PART X · HUMANITARIAN — THE ANALYSIS WORKSPACE SEMANTICS.
 *
 * WHAT THIS IS. A pure projection from ADMITTED retained evidence to the set of
 * dimensions a reader may be shown, where every carried claim names the records it
 * came from and every empty dimension names why it is empty. It is the semantics
 * only: it fetches nothing, acquires nothing, and carries no reader-facing string
 * (that rule is `observation/absence.ts`'s, and it is right).
 *
 * WHAT IT IS NOT. It is not an analysis engine, not a prompt, not a retrieval and not
 * a second intelligence service. It never calls a model. The handoff to Ask is a
 * SUBJECT, resolved here from admitted records, that the one Ask engine turns into a
 * turn — see `humanitarianAskHandoff`.
 *
 * THE RULE THE WHOLE FILE EXISTS TO ENFORCE. A dimension may be empty, and an empty
 * dimension is a RESULT. What it may never be is prose: there is no code path from
 * "no admitted record" to a sentence about the world. `assertNoNarrativeFiller` and
 * `WORKSPACE_FORBIDDEN_CLAIM_ATTRIBUTES` are the two guards, and they throw rather
 * than degrade, because a degraded guard is a guard a producer learns to live with.
 *
 * MEASURED PRECONDITION, STATED RATHER THAN WORKED AROUND. At this baseline the only
 * admitted humanitarian record is a Copernicus EMS inundation EXTENT — a geometry
 * claim. There is no population, displacement, severity, access or sector attribute
 * anywhere in the substrate, deliberately and by test. So most dimensions below are
 * STRUCTURALLY empty today, and their absence reason says `SOURCE_NOT_CONNECTED`
 * rather than anything a reader could mistake for a finding.
 */

/**
 * THE DIMENSIONS, IN READING ORDER.
 *
 * `WHAT_IS_UNKNOWN` is last and it is DERIVED: it is the roster of the dimensions
 * that came back empty, so the unknown half of the workspace is computed from the
 * same projection as the known half rather than authored beside it. A hand-authored
 * unknown list is the first place a workspace starts lying, because it drifts.
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
 * THE CLAIM LADDER — FIVE LABELS, AND ONLY ONE OF THEM IS REACHABLE TODAY.
 *
 * The contract asks for FACT / SOURCE_ASSERTION / ESTIMATE / INTERPRETATION / UNKNOWN
 * to be kept apart. Accepted authority already rules on two of those five:
 * `analysis.ts` states *"TWO KINDS, NOT THREE. An interpretive characterisation is not
 * a third kind of key fact — it is a kind that does not belong in key facts at all"*,
 * and the retained substrate carries no `value` and no `unit`, deliberately, so there
 * is nothing an ESTIMATE could be an estimate OF.
 *
 * Those two facts are not worked around and they are not quietly dropped. The five
 * labels are DECLARED, each with the admission it would require, and the two that
 * accepted authority forbids are declared UNREACHABLE and asserted unreachable by
 * test. A reader never sees a class this substrate cannot earn, and a future producer
 * that gains a stated method still has to come back here and change a named rule
 * rather than widening a type at a distance.
 */
export const HUMANITARIAN_CLAIM_CLASSES = [
  'FACT',
  'SOURCE_ASSERTION',
  'ESTIMATE',
  'INTERPRETATION',
  'UNKNOWN',
] as const;

export type HumanitarianClaimClass = (typeof HUMANITARIAN_CLAIM_CLASSES)[number];

export interface ClaimClassAdmission {
  /** What a record must carry before a claim of this class may be emitted. */
  readonly requires: string;
  /** Where the class lands in the accepted two-kind vocabulary, when it lands at all. */
  readonly assertsAs: ClaimAssertionKind | null;
  /**
   * FALSE means no code path in this module can produce it from admitted retained
   * evidence, and a test asserts that. It is a measured statement about the substrate,
   * not a preference.
   */
  readonly reachableFromRetainedEvidence: boolean;
}

export const CLAIM_CLASS_ADMISSION: Readonly<Record<HumanitarianClaimClass, ClaimClassAdmission>> =
  {
    FACT: {
      requires: 'an attribute the publisher itself states, carried as PUBLISHER_STATED authorship',
      assertsAs: 'FACT',
      reachableFromRetainedEvidence: true,
    },
    SOURCE_ASSERTION: {
      requires: 'an attributed statement with a named speaker, per StatementAttribution',
      assertsAs: 'REPORTED_STATEMENT',
      /* The retained record has no speaker field. A reported statement with no speaker is
       indistinguishable from a fact, which is the collapse `analysis.ts` exists to stop. */
      reachableFromRetainedEvidence: false,
    },
    ESTIMATE: {
      requires: 'a figure with a stated method and a stated basis',
      assertsAs: null,
      /* No `value`, no `unit`, by design. Nothing to estimate and no method to state. */
      reachableFromRetainedEvidence: false,
    },
    INTERPRETATION: {
      requires: 'nothing — accepted authority excludes it from key facts entirely',
      assertsAs: null,
      reachableFromRetainedEvidence: false,
    },
    UNKNOWN: {
      requires: 'no record; it is the state of a dimension, never the class of a claim',
      assertsAs: null,
      /* Reachable as a dimension state, never as an entry. `assertWorkspaceIsWellFormed`
       refuses a claim carrying it. */
      reachableFromRetainedEvidence: false,
    },
  };

/**
 * ATTRIBUTES A CLAIM MAY NEVER NAME.
 *
 * The admitter already proves a body carrying `severity`, `casualties` and `population`
 * is admitted with none of it surviving. This is the same refusal one layer out: if a
 * future projection reaches for one of these names, it throws here rather than reaching
 * a reader. Carried as data so a reviewer sees the list the contract is held to.
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
 * WORDS AN EMPTY DIMENSION MAY NOT USE.
 *
 * `ABSENCE_MUST_NOT_IMPLY` is the shared floor — normal, safe, stable, no outage, no
 * event. Humanitarian adds the four that would turn silence into relief in this domain
 * specifically. Source absence is not reassurance, and this is where that is enforced
 * rather than reviewed.
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
  readonly claimClass: Extract<HumanitarianClaimClass, 'FACT' | 'SOURCE_ASSERTION'>;
  readonly assertion: ClaimAssertionKind;
  /** The attribute the publisher stated — never a sentence, never a figure. */
  readonly attribute: string;
  readonly authorship: AttributeAuthorshipKind;
  /** At least one. A claim with no pointer is refused, not rendered. */
  readonly records: readonly AdmittedRecordPointer[];
}

export const WORKSPACE_DIMENSION_STATES = ['CARRIED', 'EMPTY', 'DERIVED'] as const;
export type WorkspaceDimensionState = (typeof WORKSPACE_DIMENSION_STATES)[number];

export interface HumanitarianWorkspaceDimension {
  readonly id: HumanitarianWorkspaceDimensionId;
  readonly state: WorkspaceDimensionState;
  /** Present on EMPTY, absent on CARRIED and DERIVED. Never the reassuring member. */
  readonly absence: ObservationAbsenceState | null;
  readonly claims: readonly HumanitarianWorkspaceClaim[];
  /** Present only on the DERIVED dimension: the ids that came back empty. */
  readonly derivedFrom: readonly HumanitarianWorkspaceDimensionId[];
}

export interface HumanitarianAnalysisWorkspace {
  readonly dimensions: readonly HumanitarianWorkspaceDimension[];
  /** Every admitted record the projection read, in `observationKey` order. */
  readonly records: readonly AdmittedRecordPointer[];
  /** Distinct `providerId` count. Source disagreement needs at least two. */
  readonly distinctProviders: number;
  readonly projectedAt: string;
}

/** The record shape this module reads. Structural, so it does not import the backend. */
export interface AdmittedRetainedEvidenceReadModel {
  readonly captureKey: string;
  readonly publisherReleasedAt: string;
  readonly observation: DomainObservation<unknown>;
}

const DIMENSION_FIELDS = ['absence', 'claims', 'derivedFrom', 'id', 'state'] as const;
const WORKSPACE_FIELDS = ['dimensions', 'distinctProviders', 'projectedAt', 'records'] as const;

function pointerFor(record: AdmittedRetainedEvidenceReadModel): AdmittedRecordPointer {
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
      `HUM_WORKSPACE_FORBIDDEN_ATTRIBUTE: '${attribute}' is not an attribute this substrate states. ` +
        'A figure the publisher did not publish may not become a claim.',
    );
  }
  if (records.length === 0) {
    throw new HumanitarianWorkspaceRefused(
      `HUM_WORKSPACE_CLAIM_WITHOUT_RECORD: '${attribute}' points at no admitted record.`,
    );
  }
  return { claimClass: 'FACT', assertion: 'FACT', attribute, authorship, records };
}

function carried(
  id: HumanitarianWorkspaceDimensionId,
  claims: readonly HumanitarianWorkspaceClaim[],
): HumanitarianWorkspaceDimension {
  return { id, state: 'CARRIED', absence: null, claims, derivedFrom: [] };
}

function empty(
  id: HumanitarianWorkspaceDimensionId,
  absence: Exclude<ObservationAbsenceState, typeof ONLY_REASSURING_ABSENCE_STATE>,
): HumanitarianWorkspaceDimension {
  return { id, state: 'EMPTY', absence, claims: [], derivedFrom: [] };
}

/**
 * Attributes the publisher states on a retained extent record, read from the record's
 * own `attributeAuthorship` rather than assumed. A producer that stops stating an
 * attribute stops producing the claim, with no edit here.
 */
function publisherStatedAttributes(record: AdmittedRetainedEvidenceReadModel): readonly string[] {
  return record.observation.attributeAuthorship
    .filter((entry) => entry.authorship === 'PUBLISHER_STATED')
    .map((entry) => entry.attribute);
}

/**
 * The dimension-to-attribute table for the dimensions no producer serves yet. Carried
 * as data so the projection cannot grow a case without a reviewer seeing the name.
 */
const UNWIRED_DIMENSION_ATTRIBUTES: readonly (readonly [
  HumanitarianWorkspaceDimensionId,
  string,
])[] = Object.freeze([
  ['REPORTED_IMPACT', 'reportedImpact'],
  ['DISPLACEMENT', 'displacementRecord'],
  ['ACCESS_CONSTRAINTS', 'accessConstraint'],
  ['SECTOR_CLAIMS', 'sectorClaim'],
] as const);

/**
 * THE PROJECTION.
 *
 * Deterministic, total, and ordered by `observationKey` so two runs over the same set
 * produce the same workspace. `projectedAt` is passed in; nothing here reads a clock.
 */
export function projectHumanitarianWorkspace(
  records: readonly AdmittedRetainedEvidenceReadModel[],
  projectedAt: string,
): HumanitarianAnalysisWorkspace {
  const ordered = [...records].sort((a, b) =>
    a.observation.observationKey < b.observation.observationKey
      ? -1
      : a.observation.observationKey > b.observation.observationKey
        ? 1
        : 0,
  );
  const pointers = ordered.map(pointerFor);
  const distinctProviders = new Set(pointers.map((p) => p.providerId)).size;

  /* NO ADMITTED RECORD. Every dimension is empty at the floor, which claims nothing
     about the world — not that nothing happened, and not that nothing was found. */
  if (ordered.length === 0) {
    const emptied = HUMANITARIAN_WORKSPACE_DIMENSIONS.filter(
      (id) => id !== DERIVED_WORKSPACE_DIMENSION,
    ).map((id) => empty(id, OBSERVATION_ABSENCE_FLOOR));
    return {
      dimensions: [...emptied, derivedUnknown(emptied)],
      records: [],
      distinctProviders: 0,
      projectedAt,
    };
  }

  const stated = new Set(ordered.flatMap(publisherStatedAttributes));

  const whatHappened: HumanitarianWorkspaceDimension = carried(
    'WHAT_HAPPENED',
    ordered.map((record) =>
      factClaim(record.observation.observationKind, 'PUBLISHER_STATED', [pointerFor(record)]),
    ),
  );

  /* WHERE. Only from an attribute the publisher stated. Geometry that is withheld or
     absent is not a hole to be filled: the dimension goes empty with a reason. */
  const whereClaims = ordered
    .filter((record) => publisherStatedAttributes(record).includes('geometry'))
    .map((record) => factClaim('geometry', 'PUBLISHER_STATED', [pointerFor(record)]));
  const where =
    whereClaims.length > 0
      ? carried('WHERE', whereClaims)
      : /* The publisher published no drawable position for this record. EVIDENCE_WITHHELD
           is INTERNAL and projects to COVERAGE_GAP for a reader; it says something exists
           and is not displayable, which is exactly the geometry case. */
        empty('WHERE', 'EVIDENCE_WITHHELD');

  /* WHEN. A record always carries `retrievedAt`, so this dimension is carried whenever
     a record is — but the claim names the BASIS, so a retrieval-only record cannot be
     read as an occurrence. */
  const when = carried(
    'WHEN',
    ordered.map((record) =>
      factClaim(`temporalBasis:${record.observation.temporal.temporalBasis}`, 'PUBLISHER_STATED', [
        pointerFor(record),
      ]),
    ),
  );

  /* SOURCE_TIMELINE. The revision lineage of the understanding, not of the world. */
  const timeline = carried(
    'SOURCE_TIMELINE',
    ordered.map((record) =>
      factClaim(
        `revisionOrdinal:${String(record.observation.revision.revisionOrdinal)}`,
        'PUBLISHER_STATED',
        [pointerFor(record)],
      ),
    ),
  );

  /* The four dimensions the substrate has no producer for. Not "nothing reported" —
     no source is wired for the scope at all, which is a different and smaller claim.

     The attribute each one WOULD need is named, and read from the record rather than
     assumed: the day a producer starts stating `accessConstraint`, this stops saying
     SOURCE_NOT_CONNECTED on its own and the dimension has to be given a projection
     here. A silent widening is not possible, because the name has to appear below. */
  const unwired = UNWIRED_DIMENSION_ATTRIBUTES.map(
    ([id, attribute]): HumanitarianWorkspaceDimension =>
      stated.has(attribute)
        ? empty(id, 'NO_QUALIFYING_EVIDENCE')
        : empty(id, 'SOURCE_NOT_CONNECTED'),
  );

  /* SOURCE_DISAGREEMENT. Disagreement is a relation between at least two independent
     providers. With one, it is not "no disagreement" — it is not establishable. */
  const disagreement = empty(
    'SOURCE_DISAGREEMENT',
    distinctProviders < 2 ? 'COVERAGE_GAP' : 'NO_QUALIFYING_EVIDENCE',
  );

  const substantive: readonly HumanitarianWorkspaceDimension[] = [
    whatHappened,
    where,
    when,
    ...unwired,
    disagreement,
    timeline,
  ];

  const byId = new Map(substantive.map((d) => [d.id, d] as const));
  const inOrder = HUMANITARIAN_WORKSPACE_DIMENSIONS.filter(
    (id) => id !== DERIVED_WORKSPACE_DIMENSION,
  ).map((id) => {
    const found = byId.get(id);
    if (found === undefined) {
      throw new HumanitarianWorkspaceRefused(
        `HUM_WORKSPACE_DIMENSION_MISSING: '${id}' was not projected.`,
      );
    }
    return found;
  });

  return {
    dimensions: [...inOrder, derivedUnknown(inOrder)],
    records: pointers,
    distinctProviders,
    projectedAt,
  };
}

function derivedUnknown(
  dimensions: readonly HumanitarianWorkspaceDimension[],
): HumanitarianWorkspaceDimension {
  return {
    id: DERIVED_WORKSPACE_DIMENSION,
    state: 'DERIVED',
    absence: null,
    claims: [],
    derivedFrom: dimensions.filter((d) => d.state === 'EMPTY').map((d) => d.id),
  };
}

/**
 * CLOSURE. The field sets are exact in both directions, so neither a new field nor a
 * dropped one reaches a reader unreviewed — the same shape `assertReaderProjectionIsClosed`
 * uses, for the same reason.
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
      if (dimension.absence === null) {
        throw new HumanitarianWorkspaceRefused(
          `HUM_WORKSPACE_EMPTY_WITHOUT_REASON: '${dimension.id}' is empty and names no reason.`,
        );
      }
      if (dimension.absence === ONLY_REASSURING_ABSENCE_STATE) {
        throw new HumanitarianWorkspaceRefused(
          `HUM_WORKSPACE_ABSENCE_REASSURES: '${dimension.id}' claims a positive finding this substrate cannot admit.`,
        );
      }
      if (dimension.claims.length > 0) {
        throw new HumanitarianWorkspaceRefused(
          `HUM_WORKSPACE_EMPTY_CARRIES_CLAIMS: '${dimension.id}'.`,
        );
      }
    }
    if (dimension.state === 'CARRIED' && dimension.claims.length === 0) {
      throw new HumanitarianWorkspaceRefused(
        `HUM_WORKSPACE_CARRIED_WITHOUT_CLAIM: '${dimension.id}'.`,
      );
    }
    /* The derived dimension is derived and nothing else is, in both directions. */
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
          `HUM_WORKSPACE_CLAIM_WITHOUT_RECORD: '${dimension.id}' carries a claim with no admitted record.`,
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
          `HUM_WORKSPACE_CLAIM_CLASS_UNREACHABLE: '${claim.claimClass}' has no admission from retained evidence.`,
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
 * Reader text written for an empty dimension must not imply the world is fine. The
 * check is on the TEXT, so it holds for any locale a domain authors, and it is case
 * and diacritic insensitive on the ASCII fold only — a PL author adding a reassuring
 * Polish word must add it to the list, which is a decision they write down.
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
  /** The publisher's own observation kinds, de-duplicated and ordered. Never prose. */
  readonly observationKinds: readonly string[];
  /** The records the one Ask engine may cite. Identifiers only. */
  readonly records: readonly AdmittedRecordPointer[];
}

export type HumanitarianAskHandoff = AskHandoffUnavailable | AskHandoffSubject;

/**
 * WHY THIS RETURNS A SUBJECT AND NOT A QUESTION.
 *
 * Ask V2's public turn DTO is four fields — `idempotencyKey, question, language,
 * intent` — and an exact-equality test freezes that list, so a humanitarian context
 * cannot travel as a fifth field and must not try. Ask V2 resolves scope server-side
 * from the question text, which is the seam this uses: the surface composes the
 * reader's question in the reader's own language from the SUBJECT below, and the one
 * Ask engine does the rest. Nothing here builds a prompt, and nothing here computes.
 *
 * When no record is admitted the handoff is UNAVAILABLE with a reason. It does not
 * degrade into a general question about the region, because a question composed from
 * nothing would arrive at Ask as if a situation had been established.
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
  const observationKinds = [...new Set(subject.claims.map((c) => c.attribute))].sort();
  if (observationKinds.length === 0) {
    return { available: false, refusal: 'NO_STATED_SUBJECT' };
  }
  return { available: true, observationKinds, records: workspace.records };
}
