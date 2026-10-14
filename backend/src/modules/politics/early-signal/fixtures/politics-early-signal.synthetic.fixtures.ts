/**
 * SYNTHETIC FIXTURES — Politics early-signal T3 (R66). TEST / DEV ONLY.
 *
 * Every observation is stamped `dataOrigin: 'SYNTHETIC_FIXTURE'`. Publisher ids are `syn:*`; hosts are
 * `*.synthetic.test`. Nothing here is a real report, outlet, quotation or measurement. Scenario SHAPES
 * mirror East Africa's real benchmark cases (EA-ES-xx, cited per scenario) so the chronology rules are
 * exercised on realistic structure without inventing real facts. No runtime file imports this module
 * (asserted by politics-early-signal.engine.spec.ts).
 */
import type {
  PoliticsEsEvaluationInput,
  PoliticsEsHumanDispute,
  PoliticsEsObservationInput,
  PoliticsEsUse,
  PoliticsEsUseVerdict,
} from '@globalnews-ai/shared';
import type { PoliticsEsEngineInput } from '../politics-early-signal.engine';

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

const ALL_CLEAR: Record<PoliticsEsUse, PoliticsEsUseVerdict> = {
  LINK_AND_SOURCE_NAME: 'CLEAR_FOR_EXACT_USE', METADATA_HEADLINE: 'CLEAR_FOR_EXACT_USE', EXCERPT: 'HOLD', AI_INPUT: 'HOLD',
  RETENTION: 'CLEAR_FOR_EXACT_USE', TRANSLATION: 'HOLD', IMAGES: 'HOLD', ALERT_TEXT: 'HOLD', DOWNSTREAM_REPUBLICATION: 'HOLD',
};
const ALL_HOLD: Record<PoliticsEsUse, PoliticsEsUseVerdict> = {
  LINK_AND_SOURCE_NAME: 'HOLD', METADATA_HEADLINE: 'HOLD', EXCERPT: 'HOLD', AI_INPUT: 'HOLD', RETENTION: 'HOLD',
  TRANSLATION: 'HOLD', IMAGES: 'HOLD', ALERT_TEXT: 'HOLD', DOWNSTREAM_REPUBLICATION: 'HOLD',
};
/** Synthetic rights: "as if cleared" for engine testing only; a real source needs E1's matrix row. */
export const SYNTHETIC_RIGHTS_CLEARED = ALL_CLEAR;
export const SYNTHETIC_RIGHTS_HELD = ALL_HOLD;

export function syn(id: string, over: DeepPartial<PoliticsEsObservationInput> = {}): PoliticsEsObservationInput {
  const base: PoliticsEsObservationInput = {
    observationId: id,
    dataOrigin: 'SYNTHETIC_FIXTURE',
    publisherId: `syn:pub-${id}`,
    host: `${id}.synthetic.test`,
    deliveredByProviderId: 'syn:provider',
    acquisitionMode: 'SYNTHETIC_FIXTURE',
    artefactKind: 'PUBLISHED_ITEM',
    chain: { declaredWireOrigin: null, declaredSyndicationOf: null, similarityClusterId: null, humanLinkedChainId: null, originSelf: true },
    originalLanguage: { tag: 'en', basis: 'PUBLISHER_DECLARED' },
    clocks: { publishedAt: '2026-01-10T08:00:00Z', publishedAtBasis: 'publisher', providerObservedAt: null, firstSeenAt: '2026-01-10T09:00:00Z', collectedAt: '2026-01-10T09:00:00Z' },
    places: [{ iso3: 'KEN', locality: null, precision: 'COUNTRY', role: 'EVENT_PLACE', basis: 'OBSERVED_PRIMARY' }],
    rights: ALL_CLEAR,
    claim: {
      claimKey: `claim-${id}`,
      predicate: 'FACILITY_CLOSED',
      incidentKey: 'syn-incident-1',
      eventTime: { from: '2026-01-10', to: '2026-01-10', basis: 'AS_REPORTED' },
      quantity: null,
      speakerRole: 'JOURNALIST',
      interestedParty: false,
    },
    mutation: { kind: 'NONE', supersedesObservationId: null, observedAt: null },
  };
  return {
    ...base,
    ...over,
    chain: { ...base.chain, ...(over.chain ?? {}) },
    originalLanguage: { ...base.originalLanguage, ...(over.originalLanguage ?? {}) },
    clocks: { ...base.clocks, ...(over.clocks ?? {}) },
    places: (over.places as PoliticsEsObservationInput['places']) ?? base.places,
    rights: (over.rights as PoliticsEsObservationInput['rights']) ?? base.rights,
    claim: { ...base.claim, ...(over.claim ?? {}), eventTime: { ...base.claim.eventTime, ...(over.claim?.eventTime ?? {}) } } as PoliticsEsObservationInput['claim'],
    mutation: { ...base.mutation, ...(over.mutation ?? {}) },
  } as PoliticsEsObservationInput;
}

export function evaluation(over: Partial<PoliticsEsEvaluationInput> = {}): PoliticsEsEvaluationInput {
  return { attemptedAt: '2026-01-10T12:00:00Z', access: 'COMPLETED_MATCH', previousCompletedAt: null, perSource: [], baseline: null, ...over };
}

const indep = (id: string, extra: DeepPartial<PoliticsEsObservationInput> = {}) => syn(id, { chain: { originSelf: true }, ...extra });

/* ── ONE FIXTURE PER NAMED READER STATE (for Main's frontend; test/dev only) ── */

export const STATE_FIXTURES: Readonly<Record<string, PoliticsEsEngineInput & { readonly expect: string }>> = {
  /** Two independent chains report a facility closure → corroborated evidence with an observed effect. */
  EVIDENCE: {
    expect: 'developments[0].statementStatus = CORROBORATED, impact OBSERVED_EFFECT',
    observations: [indep('ev-a'), indep('ev-b')],
    evaluation: evaluation(),
  },
  /** Search completed, nothing matched. */
  ABSENCE_NO_MATCH: { expect: 'absence.state = COMPLETED_NO_MATCH', observations: [], evaluation: evaluation({ access: 'COMPLETED_NO_MATCH' }) },
  /** Items exist but every one is rights-held. */
  RIGHTS_WITHHELD: {
    expect: 'absence.state = RIGHTS_WITHHELD, withheld.count = 2',
    observations: [syn('rw-a', { rights: ALL_HOLD }), syn('rw-b', { rights: ALL_HOLD })],
    evaluation: evaluation(),
  },
  /** No search has run for this subject. */
  NOT_CHECKED: { expect: 'absence.state = SEARCH_NOT_RUN, lastEvaluatedAt = null', observations: [], evaluation: evaluation({ access: 'SEARCH_NOT_RUN' }) },
  /** Completed re-evaluation, same chains as the baseline. */
  NO_CHANGE: {
    expect: 'developments[0].change = NO_MATERIAL_CHANGE',
    observations: [indep('nc-a')],
    evaluation: evaluation({ previousCompletedAt: '2026-01-10T10:00:00Z', baseline: { 'syn-incident-1': ['origin:syn:pub-nc-a'] } }),
  },
  /** Provider failed this time; the last completed evaluation is kept, nothing is claimed. */
  PROVIDER_FAILURE: {
    expect: 'absence.state = PROVIDER_FAILED, lastEvaluatedAt = previousCompletedAt',
    observations: [indep('pf-a')],
    evaluation: evaluation({ access: 'PROVIDER_FAILED', previousCompletedAt: '2026-01-09T12:00:00Z' }),
  },
  /** Two attributed claims a human reviewer recorded as incompatible (offline modelling only). */
  DISPUTED: {
    expect: 'developments[0].disputed[0].derivedBy = HUMAN_REVIEW',
    observations: [
      indep('dp-a', { claim: { predicate: 'COALITION_ANNOUNCED', claimKey: 'deputies-3' } }),
      indep('dp-b', { claim: { predicate: 'COALITION_ANNOUNCED', claimKey: 'deputies-4' } }),
    ],
    evaluation: evaluation(),
    humanDisputes: [{ claimKeyA: 'deputies-3', claimKeyB: 'deputies-4', reviewer: 'syn:reviewer', reviewedAt: '2026-01-10T11:00:00Z', derivedBy: 'HUMAN_REVIEW' }],
  },
  /** A source corrects its own earlier report; the original stays in history as CORRECTED. */
  CORRECTED: {
    expect: 'developments[0].corrected = true, original claim status CORRECTED',
    observations: [
      indep('co-a', { claim: { predicate: 'CASUALTIES_REPORTED', quantity: { value: 12, unit: 'KILLED', qualifier: 'ABOUT' } } }),
      indep('co-b', {
        publisherId: 'syn:pub-co-a',
        claim: { predicate: 'CASUALTIES_REPORTED', quantity: { value: 9, unit: 'KILLED', qualifier: 'EXACT' } },
        mutation: { kind: 'CORRECTED', supersedesObservationId: 'co-a', observedAt: '2026-01-10T11:30:00Z' },
      }),
    ],
    evaluation: evaluation(),
  },
};

export type { PoliticsEsHumanDispute };
