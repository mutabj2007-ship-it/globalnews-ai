import type { Pool } from 'pg';
import { assertObservationRevisionAppends, type DomainObservation } from '@globalnews-ai/shared';
import {
  assertAdmittedRetainedEvidence,
  RetainedEvidenceRefused,
  sha256,
  type AdmittedRetainedEvidence,
  type RetainedExtentClaim,
} from './retained-evidence';

interface RetainedRevision {
  readonly artifactSha256: string;
  readonly sourceFingerprint: string;
  readonly sourceRevisionId: string;
  readonly geometryRevisionId: string;
  readonly geometrySha256: string;
  readonly observation: DomainObservation<RetainedExtentClaim>;
}
export interface RetainedWriteReceipt {
  readonly outcome: 'APPENDED' | 'DUPLICATE';
  readonly observationKey: string;
  readonly revisionOrdinal: number;
  readonly captureKey: string;
}

/** Scientific source facts only; receipt/authority refreshes are not source revisions. */
function fingerprint(value: AdmittedRetainedEvidence): string {
  return sha256(
    JSON.stringify([
      value.observation.identity,
      value.sourceRevisionId,
      value.predecessorRevisionId,
      value.geometryRevisionId,
      value.geometrySha256,
      value.publisherReleasedAt,
      value.observation.temporal.occurredAt ?? null,
      value.observation.temporal.publisherVintage,
      value.observation.claim.countryIso2,
    ]),
  );
}

/**
 * Explicitly constructed offline by a governed importer, never registered in AppModule.
 * Uses the dedicated hum_retention_writer role. No public or producer role may read
 * these tables. Transactions and per-observation locks preserve append-only lineage.
 */
export class HumanitarianRetainedRepository {
  constructor(private readonly pool: Pool) {}

  async append(value: AdmittedRetainedEvidence): Promise<RetainedWriteReceipt> {
    assertAdmittedRetainedEvidence(value);
    const client = await this.pool.connect();
    const key = value.observation.observationKey;
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL lock_timeout = '5s'");
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
      const head = await client.query<{ evidence: RetainedRevision }>(
        'SELECT evidence FROM hum_authority.retained_observation_revision WHERE observation_key=$1 ORDER BY revision_ordinal DESC LIMIT 1',
        [key],
      );
      const prior = head.rows[0]?.evidence;
      const existing = await client.query<{ evidence: RetainedRevision }>(
        'SELECT evidence FROM hum_authority.retained_observation_revision WHERE observation_key=$1 AND source_revision_id=$2',
        [key, value.sourceRevisionId],
      );
      const duplicate = existing.rows[0]?.evidence;
      const sourceFingerprint = fingerprint(value);
      if (
        duplicate &&
        (duplicate.artifactSha256 !== value.artifactSha256 ||
          duplicate.sourceFingerprint !== sourceFingerprint)
      ) {
        throw new RetainedEvidenceRefused('Source revision identity reused for different evidence');
      }
      if (!duplicate) {
        if (value.predecessorRevisionId !== (prior?.sourceRevisionId ?? null)) {
          throw new RetainedEvidenceRefused('Missing predecessor or divergent revision branch');
        }
        if (
          prior &&
          (Date.parse(value.observation.temporal.publisherVintage!) <=
            Date.parse(prior.observation.temporal.publisherVintage!) ||
            Date.parse(value.observation.temporal.retrievedAt) <
              Date.parse(prior.observation.temporal.retrievedAt) ||
            Date.parse(value.observation.revision.recordedAt) <
              Date.parse(prior.observation.revision.recordedAt))
        ) {
          throw new RetainedEvidenceRefused('Revision chronology does not advance');
        }
        const geometry = await client.query<{ geometry_sha256: string }>(
          'SELECT geometry_sha256 FROM hum_authority.retained_observation_revision WHERE observation_key=$1 AND geometry_revision_id=$2 LIMIT 1',
          [key, value.geometryRevisionId],
        );
        if (geometry.rows[0] && geometry.rows[0].geometry_sha256 !== value.geometrySha256) {
          throw new RetainedEvidenceRefused(
            'Geometry changed without a new source geometry revision',
          );
        }
      }
      // Preserve every approved capture receipt, even a byte-identical recapture.
      await client.query(
        'INSERT INTO hum_authority.retained_capture (capture_key,artifact_sha256,source_url,captured_at,approval_id,raw_bytes,observation_key,source_revision_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (capture_key) DO NOTHING',
        [
          value.captureKey,
          value.artifactSha256,
          value.observation.sourceReference.sourceUrl,
          value.observation.temporal.retrievedAt,
          value.approvalId,
          Buffer.from(value.rawBase64, 'base64'),
          key,
          value.sourceRevisionId,
        ],
      );
      const capture = await client.query<{ observation_key: string; source_revision_id: string }>(
        'SELECT observation_key,source_revision_id FROM hum_authority.retained_capture WHERE capture_key=$1',
        [value.captureKey],
      );
      if (
        capture.rows[0]?.observation_key !== key ||
        capture.rows[0]?.source_revision_id !== value.sourceRevisionId
      ) {
        throw new RetainedEvidenceRefused(
          'Capture identity was assigned to different source facts',
        );
      }
      const ordinal =
        duplicate?.observation.revision.revisionOrdinal ??
        (prior ? prior.observation.revision.revisionOrdinal + 1 : 0);
      if (!duplicate) {
        const observation: DomainObservation<RetainedExtentClaim> = {
          ...value.observation,
          revision: {
            revisionOrdinal: ordinal,
            supersedesRevisionOrdinal: prior ? ordinal - 1 : null,
            ...(prior ? { revisionKind: 'SOURCE_REVISION' as const } : {}),
            recordedAt: value.observation.revision.recordedAt,
          },
        };
        if (prior)
          assertObservationRevisionAppends(prior.observation.revision, observation.revision);
        const { rawBase64: _raw, ...metadata } = value;
        await client.query(
          'INSERT INTO hum_authority.retained_observation_revision (observation_key,revision_ordinal,source_revision_id,geometry_revision_id,geometry_sha256,capture_key,evidence) VALUES ($1,$2,$3,$4,$5,$6,$7)',
          [
            key,
            ordinal,
            value.sourceRevisionId,
            value.geometryRevisionId,
            value.geometrySha256,
            value.captureKey,
            { ...metadata, sourceFingerprint, observation },
          ],
        );
      }
      // If authority changed during asynchronous IO, persist nothing.
      assertAdmittedRetainedEvidence(value);
      await client.query('COMMIT');
      return {
        outcome: duplicate ? 'DUPLICATE' : 'APPENDED',
        observationKey: key,
        revisionOrdinal: ordinal,
        captureKey: value.captureKey,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
