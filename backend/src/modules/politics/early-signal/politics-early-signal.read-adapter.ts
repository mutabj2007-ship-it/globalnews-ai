/**
 * POLITICS EARLY-SIGNAL — VERSIONED READ-ONLY ADAPTER (R66 Workstream A).
 *
 * The seam Main's frontend integrates against. It is deliberately NOT a Nest controller, NOT registered
 * in `politics.module.ts`, and has NO route. Public reads are disabled by a code literal until later
 * E1 and release gates; synthetic fixture data can never be served to a public reader even if the
 * literal were flipped.
 *
 *   readPublic()        → always { status: 'DISABLED' } today
 *   readFixtureLocal()  → the full read model, for tests/dev only, from SYNTHETIC_FIXTURE input only
 *
 * Retained Politics observations map in with every E1 use on HOLD (no per-use matrix row exists for any
 * Politics source), so the engine reports RIGHTS_WITHHELD rather than showing them.
 */
import {
  POLITICS_ES_CONTRACT_VERSION,
  type PoliticsEsEvaluationInput,
  type PoliticsEsObservationInput,
  type PoliticsEsReadModelV1,
  type RetainedPoliticsObservation,
} from '@globalnews-ai/shared';
import { runPoliticsEarlySignal, type PoliticsEsEngineInput } from './politics-early-signal.engine';

/** Code literal. No environment variable, DB row or request can change it. */
export const POLITICS_EARLY_SIGNAL_PUBLIC_READ_ENABLED = false as const;
export const POLITICS_ES_ADAPTER_VERSION = 'politics-early-signal-adapter/v1' as const;

export type PoliticsEsPublicReadResponse =
  | { readonly contractVersion: typeof POLITICS_ES_CONTRACT_VERSION; readonly status: 'DISABLED'; readonly reason: 'RELEASE_GATES_NOT_MET' }
  | { readonly contractVersion: typeof POLITICS_ES_CONTRACT_VERSION; readonly status: 'REFUSED'; readonly reason: 'SYNTHETIC_DATA_NEVER_PUBLIC' }
  | { readonly contractVersion: typeof POLITICS_ES_CONTRACT_VERSION; readonly status: 'OK'; readonly model: PoliticsEsReadModelV1 };

export type PoliticsEsAdapterSource =
  | { readonly kind: 'FIXTURE_LOCAL'; readonly input: PoliticsEsEngineInput }
  | { readonly kind: 'RETAINED'; readonly observations: readonly RetainedPoliticsObservation[]; readonly evaluation: PoliticsEsEvaluationInput };

const RETAINED_KIND_TO_PREDICATE: Readonly<Record<string, string>> = {
  PROTEST_HELD: 'PROTEST_HELD',
  LEGISLATIVE_STAGE: 'LEGISLATIVE_STAGE',
  ELECTION_PROCESS_NOTICE: 'ELECTION_PROCESS_NOTICE', // not in the impact table ⇒ INSUFFICIENT, never a guess
};

/** Retained Politics observation → engine input. Every use HOLD; no place is inferred. */
export function fromRetainedPoliticsObservation(o: RetainedPoliticsObservation): PoliticsEsObservationInput {
  return {
    observationId: o.observationKey,
    dataOrigin: 'RETAINED',
    publisherId: o.identity.upstreamAuthority,
    host: '',
    deliveredByProviderId: o.identity.upstreamAuthority,
    acquisitionMode: 'BACKGROUND_DISCOVERY',
    artefactKind: 'OFFICIAL_RECORD',
    chain: { declaredWireOrigin: null, declaredSyndicationOf: null, similarityClusterId: null, humanLinkedChainId: null, originSelf: true },
    originalLanguage: { tag: null, basis: 'NOT_ESTABLISHED' },
    clocks: {
      publishedAt: o.publishedAt,
      publishedAtBasis: 'publisher',
      providerObservedAt: null,
      firstSeenAt: null,
      collectedAt: o.temporal.retrievedAt,
    },
    places: [],
    rights: {
      LINK_AND_SOURCE_NAME: 'HOLD', METADATA_HEADLINE: 'HOLD', EXCERPT: 'HOLD', AI_INPUT: 'HOLD', RETENTION: 'HOLD',
      TRANSLATION: 'HOLD', IMAGES: 'HOLD', ALERT_TEXT: 'HOLD', DOWNSTREAM_REPUBLICATION: 'HOLD',
    },
    claim: {
      claimKey: o.observationKey,
      predicate: RETAINED_KIND_TO_PREDICATE[o.observationKind] ?? o.observationKind,
      incidentKey: null,
      eventTime: o.temporal.occurredAt
        ? { from: o.temporal.occurredAt, to: null, basis: 'AS_REPORTED' }
        : { from: null, to: null, basis: 'NOT_ESTABLISHED' },
      quantity: null,
      speakerRole: 'OFFICIAL_BODY',
      interestedParty: false,
    },
    mutation: { kind: 'NONE', supersedesObservationId: null, observedAt: null },
  };
}

export class PoliticsEarlySignalReadAdapter {
  constructor(
    private readonly source: PoliticsEsAdapterSource,
    private readonly publicReadEnabled: boolean = POLITICS_EARLY_SIGNAL_PUBLIC_READ_ENABLED,
  ) {}

  private engineInput(): PoliticsEsEngineInput {
    return this.source.kind === 'FIXTURE_LOCAL'
      ? this.source.input
      : { observations: this.source.observations.map(fromRetainedPoliticsObservation), evaluation: this.source.evaluation };
  }

  /** The only path a public reader could ever reach. Disabled today; synthetic data is always refused. */
  readPublic(): PoliticsEsPublicReadResponse {
    if (!this.publicReadEnabled) return { contractVersion: POLITICS_ES_CONTRACT_VERSION, status: 'DISABLED', reason: 'RELEASE_GATES_NOT_MET' };
    const input = this.engineInput();
    if (this.source.kind === 'FIXTURE_LOCAL' || input.observations.some((o) => o.dataOrigin === 'SYNTHETIC_FIXTURE'))
      return { contractVersion: POLITICS_ES_CONTRACT_VERSION, status: 'REFUSED', reason: 'SYNTHETIC_DATA_NEVER_PUBLIC' };
    return { contractVersion: POLITICS_ES_CONTRACT_VERSION, status: 'OK', model: runPoliticsEarlySignal(input) };
  }

  /** Tests/dev only. Refuses anything that is not a synthetic fixture. */
  readFixtureLocal(): PoliticsEsReadModelV1 {
    if (this.source.kind !== 'FIXTURE_LOCAL') throw new Error('readFixtureLocal accepts FIXTURE_LOCAL sources only');
    if (this.source.input.observations.some((o) => o.dataOrigin !== 'SYNTHETIC_FIXTURE'))
      throw new Error('readFixtureLocal accepts SYNTHETIC_FIXTURE observations only');
    return runPoliticsEarlySignal(this.source.input);
  }

  /** Retained path for offline verification (no public exposure). */
  readRetainedOffline(): PoliticsEsReadModelV1 {
    if (this.source.kind !== 'RETAINED') throw new Error('readRetainedOffline accepts RETAINED sources only');
    return runPoliticsEarlySignal(this.engineInput());
  }
}
