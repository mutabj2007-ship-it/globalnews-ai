export type ElectionKind =
  'FORM_AVAILABLE' | 'FORM_REPORTED' | 'TALLY_OBSERVATION' | 'OFFICIAL_DECLARATION';
export interface ElectionRecord {
  id: string;
  kind: ElectionKind;
  label: string;
  capturedAt: string;
  sourceLanguage: string;
  election: {
    eventId: string;
    publisherEventLabel: string;
    electionDate: string | null;
    electivePosition: string | null;
    administrativeGeography: { kind: string; label: string; officialCode: string | null }[];
  };
  source: { publisher: string; url: string; artifactSha256: string };
  citation: { locator: string; statement: string };
  declaredAt?: string | null;
  publisherStatus?: string;
  declaredPerson?: { ballotName: string; partyAsPublished: string | null };
  qualifiedReading?: string | null;
  availability?: string;
  documentRole?: string;
  reported?: number;
  total?: number;
  unitLabel?: string;
  publisherStatedAt?: string;
  scope?: { reported: number; total: number; unitLabel: string };
  readings?: {
    candidateBallotName: string;
    partyAsPublished: string | null;
    qualifiedReading: string;
  }[];
}
export interface ElectionReadResponse {
  domain: 'ELECTION';
  state: 'EVIDENCE' | 'COVERAGE_GAP';
  locale: 'en' | 'pl';
  records: ElectionRecord[];
  reason?: 'READER_DISABLED' | 'VALIDATION_FAILED' | 'NO_CURRENT_RECORDS';
}
