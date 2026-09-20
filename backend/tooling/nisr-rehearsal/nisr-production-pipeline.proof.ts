/**
 * ════════════════════════════════════════════════════════════════════════════
 * NISR FIRST REAL DATA — THROUGH THE PRODUCTION COMPONENTS, ONCE, BY HAND
 * ════════════════════════════════════════════════════════════════════════════
 *
 * C-P1 — **THE SINGLE AUTHORISED LIVE EXCHANGE.** One manual, operator-run fetch of the
 * governed NISR artifact, hashed against the retained content address. By hand, once. Not
 * in CI, not on a timer, not from a producer.
 *
 * MANUAL ONE-SHOT PROOF. No scheduler, no recurring fetch, no provider activation, no UI
 * binding, no deployment. `rw-nisr` remains `enabled: false` / `ingestionMethod: 'none'`.
 * Production HOLD.
 *
 * ── WHAT CHANGED SINCE THE ACCEPTED FIRST-REAL-DATA PROOF ─────────────────
 *
 * That proof ran on TOOLING components — a `pdftotext` subprocess, a bespoke fetch loop
 * and an in-memory store — and said so. Every one of the three is now the production
 * component, and nothing tooling-only remains on the path:
 *
 * ```
 *   extraction   pdftotext subprocess      ->  in-process synchronous reader, no binary
 *   transport    a loop in tooling/        ->  makeSafeWireFetch over E1's adjudicators
 *   retention    an in-memory Map          ->  PostgresOfficialDataSnapshotStore, durable
 * ```
 *
 * The harness that remains is only the AUTHORISATION and the EVIDENCE WRITER. It lives in
 * `backend/tooling/`, which `tsconfig.build.json` already excluded, so it is kept out of
 * the production image by an existing rule rather than by a new exemption, and it is not
 * a `.spec.ts`, so the repository suite never collects it.
 *
 *     NISR_REHEARSAL=1 SNAPSHOT_DATABASE_URL=... npx jest --config jest.nisr-rehearsal.config.js
 *
 * ── THE CHAIN THIS PROVES ─────────────────────────────────────────────────
 *
 *   rw-nisr → production hardened safe fetch → PDF media admission → production PDF
 *   extractor → canonical G R5 decoder → retained artifact → persisted retrieval lineage
 *   → Economy INFLATION_CPI → canonical persistence → internal read
 *
 * EVERY VALUE IS SOURCE-DERIVED. The expected figures are VERIFICATION EVIDENCE, asserted
 * against what the pipeline produced; none of them is written into production code.
 */

import { getServers, setServers } from 'node:dns';
import { setServers as setPromiseServers } from 'node:dns/promises';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CanonicalOfficialDataAdmissionEvaluator,
  CAPTURED_RESPONSE_HEADERS,
  SNAPSHOT_EXPOSURE,
  SNAPSHOT_WIRE_BYTE_CAP,
  assembleProvenance,
  economyObservationKey,
  installNisrCpiTextLayerExtractor,
  mediaAdmissionRowFor,
  resolveParserBinding,
  type NisrCpiDecoded,
  type OfficialDataRetrieval,
  type SnapshotContentAddress,
  type SourceProvenance,
} from '@globalnews-ai/shared';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../src/generated/prisma/client';
import { OFFICIAL_SOURCES } from '../../src/modules/official-sources/official-source-registry';
import { PostgresOfficialDataSnapshotStore } from '../../src/modules/official-data/official-data-snapshot.store';
import {
  buildSafeFetchPolicy,
  officialSourceHostResolver,
} from '../../src/modules/official-data/official-data.boot';
import { NISR_CPI_PRODUCTION_EXTRACTOR } from '../../src/modules/official-data/nisr/nisr-cpi-pdf.extractor';
import {
  makeSafeWireFetch,
  nodeAddressBoundConnector,
  nodeAddressResolver,
} from '../../src/modules/official-data/safe-wire-fetch.node';
import {
  nisrCpiEditionOrderFor,
  normalizeNisrCpiNationalObservation,
  readNisrCpiNationalFigureSlot,
} from '../../src/modules/economy/producers/nisr-cpi-economy.normalizer';

const PROVIDER_ID = 'rw-nisr';
const ENDPOINT_ID = 'cpi-monthly-en';

/**
 * PERCENT-ENCODED EXACTLY AS THE PUBLISHER SERVES IT, INCLUDING THE DOUBLE SPACE between
 * "INDEX" and "(CPI)". A producer that collapses whitespace here gets a 404. The filename
 * is READ from the release page and never synthesised.
 *
 * `2026-09` IS THE UPLOAD FOLDER — not the publication month and not the reference period.
 * It coincides here; it does not always. `R-AID-1` forbids parsing either, and nothing
 * downstream does: the reference period comes from the document body.
 */
const ARTIFACT_PATH =
  '/sites/default/files/documents/2026-09/' +
  'CONSUMER%20PRICE%20INDEX%20%20%28CPI%29%20AUGUST%202026.pdf';

/** VERIFICATION EVIDENCE. Asserted against the pipeline's output; never its source. */
const EXPECTED = Object.freeze({
  nationalAnnualPercent: 15.9,
  referencePeriod: '2026-08',
  vintage: '2026-09-10',
  contentAddressPrefix: '4ba5193b',
  byteLength: 1_727_902,
});

const EVIDENCE_DIR = process.env['NISR_EVIDENCE_DIR'] ?? join(__dirname, 'evidence');
const DATABASE_URL = process.env['SNAPSHOT_DATABASE_URL'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const record: Record<string, any> = { ranAt: new Date().toISOString() };

function emit(): void {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const path = join(EVIDENCE_DIR, 'nisr-production-pipeline.run.json');
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`);
  // eslint-disable-next-line no-console
  console.log(`evidence written: ${path}`);
}

/**
 * THE DORMANCY GATE — THE PART THAT MUST NOT BE CONVENIENT.
 *
 * The fetch requires BOTH facts at once and says which is which: the source is DORMANT,
 * AND a human named this single run. `enabled: true` is a TRIPWIRE, not a green light —
 * if that entry is ever flipped, activation happened somewhere else, and a one-shot proof
 * is not the place to find that out quietly.
 */
export function rehearsalAuthorisation(env: NodeJS.ProcessEnv): {
  authorised: boolean;
  reason: string;
} {
  const entry = OFFICIAL_SOURCES.find((s) => s.id === PROVIDER_ID);
  if (entry === undefined) return { authorised: false, reason: 'PROVIDER_NOT_REGISTERED' };
  if (entry.enabled) {
    return { authorised: false, reason: 'SOURCE_UNEXPECTEDLY_ENABLED_REFER_TO_PO' };
  }
  if (entry.ingestionMethod !== 'none') {
    return { authorised: false, reason: 'SOURCE_HAS_AN_INGESTION_METHOD_REFER_TO_PO' };
  }
  if (env['NISR_REHEARSAL'] !== '1') {
    return { authorised: false, reason: 'NO_MANUAL_REHEARSAL_AUTHORISATION' };
  }
  return { authorised: true, reason: 'DORMANT_SOURCE_UNDER_ONE_TIME_MANUAL_PROOF' };
}


/* ══════════════════════════════════════════════════════════════════════════
 * THE RUN — A PLAIN NODE SCRIPT, NOT A TEST
 * ══════════════════════════════════════════════════════════════════════════
 *
 * IT IS NOT A JEST SUITE, AND THAT IS A MEASUREMENT RATHER THAN A PREFERENCE.
 *
 * Under jest, `dns.resolve4` times out against every nameserver — the sandbox breaks
 * c-ares' UDP channel — while the identical call succeeds in a plain Node process. The
 * driver must keep `resolve4`/`resolve6` (ruling C-1 forbids `dns.lookup`, which returns
 * one address and consults the OS resolver), so THE PROOF MOVED OUT OF THE TEST RUNNER
 * RATHER THAN THE DRIVER MOVING TO `lookup`.
 *
 * It is also what the proof is supposed to be: `R-EA-TR-4` wants the ACTUAL producer
 * runtime, "not from a research tool", and a test runner is a research tool. Being outside
 * CI is now structural rather than conventional — there is no suite to collect.
 */

class ProofFailure extends Error {}

const checks: { name: string; ok: boolean; detail?: string }[] = [];

function check(name: string, condition: boolean, detail?: string): void {
  checks.push({ name, ok: condition, ...(detail === undefined ? {} : { detail }) });
  if (!condition) throw new ProofFailure(`${name}${detail === undefined ? '' : ` — ${detail}`}`);
}

async function main(): Promise<void> {
  const auth = rehearsalAuthorisation(process.env);
  /* ONE RESOLVER INSTANCE, shared by the driver and anything else that needs the governed
     host — C-3.3. Two resolvers is the two-tables drift with teeth. */
  const resolveHost = officialSourceHostResolver();
  const host = resolveHost(PROVIDER_ID);
  const entry = OFFICIAL_SOURCES.find((s) => s.id === PROVIDER_ID);

  /* ── THE OPERATOR'S RESOLVER, DECLARED AND RECORDED ───────────────────────
     MEASURED on the proof machine: the configured nameserver is `127.0.0.1`, a local
     stub that c-ares cannot query. The driver is unchanged; the OPERATOR names a resolver
     for this run and it is recorded here. No default and no silent fallback — absent the
     variable the run fails with DNS_FAILURE, which is honest for a host this machine
     cannot resolve. */
  const declaredServers = process.env['NISR_DNS_SERVERS'];
  record.dns = { configuredBefore: getServers() };
  if (declaredServers !== undefined && declaredServers.trim() !== '') {
    const servers = declaredServers.split(',').map((x) => x.trim()).filter((x) => x !== '');
    /*
      BOTH, AND THE SECOND IS THE ONE THAT MATTERS — MEASURED, NOT ASSUMED.

      `node:dns` and `node:dns/promises` hold SEPARATE default resolvers. The driver
      imports `resolve4` from the promises API at module load, so a `dns.setServers()`
      afterwards updates a channel the driver never uses, and every lookup keeps going to
      the stub that cannot answer. Measured on this machine: 27s ETIMEOUT through the
      callback-API setter, 102ms OK through the promises-API one, same servers, same
      process.

      A single `setServers` would have looked correct, recorded the right nameservers in
      the evidence, and resolved nothing.
    */
    setServers(servers);
    setPromiseServers(servers);
    record.dns.operatorDeclared = servers;
    record.dns.reason =
      'the machine resolver is a local stub c-ares cannot query; the driver is unchanged ' +
      'and still never uses dns.lookup';
  }
  record.dns.inUse = getServers();

  /* A DIRECT RESOLUTION, RECORDED BEFORE THE DRIVER RUNS. If this fails the environment
     cannot resolve the governed host at all, and the transport failure that follows is a
     fact about the machine rather than about the driver. Stating which it is, in the
     evidence, is the difference between a blocked proof and an unexplained one. */
  try {
    const probe = await nodeAddressResolver('statistics.gov.rw', new AbortController().signal);
    record.dns.probe = { ok: probe.length > 0, addresses: probe };
  } catch (e) {
    record.dns.probe = { ok: false, error: (e as Error).message };
  }

  record.authorisation = auth;
  record.providerId = PROVIDER_ID;
  record.endpointId = ENDPOINT_ID;
  record.configuredHost = host;
  record.sourceEnabled = entry?.enabled;
  record.ingestionMethod = entry?.ingestionMethod;
  record.snapshotExposure = SNAPSHOT_EXPOSURE;
  record.durablePersistence = DATABASE_URL !== undefined;

  check('AUTHORISED_MANUAL_ONE_SHOT', auth.authorised, auth.reason);
  check('SOURCE_IS_DORMANT', entry?.enabled === false);
  check('NO_INGESTION_METHOD', entry?.ingestionMethod === 'none');
  check('GOVERNED_HOST_FROM_REGISTRY', host === 'statistics.gov.rw');
  check('EXPOSURE_IS_INTERNAL_ONLY', SNAPSHOT_EXPOSURE === 'INTERNAL_ONLY');

  /* ── LINK 1 · THE PRODUCTION HARDENED SAFE FETCH (C-P1) ─────────────────── */
  const policy = buildSafeFetchPolicy(['api.globalnews.ai']);
  const wireFetch = makeSafeWireFetch({
    resolver: nodeAddressResolver,
    connector: nodeAddressBoundConnector,
    policy,
    resolveHost,
  });

  const fetchStarted = Date.now();
  const response = await wireFetch(
    {
      providerId: PROVIDER_ID,
      endpointId: ENDPOINT_ID,
      url: `https://${host}${ARTIFACT_PATH}`,
      accept: 'application/pdf',
      query: {},
    },
    AbortSignal.timeout(policy.totalDeadlineMs),
  );
  const fetchWallMs = Date.now() - fetchStarted;

  const headers = Object.fromEntries(
    CAPTURED_RESPONSE_HEADERS.flatMap((h) =>
      response.headers[h] === undefined ? [] : [[h, response.headers[h]!] as const],
    ),
  );
  const bytes = response.wireBytes;

  record.transport = {
    driver: 'makeSafeWireFetch (production)',
    status: response.status,
    finalUrl: response.finalUrl,
    redirectHops: response.redirectChain.length,
    wireByteLength: bytes.byteLength,
    fetchWallMs,
    capturedHeaders: headers,
    policy: {
      wireByteCap: policy.wireByteCap,
      maxRedirectHops: policy.maxRedirectHops,
      admittedScheme: policy.admittedScheme,
      ownOriginsDeclared: policy.ownOrigins.length,
    },
  };

  check('HTTP_200', response.status === 200, String(response.status));
  check('FINAL_URL_IS_GOVERNED_HOST', new URL(response.finalUrl).hostname === host);
  check('BYTE_LENGTH_MATCHES_RETAINED', bytes.byteLength === EXPECTED.byteLength, String(bytes.byteLength));

  /* ── LINK 2 · PDF MEDIA ADMISSION, PRODUCTION EXTRACTOR ─────────────────── */
  const contentTypeHeader = headers['content-type'] ?? '';
  const row = mediaAdmissionRowFor(contentTypeHeader);
  record.mediaRow = row;
  check('PDF_MEDIA_ROW', row?.mediaType === 'application/pdf');
  check('PDF_SHAPE_KEY', row?.shapeRefusalKey === 'BODY_NOT_PDF_SHAPED');

  /* THE COMPOSITION ROOT'S JOB, done here for this one run. In a deployment the boot gate
     installs it, and only when the registry says the provider is enabled. */
  installNisrCpiTextLayerExtractor(NISR_CPI_PRODUCTION_EXTRACTOR);

  const evaluator = new CanonicalOfficialDataAdmissionEvaluator({
    gunzip: () => {
      throw new Error('NO_GZIP_EXPECTED');
    },
    secrets: { configuredSecrets: [] },
    now: () => new Date().toISOString(),
  });

  const admissionStarted = Date.now();
  const outcome = evaluator.evaluate({
    providerId: PROVIDER_ID,
    endpointId: ENDPOINT_ID,
    finalUrl: response.finalUrl,
    configuredHost: host!,
    redirectChain: [response.finalUrl],
    httpStatus: 200,
    requestedAt: new Date(fetchStarted).toISOString(),
    retrievedAt: new Date().toISOString(),
    contentTypeHeader,
    contentEncoding: 'identity',
    contentEncodingHeaderPresent: false,
    wireByteLength: bytes.byteLength,
    wireBytes: bytes,
    decodedBytes: bytes,
    headers,
  });
  const admissionWallMs = Date.now() - admissionStarted;

  record.admission = {
    admissibility: outcome.admission.admissibility,
    refusalKey: outcome.admission.refusalKey,
    detail: outcome.detail,
    parserId: outcome.admission.parse?.parserId,
    parserVersion: outcome.admission.parse?.parserVersion,
    admissionWallMs,
  };
  check('ADMITTED', outcome.admission.admissibility === 'ADMITTED', outcome.detail);
  check('PARSER_FROM_REGISTRY', outcome.admission.parse?.parserId === 'nisr.cpi.pdf');

  const decoded = outcome.parsed as NisrCpiDecoded;
  record.decoded = {
    referencePeriod: decoded.referencePeriod,
    publicationDate: decoded.publicationDate,
    sourceLanguage: decoded.sourceLanguage,
    basePeriod: decoded.basePeriod,
    issueOrdinal: decoded.issueOrdinal,
    licenceToken: decoded.licenceToken,
    geographiesPresent: decoded.geographiesPresent,
    extractorId: decoded.extractorId,
    extractorVersion: decoded.extractorVersion,
    rowCount: decoded.rows.length,
  };
  check('PRODUCTION_EXTRACTOR_PRODUCED_IT', decoded.extractorId === 'nisr.cpi.pdfsynctext.positional');
  check('REFERENCE_PERIOD', decoded.referencePeriod === EXPECTED.referencePeriod, decoded.referencePeriod);
  check('PUBLICATION_DATE', decoded.publicationDate === EXPECTED.vintage, decoded.publicationDate);

  /* The national figure is READ from the publisher's own All Rwanda annex. The mean of
     urban and rural rounds to the same number on THIS edition, which is exactly why the
     assertion below is about WHERE it came from as well as what it is. */
  const nationalCell = decoded.rows
    .find((r) => r.geography === 'ALL_RWANDA' && r.coicopCode === '00')
    ?.cells.find((c) => c.role === 'PCT_CHANGE_ON_YEAR_AGO');
  check('NATIONAL_ROW_PRESENT', nationalCell !== undefined);
  check('NATIONAL_VALUE', nationalCell!.value === EXPECTED.nationalAnnualPercent, String(nationalCell!.value));

  /* ── LINK 3 · DURABLE RETENTION, WITH THE LINEAGE COLUMNS ───────────────── */
  if (DATABASE_URL === undefined) {
    record.retention = { skipped: 'NO SNAPSHOT_DATABASE_URL — UNMEASURED, not PASS' };
    throw new ProofFailure('SNAPSHOT_DATABASE_URL is required for a durable proof');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });
  try {
    await prisma.$connect();
    const store = new PostgresOfficialDataSnapshotStore(prisma, [PROVIDER_ID]);
    const lastModified = headers['last-modified'];

    const retainStarted = Date.now();
    const retrieval = await store.retain({
      retrievalId: `nisr-production-${Date.now()}`,
      request: {
        providerId: PROVIDER_ID,
        endpointId: ENDPOINT_ID,
        requestPath: ARTIFACT_PATH,
        parameters: [],
        requestedAt: new Date(fetchStarted).toISOString(),
      },
      retrievedAt: new Date().toISOString(),
      httpStatus: 200,
      mediaType: 'application/pdf',
      bytes,
      completeness: 'COMPLETE',
      rights: {
        grade: 'E-5',
        instrumentRef: 'https://statistics.gov.rw',
        payloadRetentionPermitted: true,
      },
      /* EMPTY, AND THAT IS THE MEASUREMENT — R-AID-6. NISR publishes none. */
      editionAnnotations: {},
      publisherReleasedAt: decoded.publicationDate,
      ...(lastModified === undefined
        ? {}
        : { publisherChangedAt: new Date(lastModified).toISOString() }),
      /* THE TWO LINEAGE FIELDS — persisted now, refused before this round. */
      referencePeriod: decoded.referencePeriod,
      sourceLanguage: decoded.sourceLanguage,
      admission: {
        captureOutcome: 'COMPLETE',
        admissibility: 'ADMITTED',
        transport: { contentEncoding: 'identity', wireByteLength: bytes.byteLength },
        parse: {
          parserId: 'nisr.cpi.pdf',
          parserVersion: '1.0.0',
          parsedAt: new Date().toISOString(),
          /* B-3.1 — the extractor identity now SURVIVES THE REQUEST. */
          extractorId: decoded.extractorId,
          extractorVersion: decoded.extractorVersion,
        },
      },
    });
    const retentionWallMs = Date.now() - retainStarted;
    const address = retrieval.contentAddress!;

    const payload = await store.open(address);
    const readBack = await store.retrievalsFor(address);
    const latest = readBack[readBack.length - 1];

    record.retention = {
      substrate: 'PostgresOfficialDataSnapshotStore (production)',
      contentAddress: address,
      byteLength: retrieval.byteLength,
      retentionWallMs,
      payloadReopened: payload !== null,
      payloadByteLength: payload?.byteLength,
      retrievalsForThisArtifact: readBack.length,
      referencePeriodReadBack: latest?.referencePeriod,
      sourceLanguageReadBack: latest?.sourceLanguage,
      editionAnnotations: retrieval.editionAnnotations,
      publisherReleasedAt: retrieval.publisherReleasedAt,
    };

    check('CONTENT_ADDRESS_MATCHES_RETAINED', address.startsWith(EXPECTED.contentAddressPrefix), address);
    check('PAYLOAD_REOPENED', payload !== null);
    /* A-P1 on the real row: the lineage survived the database. */
    check('LINEAGE_REFERENCE_PERIOD_PERSISTED', latest?.referencePeriod === EXPECTED.referencePeriod);
    check('LINEAGE_SOURCE_LANGUAGE_PERSISTED', latest?.sourceLanguage === 'en');

    /* ── LINK 4 · ECONOMY AND THE INTERNAL READ ──────────────────────────── */
    const provenance: SourceProvenance = {
      sourceType: 'PUBLIC_DATA',
      providerId: PROVIDER_ID,
      institution: 'National Institute of Statistics of Rwanda',
      jurisdiction: 'RW',
      language: decoded.sourceLanguage,
      sourceUrl: response.finalUrl,
      retrievedAt: retrieval.retrievedAt,
      authorityClass: 'OFFICIAL_STATISTICS',
    };

    const seen = readBack.slice(0, -1).map((r) => r.contentAddress ?? '');
    const editionOrder = nisrCpiEditionOrderFor(seen, address);

    const n = normalizeNisrCpiNationalObservation({ decoded, retrieval, provenance, editionOrder });
    check('NORMALIZED', n.ok, n.ok ? '' : n.detail);
    if (!n.ok) return;

    const read = readNisrCpiNationalFigureSlot({ decoded, retrieval, provenance, editionOrder });

    record.observation = {
      editionOrder,
      seriesId: n.series.seriesId,
      seriesLabel: n.series.label,
      category: n.series.category,
      economyIso2: n.series.economyIso2,
      periodId: n.period.periodId,
      periodStart: n.period.start,
      periodEnd: n.period.end,
      vintage: n.observation.vintage,
      value: n.observation.value,
      unit: n.observation.unit,
      semantics: n.observation.semantics,
      observationKey: economyObservationKey(n.observation),
      lineage: {
        datasetCode: n.lineage.upstream.datasetCode,
        dimensions: n.lineage.upstream.dimensions,
        contentAddress: n.lineage.retrieval.contentAddress,
        referencePeriod: n.lineage.retrieval.referencePeriod,
        sourceLanguage: n.lineage.retrieval.sourceLanguage,
      },
    };
    record.internalRead = {
      exposure: SNAPSHOT_EXPOSURE,
      kind: read.slot.kind,
      publishable: read.publishable,
      value: read.slot.kind === 'OBSERVATION' ? read.slot.observation.value : undefined,
      unit: read.slot.kind === 'OBSERVATION' ? read.slot.observation.unit : undefined,
    };

    check('OBSERVATION_IS_THE_ARTIFACT_CELL', n.observation.value === nationalCell!.value);
    check('NO_RELEASE_STATUS_INFERRED', n.observation.semantics.releaseStatus === null);
    check('INTERNAL_READ_IS_AN_OBSERVATION', read.slot.kind === 'OBSERVATION');
    check('INTERNAL_READ_PUBLISHABLE', read.publishable);

    /* A pin names the observation lineage key that cites it, and never free text. */
    await store.pin(address, {
      citedBy: economyObservationKey(n.observation),
      pinnedAt: new Date().toISOString(),
    });
    record.retention.pinned = await store.isPinned(address);
    check('PAYLOAD_PINNED_BY_THE_FIGURE', record.retention.pinned === true);

    const binding = resolveParserBinding(PROVIDER_ID, ENDPOINT_ID, 'application/pdf')!;
    record.parseProvenance = assembleProvenance(address, binding as never, decoded);
    check('PROVENANCE_ADDRESS_COPIED', record.parseProvenance.contentAddress === address);
  } finally {
    await prisma.$disconnect();
  }

  const finalEntry = OFFICIAL_SOURCES.find((s) => s.id === PROVIDER_ID)!;
  record.finalState = {
    sourceEnabled: finalEntry.enabled,
    ingestionMethod: finalEntry.ingestionMethod,
    schedulerOff: true,
    recurringFetch: false,
    deploymentExecuted: false,
    railwayChanged: false,
  };
  check('STILL_DORMANT_AFTERWARDS', finalEntry.enabled === false);
}

main()
  .then(() => {
    record.checks = checks;
    record.verdict = 'PASS';
    emit();
    // eslint-disable-next-line no-console
    console.log(`NISR PRODUCTION PIPELINE = PASS (${checks.length} checks)`);
  })
  .catch((e: unknown) => {
    record.checks = checks;
    record.verdict = 'FAIL';
    record.failure = (e as Error).message;
    emit();
    // eslint-disable-next-line no-console
    console.error('NISR PRODUCTION PIPELINE = FAIL —', (e as Error).message);
    process.exitCode = 1;
  });
