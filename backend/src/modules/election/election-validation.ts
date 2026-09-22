import { createHash } from 'node:crypto';
import type {
  ElectionBundle,
  ElectionEvidence,
  RetainedArtifact,
  SourceCitation,
} from './election-evidence';

export function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}
function requireThat(ok: unknown, reason: string): asserts ok {
  if (!ok) throw new Error(`ELECTION_WITHHELD: ${reason}`);
}
function object(value: unknown, keys: string[]): void {
  requireThat(value && typeof value === 'object' && !Array.isArray(value), 'object required');
  requireThat(
    Object.keys(value).length === keys.length &&
      keys.every((k) => Object.prototype.hasOwnProperty.call(value, k)),
    'unknown or missing field',
  );
}
function text(value: unknown): asserts value is string {
  requireThat(
    typeof value === 'string' && value.trim().length > 0 && value.length <= 4000,
    'text required',
  );
}
function optionalText(value: unknown): void {
  if (value !== null) text(value);
}
function timestamp(value: unknown): void {
  text(value);
  requireThat(
    /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)),
    'timestamp required',
  );
}
function integer(value: unknown): void {
  requireThat(
    Number.isSafeInteger(value) && (value as number) >= 0,
    'nonnegative integer required',
  );
}
export function officialUrl(value: unknown): void {
  text(value);
  const u = new URL(value);
  requireThat(
    u.protocol === 'https:' &&
      ['www.iebc.or.ke', 'iebc.or.ke', 'forms.iebc.or.ke'].includes(u.hostname) &&
      !u.username &&
      !u.password &&
      (!u.port || u.port === '443'),
    'official HTTPS origin required',
  );
}
/** Pure offline validation. Unknown fields are rejected, including rankings and candidate dossiers. */
export function validateBundle(candidate: unknown): ElectionBundle {
  // This view is not trusted until all runtime checks below have succeeded.
  const input = candidate as ElectionBundle;
  object(input, ['schemaVersion', 'captureId', 'artifacts', 'records', 'admission']);
  requireThat(input.schemaVersion === 1, 'schema version');
  text(input.captureId);
  requireThat(
    Array.isArray(input.artifacts) && input.artifacts.length > 0 && input.artifacts.length <= 4,
    'bounded artifacts',
  );
  const artifacts = new Map<string, RetainedArtifact>();
  for (const a of input.artifacts) {
    object(a, [
      'sha256',
      'bodyBase64',
      'requestedUrl',
      'finalUrl',
      'capturedAt',
      'mediaType',
      'httpStatus',
      'etag',
      'lastModified',
      'tlsPeerFingerprint256',
      'discoveredFrom',
    ]);
    officialUrl(a.requestedUrl);
    officialUrl(a.finalUrl);
    requireThat(a.requestedUrl === a.finalUrl, 'redirect refused');
    requireThat(a.httpStatus === 200, 'HTTP status');
    timestamp(a.capturedAt);
    text(a.mediaType);
    text(a.tlsPeerFingerprint256);
    optionalText(a.etag);
    optionalText(a.lastModified);
    if (a.discoveredFrom !== null) officialUrl(a.discoveredFrom);
    requireThat(
      typeof a.bodyBase64 === 'string' && a.bodyBase64.length <= 12 * 1024 * 1024,
      'bounded bytes',
    );
    const bytes = Buffer.from(a.bodyBase64, 'base64');
    requireThat(
      bytes.length > 0 && bytes.toString('base64') === a.bodyBase64 && sha256(bytes) === a.sha256,
      'artifact digest mismatch',
    );
    requireThat(!artifacts.has(a.sha256), 'duplicate artifact');
    artifacts.set(a.sha256, a);
  }
  const citation = (value: unknown): SourceCitation => {
    const c = value as SourceCitation;
    object(c, ['artifactSha256', 'locator', 'statement']);
    requireThat(artifacts.has(c.artifactSha256), 'unretained citation');
    text(c.locator);
    text(c.statement);
    return c as unknown as SourceCitation;
  };
  object(input.admission, ['policy', 'reviewedAt', 'reviewer', 'permittedKinds']);
  requireThat(input.admission.policy === 'KE-BOUNDED-R1', 'policy');
  timestamp(input.admission.reviewedAt);
  text(input.admission.reviewer);
  const kinds = ['FORM_AVAILABLE', 'FORM_REPORTED', 'TALLY_OBSERVATION', 'OFFICIAL_DECLARATION'];
  requireThat(
    Array.isArray(input.admission.permittedKinds) &&
      input.admission.permittedKinds.every((k: unknown) => kinds.includes(k as string)),
    'permitted kinds',
  );
  requireThat(
    Array.isArray(input.records) && input.records.length > 0 && input.records.length <= 30,
    'bounded records',
  );
  const ids = new Set<string>();
  const revisions = new Set<string>();
  const predecessors = new Map<string, ElectionEvidence>();
  for (const r of input.records) {
    const additional: Record<string, string[]> = {
      FORM_AVAILABLE: ['availability', 'documentRole'],
      FORM_REPORTED: ['publisherStatus', 'reported', 'total', 'unitLabel'],
      TALLY_OBSERVATION: [
        'publisherStatus',
        'publisherStatedAt',
        'expiresAt',
        'scope',
        'votes',
        'registeredVoters',
      ],
      OFFICIAL_DECLARATION: ['publisherStatus', 'declaredAt', 'votesAsPublished', 'declaredPerson'],
    };
    requireThat(
      r && kinds.includes(r.kind) && input.admission.permittedKinds.includes(r.kind),
      'unadmitted kind',
    );
    object(r, [
      'id',
      'election',
      'form',
      'capturedAt',
      'sourceLanguage',
      'source',
      'revision',
      'citation',
      'kind',
      ...additional[r.kind],
    ]);
    text(r.id);
    requireThat(!ids.has(r.id), 'duplicate evidence');
    ids.add(r.id);
    timestamp(r.capturedAt);
    text(r.sourceLanguage);
    requireThat(/^[a-z]{2,3}(-[A-Za-z0-9]+)*$/.test(r.sourceLanguage), 'source language');
    object(r.source, ['publisher', 'url', 'artifactSha256']);
    requireThat(r.source.publisher === 'IEBC', 'publisher');
    officialUrl(r.source.url);
    const a = artifacts.get(r.source.artifactSha256);
    requireThat(
      a && a.finalUrl === r.source.url && a.capturedAt === r.capturedAt,
      'source lineage mismatch',
    );
    requireThat(
      citation(r.citation).artifactSha256 === r.source.artifactSha256,
      'record citation mismatch',
    );
    object(r.revision, ['id', 'ordinal', 'supersedes', 'kind', 'publisherReason']);
    text(r.revision.id);
    integer(r.revision.ordinal);
    optionalText(r.revision.publisherReason);
    requireThat(!revisions.has(r.revision.id), 'duplicate revision');
    requireThat(
      r.revision.ordinal === 0
        ? r.revision.kind === 'INITIAL' && r.revision.supersedes === null
        : ['SOURCE_REVISION', 'CORRECTION'].includes(r.revision.kind) &&
            revisions.has(r.revision.supersedes),
      'broken revision chain',
    );
    revisions.add(r.revision.id);
    object(r.election, [
      'eventId',
      'publisherEventLabel',
      'cycle',
      'electionDate',
      'electivePosition',
      'administrativeGeography',
      'reportingGeography',
      'citation',
    ]);
    if (r.revision.supersedes !== null) {
      const previous = predecessors.get(r.revision.supersedes);
      requireThat(
        previous &&
          previous.revision.ordinal + 1 === r.revision.ordinal &&
          previous.kind === r.kind &&
          previous.election.eventId === r.election.eventId &&
          JSON.stringify(previous.form) === JSON.stringify(r.form),
        'revision identity mismatch',
      );
      requireThat(
        Date.parse(r.capturedAt) >= Date.parse(previous.capturedAt),
        'revision time regressed',
      );
      if (
        r.kind === 'TALLY_OBSERVATION' &&
        previous.kind === 'TALLY_OBSERVATION' &&
        r.revision.kind !== 'CORRECTION'
      ) {
        for (const old of previous.votes) {
          const current = r.votes.find(
            (v: { candidateBallotName: string; votesAsPublished: string }) =>
              v.candidateBallotName === old.candidateBallotName,
          );
          requireThat(
            current && Number(current.votesAsPublished) >= Number(old.votesAsPublished),
            'unexplained tally decrease',
          );
        }
      }
    }
    predecessors.set(r.revision.id, r);
    text(r.election.eventId);
    text(r.election.publisherEventLabel);
    optionalText(r.election.cycle);
    optionalText(r.election.electionDate);
    optionalText(r.election.electivePosition);
    citation(r.election.citation);
    requireThat(
      Array.isArray(r.election.administrativeGeography) &&
        r.election.administrativeGeography.length <= 4,
      'administrative geography',
    );
    for (const g of r.election.administrativeGeography) {
      object(g, ['kind', 'label', 'officialCode']);
      requireThat(['COUNTRY', 'COUNTY', 'CONSTITUENCY', 'WARD'].includes(g.kind), 'geography kind');
      text(g.label);
      optionalText(g.officialCode);
    }
    if (r.election.reportingGeography !== null) {
      const g = r.election.reportingGeography;
      object(g, ['kind', 'label', 'officialCode', 'citation']);
      requireThat(
        ['POLLING_STATION', 'POLLING_CENTRE', 'TALLYING_CENTRE'].includes(g.kind),
        'reporting geography',
      );
      text(g.label);
      optionalText(g.officialCode);
      citation(g.citation);
    }
    if (r.form !== null) {
      object(r.form, ['publisherIdentity', 'formType', 'serial']);
      text(r.form.publisherIdentity);
      text(r.form.formType);
      optionalText(r.form.serial);
    }
    if (r.kind === 'FORM_AVAILABLE') {
      requireThat(
        r.form &&
          r.availability === 'AVAILABLE' &&
          ['BLANK_TEMPLATE', 'COMPLETED_FORM'].includes(r.documentRole),
        'form availability',
      );
    }
    if (r.kind === 'FORM_REPORTED') {
      text(r.publisherStatus);
      integer(r.reported);
      integer(r.total);
      requireThat(r.total > 0 && r.reported <= r.total, 'form denominator');
      text(r.unitLabel);
    }
    if (r.kind === 'OFFICIAL_DECLARATION') {
      text(r.publisherStatus);
      requireThat(/declar|elected/i.test(r.citation.statement), 'explicit declaration required');
      if (r.declaredAt !== null) {
        text(r.declaredAt);
        requireThat(
          /^\d{4}-\d{2}-\d{2}$/.test(r.declaredAt) && Number.isFinite(Date.parse(r.declaredAt)),
          'declaration date',
        );
      }
      optionalText(r.votesAsPublished);
      if (r.votesAsPublished !== null)
        requireThat(
          /^(0|[1-9][0-9]{0,2}(,[0-9]{3})*|[1-9][0-9]*)$/.test(r.votesAsPublished) &&
            r.citation.statement.includes(r.votesAsPublished),
          'declaration votes citation',
        );
      object(r.declaredPerson, ['ballotName', 'partyAsPublished']);
      text(r.declaredPerson.ballotName);
      optionalText(r.declaredPerson.partyAsPublished);
      requireThat(
        r.citation.statement.includes(r.declaredPerson.ballotName),
        'declaration person absent from citation',
      );
    }
    if (r.kind === 'TALLY_OBSERVATION') {
      text(r.publisherStatus);
      timestamp(r.publisherStatedAt);
      timestamp(r.expiresAt);
      requireThat(
        r.election.electionDate !== null &&
          Date.parse(r.publisherStatedAt) >= Date.parse(r.election.electionDate),
        'tally before election',
      );
      requireThat(r.election.reportingGeography !== null, 'publisher reporting unit required');
      requireThat(
        Date.parse(r.expiresAt) > Date.parse(r.publisherStatedAt) &&
          Date.parse(r.expiresAt) - Date.parse(r.publisherStatedAt) <= 6 * 3600000,
        'provisional window',
      );
      object(r.scope, ['reported', 'total', 'unitLabel']);
      integer(r.scope.reported);
      integer(r.scope.total);
      text(r.scope.unitLabel);
      requireThat(r.scope.total > 0 && r.scope.reported <= r.scope.total, 'tally denominator');
      integer(r.registeredVoters);
      requireThat(
        Array.isArray(r.votes) && r.votes.length > 0 && r.votes.length <= 100,
        'bounded votes',
      );
      let total = 0;
      const names = new Set<string>();
      for (const v of r.votes) {
        object(v, [
          'candidateBallotName',
          'authorityCandidateCode',
          'partyAsPublished',
          'votesAsPublished',
          'citation',
        ]);
        text(v.candidateBallotName);
        optionalText(v.authorityCandidateCode);
        optionalText(v.partyAsPublished);
        requireThat(
          typeof v.votesAsPublished === 'string' && /^(0|[1-9][0-9]*)$/.test(v.votesAsPublished),
          'integer vote string',
        );
        requireThat(Number.isSafeInteger(Number(v.votesAsPublished)), 'vote range');
        requireThat(!names.has(v.candidateBallotName), 'duplicate candidate');
        names.add(v.candidateBallotName);
        total += Number(v.votesAsPublished);
        citation(v.citation);
      }
      requireThat(total <= r.registeredVoters, 'votes exceed registration');
    }
  }
  return input as unknown as ElectionBundle;
}
