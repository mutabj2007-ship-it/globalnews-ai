import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { assertProviderRightsPermitRunning } from '../modules/market-ingest/market-acquisition-declarations';
import {
  EUROSTAT_ENERGY_ALPHA_R1_ENDPOINT_ID,
  EUROSTAT_ENERGY_ALPHA_R1_PARAMETERS,
  EUROSTAT_ENERGY_ALPHA_R1_PARSER_ID,
  EUROSTAT_ENERGY_ALPHA_R1_PARSER_VERSION,
  EUROSTAT_ENERGY_ALPHA_R1_REQUEST_PATH,
  EUROSTAT_ENERGY_ROW_PARSER_VERSION,
  normalizeEurostatEnergyCapture,
} from '../modules/energy/energy-eurostat-pem';

const BASE_URL =
  'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/nrg_cb_pem';
const REVIEWED_BY = 'PRODUCT_OWNER_ALPHA';
const REVIEW_REF = 'ALPHA:DESIGN_NATIVE_DATA_CONVERGENCE_R1:ENERGY_EUROSTAT_R1';

function fail(reason: string): never {
  throw new Error(`ENERGY_EUROSTAT_ALPHA_R1_REFUSED:${reason}`);
}

function digest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

async function acquire() {
  const rights = assertProviderRightsPermitRunning('EUROSTAT');
  const url = new URL(BASE_URL);
  for (const parameter of EUROSTAT_ENERGY_ALPHA_R1_PARAMETERS) {
    url.searchParams.append(parameter.key, parameter.value);
  }

  const requestedAt = new Date();
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
    redirect: 'error',
  });
  const retrievedAt = new Date();

  if (!response.ok || response.status !== 200) fail(`HTTP_${response.status}`);
  if (response.url !== url.toString()) fail('REDIRECT_OR_QUERY_DRIFT');

  const mediaType = response.headers.get('content-type') ?? '';
  if (mediaType.split(';')[0].trim().toLowerCase() !== 'application/json') {
    fail('MEDIA_TYPE');
  }

  const contentEncoding =
    response.headers.get('content-encoding')?.trim().toLowerCase() || 'identity';
  if (!['identity', 'gzip'].includes(contentEncoding)) fail('CONTENT_ENCODING');

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > 4 * 1024 * 1024) fail('SIZE');

  const contentAddress = digest(bytes);
  const retrievalId =
    `eurostat-energy:nrg_cb_pem:ES:TOTAL:GWH:2026-07:${contentAddress}`;
  const parsedAt = new Date();

  const candidate = {
    retrievalId,
    providerId: 'EUROSTAT',
    endpointId: EUROSTAT_ENERGY_ALPHA_R1_ENDPOINT_ID,
    requestPath: EUROSTAT_ENERGY_ALPHA_R1_REQUEST_PATH,
    parameters: EUROSTAT_ENERGY_ALPHA_R1_PARAMETERS,
    requestedAt,
    retrievedAt,
    httpStatus: 200,
    mediaType,
    byteLength: bytes.length,
    contentAddress,
    completeness: 'COMPLETE',
    admissibility: 'ADMITTED',
    refusalKey: null,
    parserId: EUROSTAT_ENERGY_ALPHA_R1_PARSER_ID,
    parserVersion: EUROSTAT_ENERGY_ALPHA_R1_PARSER_VERSION,
    rightsGrade: rights.rightsClass,
    rightsInstrumentRef: rights.instrument,
    payloadRetentionPermitted: true,
    payload: {
      bytes,
      storageState: 'RETAINED',
      byteLength: bytes.length,
      contentAddress,
    },
  };

  const observation = normalizeEurostatEnergyCapture(candidate);
  return {
    rights,
    candidate,
    observation,
    bytes,
    contentAddress,
    retrievalId,
    requestedAt,
    retrievedAt,
    parsedAt,
    mediaType,
    contentEncoding,
  };
}

async function persist(
  prisma: PrismaService,
  acquired: Awaited<ReturnType<typeof acquire>>,
): Promise<void> {
  const existingRetrieval = await prisma.snapshotRetrieval.findUnique({
    where: { retrievalId: acquired.retrievalId },
    include: { payload: true },
  });

  if (existingRetrieval) {
    const replay = normalizeEurostatEnergyCapture(existingRetrieval);
    if (
      replay.observationKey !== acquired.observation.observationKey ||
      existingRetrieval.contentAddress !== acquired.contentAddress ||
      existingRetrieval.payload?.storageState !== 'RETAINED' ||
      !existingRetrieval.payload.bytes ||
      digest(existingRetrieval.payload.bytes) !== acquired.contentAddress
    ) {
      fail('EXISTING_RETRIEVAL_MISMATCH');
    }
  } else {
    await prisma.$transaction(
      async (tx) => {
        const payload = await tx.snapshotPayload.findUnique({
          where: { contentAddress: acquired.contentAddress },
        });

        if (payload) {
          if (
            payload.storageState !== 'RETAINED' ||
            !payload.bytes ||
            payload.byteLength !== acquired.bytes.byteLength ||
            payload.mediaType.split(';')[0].trim().toLowerCase() !== 'application/json' ||
            digest(payload.bytes) !== acquired.contentAddress
          ) {
            fail('EXISTING_PAYLOAD_MISMATCH');
          }
        } else {
          await tx.snapshotPayload.create({
            data: {
              contentAddress: acquired.contentAddress,
              bytes: Buffer.from(acquired.bytes),
              byteLength: acquired.bytes.byteLength,
              mediaType: acquired.mediaType,
              storageState: 'RETAINED',
            },
          });
        }

        await tx.snapshotRetrieval.create({
          data: {
            retrievalId: acquired.retrievalId,
            providerId: 'EUROSTAT',
            endpointId: EUROSTAT_ENERGY_ALPHA_R1_ENDPOINT_ID,
            requestPath: EUROSTAT_ENERGY_ALPHA_R1_REQUEST_PATH,
            parameters:
              EUROSTAT_ENERGY_ALPHA_R1_PARAMETERS as unknown as Prisma.InputJsonValue,
            requestedAt: acquired.requestedAt,
            retrievedAt: acquired.retrievedAt,
            httpStatus: 200,
            mediaType: acquired.mediaType,
            byteLength: acquired.bytes.byteLength,
            contentAddress: acquired.contentAddress,
            completeness: 'COMPLETE',
            contentEncoding: acquired.contentEncoding,
            wireByteLength:
              acquired.contentEncoding === 'identity'
                ? acquired.bytes.byteLength
                : null,
            admissibility: 'ADMITTED',
            refusalKey: null,
            refusalClass: null,
            parserId: EUROSTAT_ENERGY_ALPHA_R1_PARSER_ID,
            parserVersion: EUROSTAT_ENERGY_ALPHA_R1_PARSER_VERSION,
            parsedAt: acquired.parsedAt,
            rightsGrade: acquired.rights.rightsClass,
            rightsInstrumentRef: acquired.rights.instrument,
            payloadRetentionPermitted: true,
            editionAnnotations: {
              source: 'Eurostat',
              dataset: 'nrg_cb_pem',
              geo: 'ES',
              siec: 'TOTAL',
              unit: 'GWH',
              period: '2026-07',
              sourceFlag: 'p',
            } as Prisma.InputJsonValue,
            publisherReleasedAt: null,
            publisherChangedAt: new Date(
              acquired.observation.publisherChangedAt as string,
            ),
            referencePeriod: acquired.observation.period,
            sourceLanguage: 'en',
            extractorId: null,
            extractorVersion: null,
          },
        });
      },
      { isolationLevel: 'Serializable', timeout: 30_000 },
    );
  }

  const latest = await prisma.energyObservation.findFirst({
    where: { observationKey: acquired.observation.observationKey },
    orderBy: { revision: 'desc' },
  });

  if (latest) {
    if (
      latest.revision !== 0 ||
      latest.snapshotRetrievalId !== acquired.retrievalId ||
      latest.parserVersion !== EUROSTAT_ENERGY_ROW_PARSER_VERSION ||
      latest.admission !== 'ADMITTED' ||
      latest.publicDisclosureApproved !== false ||
      latest.reviewedBy !== REVIEWED_BY ||
      latest.reviewRef !== REVIEW_REF
    ) {
      fail('EXISTING_ENERGY_OBSERVATION_REQUIRES_REVIEW');
    }
  } else {
    await prisma.energyObservation.create({
      data: {
        id: randomUUID(),
        observationKey: acquired.observation.observationKey,
        revision: 0,
        snapshotRetrievalId: acquired.retrievalId,
        payload: acquired.observation as unknown as Prisma.InputJsonValue,
        evidencePointer: '/value/0',
        parserVersion: EUROSTAT_ENERGY_ROW_PARSER_VERSION,
        admission: 'ADMITTED',
        publicDisclosureApproved: false,
        reviewedBy: REVIEWED_BY,
        reviewRef: REVIEW_REF,
      },
    });
  }

  await prisma.snapshotPin.upsert({
    where: {
      contentAddress_citedBy: {
        contentAddress: acquired.contentAddress,
        citedBy:
          'energy:alpha-r1:EUROSTAT:nrg_cb_pem:ES:TOTAL:GWH:2026-07:revision:0',
      },
    },
    update: { releasedAt: null },
    create: {
      contentAddress: acquired.contentAddress,
      citedBy:
        'energy:alpha-r1:EUROSTAT:nrg_cb_pem:ES:TOTAL:GWH:2026-07:revision:0',
      pinnedAt: acquired.parsedAt,
    },
  });
}

async function main(): Promise<void> {
  if (process.env.ALPHA_ENERGY_EUROSTAT_R1_APPLY !== 'YES') {
    fail('EXPLICIT_APPLY_ENV_REQUIRED');
  }

  const acquired = await acquire();
  const prisma = new PrismaService();
  try {
    await persist(prisma, acquired);
    console.log(
      JSON.stringify({
        scope: 'ALPHA_ENERGY_EUROSTAT_R1',
        retrievalId: acquired.retrievalId,
        sourceSha256: acquired.contentAddress,
        retainedBytes: acquired.bytes.byteLength,
        observationKey: acquired.observation.observationKey,
        subjectName: acquired.observation.subjectName,
        period: acquired.observation.period,
        value: acquired.observation.value,
        unit: acquired.observation.unit,
        releaseStatus: acquired.observation.releaseStatus,
        publicDisclosureApproved: false,
        reviewRef: REVIEW_REF,
      }),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      scope: 'ALPHA_ENERGY_EUROSTAT_R1',
      state: 'STOP',
      reason: error instanceof Error ? error.message : 'UNKNOWN',
    }),
  );
  process.exitCode = 1;
});
