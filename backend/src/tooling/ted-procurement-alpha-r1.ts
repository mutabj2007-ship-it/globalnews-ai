import { createHash } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { MarketProviderRegistry } from '../modules/market-ingest/market-provider-registry';
import { RIGHTS_RECORDS } from '../modules/market-ingest/market-acquisition-declarations';
import {
  inspectTedProcurementCapture,
  MAX_TED_PROCUREMENT_BYTES,
} from '../modules/market-ingest/ted-procurement-retained';
import {
  TED_PROCUREMENT_R1,
  tedProcurementRequestBody,
} from '../modules/market-ingest/ted-procurement.reviewed';

const RETRIEVAL_ID = 'ted-procurement:2026-09-24:eu27:r1';

function fail(reason: string): never {
  throw new Error(`TED_PROCUREMENT_ALPHA_R1_REFUSED:${reason}`);
}

function digest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

const PARAMETERS = Object.freeze([
  { key: 'query', value: TED_PROCUREMENT_R1.query },
  { key: 'fields', value: JSON.stringify(TED_PROCUREMENT_R1.fields) },
  { key: 'page', value: String(TED_PROCUREMENT_R1.page) },
  { key: 'limit', value: String(TED_PROCUREMENT_R1.limit) },
  { key: 'scope', value: TED_PROCUREMENT_R1.scope },
  { key: 'checkQuerySyntax', value: 'false' },
  { key: 'paginationMode', value: TED_PROCUREMENT_R1.paginationMode },
  { key: 'onlyLatestVersions', value: String(TED_PROCUREMENT_R1.onlyLatestVersions) },
]);

async function main(): Promise<void> {
  if (process.env.ALPHA_TED_PROCUREMENT_R1_APPLY !== 'YES') {
    fail('EXPLICIT_APPLY_ENV_REQUIRED');
  }

  /*
    Explicit one-job allowlist only. This does not change the application's
    default empty Market provider allowlist and creates no scheduler.
  */
  const permission = new MarketProviderRegistry(['TED']).resolve(
    'TED',
    'PROCUREMENT_OPPORTUNITY',
    'RETAIN_PAYLOAD',
  );
  if (permission.rights.rightsClass !== 'E-5') fail('RIGHTS');

  const prisma = new PrismaService();
  try {
    const existing = await prisma.snapshotRetrieval.findUnique({
      where: { retrievalId: RETRIEVAL_ID },
      include: { payload: true },
    });
    if (existing) {
      const notices = inspectTedProcurementCapture(existing);
      if (notices.length === 0 || notices.length > TED_PROCUREMENT_R1.limit)
        fail('EXISTING_NOTICE_BOUND');
      console.log(JSON.stringify({
        scope: 'ALPHA_TED_PROCUREMENT_R1',
        retrievalId: RETRIEVAL_ID,
        sourceSha256: existing.contentAddress,
        retainedBytes: existing.byteLength,
        notices: notices.length,
        state: 'ALREADY_RETAINED',
      }));
      return;
    }

    const requestedAt = new Date();
    const response = await fetch(TED_PROCUREMENT_R1.sourceUrl, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(tedProcurementRequestBody()),
      signal: AbortSignal.timeout(permission.fetchTimeoutMs),
      redirect: 'error',
    });
    const retrievedAt = new Date();

    if (!response.ok || response.status !== 200) fail(`HTTP_${response.status}`);
    if (response.url !== TED_PROCUREMENT_R1.sourceUrl) fail('REDIRECT_ORIGIN_DRIFT');

    const mediaType = response.headers.get('content-type') ?? '';
    if (mediaType.split(';')[0].trim().toLowerCase() !== 'application/json')
      fail('MEDIA_TYPE');

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_TED_PROCUREMENT_BYTES) fail('SIZE');
    const sha256 = digest(bytes);
    const contentEncoding =
      response.headers.get('content-encoding')?.trim().toLowerCase() || 'identity';
    if (!['identity', 'gzip'].includes(contentEncoding)) fail('CONTENT_ENCODING');

    const parsedAt = new Date();
    const candidate = {
      retrievalId: RETRIEVAL_ID,
      providerId: 'TED',
      endpointId: TED_PROCUREMENT_R1.endpointId,
      requestPath: TED_PROCUREMENT_R1.requestPath,
      parameters: PARAMETERS,
      requestedAt,
      retrievedAt,
      httpStatus: 200,
      mediaType,
      byteLength: bytes.length,
      contentAddress: sha256,
      completeness: 'COMPLETE',
      admissibility: 'ADMITTED',
      refusalKey: null,
      parserId: TED_PROCUREMENT_R1.parserId,
      parserVersion: TED_PROCUREMENT_R1.parserVersion,
      rightsGrade: 'E-5',
      rightsInstrumentRef: RIGHTS_RECORDS.TED.instrument,
      payloadRetentionPermitted: true,
      payload: {
        bytes,
        storageState: 'RETAINED',
        byteLength: bytes.length,
        contentAddress: sha256,
      },
    };
    const notices = inspectTedProcurementCapture(candidate);
    if (notices.length === 0 || notices.length > TED_PROCUREMENT_R1.limit)
      fail('NOTICE_BOUND');

    await prisma.$transaction(
      async (tx) => {
        const payload = await tx.snapshotPayload.findUnique({
          where: { contentAddress: sha256 },
        });
        if (payload) {
          if (
            payload.storageState !== 'RETAINED' ||
            !payload.bytes ||
            payload.byteLength !== bytes.length ||
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
            providerId: 'TED',
            endpointId: TED_PROCUREMENT_R1.endpointId,
            requestPath: TED_PROCUREMENT_R1.requestPath,
            parameters: PARAMETERS as unknown as Prisma.InputJsonValue,
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
            parserId: TED_PROCUREMENT_R1.parserId,
            parserVersion: TED_PROCUREMENT_R1.parserVersion,
            parsedAt,
            rightsGrade: 'E-5',
            rightsInstrumentRef: RIGHTS_RECORDS.TED.instrument,
            payloadRetentionPermitted: true,
            editionAnnotations: {
              api: 'TED Search API v3',
              query: TED_PROCUREMENT_R1.query,
              onlyLatestVersions: TED_PROCUREMENT_R1.onlyLatestVersions,
              resultCount: notices.length,
            } as Prisma.InputJsonValue,
            publisherReleasedAt: null,
            publisherChangedAt: null,
            referencePeriod: null,
            sourceLanguage: null,
            extractorId: null,
            extractorVersion: null,
          },
        });

        await tx.snapshotPin.createMany({
          data: notices.map((notice) => ({
            contentAddress: sha256,
            citedBy: `market-procurement:${notice.publicationNumber}`,
            pinnedAt: retrievedAt,
          })),
          skipDuplicates: true,
        });
      },
      { isolationLevel: 'Serializable', timeout: 30_000 },
    );

    console.log(JSON.stringify({
      scope: 'ALPHA_TED_PROCUREMENT_R1',
      retrievalId: RETRIEVAL_ID,
      sourceSha256: sha256,
      retainedBytes: bytes.length,
      notices: notices.length,
      state: 'INSERTED',
    }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    scope: 'ALPHA_TED_PROCUREMENT_R1',
    state: 'STOP',
    reason: error instanceof Error ? error.message : 'UNKNOWN',
  }));
  process.exitCode = 1;
});
