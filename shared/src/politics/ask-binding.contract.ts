/**
 * POLITICS → SHARED ASK BINDING — the gate and the entityRef guard.
 *
 * Lane: Claude C. PROPOSED, not integrated. Base MEASURED: d9208933c6ec758756b3b1019d8d01aa1f7592d1
 *
 * WHAT CHANGED FROM MY R2 PROPOSAL, AFTER MEASURING THE REAL BASE:
 *
 *   - R2 invented a `PoliticsAvailability` union. The base already has the real vocabulary —
 *     `AskContribution.status` is USED | NO_MATCH | NO_DATA | NOT_ASSESSED | DEGRADED. **That union
 *     is dropped.** This file states the gate only, and the gate's output is expressed in the
 *     contribution statuses that already ship.
 *   - R2 proposed a broad no-person guard. `backend/src/modules/politics/politics-no-person-channel.spec.ts`
 *     already exists and covers the store side well (enumerated schema columns, the migration, the
 *     shared record, and every non-spec source in the politics directory). **Those checks are not
 *     duplicated here.** What remains uncovered is the `entityRef` join (E1-POL-8) and the BINDING
 *     path, which lives outside the politics directory that spec scans. This file covers the first;
 *     the companion spec covers the second.
 *
 * No fetch, no provider, no model call, no store, no index, no conversation state, no second IR.
 */

/* ------------------------------------------------------------------ *
 * 1 · The binding gate — measured preconditions, not invented ones
 * ------------------------------------------------------------------ */

/**
 * `boundSpecialistDomains()`'s own docblock on the base states the rule this gate enforces:
 * *"the specialist domains whose callable seam is PROVEN here — a measured fact handed to the
 * router's registry port, never a default. CONFLICT is bound because its read seam is this
 * coordinator's injected, tested ConflictObservationRepository."*
 *
 * So binding requires an INJECTED repository, not merely an existing one. Every field below was
 * checked against `d920893`; the comment records what was measured.
 */
export interface PoliticsBindingPreconditions {
  /** MEASURED TRUE: `model PoliticsObservation` at prisma/schema.prisma:1293. */
  readonly retainedStoreModelExists: boolean;
  /** MEASURED TRUE: prisma/migrations/20261004120000_politics_observation_store. */
  readonly migrationApplied: boolean;
  /** MEASURED TRUE: `artifactSha256` is required and FK-linked to SnapshotRetrieval. */
  readonly everyRowHasAdmittedCaptureLink: boolean;
  /** MEASURED TRUE: PoliticsObservationRepository.searchRecords() exists. */
  readonly searchableProjectionExists: boolean;
  /**
   * MEASURED FALSE — the whole gap. `searchRecords` has exactly one caller and it is
   * `politics-observation.live-postgres.spec.ts`. Zero non-spec call sites.
   */
  readonly searchableProjectionHasNonSpecConsumer: boolean;
  /** MEASURED FALSE: AskIntelligenceModule providers are Conflict, Market, Economy only. */
  readonly repositoryInjectedIntoCoordinator: boolean;
  /** MEASURED FALSE: selectContributors() has no POLITICS branch. */
  readonly contributorSelectable: boolean;
  /**
   * MEASURED FALSE, and it is the defect Politics must not repeat. `governed-answer.ts` recognises
   * exactly five codes; the coordinator emits `HUMANITARIAN_NOT_ASSESSED`, which is not one of them.
   * An emitted code no consumer recognises is a defect at the EMITTING lane.
   */
  readonly everyEmittedDisclosureRecognised: boolean;
  /** E1 G6: untested counts as not passed. */
  readonly leakProbesPass: boolean;
}

export type PoliticsBindingRefusal =
  | 'NO_RETAINED_STORE'
  | 'MIGRATION_NOT_APPLIED'
  | 'CAPTURE_LINK_NOT_REQUIRED'
  | 'NO_SEARCHABLE_PROJECTION'
  | 'PROJECTION_HAS_NO_CONSUMER'
  | 'REPOSITORY_NOT_INJECTED'
  | 'CONTRIBUTOR_NOT_SELECTABLE'
  | 'DISCLOSURE_CODE_UNRECOGNISED'
  | 'LEAK_PROBES_NOT_PASSED';

export interface PoliticsBindingDecision {
  readonly bound: boolean;
  /** Every failed precondition, not the first. */
  readonly refusedBecause: readonly PoliticsBindingRefusal[];
  /**
   * The contribution status an unbound Politics leg must produce — one of the statuses that already
   * ship. `NOT_ASSESSED`, never `NO_DATA`: no data asserts a governed read found nothing, and an
   * unbound reader performed no read at all.
   */
  readonly unboundStatus: 'NOT_ASSESSED';
}

export function decidePoliticsBinding(p: PoliticsBindingPreconditions): PoliticsBindingDecision {
  const r: PoliticsBindingRefusal[] = [];
  if (!p.retainedStoreModelExists) r.push('NO_RETAINED_STORE');
  if (!p.migrationApplied) r.push('MIGRATION_NOT_APPLIED');
  if (!p.everyRowHasAdmittedCaptureLink) r.push('CAPTURE_LINK_NOT_REQUIRED');
  if (!p.searchableProjectionExists) r.push('NO_SEARCHABLE_PROJECTION');
  if (!p.searchableProjectionHasNonSpecConsumer) r.push('PROJECTION_HAS_NO_CONSUMER');
  if (!p.repositoryInjectedIntoCoordinator) r.push('REPOSITORY_NOT_INJECTED');
  if (!p.contributorSelectable) r.push('CONTRIBUTOR_NOT_SELECTABLE');
  if (!p.everyEmittedDisclosureRecognised) r.push('DISCLOSURE_CODE_UNRECOGNISED');
  if (!p.leakProbesPass) r.push('LEAK_PROBES_NOT_PASSED');
  return { bound: r.length === 0, refusedBecause: r, unboundStatus: 'NOT_ASSESSED' };
}

/** What `d920893` actually measures to. Four true, five false. */
export const MEASURED_AT_D920893: PoliticsBindingPreconditions = {
  retainedStoreModelExists: true,
  migrationApplied: true,
  everyRowHasAdmittedCaptureLink: true,
  searchableProjectionExists: true,
  searchableProjectionHasNonSpecConsumer: false,
  repositoryInjectedIntoCoordinator: false,
  contributorSelectable: false,
  everyEmittedDisclosureRecognised: false,
  leakProbesPass: false,
};

/* ------------------------------------------------------------------ *
 * 2 · E1-POL-8 — the entityRef join, still uncovered on this base
 * ------------------------------------------------------------------ */

/**
 * `shared/src/politics/index.ts` carries `PoliticalActorFacet.entityRef` — an opaque handle into the
 * shared participant surface that Politics never resolves. The analysis channel independently
 * produces free-form `entities.people`, measured live on this base at
 * `validate-analysis-result.ts:649` and `AnalysisResultView.tsx:61`.
 *
 * Nothing on `d920893` asserts the two cannot meet. If a handle is ever minted from or matched
 * against an extracted name, a per-person political record exists — with roles, jurisdictions and
 * date ranges — without a single Politics file changing. The existing politics spec cannot catch it:
 * it scans the politics directory, and the join would live in the binding path.
 */
export const FORBIDDEN_NAME_CHANNELS: readonly string[] = [
  'entities.people',
  'analysis.entities.people',
  'extractTitledPeople',
  'PERSON_TITLES',
  'validate-analysis-result',
  'article-entities.util',
];

export type EntityRefProvenance = 'GOVERNED_PARTICIPANT_SURFACE' | 'UNGOVERNED';

export class PoliticsPersonChannelError extends Error {
  constructor(
    readonly code:
      | 'ENTITY_REF_DERIVED_FROM_NAME_CHANNEL'
      | 'ENTITY_REF_NOT_FROM_GOVERNED_SURFACE'
      | 'NAME_STRING_MATCHING_FORBIDDEN',
    message: string,
  ) {
    super(`${code}: ${message}`);
    this.name = 'PoliticsPersonChannelError';
  }
}

/** Admissible because of ORIGIN, never shape: any shape test passes a name-derived string. */
export function assertEntityRefAdmissible(c: {
  readonly provenance: EntityRefProvenance;
  readonly derivedFromChannel: string | null;
}): void {
  if (c.derivedFromChannel !== null && FORBIDDEN_NAME_CHANNELS.includes(c.derivedFromChannel)) {
    throw new PoliticsPersonChannelError(
      'ENTITY_REF_DERIVED_FROM_NAME_CHANNEL',
      `a participant handle was derived from "${c.derivedFromChannel}"`,
    );
  }
  if (c.provenance !== 'GOVERNED_PARTICIPANT_SURFACE') {
    throw new PoliticsPersonChannelError(
      'ENTITY_REF_NOT_FROM_GOVERNED_SURFACE',
      'a handle that merely looks well-formed is not governed',
    );
  }
}

/** Declared as a refusal so no comparison exists here to be repurposed into the match it forbids. */
export function assertNoNameStringMatching(operation: string): never {
  throw new PoliticsPersonChannelError(
    'NAME_STRING_MATCHING_FORBIDDEN',
    `"${operation}" would match, join or deduplicate on a person name`,
  );
}
