import { createHash } from 'node:crypto';
import {
  assertAuthorityIsInstalled,
  assertDomainObservationIsWellFormed,
  domainObservationKey,
  findCountryByIso2,
  parseStrictJson,
  type DomainObservation,
  type ProtectionAuthority,
} from '@globalnews-ai/shared';
import { humanitarianProtectionAuthority } from '../humanitarian-authority.loader';
import {
  GovernedIntakeService,
  type GovernedGeometryRow,
  type GovernedProtectionResolver,
} from '../intake/governed-intake.service';
import {
  produceInundationExtents,
  COPERNICUS_SOURCE_ID,
} from '../producers/copernicus-ems.producer';

export const MAX_RETAINED_ARTIFACT_BYTES = 2 * 1024 * 1024;
export type SourceFact =
  | 'eventId'
  | 'observationId'
  | 'productId'
  | 'featureId'
  | 'sourceRevisionId'
  | 'predecessorRevisionId'
  | 'geometryRevisionId'
  | 'publisherReleasedAt'
  | 'publisherRevisedAt'
  | 'countryIso2'
  | 'geometryType'
  | 'crs'
  | 'coordinates';
export type SourcePath = readonly (string | number)[];

/**
 * Trusted capture-review output, NEVER read from the candidate body.
 * Paths select facts verbatim from original JSON bytes; this is an internal review
 * contract, not a claim that Copernicus publishes this envelope or field layout.
 */
export interface ReviewedCapture {
  readonly approvalId: string;
  readonly artifactSha256: string;
  readonly sourceId: typeof COPERNICUS_SOURCE_ID;
  readonly sourceUrl: string;
  readonly capturedAt: string;
  readonly citation: string;
  readonly facts: Readonly<Record<SourceFact, SourcePath>>;
  readonly occurredAt?: SourcePath;
}

/** No production provider of this authority is bound. No caller-supplied approval flag. */
export interface RetainedCaptureReviewAuthority {
  review(artifactSha256: string): ReviewedCapture | null;
}
export const NO_RETAINED_CAPTURE_APPROVAL: RetainedCaptureReviewAuthority = Object.freeze({
  review: () => null,
});

export class RetainedEvidenceRefused extends Error {
  constructor(
    message: string,
    readonly geometryRefusalCodes: readonly string[] = [],
  ) {
    super(message);
  }
}

export function sha256(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function timestamp(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().replace('.000Z', 'Z') !== value.replace('.000Z', 'Z')
  ) {
    throw new RetainedEvidenceRefused('Explicit valid UTC timestamp required');
  }
  return value;
}

function identifier(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 512 ||
    value.trim() !== value ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new RetainedEvidenceRefused('Explicit source identity required');
  }
  return value;
}

function at(value: unknown, path: SourcePath): unknown {
  if (!Array.isArray(path) || path.length === 0 || path.length > 32) {
    throw new RetainedEvidenceRefused('Reviewed source field path required');
  }
  for (const segment of path) {
    if (
      (typeof segment !== 'string' && typeof segment !== 'number') ||
      typeof value !== 'object' ||
      value === null ||
      !Object.prototype.hasOwnProperty.call(value, segment)
    ) {
      throw new RetainedEvidenceRefused('Source artifact does not establish required field');
    }
    value = (value as Record<string | number, unknown>)[segment];
  }
  return value;
}

export interface RetainedExtentClaim {
  readonly countryIso2: string;
  readonly geometry: GovernedGeometryRow;
}
export interface AdmittedRetainedEvidence {
  readonly captureKey: string;
  readonly artifactSha256: string;
  readonly rawBase64: string;
  readonly approvalId: string;
  readonly sourceRevisionId: string;
  readonly predecessorRevisionId: string | null;
  readonly geometryRevisionId: string;
  readonly geometrySha256: string;
  readonly publisherReleasedAt: string;
  readonly authorityEpoch: number;
  readonly authorityDigest: string;
  readonly observation: DomainObservation<RetainedExtentClaim>;
}

const admitted = new WeakSet<object>();
const installedFor = new WeakMap<object, ProtectionAuthority>();
function freezeDeep(value: object): void {
  for (const child of Object.values(value))
    if (child && typeof child === 'object') freezeDeep(child);
  Object.freeze(value);
}
export function assertAdmittedRetainedEvidence(value: AdmittedRetainedEvidence): void {
  const authority = installedFor.get(value);
  if (!admitted.has(value) || !authority) throw new RetainedEvidenceRefused('Unadmitted evidence');
  assertAuthorityIsInstalled(authority);
}

/**
 * Offline admission only. No network, file discovery, default store or Nest registration.
 * Approval is hash-bound and re-derived facts must be present in original source bytes.
 */
export async function admitRetainedEvidence(
  bytes: Uint8Array,
  reviewAuthority: RetainedCaptureReviewAuthority,
  resolver: GovernedProtectionResolver,
  recordedAt: string,
): Promise<AdmittedRetainedEvidence> {
  const authority = humanitarianProtectionAuthority();
  assertAuthorityIsInstalled(authority);
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_RETAINED_ARTIFACT_BYTES) {
    throw new RetainedEvidenceRefused('Artifact size outside admission bound');
  }
  const raw = Buffer.from(bytes); // own the bytes before any asynchronous work
  const artifactSha256 = sha256(raw);
  const review = reviewAuthority.review(artifactSha256);
  if (
    !review ||
    review.artifactSha256 !== artifactSha256 ||
    review.sourceId !== COPERNICUS_SOURCE_ID
  ) {
    throw new RetainedEvidenceRefused('No matching governed capture approval');
  }
  const approvalId = identifier(review.approvalId);
  const citation = identifier(review.citation);
  const reviewedSourceUrl = review.sourceUrl;
  const sourceUrl = new URL(reviewedSourceUrl);
  if (
    sourceUrl.protocol !== 'https:' ||
    sourceUrl.username ||
    sourceUrl.password ||
    sourceUrl.hash
  ) {
    throw new RetainedEvidenceRefused('Invalid capture provenance address');
  }
  const capturedAt = timestamp(review.capturedAt);
  const observedAt = timestamp(recordedAt);
  if (Date.parse(capturedAt) > Date.parse(observedAt))
    throw new RetainedEvidenceRefused('Capture follows observation');
  const parsed = parseStrictJson(raw);
  if (!parsed.ok) throw new RetainedEvidenceRefused('Malformed source artifact');
  const get = (name: SourceFact): unknown => at(parsed.value, review.facts[name]);
  const eventId = identifier(get('eventId'));
  const sourceObservationId = identifier(get('observationId'));
  const sourceRevisionId = identifier(get('sourceRevisionId'));
  const predecessor = get('predecessorRevisionId');
  const predecessorRevisionId = predecessor === null ? null : identifier(predecessor);
  if (predecessorRevisionId === sourceRevisionId)
    throw new RetainedEvidenceRefused('Self-referencing revision');
  const geometryRevisionId = identifier(get('geometryRevisionId'));
  const publisherReleasedAt = timestamp(get('publisherReleasedAt'));
  const publisherRevisedAt = timestamp(get('publisherRevisedAt'));
  const occurredAt = review.occurredAt ? timestamp(at(parsed.value, review.occurredAt)) : undefined;
  if (
    Date.parse(publisherReleasedAt) > Date.parse(publisherRevisedAt) ||
    Date.parse(publisherRevisedAt) > Date.parse(capturedAt) ||
    (occurredAt !== undefined && Date.parse(occurredAt) > Date.parse(publisherReleasedAt))
  ) {
    throw new RetainedEvidenceRefused('Source chronology disagrees');
  }
  const countryIso2 = identifier(get('countryIso2'));
  if (!/^[A-Z]{2}$/.test(countryIso2) || !findCountryByIso2(countryIso2)) {
    throw new RetainedEvidenceRefused('Source country identity is unsupported');
  }
  const identity = {
    domainId: 'HUMANITARIAN',
    upstreamAuthority: COPERNICUS_SOURCE_ID,
    upstreamId: JSON.stringify([eventId, sourceObservationId]),
  };
  const observationKey = domainObservationKey(identity);
  const rows: GovernedGeometryRow[] = [];
  const produced = produceInundationExtents(
    {
      features: [
        {
          activationCode: eventId,
          productId: identifier(get('productId')),
          featureId: identifier(get('featureId')),
          geometryType: identifier(get('geometryType')),
          crs: identifier(get('crs')),
          coordinates: get('coordinates'),
        },
      ],
    },
    {
      // The producer receives no protection choices from the artifact.
      keyFor: () => {
        const keys = resolver.resolve(observationKey);
        return keys === null ? null : { recordKey: observationKey, ...keys };
      },
    },
  );
  if (produced.withheld.length || produced.emitted.length !== 1) {
    throw new RetainedEvidenceRefused(
      'Geometry or authority refused source evidence',
      produced.withheld.map((record) => record.code),
    );
  }
  const geometry = produced.emitted[0]!.geometry;
  const intake = new GovernedIntakeService(
    resolver,
    {
      insertGeometryRecord: async (row) => {
        rows.push(row);
      },
    },
    () => authority,
  );
  const receipt = await intake.admit([
    {
      recordKey: observationKey,
      sourceId: COPERNICUS_SOURCE_ID,
      sourceGeometryId: geometry.sourceGeometryId!,
      emittingDomainId: 'HUMANITARIAN',
      geometryKind: geometry.kind,
      denotation: geometry.denotation,
      origin: geometry.origin,
      crs: geometry.crs,
      coordinates: geometry.coordinates!,
    },
  ]);
  if (receipt.admitted !== 1 || rows.length !== 1 || !rows[0]!.presentationPartitionKey.trim())
    throw new RetainedEvidenceRefused('Authority did not admit record');
  const keyed = produced.emitted[0]!;
  if (
    rows[0]!.presentationPartitionKey !== keyed.presentationPartitionKey ||
    rows[0]!.protectionClassId !== (keyed.protectionClassId ?? null)
  ) {
    throw new RetainedEvidenceRefused('Authority resolution changed during admission');
  }
  const observation: DomainObservation<RetainedExtentClaim> = {
    observationKey,
    identity,
    observationKind: 'SOURCE_INUNDATION_EXTENT',
    subjectType: 'SOURCE_EVENT',
    subjectId: eventId,
    claim: { countryIso2, geometry: rows[0]! },
    temporal: {
      ...(occurredAt ? { occurredAt } : {}),
      publisherVintage: publisherRevisedAt,
      retrievedAt: capturedAt,
      temporalBasis: 'PUBLISHER_VINTAGE',
    },
    provenance: {
      sourceType: 'PUBLIC_DATA',
      providerId: COPERNICUS_SOURCE_ID,
      sourceUrl: reviewedSourceUrl,
      retrievedAt: capturedAt,
      evidenceRole: 'PRIMARY_RECORD',
    },
    sourceReference: { sourceUrl: reviewedSourceUrl, citation },
    attributeAuthorship: [
      { attribute: 'geometry', authorship: 'PUBLISHER_STATED' },
      { attribute: 'countryIso2', authorship: 'PUBLISHER_STATED' },
    ],
    // Repository assigns the contiguous ordinal after locking and checking the chain.
    revision: { revisionOrdinal: 0, supersedesRevisionOrdinal: null, recordedAt: observedAt },
  };
  assertDomainObservationIsWellFormed(observation);
  const value: AdmittedRetainedEvidence = {
    captureKey: sha256(JSON.stringify([artifactSha256, reviewedSourceUrl, capturedAt, approvalId])),
    artifactSha256,
    rawBase64: raw.toString('base64'),
    approvalId,
    sourceRevisionId,
    predecessorRevisionId,
    geometryRevisionId,
    geometrySha256: sha256(
      JSON.stringify([
        geometry.kind,
        geometry.denotation,
        geometry.origin,
        geometry.crs,
        geometry.coordinates,
      ]),
    ),
    publisherReleasedAt,
    authorityEpoch: authority.epoch,
    authorityDigest: authority.sourceDigest,
    observation,
  };
  // Freeze all nested data; a genuine admission cannot be mutated after validation.
  freezeDeep(value);
  admitted.add(value);
  installedFor.set(value, authority);
  assertAdmittedRetainedEvidence(value);
  return value;
}
