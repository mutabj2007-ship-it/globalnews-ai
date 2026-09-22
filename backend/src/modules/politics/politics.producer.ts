import { createHash } from 'node:crypto';
import {
  assertDomainObservationIsWellFormed, assertObservationRevisionAppends,
  determinationIsAccountable, LEGISLATIVE_STAGES, resolveConflictEventOwner,
  type EditorialDetermination, type OwnershipThresholds,
  type RetainedPoliticsObservation,
} from '@globalnews-ai/shared';

/** Internal reviewed capture input. Never a public request body or a provider adapter. */
export interface PoliticsCapture {
  observation: RetainedPoliticsObservation;
  artifact: {
    origin: 'CAPTURED_SOURCE' | 'PREVIEW_FIXTURE';
    text: string;
    sha256: string;
    sourceUrl: string;
    capturedAt: string;
    language: string;
  };
  review: {
    reviewer: string;
    reviewedAt: string;
    rationale: string;
    publicDisplayAuthorized: boolean;
    rightsBasis: string;
    evidenceSufficient: boolean;
    activity: 'POLITICAL_PROCESS' | 'SPEECH_ONLY' | 'CRIME' | 'UNKNOWN';
    ownership: OwnershipThresholds;
    sustainedMobilisation?: EditorialDetermination;
  };
}

const nonempty = (s: string | undefined): boolean => typeof s === 'string' && s.trim().length > 0;
const date = (s: string): number => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(s) || !Number.isFinite(Date.parse(s))) {
    throw new Error('Invalid chronology');
  }
  const [year, month, day] = s.slice(0, 10).split('-').map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) throw new Error('Invalid calendar date');
  return Date.parse(s);
};
const requireEvidence = (ok: boolean): void => { if (!ok) throw new Error('Politics evidence withheld'); };
export const politicsArtifactHash = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => JSON.stringify(k) + ':' + canonical(v)).join(',') + '}';
  }
  return JSON.stringify(value);
};

/** Pure offline producer: no fetching, scheduling, database or generated text. */
export function producePoliticsObservation(capture: PoliticsCapture): RetainedPoliticsObservation {
  const { observation: o, artifact: a, review: r } = capture;
  requireEvidence(a.origin === 'CAPTURED_SOURCE' && r.publicDisplayAuthorized === true && r.evidenceSufficient === true);
  requireEvidence(nonempty(r.reviewer) && !/^(system|auto|ai|model)$/i.test(r.reviewer.trim()) && nonempty(r.rationale) && nonempty(r.rightsBasis));
  requireEvidence(r.activity === 'POLITICAL_PROCESS' && r.ownership.violenceOrProtectivePosture === false && r.ownership.organisedArmedActorParticipates === false);
  requireEvidence(resolveConflictEventOwner(r.ownership) === 'POLITICS');
  assertDomainObservationIsWellFormed(o);
  requireEvidence(o.identity.domainId === 'POLITICS' && nonempty(o.identity.upstreamAuthority) && nonempty(o.subjectId));
  requireEvidence(nonempty(a.text) && a.text.length <= 100_000 && /^[a-f0-9]{64}$/.test(a.sha256) && politicsArtifactHash(a.text) === a.sha256 && o.artifactSha256 === a.sha256);
  const url = new URL(a.sourceUrl);
  requireEvidence(['https:', 'http:'].includes(url.protocol) && !url.username && !url.password);
  requireEvidence(o.sourceReference.sourceUrl === a.sourceUrl && o.provenance.sourceUrl === a.sourceUrl);
  requireEvidence(nonempty(a.language) && o.provenance.language === a.language && o.provenance.retrievedAt === a.capturedAt && o.temporal.retrievedAt === a.capturedAt);
  requireEvidence(['NEWS_PROVIDER', 'OFFICIAL_SOURCE', 'PUBLIC_DATA'].includes(o.provenance.sourceType));
  requireEvidence(['PRIMARY_RECORD', 'REPORTING'].includes(o.provenance.evidenceRole ?? ''));
  requireEvidence(Object.keys(o.claim).sort().join(',') === 'kind,sourceText,stage');
  requireEvidence(nonempty(o.claim.sourceText) && o.claim.sourceText.length <= 2000 && a.text.includes(o.claim.sourceText));
  requireEvidence(o.observationKind === o.claim.kind);
  requireEvidence(['kind', 'stage', 'sourceText'].every(attribute => o.attributeAuthorship.some(row => row.attribute === attribute)));
  requireEvidence(o.attributeAuthorship.find(row => row.attribute === 'sourceText')?.authorship === 'PUBLISHER_STATED');
  const published = date(o.publishedAt), captured = date(a.capturedAt), recorded = date(o.revision.recordedAt);
  requireEvidence(published <= captured && captured <= recorded && recorded <= date(r.reviewedAt));
  requireEvidence(o.temporal.publisherVintage === (o.sourceUpdatedAt ?? o.publishedAt));
  if (o.sourceUpdatedAt) requireEvidence(published <= date(o.sourceUpdatedAt) && date(o.sourceUpdatedAt) <= captured);
  if (o.temporal.occurredAt) requireEvidence(date(o.temporal.occurredAt) <= captured);
  requireEvidence(['OCCURRENCE', 'PUBLISHER_VINTAGE', 'RETRIEVAL_ONLY'].includes(o.temporal.temporalBasis));
  requireEvidence(Number.isInteger(o.revision.revisionOrdinal) && o.revision.revisionOrdinal >= 0);
  if (o.revision.revisionKind) requireEvidence(['CORRECTION', 'CLASSIFICATION_CHANGE', 'SOURCE_REVISION', 'RETRACTION'].includes(o.revision.revisionKind));
  switch (o.claim.kind) {
    case 'PROTEST_HELD': {
      requireEvidence(o.subjectType === 'PROTEST_CAMPAIGN' && o.claim.stage === 'HELD' && nonempty(o.temporal.occurredAt));
      const d = r.sustainedMobilisation;
      requireEvidence(!!d && d.kind === 'SUSTAINED_MOBILISATION' && d.admitted === true && d.aboutRefs.includes(o.subjectId) && determinationIsAccountable(d));
      requireEvidence(date(d!.decidedAt) <= date(r.reviewedAt));
      break;
    }
    case 'LEGISLATIVE_STAGE':
      requireEvidence(o.subjectType === 'LEGISLATIVE_SUBJECT' && LEGISLATIVE_STAGES.includes(o.claim.stage) && o.provenance.evidenceRole === 'PRIMARY_RECORD');
      break;
    case 'ELECTION_PROCESS_NOTICE':
      requireEvidence(o.subjectType === 'ELECTION' && o.claim.stage === 'ANNOUNCED' && o.provenance.evidenceRole === 'PRIMARY_RECORD');
      break;
    default: throw new Error('Unsupported political claim');
  }
  // Explicit projection prevents internal review/capture fields entering public output.
  return JSON.parse(JSON.stringify({
    observationKey: o.observationKey, identity: o.identity, observationKind: o.observationKind,
    subjectType: o.subjectType, subjectId: o.subjectId, claim: o.claim, temporal: o.temporal,
    provenance: o.provenance, sourceReference: o.sourceReference, attributeAuthorship: o.attributeAuthorship,
    revision: o.revision, publishedAt: o.publishedAt, sourceUpdatedAt: o.sourceUpdatedAt, artifactSha256: o.artifactSha256,
  })) as RetainedPoliticsObservation;
}

/** A bad revision withholds its whole identity; older claims must not survive a failed correction. */
export function producePoliticsLedger(captures: readonly PoliticsCapture[]): { observations: RetainedPoliticsObservation[]; withheld: boolean } {
  if (captures.length > 500 || JSON.stringify(captures).length > 2_000_000) return { observations: [], withheld: true };
  const groups = new Map<string, PoliticsCapture[]>();
  let withheld = false;
  for (const c of captures) {
    const key = c?.observation?.observationKey;
    if (typeof key !== 'string') return { observations: [], withheld: true };
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  const observations: RetainedPoliticsObservation[] = [];
  for (const group of groups.values()) {
    try {
      const versions = new Map<number, RetainedPoliticsObservation>();
      for (const capture of group) {
        const o = producePoliticsObservation(capture), prior = versions.get(o.revision.revisionOrdinal);
        requireEvidence(!prior || canonical(prior) === canonical(o));
        versions.set(o.revision.revisionOrdinal, o);
      }
      const chain = [...versions.values()].sort((a, b) => a.revision.revisionOrdinal - b.revision.revisionOrdinal);
      requireEvidence(chain[0].revision.revisionOrdinal === 0 && chain[0].revision.supersedesRevisionOrdinal === null && chain[0].revision.revisionKind === undefined);
      for (let i = 1; i < chain.length; i++) {
        assertObservationRevisionAppends(chain[i - 1].revision, chain[i].revision);
        requireEvidence(chain[i].subjectId === chain[0].subjectId && chain[i].subjectType === chain[0].subjectType);
        requireEvidence(date(chain[i].revision.recordedAt) >= date(chain[i - 1].revision.recordedAt));
        requireEvidence(date(chain[i].temporal.retrievedAt) >= date(chain[i - 1].temporal.retrievedAt));
      }
      const latest = chain[chain.length - 1];
      if (latest.revision.revisionKind !== 'RETRACTION') observations.push(latest);
      else withheld = true;
    } catch { withheld = true; }
  }
  return { observations, withheld };
}
