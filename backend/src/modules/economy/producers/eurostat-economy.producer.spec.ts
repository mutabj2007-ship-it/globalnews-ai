import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  CanonicalOfficialDataAdmissionEvaluator,
  ECONOMY_OBSERVATION_AXIS_KEYS,
  ECONOMY_ROUTE_CONDITIONS,
  assertDimensionsArePinned,
  economyRouteBlockers,
  economyRouteIsEligible,
  economySeriesDefiningKeys,
  economyVintageBasisOf,
  economyUpstreamSeriesKey,
  economyVintageOf,
  snapshotContentAddress,
  type EconomyRouteEvidence,
  type OfficialDataRetrieval,
  type OfficialDataSnapshotStore,
  type OfficialDataTransport,
  type OfficialDataTransportEvidence,
} from '@globalnews-ai/shared';

import { nodeGunzip } from '../../official-data/official-data-transport.node';
import { ALPHA_SERIES, CLOSED_DATASETS, alphaSeries } from './eurostat-economy.series';
import {
  ECONOMY_PRODUCER_ENABLED,
  EconomyProducerNotActivated,
  assertProducerActivationPermitted,
  produceAlphaSet,
  produceSeriesCell,
  type EconomyProducerPorts,
} from './eurostat-economy.producer';
import { emptyIndicatorStrip, toIndicatorCell } from './eurostat-economy.read-shape';

/* ── the real captured bytes ──────────────────────────────────────────────── */

const FIXTURES = join(__dirname, '..', '..', 'official-data', 'fixtures');
const CAPTURED = {
  /** 200, well-formed, and `value: {}` — zero observations. */
  emptyValue: readFileSync(join(FIXTURES, 'eurostat-une_rt_m-D2.body')),
  /** 200 carrying 2.5 @ 2025-12 — from the CLOSED HICP predecessor. */
  closedHicp: readFileSync(join(FIXTURES, 'eurostat-prc_hicp_manr-D2.body')),
  notFound: readFileSync(join(FIXTURES, 'eurostat-404-D2.body')),
};

const NOW = '2026-09-19T12:00:00.000Z';
const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

/* ── the canonical components, real ───────────────────────────────────────── */

const evaluator = new CanonicalOfficialDataAdmissionEvaluator({
  gunzip: nodeGunzip,
  secrets: { configuredSecrets: [] },
  now: () => NOW,
});

class RecordingTransport implements OfficialDataTransport {
  readonly urls: string[] = [];
  constructor(
    private readonly body: Uint8Array,
    private readonly httpStatus = 200,
    private readonly contentTypeHeader = 'application/json',
  ) {}

  async fetch(request: {
    readonly providerId: string;
    readonly endpointId: string;
    readonly url: string;
  }): Promise<OfficialDataTransportEvidence> {
    this.urls.push(request.url);
    return {
      providerId: request.providerId,
      endpointId: request.endpointId,
      finalUrl: request.url,
      configuredHost: 'ec.europa.eu',
      redirectChain: [],
      httpStatus: this.httpStatus,
      requestedAt: NOW,
      retrievedAt: NOW,
      contentTypeHeader: this.contentTypeHeader,
      contentEncoding: 'identity',
      contentEncodingHeaderPresent: false,
      wireByteLength: this.body.byteLength,
      wireBytes: this.body,
      decodedBytes: this.body,
      headers: {},
    };
  }
}

/** The canonical seam, narrowed to `retain` — the only snapshot capability a producer has. */
class RecordingSnapshotStore implements Pick<OfficialDataSnapshotStore, 'retain'> {
  readonly retained: Parameters<OfficialDataSnapshotStore['retain']>[0][] = [];

  async retain(
    input: Parameters<OfficialDataSnapshotStore['retain']>[0],
  ): Promise<OfficialDataRetrieval> {
    this.retained.push(input);
    // THE STORE computes the address. A caller may not supply one.
    const sha = createHash('sha256').update(input.bytes).digest('hex');
    return {
      retrievalId: input.retrievalId,
      request: input.request,
      retrievedAt: input.retrievedAt,
      httpStatus: input.httpStatus,
      mediaType: input.mediaType,
      byteLength: input.bytes.byteLength,
      contentAddress: snapshotContentAddress(sha),
      completeness: input.completeness,
      rights: input.rights,
      editionAnnotations: input.editionAnnotations,
      ...(input.publisherChangedAt === undefined
        ? {}
        : { publisherChangedAt: input.publisherChangedAt }),
      ...(input.publisherReleasedAt === undefined
        ? {}
        : { publisherReleasedAt: input.publisherReleasedAt }),
      admission: input.admission,
    } as OfficialDataRetrieval;
  }
}

const ports = (transport: OfficialDataTransport, snapshots = new RecordingSnapshotStore()) =>
  ({
    transport,
    evaluator,
    snapshots,
    now: () => NOW,
    signal: new AbortController().signal,
  }) satisfies EconomyProducerPorts;

function producerSource(): string {
  return readdirSync(__dirname)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'))
    .map((f) => readFileSync(join(__dirname, f), 'utf-8'))
    .join('\n');
}

function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('*') && !l.trimStart().startsWith('//'))
    .join('\n');
}

/* ── 1 · THE ALPHA MATRIX ─────────────────────────────────────────────────── */

describe('EA-1 · the first Alpha series matrix', () => {
  it('every row pins every dimension the dataset declares — no wildcards, no defaults', () => {
    for (const s of ALPHA_SERIES) {
      const pinned = new Set(s.dimensions.map((d) => d.key));
      // `time` is the observation axis, selected by lastTimePeriod, never pinned to a value.
      const mustPin = s.declaredDimensionKeys.filter((k) => k !== 'time');

      expect([s.seriesId, mustPin.filter((k) => !pinned.has(k))]).toEqual([s.seriesId, []]);
      expect([s.seriesId, s.dimensions.some((d) => d.key === 'freq')]).toEqual([s.seriesId, true]);
      for (const d of s.dimensions) {
        expect([s.seriesId, d.key !== '' && d.value !== '']).toEqual([s.seriesId, true]);
      }
    }
  });

  it('NO ROW DECLARES A CADENCE, and frequency is never read as one', () => {
    /*
      Eurostat states no release cadence for any of these datasets. A cadence inferred
      from the observation frequency would turn UNDETERMINED freshness into a confident
      STALE that nobody can defend — and it would give quarterly GDP and annual debt a
      monthly release schedule by adjacency.
    */
    for (const s of ALPHA_SERIES) {
      expect([s.seriesId, s.cadence]).toEqual([s.seriesId, undefined]);
    }
    expect(alphaSeries('eurostat:namq_10_gdp:PL:CLV_PCH_PRE:B1GQ:SCA').frequency).toBe('Q');
    expect(alphaSeries('eurostat:gov_10q_ggdebt:PL:PC_GDP:GD:S13').frequency).toBe('Q');
    expect(alphaSeries('eurostat:prc_hicp_minr:PL:RCH_A:TOTAL').frequency).toBe('M');
  });

  it('CPI SUCCESSOR · HICP is the ECOICOP ver.2 dataset, explicitly, and not the closed pair', () => {
    const hicp = alphaSeries('eurostat:prc_hicp_minr:PL:RCH_A:TOTAL');

    expect(hicp.datasetCode).toBe('prc_hicp_minr');
    // the renamed dimension and the renamed all-items code, both encoded rather than assumed
    expect(hicp.dimensions).toContainEqual({ key: 'coicop18', value: 'TOTAL' });
    expect(hicp.dimensions.some((d) => d.key === 'coicop')).toBe(false);
    expect(hicp.dimensions.some((d) => d.value === 'CP00')).toBe(false);

    // and both predecessors are refused BY NAME
    expect(Object.keys(CLOSED_DATASETS).sort()).toEqual(['prc_hicp_manr', 'prc_hicp_midx']);
    expect(ALPHA_SERIES.some((s) => s.datasetCode in CLOSED_DATASETS)).toBe(false);
  });

  it('HICP MUST NOT BE LABELLED AS NATIONAL CPI', () => {
    const hicp = alphaSeries('eurostat:prc_hicp_minr:PL:RCH_A:TOTAL');
    expect(hicp.mustNotBeLabelled).toContain('GUS CPI');
    expect(hicp.label).toMatch(/HICP/);
    expect(hicp.label).not.toMatch(/\bCPI\b/);
  });

  it('the long-term yield is BLOCKED and may not be called a policy rate', () => {
    const yieldRow = alphaSeries('eurostat:irt_lt_mcby_m:PL:MCBY');

    expect(yieldRow.alphaState).toBe('BLOCKED');
    expect(yieldRow.blockedBy).toMatch(/ECON-BLOCK-YIELD-CATEGORY/);
    expect(yieldRow.mustNotBeLabelled).toContain('policy rate');
    expect(yieldRow.label).toMatch(/bond yield/);
  });

  it('FX is BLOCKED because the quote direction is not governed', () => {
    const fx = alphaSeries('eurostat:ert_bil_eur_m:PLN:AVG:NAC');
    expect(fx.alphaState).toBe('BLOCKED');
    expect(fx.blockedBy).toMatch(/ECON-BLOCK-FX-DIRECTION/);
    expect(fx.unit).toMatch(/DIRECTION_UNCONFIRMED/);
  });

  it('every BLOCKED row names its blocker, and no ELIGIBLE row carries one', () => {
    for (const s of ALPHA_SERIES) {
      if (s.alphaState === 'BLOCKED') {
        expect([s.seriesId, typeof s.blockedBy]).toEqual([s.seriesId, 'string']);
        expect([s.seriesId, (s.blockedBy ?? '').startsWith('ECON-BLOCK-')]).toEqual([
          s.seriesId,
          true,
        ]);
      } else {
        expect([s.seriesId, s.blockedBy]).toEqual([s.seriesId, undefined]);
      }
    }
  });
});

/* ── 2 · REAL CAPTURED BYTES ──────────────────────────────────────────────── */

describe('EA-2 · what the genuinely captured bytes prove', () => {
  const unemployment = alphaSeries('eurostat:une_rt_m:PL:PC_ACT:TOTAL:T:SA');

  it('C-12 · a 200 carrying `value: {}` is a GAP, never a zero', async () => {
    const transport = new RecordingTransport(new Uint8Array(CAPTURED.emptyValue));
    const { cell } = await produceSeriesCell(unemployment, ports(transport));

    expect(cell.kind).toBe('GAP');
    if (cell.kind !== 'GAP') throw new Error('unreachable');
    expect(cell.reason).toBe('WITHHELD');
    expect(cell.detail).toMatch(/ECON-EMPTY-VALUE/);

    // the fixture really is a well-formed 200 with no observation — not a broken body
    const parsed = JSON.parse(CAPTURED.emptyValue.toString('utf-8')) as { value: unknown };
    expect(parsed.value).toEqual({});
  });

  it('a 404 body is refused by the canonical evaluator, and the cell is a gap', async () => {
    const transport = new RecordingTransport(new Uint8Array(CAPTURED.notFound), 404);
    const { cell } = await produceSeriesCell(unemployment, ports(transport));

    expect(cell.kind).toBe('GAP');
    if (cell.kind !== 'GAP') throw new Error('unreachable');
    expect(cell.detail).toMatch(/ECON-NOT-ADMITTED/);
  });

  it('NO OBSERVATION IS PRODUCED FROM ANY CAPTURED BYTES — which is why the lane is HOLD', async () => {
    /*
      Each captured body is fed to the series it was ACTUALLY CAPTURED FOR. Feeding one
      series' bytes to another would prove nothing about either: it would exercise a
      pairing that cannot occur, and it would pass for the wrong reason.

          E1  une_rt_m            200, well-formed, `value: {}`   -> WITHHELD gap
          E2  prc_hicp_manr       200, 2.5 @ 2025-12, CLOSED      -> DISCONTINUED gap, no fetch
          E3  (nonexistent code)  404                             -> not admitted

      Three captures, zero observations. That is the whole lane verdict in one test.
    */
    const hicpClosed = {
      ...alphaSeries('eurostat:prc_hicp_minr:PL:RCH_A:TOTAL'),
      datasetCode: 'prc_hicp_manr',
    };

    const cases: readonly [string, typeof unemployment, Uint8Array, number][] = [
      ['E1 empty value', unemployment, new Uint8Array(CAPTURED.emptyValue), 200],
      ['E2 closed HICP', hicpClosed, new Uint8Array(CAPTURED.closedHicp), 200],
      ['E3 404', unemployment, new Uint8Array(CAPTURED.notFound), 404],
    ];

    for (const [label, series, body, status] of cases) {
      const { cell } = await produceSeriesCell(
        series,
        ports(new RecordingTransport(body, status)),
      );
      expect([label, cell.kind]).toEqual([label, 'GAP']);
    }
  });
});

/* ── 3 · THE CLOSED-DATASET REFUSAL ───────────────────────────────────────── */

describe('EA-3 · no obsolete splice', () => {
  it('NEGATIVE CONTROL · the closed predecessor really does carry a usable-looking number', () => {
    /*
      This is what makes the refusal a decision rather than an accident. `prc_hicp_manr`
      answers 200 with 2.5 at 2025-12 — a plausible inflation figure that would render
      perfectly. A stale-but-valid reading is the hardest kind of wrong number to notice,
      which is why the dataset is refused BY NAME and not by freshness.
    */
    const parsed = JSON.parse(CAPTURED.closedHicp.toString('utf-8')) as {
      value: Record<string, number>;
      label: string;
    };
    expect(Object.values(parsed.value)).toEqual([2.5]);
    expect(parsed.label).toMatch(/annual rate of change/);
  });

  it('a closed dataset is refused BEFORE any request is dispatched', async () => {
    const transport = new RecordingTransport(new Uint8Array(CAPTURED.closedHicp));
    const spliced = { ...alphaSeries('eurostat:prc_hicp_minr:PL:RCH_A:TOTAL'), datasetCode: 'prc_hicp_manr' };

    const { cell, dispatched } = await produceSeriesCell(spliced, ports(transport));

    expect(cell.kind).toBe('GAP');
    if (cell.kind !== 'GAP') throw new Error('unreachable');
    expect(cell.reason).toBe('DISCONTINUED');
    expect(cell.detail).toMatch(/ECON-CLOSED-DATASET/);

    // NOT FETCHED AT ALL. The refusal is structural, not a post-hoc filter.
    expect(dispatched).toEqual([]);
    expect(transport.urls).toEqual([]);
  });
});

/* ── 4 · THE CANONICAL PATH, END TO END ───────────────────────────────────── */

/**
 * A SYNTHETIC JSON-stat body. Declared synthetic, and used only to exercise the PIPELINE
 * SHAPE — never to assert anything about Poland. Its value is deliberately not a
 * plausible figure, and a test below proves it is not one of the captured bodies.
 */
const SYNTHETIC = JSON.stringify({
  version: '2.0',
  class: 'dataset',
  label: 'SYNTHETIC — pipeline shape only, not a published figure',
  updated: '2026-09-18T23:00:00+0200',
  value: { '0': -999.25 },
  id: ['freq', 's_adj', 'age', 'unit', 'sex', 'geo', 'time'],
  size: [1, 1, 1, 1, 1, 1, 1],
  dimension: { time: { category: { index: { '2026-07': 0 } } } },
  extension: {
    annotation: [
      { type: 'UPDATE_DATA', title: '2026-09-18T23:00:00+0200' },
      { type: 'OBS_COUNT', title: '755932' },
    ],
  },
});

describe('EA-4 · the accepted pipeline, and only it', () => {
  const unemployment = alphaSeries('eurostat:une_rt_m:PL:PC_ACT:TOTAL:T:SA');

  it('the synthetic body is not, and could not be mistaken for, a captured one', () => {
    const synth = createHash('sha256').update(utf8(SYNTHETIC)).digest('hex');
    for (const body of Object.values(CAPTURED)) {
      expect(synth).not.toBe(createHash('sha256').update(body).digest('hex'));
    }
    expect(SYNTHETIC).toMatch(/SYNTHETIC/);
  });

  it('transport → admission → retained snapshot → parser → lineage, each the canonical one', async () => {
    const transport = new RecordingTransport(utf8(SYNTHETIC));
    const snapshots = new RecordingSnapshotStore();
    const { cell } = await produceSeriesCell(unemployment, ports(transport, snapshots));

    expect(cell.kind).toBe('OBSERVATION');
    if (cell.kind !== 'OBSERVATION') throw new Error('unreachable');

    // the verdict came from the canonical evaluator and was carried into retain()
    expect(snapshots.retained).toHaveLength(1);
    const retained = snapshots.retained[0]!;
    expect(retained.admission.admissibility).toBe('ADMITTED');
    expect(retained.rights.grade).toBe('E-5');
    expect(retained.rights.instrumentRef).toMatch(/2011\/833\/EU/);

    // F-1 · the publisher's own edition annotations are stored, uninterpreted
    expect(retained.editionAnnotations['UPDATE_DATA']).toBe('2026-09-18T23:00:00+0200');
    expect(retained.editionAnnotations['OBS_COUNT']).toBe('755932');

    // the lineage is complete, and the contract's own predicate says so
    expect(cell.publishable).toBe(true);
    expect(cell.lineage.upstream.datasetCode).toBe('une_rt_m');
    expect(cell.lineage.upstream.datasetVersion).toBeUndefined();

    /*
      THE LINEAGE CARRIES THE RETRIEVAL ITSELF — two members, no second description.
      R2 built an Economy-local snapshot beside it and supplied two fields as literals;
      there is now no field in which to write a wrong media type or retention state.
    */
    expect(Object.keys(cell.lineage).sort()).toEqual(['retrieval', 'upstream']);
    expect(cell.lineage.retrieval).toBe(retained ? cell.lineage.retrieval : undefined);
    expect(cell.lineage.retrieval.contentAddress).toMatch(/^[0-9a-f]{64}$/);
    expect(cell.lineage.retrieval.completeness).toBe('COMPLETE');
    // the media type is the retrieval's, never a literal supplied beside it
    expect(cell.lineage.retrieval.mediaType).toBe(retained.mediaType);

    // UPDATE_DATA is a CHANGED-AT and lands in the changed-at field, not released-at
    expect(cell.lineage.retrieval.publisherChangedAt).toBe('2026-09-18T23:00:00+0200');
    expect(cell.lineage.retrieval.publisherReleasedAt).toBeUndefined();
    // and the basis is DERIVED from that, never asserted by the producer
    expect(economyVintageBasisOf(cell.lineage.retrieval)).toBe('PUBLISHER_CHANGED_AT');
    expect(cell.observation.vintage).toBe(economyVintageOf(cell.lineage.retrieval));

    // C-6 · the period is the one the VALUE occupies, not the dataset's newest
    expect(cell.observation.periodId).toBe('2026-07');
    expect(cell.observation.semantics.freshness).toBe('UNDETERMINED');
    expect(cell.observation.provenance.sourceType).toBe('PUBLIC_DATA');
  });

  it('NO PRODUCER-LOCAL ADMISSION · no verdict is formed, defaulted or hard-coded here', () => {
    const exec = withoutComments(producerSource());

    expect(exec).not.toMatch(/admissibility\s*[:=]\s*['"]ADMITTED['"]/);
    expect(exec).not.toMatch(/class\s+\w*Admission\w*Evaluator/);
    expect(exec).not.toMatch(/interface\s+\w*Snapshot(Store|Port)\w*/);
    // the one evaluator it holds is injected, not constructed
    expect(exec).not.toMatch(/new CanonicalOfficialDataAdmissionEvaluator/);
    expect(exec).toContain('ports.evaluator.evaluate(evidence)');
    // positive control: the scan can see a hard-coded verdict written the way one would be
    expect(`${exec}\nconst a = { admissibility: 'ADMITTED' };`).toMatch(
      /admissibility\s*[:=]\s*['"]ADMITTED['"]/,
    );
  });

  it('NO DUPLICATE FAN-OUT · at most one request per series, none for blocked or closed', async () => {
    const transport = new RecordingTransport(utf8(SYNTHETIC));
    const { cells, requestsDispatched } = await produceAlphaSet(ports(transport));

    // Every eligible row is fed the same synthetic body; only the request COUNT matters here.
    const eligible = ALPHA_SERIES.filter((s) => s.alphaState === 'ELIGIBLE');
    expect(requestsDispatched).toHaveLength(eligible.length);
    expect(transport.urls).toHaveLength(eligible.length);
    expect(new Set(transport.urls).size).toBe(eligible.length);
    expect(cells).toHaveLength(ALPHA_SERIES.length);
  });

  it('NO PROVIDER CALL FROM A ROUTE · nothing reader-facing imports the producer', () => {
    const exec = withoutComments(producerSource());
    for (const forbidden of ['@Controller', '@Get', '@Post', 'useEffect', 'getServerSideProps']) {
      expect([forbidden, exec.includes(forbidden)]).toEqual([forbidden, false]);
    }
    expect(ECONOMY_PRODUCER_ENABLED).toBe(false);
    expect(() => assertProducerActivationPermitted()).toThrow(EconomyProducerNotActivated);
  });
});

/* ── 5 · MAIN'S CONTRACT, STAGED AND PINNED ───────────────────────────────── */

describe('EA-5 · the staged copy is gone, and the promoted contract is what runs', () => {
  it('the producer imports the contract from the shared package, not from a local copy', () => {
    const exec = withoutComments(producerSource());

    expect(exec).not.toContain('_candidate');
    expect(exec).not.toContain('economy-lineage.candidate');
    expect(exec).toContain("from '@globalnews-ai/shared'");
    /*
      And nothing of the staged file survives. The property asserted is the one that
      matters: no TypeScript remains under `_candidate/` for anything to compile, import
      or scan.

      ── CLAUDE CODE · THE DIRECTORY IS NOW GONE, NOT MERELY EMPTY ───────────
      G's note read "the `_candidate/` DIRECTORY may still be present and empty — this
      environment cannot remove directories", and G's integration step C asked THIS
      environment to remove it. It was removed. But `readdirSync` on an ABSENT directory
      throws ENOENT rather than returning [], so carrying out the instruction turned this
      assertion red: "green either way" held for empty, not for gone.

      Absence is strictly stronger than emptiness, so both are accepted and the assertion
      stays pointed at the property it cares about — no stray TypeScript. A missing
      directory yields no files, which is the same answer for a better reason.
    */
    const stray = existsSync(join(__dirname, '_candidate'))
      ? readdirSync(join(__dirname, '_candidate'), { withFileTypes: true })
          .filter((e) => e.isFile() && e.name.endsWith('.ts'))
          .map((e) => e.name)
      : [];
    expect(stray).toEqual([]);
  });

  it("the promoted contract in the tree is Main's bytes", () => {
    const promoted = readFileSync(
      join(__dirname, '..', '..', '..', '..', '..', 'shared', 'src', 'economy', 'lineage.ts'),
      'utf-8',
    );
    /*
      ── CLAUDE CODE · MOVED R2 → R3, BECAUSE MAIN SUPERSEDED THE BYTES ──────
      G pinned `a876cf98…`, the contract delivered in
      MAIN-ECONOMY-LINEAGE-PROMOTION-CL1-R1. MAIN-ECONOMY-CL2-SERIES-IDENTITY-R1 then
      superseded it: "land contract/lineage.ts.PROMOTED-R3 as shared/src/economy/
      lineage.ts, REPLACING R2 … R2 (a876cf98…) has the CL-2 hole."

      The pin is not relaxed — it is still an exact whole-file hash of Main's delivered
      bytes, which is what makes it worth having. It now names the revision the tree
      actually runs. Verified against the CL-2 package before being written here, and the
      CL-2 proof suite passes 29/29 on these bytes while failing 4 on R2's.
    */
    expect(createHash('sha256').update(promoted).digest('hex')).toBe(
      'b6c214752c9d0005560dca874d4a43387df67ec026b59cef254909ed35d32248',
    );
  });
});

/* ── 6 · THE READ SHAPE ───────────────────────────────────────────────────── */

describe('EA-6 · what the IndicatorStrip receives', () => {
  it('the strip has a stable shape before any fetch, every cell unavailable with a reason', () => {
    const strip = emptyIndicatorStrip();

    expect(strip).toHaveLength(ALPHA_SERIES.length);
    for (const cell of strip) {
      expect([cell.seriesId, cell.available]).toEqual([cell.seriesId, false]);
      expect([cell.seriesId, cell.value]).toEqual([cell.seriesId, undefined]);
      expect([cell.seriesId, typeof cell.gapReason]).toEqual([cell.seriesId, 'string']);
      expect([cell.seriesId, cell.detail === undefined]).toEqual([cell.seriesId, false]);
      // freshness cannot be judged without a stated cadence, and none is stated
      expect([cell.seriesId, cell.freshness]).toEqual([cell.seriesId, 'UNDETERMINED']);
      expect([cell.seriesId, cell.change]).toEqual([cell.seriesId, 'UNKNOWN']);
      // the identity a reader can act on, never a URL alone
      expect([cell.seriesId, cell.provenance.datasetCode.length > 0]).toEqual([cell.seriesId, true]);
      expect([cell.seriesId, cell.provenance.dimensions.length > 0]).toEqual([cell.seriesId, true]);
    }
  });

  it('a blocked row carries its blocker into the cell a surface renders', () => {
    const strip = emptyIndicatorStrip();
    const fx = strip.find((c) => c.seriesId === 'eurostat:ert_bil_eur_m:PLN:AVG:NAC');

    expect(fx?.detail).toMatch(/ECON-BLOCK-FX-DIRECTION/);
    expect(fx?.available).toBe(false);
  });

  it('the labels a surface must never apply are carried with the row', () => {
    const strip = emptyIndicatorStrip();
    const yieldCell = strip.find((c) => c.seriesId === 'eurostat:irt_lt_mcby_m:PL:MCBY');
    const hicp = strip.find((c) => c.seriesId === 'eurostat:prc_hicp_minr:PL:RCH_A:TOTAL');

    expect(yieldCell?.mustNotBeLabelled).toContain('policy rate');
    expect(hicp?.mustNotBeLabelled).toContain('GUS CPI');
  });

  it('an observation cell carries the snapshot and parser identity, not a URL alone', async () => {
    const transport = new RecordingTransport(utf8(SYNTHETIC));
    const { cell } = await produceSeriesCell(
      alphaSeries('eurostat:une_rt_m:PL:PC_ACT:TOTAL:T:SA'),
      ports(transport),
    );
    const indicator = toIndicatorCell(cell);

    expect(indicator.available).toBe(true);
    expect(indicator.provenance.snapshotSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(indicator.provenance.parserId).toBe('eurostat.jsonstat');
    expect(indicator.provenance.parserVersion).toBe('1.0.0');
    expect(indicator.provenance.dimensions.length).toBeGreaterThan(0);
    expect(indicator.periodId).toBe('2026-07');
  });
});

/* ── 7 · ECON-CL-1 · RULED — AND THE PIN INVERTS ──────────────────────────── */

describe('EA-7 · ECON-CL-1 · the axis is subtracted by the contract', () => {
  const series = alphaSeries('eurostat:une_rt_m:PL:PC_ACT:TOTAL:T:SA');
  const refFor = (dimensions: readonly { key: string; value: string }[]) => ({
    providerId: 'EUROSTAT',
    datasetCode: series.datasetCode,
    dimensions,
  });

  it('THE PIN HAS INVERTED · the publisher list passes VERBATIM, `time` and all', () => {
    /*
      R2 wrote this to invert. It has. The producer no longer subtracts anything: it hands
      `assertDimensionsArePinned` the publisher's own declared list, and the contract
      removes the observation axis itself — in one place, so an adapter cannot filter one
      key too many.
    */
    expect(series.declaredDimensionKeys).toContain('time');
    expect(() =>
      assertDimensionsArePinned(refFor(series.dimensions), series.declaredDimensionKeys),
    ).not.toThrow();

    expect(ECONOMY_OBSERVATION_AXIS_KEYS).toEqual(['time']);
    expect(economySeriesDefiningKeys(series.declaredDimensionKeys)).toEqual(
      series.declaredDimensionKeys.filter((k) => k !== 'time'),
    );
  });

  it('THE HALF G COULD NOT WRITE BEFORE · a ref that PINS the axis is refused', () => {
    /*
      Permitting omission would not have been enough. The rule is a refusal, so the next
      adapter cannot do what this one correctly declined to do — and `lastTimePeriod=1`
      falls to the same clause, having never been a dimension at all.
    */
    expect(() =>
      assertDimensionsArePinned(
        refFor([...series.dimensions, { key: 'time', value: '2026-07' }]),
        series.declaredDimensionKeys,
      ),
    ).toThrow(/ECONOMY_LINEAGE_AXIS_PINNED_AS_DIMENSION/);

    // and the producer never sends either as a dimension
    for (const s of ALPHA_SERIES) {
      expect([s.seriesId, s.dimensions.some((d) => d.key === 'time')]).toEqual([s.seriesId, false]);
      expect([s.seriesId, s.dimensions.some((d) => d.key === 'lastTimePeriod')]).toEqual([
        s.seriesId,
        false,
      ]);
    }
  });

  it('AN UNRULED TEMPORAL AXIS FAILS LOUDLY · SDMX TIME_PERIOD is not silently accepted', () => {
    /*
      `TIME_PERIOD` is plausible and UNMEASURED, and a plausible-but-unmeasured entry is
      exactly how the refusal vocabulary was got wrong once already. An ECB adapter must
      fail on its first run and be ruled on, not decide locally.
    */
    expect(ECONOMY_OBSERVATION_AXIS_KEYS).not.toContain('TIME_PERIOD');
    expect(ECONOMY_OBSERVATION_AXIS_KEYS).not.toContain('time_period');

    // declared but unpinned -> refused, because it is not a known axis
    expect(() =>
      assertDimensionsArePinned(refFor(series.dimensions), [
        ...series.declaredDimensionKeys,
        'TIME_PERIOD',
      ]),
    ).toThrow(/ECONOMY_LINEAGE_DIMENSION_NOT_PINNED/);

    // and pinning it is not a way out either: it is simply an ordinary dimension today
    expect(economySeriesDefiningKeys(['freq', 'geo', 'TIME_PERIOD'])).toContain('TIME_PERIOD');
  });
});

/* ── 8 · ROUTE ELIGIBILITY ────────────────────────────────────────────────── */

describe('EA-8 · what this producer contributes to route eligibility', () => {
  /** Today's measured deployment, stated as the contract's evidence shape. */
  const TODAY: EconomyRouteEvidence = {
    publishableObservationCount: 0, // no admitted bytes exist for any eligible series
    publishedFiguresWithoutLineage: 0,
    figuresWithOverstatedVintage: 0,
    registeredSourceIds: [], // OFFICIAL_SOURCES is empty — P-2
    activatedSourceIds: [],
    gapPathPreserved: true, // every cell renders a stated gap with a reason
    executesOnLoad: false, // the producer has no route and no page-load path
    copyLanguages: ['en', 'pl'],
  };

  it('NOT ELIGIBLE today, and the blockers are exactly the three Main named', () => {
    expect(economyRouteIsEligible(TODAY)).toBe(false);
    expect([...economyRouteBlockers(TODAY)].sort()).toEqual([
      'E1_PUBLISHABLE_OBSERVATION',
      'E4A_SOURCE_REGISTERED',
      'E4B_SOURCE_ACTIVATED_WITH_RIGHTS',
    ]);
  });

  it('REGISTRATION ALONE DOES NOT COUNT — P-2 leaves exactly one blocker, and it is the data one', () => {
    const registeredOnly: EconomyRouteEvidence = { ...TODAY, registeredSourceIds: ['eurostat'] };
    expect([...economyRouteBlockers(registeredOnly)].sort()).toEqual([
      'E1_PUBLISHABLE_OBSERVATION',
      'E4B_SOURCE_ACTIVATED_WITH_RIGHTS',
    ]);

    const activated: EconomyRouteEvidence = {
      ...registeredOnly,
      activatedSourceIds: ['eurostat'],
    };
    expect(economyRouteBlockers(activated)).toEqual(['E1_PUBLISHABLE_OBSERVATION']);
  });

  it('an activated id that is not registered is not a stronger state', () => {
    const unregisteredActivation: EconomyRouteEvidence = {
      ...TODAY,
      activatedSourceIds: ['eurostat'],
    };
    expect(economyRouteBlockers(unregisteredActivation)).toContain(
      'E4B_SOURCE_ACTIVATED_WITH_RIGHTS',
    );
  });

  it('this producer already satisfies the conditions that are its own', () => {
    // E-5 · the gap path, and E-6 · no execution on load, are both this lane's to hold
    const strip = emptyIndicatorStrip();
    expect(strip.every((c) => c.available === false && c.gapReason !== undefined)).toBe(true);
    expect(strip.every((c) => c.value === undefined)).toBe(true);

    const exec = withoutComments(producerSource());
    for (const forbidden of ['@Controller', '@Get', 'useEffect', 'openai', 'gnews']) {
      expect([forbidden, exec.toLowerCase().includes(forbidden.toLowerCase())]).toEqual([
        forbidden,
        false,
      ]);
    }
    expect(ECONOMY_ROUTE_CONDITIONS).toHaveLength(8);
  });
});

/* ── 9 · ECON-CL-2 · CLOSED ON R3 · AN UNDECLARED PIN IS REFUSED ──────────── */

describe('EA-9 · ECON-CL-2 · a pin the publisher never declared is refused', () => {
  const series = alphaSeries('eurostat:une_rt_m:PL:PC_ACT:TOTAL:T:SA');
  const refFor = (dimensions: readonly { key: string; value: string }[]) => ({
    providerId: 'EUROSTAT',
    datasetCode: series.datasetCode,
    dimensions,
  });

  it('RULED · an undeclared pin is REFUSED — ECON-CL-2 closed on R3', () => {
    /*
      ── THE FINDING, AND ITS CLOSURE ────────────────────────────────────────

      G measured that `lastTimePeriod=1` was NOT refused on the R2 promoted bytes:
      `assertDimensionsArePinned` refused four things — pinning an axis key, omitting a
      declared key, an empty key or value, and a duplicate — and an UNDECLARED key was
      none of them. The consequence was the identity split ECON-CL-1 was about, arriving
      by the other door: two refs for the SAME series, one carrying a stray pin, produced
      two different `economyUpstreamSeriesKey` values. Nothing threw; one series quietly
      became two.

      G did not work around it — adding a local "reject undeclared pins" rule in the
      adapter would have been the adapter deciding for itself again, which is exactly what
      ECON-CL-1 ruled out — and instead wrote this test to measure the defect, with:

          "ROUTED TO: Main. This test measures today's behaviour and INVERTS when it is
           ruled."

      ── CLAUDE CODE · IT HAS BEEN RULED, SO IT IS INVERTED ──────────────────
      MAIN-ECONOMY-CL2-SERIES-IDENTITY-R1 promotes lineage R3, making the pin set a SET
      EQUALITY rather than a lower bound:

          keys(ref.dimensions) == declaredKeys − ECONOMY_OBSERVATION_AXIS_KEYS

      This is the assertion Main supplied for exactly this site — "the one test G could
      not write before". The inversion is the designed outcome, not a repair: the same
      input that silently minted a second key now refuses by name.

      The refusal is LOUD and never a silent drop. Discarding the extra pin would make the
      key correct and the adapter still wrong, with nothing saying so.
    */
    const clean = refFor(series.dimensions);
    const stray = refFor([...series.dimensions, { key: 'lastTimePeriod', value: '1' }]);

    expect(() => assertDimensionsArePinned(clean, series.declaredDimensionKeys)).not.toThrow();
    expect(() => assertDimensionsArePinned(stray, series.declaredDimensionKeys)).toThrow(
      /ECONOMY_LINEAGE_DIMENSION_NOT_DECLARED/,
    );

    /*
      The identity split itself is unchanged and still measurable — `economyUpstreamSeriesKey`
      is TOTAL by design and keys whatever it is handed, so it is not the gate and never
      was. That is precisely why the gate had to become an equality: a ref carrying one
      extra pin keys perfectly happily, stably, and to a different series than it names.
    */
    expect(economyUpstreamSeriesKey(stray)).not.toBe(economyUpstreamSeriesKey(clean));
    expect(series.declaredDimensionKeys).not.toContain('lastTimePeriod');
  });

  it('THE PRODUCER PINS ONLY WHAT THE PUBLISHER DECLARES — every row, measured', () => {
    for (const s of ALPHA_SERIES) {
      const undeclared = s.dimensions
        .map((d) => d.key)
        .filter((k) => !s.declaredDimensionKeys.includes(k));
      expect([s.seriesId, undeclared]).toEqual([s.seriesId, []]);
    }
  });

  it('and `lastTimePeriod` travels as a REQUEST PARAMETER, where it belongs', () => {
    /*
      It selects which period comes back; it does not say which series this is. It appears
      in the query and in `requestUrl`, and `requestUrl` is already ruled a non-identity
      input by the contract.
    */
    const exec = withoutComments(producerSource());
    expect(exec).toContain("query['lastTimePeriod'] = '1'");
    expect(exec).not.toMatch(/key:\s*'lastTimePeriod'/);
  });
});
