/**
 * CONFLICT OBSERVATION — retained evidence boundary, not an assessment.
 *
 * This type deliberately carries only fields that can be stored from a governed
 * conflict dataset without inventing GlobalNews AI severity, escalation,
 * participant-role or situation-continuity conclusions. Those higher-level
 * semantics remain owned by the accepted Conflict Intelligence contracts.
 */
export interface ConflictObservation {
  readonly observationKey: string;
  readonly providerId: string;
  readonly providerEventId: string;
  readonly occurredOn: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly countryIso3: string | null;
  readonly placeLabel: string | null;
  readonly sourceUrl: string | null;
  readonly sourceName: string | null;
  readonly ingestedAt: string;
}
