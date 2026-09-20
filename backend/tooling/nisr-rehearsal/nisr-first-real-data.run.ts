/**
 * ════════════════════════════════════════════════════════════════════════════
 * NISR FIRST REAL DATA — ONE SOURCE, ONE ARTIFACT, ONE RUN
 * ════════════════════════════════════════════════════════════════════════════
 *
 * MANUAL ONE-SHOT PROOF. No scheduler, no recurring fetch, no provider activation, no UI
 * binding, no deployment. `rw-nisr` remains `enabled: false` / `ingestionMethod: 'none'`.
 * Production HOLD.
 *
 * IT LIVES IN `backend/tooling/`, AND THAT IS LOAD-BEARING. `tsconfig.build.json` excludes
 * only spec files from the Nest build, so under `backend/src` a network-capable module
 * would COMPILE INTO THE PRODUCTION IMAGE. `tooling/**` was ALREADY excluded, so this is
 * kept out by an existing rule rather than by a new exemption. It is also not a
 * `.spec.ts`, and the repository suite has `rootDir: 'src'` — so "no recurring fetch"
 * holds on two independent counts, both structural rather than promised.
 *
 *     NISR_REHEARSAL=1 npx jest --config jest.nisr-rehearsal.config.js
 *
 * Absent the flag this file fetches nothing, which is what makes it safe for it to exist.
 *
 * ── THE CHAIN THIS PROVES ─────────────────────────────────────────────────
 *
 *   real NISR CPI artifact → safe transport → PDF artifact admission → retained artifact
 *   → the governed parser → normalized Economy INFLATION_CPI → canonical retention
 *   → internal read
 *
 * EVERY VALUE IS SOURCE-DERIVED. No August figure is written into this file as the
 * observation: the assertions compare what the pipeline produced against what the
 * publisher printed, and the publisher's number arrives through the pipeline.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import {
  CanonicalOfficialDataAdmissionEvaluator,
  CAPTURED_RESPONSE_HEADERS,
  SNAPSHOT_EXPOSURE,
  SNAPSHOT_WIRE_BYTE_CAP,
  installNisrCpiTextLayerExtractor,
  mediaAdmissionRowFor,
  resolveParserBinding,
  assembleProvenance,
  economyObservationKey,
  type NisrCpiDecoded,
  type OfficialDataRequestIdentity,
  type OfficialDataRetrieval,
  type SnapshotContentAddress,
  type SourceProvenance,
} from '@globalnews-ai/shared';

import { OFFICIAL_SOURCES } from '../../src/modules/official-sources/official-source-registry';
import { assertLineageFieldsArePersistable } from '../../src/modules/official-data/official-data-snapshot.store';
import {
  nisrCpiEditionOrderFor,
  normalizeNisrCpiNationalObservation,
  readNisrCpiNationalFigureSlot,
} from '../../src/modules/economy/producers/nisr-cpi-economy.normalizer';

import { NISR_PDFTOTEXT_EXTRACTOR } from './nisr-pdftotext.extractor';
import { RehearsalSnapshotStore } from './nisr-rehearsal.store';
import { NISR_SAFE_FETCH_POLICY, safeFetchArtifact } from './nisr-safe-fetch.driver';

/* ══════════════════════════════════════════════════════════════════════════
 * 1 · THE SUBJECT — ONE ARTIFACT, NAMED IN FULL
 * ══════════════════════════════════════════════════════════════════════════ */

const PROVIDER_ID = 'rw-nisr';
const ENDPOINT_ID = 'cpi-monthly-en';

/**
 * The English CPI release for reference period August 2026.
 *
 * PERCENT-ENCODED EXACTLY AS THE PUBLISHER SERVES IT, INCLUDING THE DOUBLE SPACE between
 * "INDEX" and "(CPI)". `%20%20` is what the path contains; a producer that collapses
 * whitespace while building this URL gets a 404. The filename is READ from the release
 * page and never synthesised — the July edition puts the month in a different position
 * and adds the word "Report".
 *
 * `2026-09` IS THE UPLOAD FOLDER. It is not the publication month and not the reference
 * period. It coincides here; it does not always. `R-AID-1` forbids parsing either, and
 * nothing downstream does: the reference period comes from the document body.
 */
const ARTIFACT_PATH =
  '/sites/default/files/documents/2026-09/' +
  'CONSUMER%20PRICE%20INDEX%20%20%28CPI%29%20AUGUST%202026.pdf';

const EVIDENCE_DIR = process.env.NISR_EVIDENCE_DIR ?? join(__dirname, 'evidence');

/* ══════════════════════════════════════════════════════════════════════════
 * 2 · THE DORMANCY GATE — THE PART THAT MUST NOT BE CONVENIENT
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `rw-nisr` ships `enabled: false`, and registration is not activation. A producer that
 * fetched merely because a host resolved would have converted a provenance lookup into an
 * activation, which is the move ruling F exists to prevent.
 *
 * So the fetch requires BOTH facts at once and says which is which: the source is DORMANT,
 * AND a human named this single run.
 */
export function rehearsalAuthorisation(env: NodeJS.ProcessEnv): {
  authorised: boolean;
  reason: string;
} {
  const entry = OFFICIAL_SOURCES.find((s) => s.id === PROVIDER_ID);
  if (entry === undefined) return { authorised: false, reason: 'PROVIDER_NOT_REGISTERED' };
  if (entry.enabled) {
    /* Not a green light — A TRIPWIRE. If this entry is ever flipped to enabled,
       activation happened somewhere else, and a rehearsal is not the place to find that
       out quietly. */
    return { authorised: false, reason: 'SOURCE_UNEXPECTEDLY_ENABLED_REFER_TO_PO' };
  }
  if (entry.ingestionMethod !== 'none') {
    return { authorised: false, reason: 'SOURCE_HAS_AN_INGESTION_METHOD_REFER_TO_PO' };
  }
  if (env.NISR_REHEARSAL !== '1') {
    return { authorised: false, reason: 'NO_MANUAL_REHEARSAL_AUTHORISATION' };
  }
  return { authorised: true, reason: 'DORMANT_SOURCE_UNDER_ONE_TIME_MANUAL_PROOF' };
}

/**
 * THE HOST COMES FROM THE REGISTRY, NEVER FROM THE RESPONSE.
 *
 * Deriving the expected host from the URL that answered would make the provenance check a
 * tautology that passes for every redirect target in the world. The apex is what is
 * registered, and the CC BY 4.0 grant is scoped to the apex: NISR's own subdomains reserve
 * rights, so a resolver returning a wildcard would extend a permission the publisher
 * declined to extend.
 */
export function registryHost(providerId: string): string | undefined {
  const entry = OFFICIAL_SOURCES.find((s) => s.id === providerId);
  if (entry === undefined) return undefined;
  return new URL(entry.baseUrl).hostname;
}

/* ══════════════════════════════════════════════════════════════════════════
 * 3 · THE RUN
 * ══════════════════════════════════════════════════════════════════════════ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const record: Record<string, any> = { ranAt: new Date().toISOString() };

function emit(): void {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const path = join(EVIDENCE_DIR, 'nisr-first-real-data.run.json');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`);
  // eslint-disable-next-line no-console
  console.log(`evidence written: ${path}`);
}

describe('NISR first real data — one-shot proof', () => {
  const auth = rehearsalAuthorisation(process.env);
  const host = registryHost(PROVIDER_ID);
  const store = new RehearsalSnapshotStore();

  let decoded: NisrCpiDecoded | undefined;
  let retrieval: OfficialDataRetrieval | undefined;
  let address: SnapshotContentAddress | undefined;

  afterAll(() => emit());

  /* ── THE GATE ─────────────────────────────────────────────────────────── */

  it('runs only under a named manual authorisation over a DORMANT source', () => {
    record.authorisation = auth;
    record.providerId = PROVIDER_ID;
    record.endpointId = ENDPOINT_ID;
    record.configuredHost = host;
    record.sourceEnabled = OFFICIAL_SOURCES.find((s) => s.id === PROVIDER_ID)?.enabled;
    record.ingestionMethod = OFFICIAL_SOURCES.find((s) => s.id === PROVIDER_ID)?.ingestionMethod;
    record.snapshotExposure = SNAPSHOT_EXPOSURE;

    expect(record.sourceEnabled).toBe(false);
    expect(record.ingestionMethod).toBe('none');
    expect(SNAPSHOT_EXPOSURE).toBe('INTERNAL_ONLY');
    expect(auth.authorised).toBe(true);
    expect(host).toBe('statistics.gov.rw');
  });

  /* ── CONTROL 1 · REFUSED BEFORE THE NETWORK ───────────────────────────── */

  it('CONTROL — an unregistered provider is refused before any request is built', () => {
    const binding = resolveParserBinding('NOT_A_PROVIDER', ENDPOINT_ID, 'application/pdf');
    record.controls = {
      unregisteredProviderHasNoBinding: binding === null,
      unmeasuredEditionHasNoBinding:
        resolveParserBinding(PROVIDER_ID, 'cpi-monthly-fr', 'application/pdf') === null,
    };
    expect(binding).toBeNull();
    /* The French and Kinyarwanda editions are separate files nobody has measured. */
    expect(resolveParserBinding(PROVIDER_ID, 'cpi-monthly-fr', 'application/pdf')).toBeNull();
  });

  /* ── CONTROL 2 · A HOST THE REGISTRY NEVER APPROVED ───────────────────── */

  it('CONTROL — a subdomain of the granting host is refused, without a request', async () => {
    /* `F-RW-1`: the CC BY 4.0 grant does not travel to NISR's own subdomains, which
       reserve rights. The safe fetch refuses on the NAME, before resolution. */
    const out = await safeFetchArtifact({
      url: `https://socioeconomic.statistics.gov.rw${ARTIFACT_PATH}`,
      governedHost: host!,
      policy: NISR_SAFE_FETCH_POLICY(SNAPSHOT_WIRE_BYTE_CAP),
      accept: 'application/pdf',
    });
    record.controls.subdomainRefused = {
      ok: out.ok,
      failureKind: out.failureKind,
      reason: out.reason,
      wireByteLength: out.wireByteLength,
    };
    expect(out.ok).toBe(false);
    expect(out.reason).toContain('HOST_NOT_THE_GOVERNED_HOST');
    /* Nothing was fetched: no bytes, and the address set was never even consulted. */
    expect(out.wireByteLength).toBe(0);
    expect(out.resolvedAddressCount).toBe(0);
  });

  /* ── LINK 1 · SAFE TRANSPORT ──────────────────────────────────────────── */

  it('fetches the real artifact through the HARDENED transport', async () => {
    const out = await safeFetchArtifact({
      url: `https://${host}${ARTIFACT_PATH}`,
      governedHost: host!,
      policy: NISR_SAFE_FETCH_POLICY(SNAPSHOT_WIRE_BYTE_CAP),
      accept: 'application/pdf',
    });

    record.transport = {
      ok: out.ok,
      status: out.status,
      finalUrl: out.finalUrl,
      redirectHops: out.redirectChain.length - 1,
      resolvedAddressCount: out.resolvedAddressCount,
      contentTypeHeader: out.headers?.['content-type'],
      contentEncodingHeaderPresent: out.headers?.['content-encoding'] !== undefined,
      lastModifiedHeader: out.headers?.['last-modified'],
      /* MEASURED BYTES AND TIMING — `R-STO-4`: E1's per-type caps are currently guesses
         and this is the only measurement that exists. */
      wireByteLength: out.wireByteLength,
      fetchWallMs: out.wallMs,
      failureKind: out.failureKind,
      reason: out.reason,
    };

    expect(out.ok).toBe(true);
    expect(out.status).toBe(200);
    expect(out.bytes!.byteLength).toBeGreaterThan(0);
    /* The final URL states the governed hostname, never the validated IP. */
    expect(new URL(out.finalUrl!).hostname).toBe(host);

    (globalThis as Record<string, unknown>).__nisrBytes = out.bytes;
    (globalThis as Record<string, unknown>).__nisrHeaders = out.headers;
  });

  /* ── LINK 2 · PDF ARTIFACT ADMISSION ──────────────────────────────────── */

  it('admits the PDF through the canonical evaluator — the row, the sniff and the binding', () => {
    const bytes = (globalThis as Record<string, unknown>).__nisrBytes as Uint8Array;
    const headers = (globalThis as Record<string, unknown>).__nisrHeaders as Record<string, string>;
    const contentTypeHeader = headers['content-type'] ?? '';

    const row = mediaAdmissionRowFor(contentTypeHeader);
    record.mediaRow = row;
    expect(row?.mediaType).toBe('application/pdf');
    expect(row?.charsetApplies).toBe(false);
    expect(row?.shapeRefusalKey).toBe('BODY_NOT_PDF_SHAPED');
    expect(row?.containerIsArchive).toBe(false);

    /* The extractor is installed at the composition root — here, for this run. Before
       this line the registry row's decoder refuses every artifact. */
    installNisrCpiTextLayerExtractor(NISR_PDFTOTEXT_EXTRACTOR);

    const evaluator = new CanonicalOfficialDataAdmissionEvaluator({
      gunzip: () => {
        /* The response arrived `identity` and the evaluator decodes from the WIRE
           bytes with the same function the transport used, so this is never reached.
           It throws rather than returning the input, because a decompressor that
           silently passed bytes through would make a bound unmeasurable. */
        throw new Error('NO_GZIP_EXPECTED');
      },
      /* No configured secret for a public CC BY document. The scan still runs — the
         credential-shaped patterns are the contract’s, not a caller’s option. */
      secrets: { configuredSecrets: [] },
      now: () => new Date().toISOString(),
    });

    /* E1 · C-1 — headers are captured FROM A LIST, never wholesale, so `Set-Cookie`
       and `Authorization` cannot arrive in evidence by accident. */
    const captured = Object.fromEntries(
      CAPTURED_RESPONSE_HEADERS.flatMap((h) =>
        headers[h] === undefined ? [] : [[h, headers[h]!] as const],
      ),
    );
    record.capturedHeaders = captured;

    const startedAt = Date.now();
    const outcome = evaluator.evaluate({
      providerId: PROVIDER_ID,
      endpointId: ENDPOINT_ID,
      finalUrl: `https://${host}${ARTIFACT_PATH}`,
      configuredHost: host!,
      redirectChain: [`https://${host}${ARTIFACT_PATH}`],
      httpStatus: 200,
      requestedAt: new Date().toISOString(),
      retrievedAt: new Date().toISOString(),
      contentTypeHeader,
      contentEncoding: 'identity',
      contentEncodingHeaderPresent: false,
      wireByteLength: bytes.byteLength,
      wireBytes: bytes,
      decodedBytes: bytes,
      headers: captured,
    });
    const admissionWallMs = Date.now() - startedAt;

    record.admission = {
      admissibility: outcome.admission.admissibility,
      refusalKey: outcome.admission.refusalKey,
      detail: outcome.detail,
      parserId: outcome.admission.parse?.parserId,
      parserVersion: outcome.admission.parse?.parserVersion,
      bytesOfferedForRetention: outcome.retainableBytes !== undefined,
      /* MEASURED: decode + envelope over a 1.7 MB PDF, on this runtime. */
      admissionWallMs,
    };

    expect(outcome.admission.admissibility).toBe('ADMITTED');
    /* THE IDENTITY COMES FROM THE REGISTRY, never from this file. */
    expect(outcome.admission.parse?.parserId).toBe('nisr.cpi.pdf');
    expect(outcome.retainableBytes).toBeDefined();

    decoded = outcome.parsed as NisrCpiDecoded;
    /* `lexicalNumberTokens` is a JSON-decoder fidelity artifact and is meaningless for a
       table extract — the generic result stayed pure, so it is simply absent. */
    expect(outcome.lexicalNumberTokens).toBeUndefined();
  });

  /* ── LINK 3 · RETENTION ───────────────────────────────────────────────── */

  it('retains the artifact — the STORE computes the address, and no migration was needed', async () => {
    const bytes = (globalThis as Record<string, unknown>).__nisrBytes as Uint8Array;
    const headers = (globalThis as Record<string, unknown>).__nisrHeaders as Record<string, string>;

    const request: OfficialDataRequestIdentity = {
      providerId: PROVIDER_ID,
      endpointId: ENDPOINT_ID,
      /* Provider-relative. No scheme, no host, no query. */
      requestPath: ARTIFACT_PATH,
      parameters: [],
      requestedAt: new Date().toISOString(),
    };

    const lastModified = headers['last-modified'];
    const startedAt = Date.now();
    retrieval = await store.retain({
      retrievalId: 'nisr-first-real-data-1',
      request,
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
      /* EMPTY, AND THAT IS THE MEASUREMENT — `R-AID-6`. NISR publishes none. */
      editionAnnotations: {},
      /* PUBLISHER-STATED, from the document's own cover, and corroborated by a header on
         a different channel. */
      ...(decoded === undefined ? {} : { publisherReleasedAt: decoded.publicationDate }),
      ...(lastModified === undefined
        ? {}
        : { publisherChangedAt: new Date(lastModified).toISOString() }),
      /* THE TWO LINEAGE FIELDS, from the document body and the edition. */
      ...(decoded === undefined
        ? {}
        : { referencePeriod: decoded.referencePeriod, sourceLanguage: decoded.sourceLanguage }),
      admission: {
        captureOutcome: 'COMPLETE',
        admissibility: 'ADMITTED',
        transport: { contentEncoding: 'identity', wireByteLength: bytes.byteLength },
        parse: {
          parserId: 'nisr.cpi.pdf',
          parserVersion: '1.0.0',
          parsedAt: new Date().toISOString(),
        },
      },
    });
    const retentionWallMs = Date.now() - startedAt;

    address = retrieval.contentAddress;
    const payload = await store.open(address!);

    record.retention = {
      contentAddress: address,
      byteLength: retrieval.byteLength,
      mediaType: retrieval.mediaType,
      payloadReopened: payload !== null,
      payloadByteLength: payload?.byteLength,
      /* MEASURED: bytes retained and wall time, which is the input E1 asked for. */
      retentionWallMs,
      editionAnnotations: retrieval.editionAnnotations,
      publisherReleasedAt: retrieval.publisherReleasedAt,
      publisherChangedAt: retrieval.publisherChangedAt,
      referencePeriod: retrieval.referencePeriod,
      sourceLanguage: retrieval.sourceLanguage,
    };

    expect(payload).not.toBeNull();
    expect(payload!.byteLength).toBe(bytes.byteLength);
    /* THE ADDRESS IS THE STORE'S, computed from the bytes it holds. */
    expect(address).toHaveLength(64);
    /* LINEAGE REACHED THE RETRIEVAL. */
    expect(retrieval.referencePeriod).toBe(decoded!.referencePeriod);
    expect(retrieval.sourceLanguage).toBe(decoded!.sourceLanguage);
  });

  it('REPORTS the Postgres blocker rather than routing around it', () => {
    /*
      The same retrieval, offered to the landed Postgres store, is REFUSED — it has no
      column for either lineage field, and `MAIN-…-R2` ruling D declines to design a
      migration. Measured here rather than asserted in a document.
    */
    let refusal = '';
    try {
      assertLineageFieldsArePersistable({
        referencePeriod: retrieval!.referencePeriod,
        sourceLanguage: retrieval!.sourceLanguage,
      });
    } catch (e) {
      refusal = (e as Error).message;
    }
    record.postgresLineageBlocker = {
      refused: refusal !== '',
      message: refusal.slice(0, 400),
      columnsThatWouldBeNeeded: ['SnapshotRetrieval.referencePeriod', 'SnapshotRetrieval.sourceLanguage'],
      migrationDesigned: false,
    };
    expect(refusal).toContain('SNAPSHOT_LINEAGE_FIELD_HAS_NO_COLUMN');
  });

  /* ── LINK 4 · THE PARSE, AND WHAT THE PUBLISHER ACTUALLY PRINTED ──────── */

  it('decoded the publisher’s own figures, and computed none of them', () => {
    expect(decoded).toBeDefined();
    const byGeo = (g: string): number | undefined =>
      decoded!.rows
        .find((r) => r.geography === g && r.coicopCode === '00')
        ?.cells.find((c) => c.role === 'PCT_CHANGE_ON_YEAR_AGO')?.value;

    const urban = byGeo('URBAN');
    const rural = byGeo('RURAL');
    const national = byGeo('ALL_RWANDA');

    record.decoded = {
      referencePeriod: decoded!.referencePeriod,
      publicationDate: decoded!.publicationDate,
      sourceLanguage: decoded!.sourceLanguage,
      basePeriod: decoded!.basePeriod,
      issueOrdinal: decoded!.issueOrdinal,
      licenceToken: decoded!.licenceToken,
      geographiesPresent: decoded!.geographiesPresent,
      extractorId: decoded!.extractorId,
      extractorVersion: decoded!.extractorVersion,
      rowCount: decoded!.rows.length,
      generalIndexAnnualPercentChange: { urban, rural, national },
    };

    expect(decoded!.referencePeriod).toMatch(/^\d{4}-\d{2}$/);
    expect(decoded!.publicationDate.slice(0, 7)).not.toBe(decoded!.referencePeriod);
    expect(decoded!.geographiesPresent).toContain('ALL_RWANDA');
    expect(typeof national).toBe('number');

    /*
      THE FINDING OF G's ROUND, RE-DEMONSTRATED ON THE REAL BYTES.

      The mean of urban and rural rounds to the published national figure on THIS edition
      — which is precisely why an equality assertion against it proves nothing about
      averaging. So the assertion is not that the number is right; it is that the number
      came from the ALL RWANDA ANNEX, which is a different row of a different table from
      the two an averaging parser would have used.
    */
    const mean = Math.round(((urban! + rural!) / 2) * 10) / 10;
    record.decoded.meanOfUrbanAndRural = mean;
    record.decoded.meanCoincidesWithPublishedNational = mean === national;
    record.decoded.nationalReadFromAllRwandaAnnex = true;
    expect(decoded!.rows.some((r) => r.geography === 'ALL_RWANDA')).toBe(true);
  });

  /* ── LINK 5 · NORMALIZED ECONOMY OBSERVATION ──────────────────────────── */

  it('normalizes to Economy INFLATION_CPI, with every value source-derived', () => {
    const provenance: SourceProvenance = {
      sourceType: 'PUBLIC_DATA',
      providerId: PROVIDER_ID,
      institution: 'National Institute of Statistics of Rwanda',
      jurisdiction: 'RW',
      language: decoded!.sourceLanguage,
      sourceUrl: `https://${host}${ARTIFACT_PATH}`,
      retrievedAt: retrieval!.retrievedAt,
      authorityClass: 'OFFICIAL_STATISTICS',
    };

    /* FIRST SIGHTING: nothing seen before, so nothing to be behind. */
    const editionOrder = nisrCpiEditionOrderFor([], address as string);

    const n = normalizeNisrCpiNationalObservation({
      decoded: decoded!,
      retrieval: retrieval!,
      provenance,
      editionOrder,
    });

    expect(n.ok).toBe(true);
    if (!n.ok) return;

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
        upstreamProviderId: n.lineage.upstream.providerId,
        datasetCode: n.lineage.upstream.datasetCode,
        dimensions: n.lineage.upstream.dimensions,
        retrievalId: n.lineage.retrieval.retrievalId,
        contentAddress: n.lineage.retrieval.contentAddress,
        referencePeriod: n.lineage.retrieval.referencePeriod,
        sourceLanguage: n.lineage.retrieval.sourceLanguage,
        parserIdentityFrom: 'REGISTRY_ROW',
      },
    };

    /* SOURCE-DERIVED: the value IS the cell the decoder read from the All Rwanda annex. */
    const fromArtifact = decoded!.rows
      .find((r) => r.geography === 'ALL_RWANDA' && r.coicopCode === '00')!
      .cells.find((c) => c.role === 'PCT_CHANGE_ON_YEAR_AGO')!.value;
    expect(n.observation.value).toBe(fromArtifact);

    expect(n.series.category).toBe('INFLATION_CPI');
    expect(n.period.periodId).toBe(decoded!.referencePeriod);
    /* Three dates, three homes. */
    expect(n.observation.vintage).toBe(decoded!.publicationDate);
    expect(n.observation.vintage).not.toBe(retrieval!.retrievedAt);
    /* NO INFERRED FINALITY OR REVISION. */
    expect(n.observation.semantics.releaseStatus).toBeNull();
    expect(n.observation.semantics.revisionOrdinal).toBeUndefined();
    expect((n.observation as unknown as Record<string, unknown>)['revisionKind']).toBeUndefined();

    (globalThis as Record<string, unknown>).__nisrProvenance = provenance;
    (globalThis as Record<string, unknown>).__nisrObservationKey = economyObservationKey(
      n.observation,
    );
  });

  /* ── LINK 6 · CANONICAL RETENTION — THE PAYLOAD IS PINNED BY THE FIGURE ── */

  it('pins the retained payload to the observation that cites it', async () => {
    const citedBy = (globalThis as Record<string, unknown>).__nisrObservationKey as string;
    await store.pin(address!, { citedBy, reason: 'ECONOMY_OBSERVATION_EVIDENCE' });

    record.retention.pinned = await store.isPinned(address!);
    record.retention.pinnedBy = citedBy;
    expect(record.retention.pinned).toBe(true);
  });

  it('SR-4 — a second fetch of unchanged bytes is ONE payload and TWO retrievals', async () => {
    const bytes = (globalThis as Record<string, unknown>).__nisrBytes as Uint8Array;
    const second = await store.retain({
      retrievalId: 'nisr-first-real-data-2',
      request: {
        providerId: PROVIDER_ID,
        endpointId: ENDPOINT_ID,
        requestPath: ARTIFACT_PATH,
        parameters: [],
        requestedAt: new Date().toISOString(),
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
      editionAnnotations: {},
      admission: {
        captureOutcome: 'COMPLETE',
        admissibility: 'ADMITTED',
        transport: { contentEncoding: 'identity', wireByteLength: bytes.byteLength },
        parse: {
          parserId: 'nisr.cpi.pdf',
          parserVersion: '1.0.0',
          parsedAt: new Date().toISOString(),
        },
      },
    });

    /* NO SECOND NETWORK CALL: the same bytes already in hand are re-offered, which is what
       a second unchanged fetch would have produced. */
    const retrievals = await store.retrievalsFor(address!);
    record.sr4 = {
      payloadCount: store.payloadCount(),
      retrievalCount: retrievals.length,
      sameAddress: second.contentAddress === address,
      editionOrderForIdenticalBytes: nisrCpiEditionOrderFor([address as string], address as string),
    };
    expect(store.payloadCount()).toBe(1);
    expect(retrievals).toHaveLength(2);
    expect(record.sr4.editionOrderForIdenticalBytes).toBe('SAME');
  });

  /* ── LINK 7 · THE INTERNAL READ ───────────────────────────────────────── */

  it('reads the figure back INTERNALLY, as a slot rather than a bare number', () => {
    const provenance = (globalThis as Record<string, unknown>).__nisrProvenance as SourceProvenance;
    const read = readNisrCpiNationalFigureSlot({
      decoded: decoded!,
      retrieval: retrieval!,
      provenance,
      editionOrder: nisrCpiEditionOrderFor([], address as string),
    });

    record.internalRead = {
      exposure: SNAPSHOT_EXPOSURE,
      kind: read.slot.kind,
      publishable: read.publishable,
      value: read.slot.kind === 'OBSERVATION' ? read.slot.observation.value : undefined,
      unit: read.slot.kind === 'OBSERVATION' ? read.slot.observation.unit : undefined,
      gapReason: read.slot.kind === 'GAP' ? read.slot.reason : undefined,
    };

    expect(read.slot.kind).toBe('OBSERVATION');
    expect(read.publishable).toBe(true);
    expect(SNAPSHOT_EXPOSURE).toBe('INTERNAL_ONLY');
  });

  /* ── THE PROVENANCE ASSEMBLY, FROM FOUR PLACES AND NOT ONE CLAIM ──────── */

  it('assembles provenance from the sealed address, the registry row and the document', () => {
    const binding = resolveParserBinding(PROVIDER_ID, ENDPOINT_ID, 'application/pdf')!;
    const p = assembleProvenance(address as string, binding as never, decoded!);
    record.parseProvenance = p;

    expect(p.contentAddress).toBe(address);
    expect(p.parserId).toBe('nisr.cpi.pdf');
    expect(p.referencePeriod).toBe(decoded!.referencePeriod);
    expect(p.sourceLanguage).toBe(decoded!.sourceLanguage);
    expect(p.extractorId).toBe('pdftotext.table');
  });

  it('leaves the source DORMANT and the scheduler OFF', () => {
    const entry = OFFICIAL_SOURCES.find((s) => s.id === PROVIDER_ID)!;
    record.finalState = {
      sourceEnabled: entry.enabled,
      ingestionMethod: entry.ingestionMethod,
      schedulerOff: true,
      recurringFetch: false,
      deploymentExecuted: false,
      uiBound: false,
    };
    expect(entry.enabled).toBe(false);
    expect(entry.ingestionMethod).toBe('none');
  });
});
