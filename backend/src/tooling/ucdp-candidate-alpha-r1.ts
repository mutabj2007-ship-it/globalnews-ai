import { createHash } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { ConflictObservationProducer } from '../modules/conflict-observation/conflict-observation.producer';
import {
  MAX_UCDP_CANDIDATE_CSV_BYTES,
  normalizeUcdpCandidateCsv,
} from '../modules/conflict-observation/ucdp-candidate-csv.normalizer';
import {
  UCDP_CANDIDATE_AUGUST_2026,
  UCDP_CANDIDATE_RIGHTS,
} from '../modules/conflict-observation/ucdp-candidate.reviewed';

const RETRIEVAL_ID =
  'ucdp-candidate:26.0.8:2ad6e0b2bfdbaa31873716a3455096923a8539519d69d96aeeea2d0f44a34593';
const ENDPOINT_ID = 'UCDP_CANDIDATE_26_0_8';
const REQUEST_PATH = 'downloads/candidateged/GEDEvent_v26_0_8.csv';

function fail(reason: string): never {
  throw new Error(`UCDP_CANDIDATE_ALPHA_R1_REFUSED:${reason}`);
}

function digest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

async function capture(prisma: PrismaService): Promise<{
  retrievalId: string;
  scopedObservations: number;
  bytes: number;
}> {
  const existing = await prisma.snapshotRetrieval.findUnique({
    where: { retrievalId: RETRIEVAL_ID },
    include: { payload: true },
  });
  if (existing) {
    if (
      existing.providerId !== 'UCDP_GED' ||
      existing.endpointId !== ENDPOINT_ID ||
      existing.contentAddress !== UCDP_CANDIDATE_AUGUST_2026.sha256 ||
      existing.admissibility !== 'ADMITTED' ||
      existing.completeness !== 'COMPLETE' ||
      existing.parserId !== 'ucdp-candidate-csv' ||
      existing.parserVersion !== '1' ||
      existing.rightsGrade !== UCDP_CANDIDATE_RIGHTS.rightsGrade ||
      existing.payload?.storageState !== 'RETAINED' ||
      !existing.payload.bytes ||
      digest(existing.payload.bytes) !== UCDP_CANDIDATE_AUGUST_2026.sha256
    ) {
      fail('EXISTING_RETRIEVAL_MISMATCH');
    }
    const scoped = normalizeUcdpCandidateCsv(existing.payload.bytes, UCDP_CANDIDATE_AUGUST_2026, {
      retrievalId: RETRIEVAL_ID,
      runId: 'alpha-design-native-data-r1-preflight',
      ingestedAt: new Date().toISOString(),
    });
    return {
      retrievalId: RETRIEVAL_ID,
      scopedObservations: scoped.length,
      bytes: existing.payload.bytes.length,
    };
  }

  const requestedAt = new Date();
  const response = await fetch(UCDP_CANDIDATE_AUGUST_2026.sourceUrl, {
    headers: { accept: 'text/csv,*/*' },
    signal: AbortSignal.timeout(20_000),
    redirect: 'error',
  });
  const retrievedAt = new Date();
  if (!response.ok || response.status !== 200) fail(`HTTP_${response.status}`);
  if (response.url !== UCDP_CANDIDATE_AUGUST_2026.sourceUrl) fail('REDIRECT_ORIGIN_DRIFT');

  const mediaType = response.headers.get('content-type') ?? '';
  if (mediaType.split(';')[0].trim().toLowerCase() !== 'text/csv') fail('MEDIA_TYPE');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_UCDP_CANDIDATE_CSV_BYTES) fail('SIZE');
  const sha256 = digest(bytes);
  if (sha256 !== UCDP_CANDIDATE_AUGUST_2026.sha256) fail('DIGEST_DRIFT');

  const parsedAt = new Date();
  const scoped = normalizeUcdpCandidateCsv(bytes, UCDP_CANDIDATE_AUGUST_2026, {
    retrievalId: RETRIEVAL_ID,
    runId: 'alpha-design-native-data-r1-preflight',
    ingestedAt: parsedAt.toISOString(),
  });
  if (scoped.length === 0 || scoped.length > 500) fail('GOVERNED_SCOPE_BOUND');

  const contentEncoding = response.headers.get('content-encoding')?.trim().toLowerCase() || 'identity';
  if (!['identity', 'gzip'].includes(contentEncoding)) fail('CONTENT_ENCODING');

  await prisma.$transaction(
    async (tx) => {
      const payload = await tx.snapshotPayload.findUnique({ where: { contentAddress: sha256 } });
      if (payload) {
        if (
          payload.storageState !== 'RETAINED' ||
          !payload.bytes ||
          payload.byteLength !== bytes.length ||
          payload.mediaType.split(';')[0].trim().toLowerCase() !== 'text/csv' ||
          digest(payload.bytes) !== sha256
        ) {
          fail('EXISTING_PAYLOAD_MISMATCH');
        }
      } else {
        await tx.snapshotPayload.create({
          data: {
            contentAddress: sha256,
            bytes: Buffer.from(bytes),
            byteLength: bytes.length,
            mediaType,
            storageState: 'RETAINED',
          },
        });
      }

      await tx.snapshotRetrieval.create({
        data: {
          retrievalId: RETRIEVAL_ID,
          providerId: 'UCDP_GED',
          endpointId: ENDPOINT_ID,
          requestPath: REQUEST_PATH,
          parameters: [] as Prisma.InputJsonValue,
          requestedAt,
          retrievedAt,
          httpStatus: 200,
          mediaType,
          byteLength: bytes.length,
          contentAddress: sha256,
          completeness: 'COMPLETE',
          contentEncoding,
          wireByteLength: contentEncoding === 'identity' ? bytes.length : null,
          admissibility: 'ADMITTED',
          refusalKey: null,
          refusalClass: null,
          parserId: 'ucdp-candidate-csv',
          parserVersion: '1',
          parsedAt,
          rightsGrade: UCDP_CANDIDATE_RIGHTS.rightsGrade,
          rightsInstrumentRef: UCDP_CANDIDATE_RIGHTS.rightsInstrumentRef,
          payloadRetentionPermitted: UCDP_CANDIDATE_RIGHTS.payloadRetentionPermitted,
          editionAnnotations: {
            dataset: 'UCDP Candidate Events Dataset',
            datasetVersion: UCDP_CANDIDATE_AUGUST_2026.datasetVersion,
            releaseLabel: 'August 2026',
            license: 'CC BY 4.0',
            sourceUrl: UCDP_CANDIDATE_AUGUST_2026.sourceUrl,
          } as Prisma.InputJsonValue,
          publisherReleasedAt: null,
          publisherChangedAt: null,
          referencePeriod: '2026-08',
          sourceLanguage: null,
          extractorId: null,
          extractorVersion: null,
        },
      });
    },
    { isolationLevel: 'Serializable', timeout: 30_000 },
  );

  return { retrievalId: RETRIEVAL_ID, scopedObservations: scoped.length, bytes: bytes.length };
}

async function main(): Promise<void> {
  if (process.env.ALPHA_UCDP_CANDIDATE_R1_APPLY !== 'YES') {
    fail('EXPLICIT_APPLY_ENV_REQUIRED');
  }
  const prisma = new PrismaService();
  try {
    const retained = await capture(prisma);
    const producer = new ConflictObservationProducer(prisma, [UCDP_CANDIDATE_AUGUST_2026]);
    const admitted = await producer.admitRetained(
      retained.retrievalId,
      'ALPHA-DESIGN-NATIVE-DATA-CONVERGENCE-R1',
    );
    console.log(
      JSON.stringify({
        scope: 'ALPHA_UCDP_CANDIDATE_R1',
        retrievalId: retained.retrievalId,
        sourceSha256: UCDP_CANDIDATE_AUGUST_2026.sha256,
        retainedBytes: retained.bytes,
        governedScopedObservations: retained.scopedObservations,
        admitted,
      }),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      scope: 'ALPHA_UCDP_CANDIDATE_R1',
      state: 'STOP',
      reason: error instanceof Error ? error.message : 'UNKNOWN',
    }),
  );
  process.exitCode = 1;
});
