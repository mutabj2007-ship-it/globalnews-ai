import { resolveApiBaseUrl } from '@/lib/api/apiBase';
import type { ElectionReadResponse, ElectionRecord } from '@/lib/election/electionRead';
import type { PoliticsReadResponse } from '@globalnews-ai/shared';

export type ReadResult<T> = { status: 'READ'; data: T } | { status: 'UNAVAILABLE' };
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const nullableText = (v: unknown) => v === null || text(v);
const count = (v: unknown) => Number.isSafeInteger(v) && (v as number) >= 0;
const date = (v: unknown) => text(v) && Number.isFinite(Date.parse(v));
const sourceUrl = (v: string, official = false) => {
  const u = new URL(v);
  return (
    !u.username &&
    !u.password &&
    (official
      ? u.protocol === 'https:' &&
        ['www.iebc.or.ke', 'iebc.or.ke', 'forms.iebc.or.ke'].includes(u.hostname)
      : ['https:', 'http:'].includes(u.protocol))
  );
};
/** Transport validation is additional to backend admission; it never admits source material. */
function electionRecord(r: ElectionRecord): boolean {
  if (!(
    text(r.id) &&
    text(r.label) &&
    date(r.capturedAt) &&
    text(r.sourceLanguage) &&
    text(r.election.eventId) &&
    text(r.election.publisherEventLabel) &&
    nullableText(r.election.electionDate) &&
    nullableText(r.election.electivePosition) &&
    Array.isArray(r.election.administrativeGeography) &&
    r.election.administrativeGeography.length > 0 &&
    r.election.administrativeGeography.every(
      (g) => text(g.kind) && text(g.label) && nullableText(g.officialCode),
    ) &&
    r.source.publisher === 'IEBC' &&
    sourceUrl(r.source.url, true) &&
    /^[a-f0-9]{64}$/.test(r.source.artifactSha256) &&
    text(r.citation.locator) &&
    text(r.citation.statement)
  ))
    return false;
  switch (r.kind) {
    case 'FORM_AVAILABLE':
      return (
        r.availability === 'AVAILABLE' &&
        ['BLANK_TEMPLATE', 'COMPLETED_FORM'].includes(r.documentRole ?? '')
      );
    case 'FORM_REPORTED':
      return (
        text(r.publisherStatus) &&
        count(r.reported) &&
        count(r.total) &&
        r.reported! <= r.total! &&
        text(r.unitLabel)
      );
    case 'OFFICIAL_DECLARATION':
      return (
        text(r.publisherStatus) &&
        nullableText(r.declaredAt) &&
        text(r.declaredPerson?.ballotName) &&
        nullableText(r.declaredPerson?.partyAsPublished) &&
        (r.qualifiedReading === null ||
          (text(r.qualifiedReading) && r.qualifiedReading.startsWith(r.label + ' · ')))
      );
    case 'TALLY_OBSERVATION':
      return (
        text(r.publisherStatus) &&
        date(r.publisherStatedAt) &&
        !!r.scope &&
        count(r.scope.reported) &&
        count(r.scope.total) &&
        r.scope.reported <= r.scope.total &&
        text(r.scope.unitLabel) &&
        Array.isArray(r.readings) &&
        r.readings.every(
          (v) =>
            text(v.candidateBallotName) &&
            nullableText(v.partyAsPublished) &&
            text(v.qualifiedReading) &&
            v.qualifiedReading.startsWith(r.label + ' · '),
        )
      );
    default:
      return false;
  }
}
/** Server-side bounded GET of our retained readers only; no acquisition or credentials. */
async function read<T>(path: string, valid: (value: T) => boolean): Promise<ReadResult<T>> {
  try {
    const response = await fetch(`${resolveApiBaseUrl()}${path}`, {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return { status: 'UNAVAILABLE' };
    const data: T = await response.json();
    return valid(data) ? { status: 'READ', data } : { status: 'UNAVAILABLE' };
  } catch {
    return { status: 'UNAVAILABLE' };
  }
}
export const readElection = (locale: 'en' | 'pl') =>
  read<ElectionReadResponse>(
    `/election/evidence/ke?locale=${locale}`,
    (v) =>
      v.domain === 'ELECTION' &&
      v.locale === locale &&
      Array.isArray(v.records) &&
      ((v.state === 'COVERAGE_GAP' && v.records.length === 0) ||
        (v.state === 'EVIDENCE' && v.records.length > 0 && v.records.every(electionRecord))),
  );
export const readPolitics = () =>
  read<PoliticsReadResponse>(
    '/politics/observations?limit=100',
    (v) =>
      v.acquisition === 'RETAINED_ONLY' &&
      Array.isArray(v.observations) &&
      typeof v.truncated === 'boolean' &&
      (v.observations.length > 0
        ? v.absence === null
        : ['NOT_ASSESSED', 'EVIDENCE_WITHHELD'].includes(v.absence ?? '')) &&
      (!v.coverage ||
        (count(v.coverage.checkedCaptures) &&
          count(v.coverage.admittedObservations) &&
          typeof v.coverage.withheld === 'boolean')) &&
      v.observations.every(
        (o) =>
          o.identity.domainId === 'POLITICS' &&
          text(o.identity.upstreamAuthority) &&
          text(o.observationKey) &&
          text(o.subjectId) &&
          ['ELECTION', 'LEGISLATIVE_SUBJECT', 'PROTEST_CAMPAIGN'].includes(o.subjectType) &&
          ['ELECTION_PROCESS_NOTICE', 'LEGISLATIVE_STAGE', 'PROTEST_HELD'].includes(o.claim.kind) &&
          text(o.claim.sourceText) &&
          text(o.claim.stage) &&
          ['NEWS_PROVIDER', 'OFFICIAL_SOURCE', 'PUBLIC_DATA'].includes(o.provenance.sourceType) &&
          ['PRIMARY_RECORD', 'REPORTING'].includes(o.provenance.evidenceRole ?? '') &&
          text(o.provenance.language) &&
          (o.provenance.jurisdiction === undefined || text(o.provenance.jurisdiction)) &&
          date(o.publishedAt) &&
          date(o.temporal.retrievedAt) &&
          Array.isArray(o.attributeAuthorship) &&
          o.attributeAuthorship.every(
            (a: { attribute: string; authorship: string }) =>
              text(a.attribute) && ['PUBLISHER_STATED', 'LOCALLY_ASSERTED'].includes(a.authorship),
          ) &&
          sourceUrl(o.sourceReference.sourceUrl!),
      ),
  );
