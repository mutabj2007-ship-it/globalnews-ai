import type { ConflictObservation } from './observation';

/**
 * The retained Conflict read contract. Reading this never fetches a provider.
 *
 * Dataset coverage is explicit because Candidate GED is a publication, not a live sensor:
 * a quiet requested window must never be presented as "no conflict" when the retained
 * artifact simply ends before that window.
 */
export interface ConflictDatasetCoverage {
  readonly providerId: 'ucdp-ged';
  readonly datasetVersion: string;
  readonly retrievedAt: string;
  readonly contentAddress: string;
  readonly firstEventDate: string | null;
  readonly lastEventDate: string | null;
  readonly totalEventsInArtifact: number;
}

export type ConflictReadResult =
  | {
      readonly kind: 'OBSERVATIONS';
      readonly coverage: ConflictDatasetCoverage;
      readonly countryIso3: string | null;
      readonly requestedDays: number | null;
      readonly observations: readonly ConflictObservation[];
      /** Rendering projection over the same limited set; never a second event authority. */
      readonly mapEvents: readonly ConflictMapEvent[];
      readonly matchedBeforeLimit: number;
      readonly truncated: boolean;
    }
  | {
      readonly kind: 'UNAVAILABLE';
      readonly reason:
        | 'NO_RETAINED_DATASET'
        | 'RETAINED_BYTES_UNAVAILABLE'
        | 'PARSER_IDENTITY_MISMATCH'
        | 'PARSE_FAILED';
    };

/**
 * Reader-facing marker projection. It deliberately carries no calculated severity and no
 * situation identity: both remain unavailable until their respective governed producers
 * exist.
 */
export interface ConflictMapEvent {
  readonly observationKey: string;
  readonly upstreamEventId: string;
  readonly eventType: ConflictObservation['eventType'];
  readonly actors: ConflictObservation['actors'];
  readonly countryIso3?: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly precision: ConflictObservation['geography']['precision'];
  readonly locationProvenance: ConflictObservation['geography']['locationProvenance'];
  readonly denotation: ConflictObservation['geography']['denotation'];
  readonly eventStartedAt: string;
  readonly eventEndedAt?: string;
  readonly severity: ConflictObservation['severity'];
  readonly sourceReference: ConflictObservation['sourceReference'];
  /** Publisher-reported count of distinct source records, where parseable. */
  readonly sourceCount: number | null;
  readonly revision: ConflictObservation['revision'];
}
