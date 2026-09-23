import type { DomainObservation } from '../observation/domain-observation';
import type { LegislativeStage, PoliticsSubjectType } from './index';

/** Deliberately excludes results, polling, scores, sentiment and inferred outcomes. */
export type RetainedPoliticsClaim =
  | { kind: 'PROTEST_HELD'; stage: 'HELD'; sourceText: string }
  | { kind: 'LEGISLATIVE_STAGE'; stage: LegislativeStage; sourceText: string }
  | { kind: 'ELECTION_PROCESS_NOTICE'; stage: 'ANNOUNCED'; sourceText: string };

export interface RetainedPoliticsObservation extends DomainObservation<RetainedPoliticsClaim> {
  readonly subjectType: PoliticsSubjectType;
  readonly observationKind: RetainedPoliticsClaim['kind'];
  /** Publication and publisher revision are distinct; neither is the ingestion clock. */
  readonly publishedAt: string;
  readonly sourceUpdatedAt?: string;
  readonly artifactSha256: string;
}

export interface PoliticsReadResponse {
  readonly observations: readonly RetainedPoliticsObservation[];
  readonly absence: 'NOT_ASSESSED' | 'EVIDENCE_WITHHELD' | null;
  readonly truncated: boolean;
  readonly acquisition: 'RETAINED_ONLY';
  /** Whole-ledger admission inventory, before subject filtering or pagination. */
  readonly coverage?: { readonly checkedCaptures: number; readonly admittedObservations: number; readonly withheld: boolean };
}
