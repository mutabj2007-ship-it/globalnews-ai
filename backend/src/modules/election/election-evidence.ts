/** Kenya is the first specialist Election implementation, independent of Politics. */
export const ELECTION_DERIVATION_RULES: readonly never[] = Object.freeze([]);
export type EvidenceKind =
  'FORM_AVAILABLE' | 'FORM_REPORTED' | 'TALLY_OBSERVATION' | 'OFFICIAL_DECLARATION';
export interface SourceCitation {
  artifactSha256: string;
  locator: string;
  /** Transcription of identified publisher passages; retained bytes remain authoritative. */
  statement: string;
}
export interface ElectionIdentity {
  eventId: string;
  publisherEventLabel: string;
  cycle: string | null;
  electionDate: string | null;
  electivePosition: string | null;
  administrativeGeography: readonly {
    kind: 'COUNTRY' | 'COUNTY' | 'CONSTITUENCY' | 'WARD';
    label: string;
    officialCode: string | null;
  }[];
  /** Textual publisher references, never geometry or an inferred administrative equivalence. */
  reportingGeography: {
    kind: 'POLLING_STATION' | 'POLLING_CENTRE' | 'TALLYING_CENTRE';
    label: string;
    officialCode: string | null;
    citation: SourceCitation;
  } | null;
  citation: SourceCitation;
}
export interface EvidenceBase {
  id: string;
  election: ElectionIdentity;
  form: { publisherIdentity: string; formType: string; serial: string | null } | null;
  capturedAt: string;
  sourceLanguage: string;
  source: { publisher: 'IEBC'; url: string; artifactSha256: string };
  revision: {
    id: string;
    ordinal: number;
    supersedes: string | null;
    kind: 'INITIAL' | 'SOURCE_REVISION' | 'CORRECTION';
    publisherReason: string | null;
  };
  citation: SourceCitation;
}
export type ElectionEvidence = EvidenceBase &
  (
    | {
        kind: 'FORM_AVAILABLE';
        availability: 'AVAILABLE';
        documentRole: 'BLANK_TEMPLATE' | 'COMPLETED_FORM';
      }
    | {
        kind: 'FORM_REPORTED';
        publisherStatus: string;
        reported: number;
        total: number;
        unitLabel: string;
      }
    | {
        kind: 'TALLY_OBSERVATION';
        publisherStatus: string;
        publisherStatedAt: string;
        expiresAt: string;
        scope: { reported: number; total: number; unitLabel: string };
        votes: readonly {
          candidateBallotName: string;
          authorityCandidateCode: string | null;
          partyAsPublished: string | null;
          votesAsPublished: string;
          citation: SourceCitation;
        }[];
        registeredVoters: number;
      }
    | {
        kind: 'OFFICIAL_DECLARATION';
        publisherStatus: string;
        declaredAt: string | null;
        votesAsPublished: string | null;
        declaredPerson: { ballotName: string; partyAsPublished: string | null };
      }
  );
export interface RetainedArtifact {
  sha256: string;
  bodyBase64: string;
  requestedUrl: string;
  finalUrl: string;
  capturedAt: string;
  mediaType: string;
  httpStatus: 200;
  etag: string | null;
  lastModified: string | null;
  tlsPeerFingerprint256: string;
  /** Discovery parent URLs are lineage, never permission for a crawler. */
  discoveredFrom: string | null;
}
export interface ElectionBundle {
  schemaVersion: 1;
  captureId: string;
  artifacts: readonly RetainedArtifact[];
  records: readonly ElectionEvidence[];
  admission: {
    policy: 'KE-BOUNDED-R1';
    reviewedAt: string;
    reviewer: string;
    permittedKinds: readonly EvidenceKind[];
  };
}
