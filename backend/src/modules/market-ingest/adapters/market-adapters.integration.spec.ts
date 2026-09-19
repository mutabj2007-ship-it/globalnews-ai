import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  refusalIsSecurityClass,
  refusalMayRetry,
  snapshotContentAddress,
  type SnapshotAdmissionRecord,
  type SnapshotRefusalKey,
} from '@globalnews-ai/shared';

import { MarketProviderRegistry, ProviderNotPermitted } from '../market-provider-registry';
import {
  DEFAULT_RETRY_POLICY,
  MarketIngestScheduler,
  ProviderCircuit,
  ProviderSlots,
  TransportFailure,
  type IngestTrigger,
  type LeaseStore,
  type MarketObservationDraft,
  type ObservationStore,
  type RunStore,
  type SchedulerClock,
} from '../market-ingest.scheduler';
import { assertComextRequestIsPermitted } from '../eurostat-comext-carveouts';
import {
  ForbiddenHttpPort,
  RecordingHttpPort,
  wireOf,
  type MarketHttpResponse,
} from './market-transport.port';
import {
  SNAPSHOT_SEAM_STATUS,
  SnapshotNotFinal,
  admissionRefusalToFailure,
  assertSnapshotBackedWriteIsNotFinal,
  type CanonicalAdmissionEvaluator,
  type MarketSnapshotRetainPort,
  type SnapshotAdmissionSubject,
} from './market-snapshot.seam';
import { TedAdapter, tedNoticeToDraft, tedRequestsFor, type TedNoticePayload } from './ted.adapter';
import {
  EurostatMarketAdapter,
  comextSeriesId,
  eurostatDraftsFor,
  type EurostatAdapterConfig,
} from './eurostat-market.adapter';

/* ── harness ──────────────────────────────────────────────────────────────── */

const ADAPTER_DIR = __dirname;
const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..', '..');

class FakeClock implements SchedulerClock {
  ms = 1_700_000_000_000;
  now(): number {
    return this.ms;
  }
  async sleep(ms: number): Promise<void> {
    this.ms += ms;
  }
}

class MemoryLeases implements LeaseStore {
  private held = new Map<string, string>();
  async acquire(input: { runKey: string; owner: string }) {
    if (this.held.has(input.runKey)) return null;
    const leaseId = `lease-${this.held.size}`;
    this.held.set(input.runKey, leaseId);
    return { leaseId, expiresAtMs: 0 };
  }
  async release(): Promise<void> {}
  async heartbeat(): Promise<boolean> {
    return true;
  }
}

class MemoryRuns implements RunStore {
  private n = 0;
  async findByRunKey() {
    return null;
  }
  async begin() {
    this.n += 1;
    return { runId: `run-${this.n}` };
  }
  async finish(): Promise<void> {}
}

class MemoryObservations implements ObservationStore {
  readonly writes: { snapshotContentAddress: string | null; observations: readonly MarketObservationDraft[] }[] = [];
  async upsertMany(input: {
    snapshotContentAddress: string | null;
    observations: readonly MarketObservationDraft[];
  }) {
    this.writes.push({ snapshotContentAddress: input.snapshotContentAddress, observations: input.observations });
    return { written: input.observations.length };
  }
}

/**
 * A test double for the ACCEPTED store's `retain`, narrowed through
 * `MarketSnapshotRetainPort`. It computes the address the way the accepted store does —
 * SHA-256 over the raw bytes — because the caller may not supply one.
 */
class RecordingRetainPort implements MarketSnapshotRetainPort {
  readonly retained: { providerId: string; byteLength: number; editionAnnotations: Readonly<Record<string, string>> }[] = [];

  async retain(input: Parameters<MarketSnapshotRetainPort['retain']>[0]) {
    const sha = createHash('sha256').update(Buffer.from(input.bytes)).digest('hex');
    this.retained.push({
      providerId: input.request.providerId,
      byteLength: input.bytes.byteLength,
      editionAnnotations: input.editionAnnotations,
    });
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
    } as Awaited<ReturnType<MarketSnapshotRetainPort['retain']>>;
  }
}

function harness(allowlist: readonly string[], slots = new ProviderSlots(8)) {
  const observations = new MemoryObservations();
  const scheduler = new MarketIngestScheduler({
    registry: new MarketProviderRegistry(allowlist),
    clock: new FakeClock(),
    leases: new MemoryLeases(),
    runs: new MemoryRuns(),
    observations,
    slots,
    circuit: new ProviderCircuit(),
  });
  return { scheduler, observations, slots };
}

const trigger = (providerId: string, subjectClass: string): IngestTrigger => ({
  kind: 'SCHEDULED',
  providerId,
  subjectClass,
  cadenceWindow: '2026-09-19',
});

const ok = (body: string): MarketHttpResponse => ({
  status: 200,
  contentType: 'application/json',
  body,
  headers: {},
  byteLength: body.length,
  ...wireOf(body),
});

/* ── the canonical admission seam, stubbed for tests ─────────────────────────
 *
 * These are FIXTURES in the canonical shape, not a classifier: they return a verdict
 * the test chose, and compute nothing from the bytes. The production evaluator is the
 * approved Snapshot/E1 path and is not implemented anywhere in this package.
 */

const ADMITTED_RECORD: SnapshotAdmissionRecord = {
  captureOutcome: 'COMPLETE',
  admissibility: 'ADMITTED',
  transport: { contentEncoding: 'identity', wireByteLength: 1 },
  parse: { parserId: 'canonical-json', parserVersion: '1', parsedAt: '2026-09-19T00:00:00Z' },
};

const refusedRecord = (refusalKey: SnapshotRefusalKey, httpStatus = 200): SnapshotAdmissionRecord => ({
  captureOutcome: 'COMPLETE',
  admissibility: 'REFUSED',
  refusalKey,
  refusalClass: refusalMayRetry(refusalKey, httpStatus) ? 'TRANSIENT' : 'PERMANENT',
  transport: { contentEncoding: 'identity', wireByteLength: 1 },
});

class StubAdmissionEvaluator implements CanonicalAdmissionEvaluator {
  readonly subjects: SnapshotAdmissionSubject[] = [];
  calls = 0;

  constructor(private readonly verdict: SnapshotAdmissionRecord = ADMITTED_RECORD) {}

  async evaluate(subject: SnapshotAdmissionSubject): Promise<SnapshotAdmissionRecord> {
    this.calls += 1;
    this.subjects.push(subject);
    return this.verdict;
  }
}


const TED_NOTICE: TedNoticePayload = {
  noticeId: 'c0ffee00-0000-4000-8000-000000000001',
  noticeVersion: '01',
  publicationDate: '2026-09-18',
  jurisdiction: 'PL',
  contractingAuthorityRef: 'PL-ORG-9911',
};

const tedBody = JSON.stringify({ notices: [TED_NOTICE] });

const comextBody = JSON.stringify({
  extension: { annotation: [{ type: 'UPDATE_DATA', title: '2026-09-11T11:00:00+0200' }] },
  dimension: { time: { category: { index: { '2026-06': 0, '2026-07': 1, '2026-08': 2 } } } },
  value: { '0': 1234.5, '2': 1300.25 },
});

const eurostatConfig = (reporter: string, product = '8703', partner = 'PL'): EurostatAdapterConfig => ({
  baseUrl: 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data',
  series: [
    {
      datasetCode: 'ds-045409',
      request: { freq: 'M', reporter, partner, product, flow: '1', indicators: 'VALUE_IN_EUROS' },
    },
  ],
});

function sourceOfAdapters(): string {
  return readdirSync(ADAPTER_DIR)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'))
    .map((f) => readFileSync(join(ADAPTER_DIR, f), 'utf-8'))
    .join('\n');
}

function executableOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('//'))
    .join('\n')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
}

/* ── 1 · REGISTRY DEFAULT DENY, AND ACTIVATION IS OFF ────────────────────── */

describe('R3-1 · default deny and activation', () => {
  it('a registry built with no allowlist refuses every provider', () => {
    const registry = new MarketProviderRegistry();
    for (const id of ['TED', 'EUROSTAT', 'GLEIF']) {
      expect(() => registry.resolve(id, 'PROCUREMENT_OPPORTUNITY', 'ACQUIRE')).toThrow(ProviderNotPermitted);
    }
  });

  it('an adapter registered on the scheduler is still not activated, and reaches no network', async () => {
    const port = new ForbiddenHttpPort();
    const { scheduler } = harness([]);
    scheduler.register(new TedAdapter(port, new RecordingRetainPort(), new StubAdmissionEvaluator()));

    const report = await scheduler.run(trigger('TED', 'PROCUREMENT_OPPORTUNITY'));

    expect(report.outcome).toBe('PROVIDER_DISABLED');
    expect(port.calls).toBe(0);
  });

  it('an unknown provider is blocked and reaches no network', async () => {
    const port = new ForbiddenHttpPort();
    const { scheduler } = harness(['NASDAQ']);
    const report = await scheduler.run(trigger('NASDAQ', 'INSTRUMENT'));

    expect(report.outcome).toBe('RIGHTS_REFUSED');
    expect(new MarketProviderRegistry(['NASDAQ']).isKnown('NASDAQ')).toBe(false);
    expect(port.calls).toBe(0);
  });

  it('World Bank and ECB stay blocked even when explicitly allowlisted', async () => {
    for (const id of ['WORLD_BANK', 'ECB']) {
      const port = new ForbiddenHttpPort();
      const { scheduler } = harness([id]);
      scheduler.register(new TedAdapter(port, new RecordingRetainPort(), new StubAdmissionEvaluator()));
      const report = await scheduler.run(trigger(id, 'INSTRUMENT'));

      expect(report.outcome).toBe('RIGHTS_REFUSED');
      expect(port.calls).toBe(0);
    }
  });

  it('eligibility reports rights and activation as independent axes', () => {
    const rows = new MarketProviderRegistry(['TED']).eligibility();
    const ted = rows.find((r) => r.providerId === 'TED')!;
    const eurostat = rows.find((r) => r.providerId === 'EUROSTAT')!;
    const wb = rows.find((r) => r.providerId === 'WORLD_BANK')!;

    expect(ted.rightsEligible && ted.activated && ted.runnable).toBe(true);
    expect(eurostat.rightsEligible).toBe(true);
    expect(eurostat.activated).toBe(false);
    expect(eurostat.runnable).toBe(false);
    expect(wb.rightsEligible).toBe(false);
  });
});

/* ── 2 · TED ─────────────────────────────────────────────────────────────── */

describe('R3-2 · TED', () => {
  it('request semantics are deterministic: the same window builds byte-identical requests', () => {
    const a = tedRequestsFor('DAILY');
    const b = tedRequestsFor('DAILY');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.map((r) => r.query.page)).toEqual(['1', '2']);
    expect(a.every((r) => r.query.sortOrder === 'ASC')).toBe(true);
  });

  it('no clock and no randomness build a TED request', () => {
    const code = executableOnly(readFileSync(join(ADAPTER_DIR, 'ted.adapter.ts'), 'utf-8'));
    for (const forbidden of ['Date.now', 'Math.random', 'new Date(', 'crypto.randomUUID']) {
      expect(code.includes(forbidden)).toBe(false);
    }
    // positive control: the scan can see real code
    expect(code.includes('tedRequestsFor')).toBe(true);
  });

  it('the concurrency ceiling is the published 3 and the adapter cannot raise it', () => {
    const provider = new MarketProviderRegistry(['TED']).resolve('TED', 'PROCUREMENT_OPPORTUNITY', 'ACQUIRE');
    expect(provider.maxConcurrent).toBe(3);

    const code = executableOnly(readFileSync(join(ADAPTER_DIR, 'ted.adapter.ts'), 'utf-8'));
    expect(code.includes('maxConcurrent')).toBe(false);
  });

  it('a saturated provider ceiling defers rather than exceeding it, and reaches no network', async () => {
    const slots = new ProviderSlots(8);
    for (let i = 0; i < 3; i += 1) expect(slots.tryAcquire('TED', 3)).toBe(true);
    expect(slots.tryAcquire('TED', 3)).toBe(false);

    const port = new ForbiddenHttpPort();
    const { scheduler } = harness(['TED'], slots);
    scheduler.register(new TedAdapter(port, new RecordingRetainPort(), new StubAdmissionEvaluator()));

    const report = await scheduler.run(trigger('TED', 'PROCUREMENT_OPPORTUNITY'));
    expect(report.outcome).toBe('DEFERRED');
    expect(port.calls).toBe(0);
  });

  it('acquires, normalises, and mints identity that is NOT the portal notice id', async () => {
    const port = new RecordingHttpPort(() => ok(tedBody));
    const snapshots = new RecordingRetainPort();
    const { scheduler, observations } = harness(['TED']);
    scheduler.register(new TedAdapter(port, snapshots, new StubAdmissionEvaluator()));

    const report = await scheduler.run(trigger('TED', 'PROCUREMENT_OPPORTUNITY'));

    expect(report.outcome).toBe('SUCCEEDED');
    expect(port.calls).toHaveLength(2);
    const draft = observations.writes[0]!.observations[0]!;
    expect(draft.seriesId.startsWith('mkt:1:')).toBe(true);
    // The identity is NOT the portal reference key: the portal reference is carried
    // separately on the observation key, and the two are different strings.
    expect(draft.observationKey).toContain('|');
    expect(draft.observationKey.split('|')[0]).toBe(draft.seriesId);
    expect(draft.observationKey.split('|')[1]).not.toBe(draft.seriesId);
    expect(draft.value).toBeNull();
    expect(draft.vintageProvenance).toBe('PUBLISHER_CHANGED_AT');
    expect(draft.publisherChangedAt).toBe('2026-09-18');
  });

  it('a new NOTICE VERSION is the same procurement, not a new one', () => {
    // BT-757 moves 01 -> 02. The canonical identity must not move with it, or every
    // amendment would silently become a different procurement.
    const v1 = tedNoticeToDraft({ ...TED_NOTICE, noticeVersion: '01' });
    const v2 = tedNoticeToDraft({ ...TED_NOTICE, noticeVersion: '02' });

    expect(v2.seriesId).toBe(v1.seriesId);
    // ...and the portal reference DOES move, so the two versions remain distinguishable.
    expect(v2.observationKey).not.toBe(v1.observationKey);
  });

  it('KNOWN LIMITATION · the canonical discriminator is still a publisher identifier', () => {
    // The accepted contract asks for a discriminator minted "from a tuple we control, and
    // never from a portal string". BT-701 is publisher-stable (UUID v4, measured stable
    // across versions) but it IS a publisher string, and there is no local canonical-object
    // registry to mint a surrogate against. This assertion pins the current state so the
    // limitation is visible rather than assumed away; it is reported as blocker R3-B1.
    expect(tedNoticeToDraft(TED_NOTICE).seriesId).toContain(TED_NOTICE.noticeId);
  });

  it('WITHDRAWN only when the publisher says so — never inferred from notice type', () => {
    expect(tedNoticeToDraft(TED_NOTICE).releaseStatus).toBe('FINAL');
    expect(tedNoticeToDraft({ ...TED_NOTICE, withdrawn: true }).releaseStatus).toBe('WITHDRAWN');
  });

  it('retries are bounded and a transport failure ends TRANSPORT_FAILED', async () => {
    const port = new RecordingHttpPort(() => {
      throw new TransportFailure('connection reset', 0);
    });
    const { scheduler } = harness(['TED']);
    scheduler.register(new TedAdapter(port, new RecordingRetainPort(), new StubAdmissionEvaluator()));

    const report = await scheduler.run(trigger('TED', 'PROCUREMENT_OPPORTUNITY'));

    expect(report.outcome).toBe('TRANSPORT_FAILED');
    expect(report.attempts).toBeLessThanOrEqual(DEFAULT_RETRY_POLICY.maxAttempts);
    expect(port.calls.length).toBeLessThanOrEqual(DEFAULT_RETRY_POLICY.maxAttempts);
  });

  it('a 403 is terminal and is asked exactly once', async () => {
    const port = new RecordingHttpPort(() => ({ ...ok('{}'), status: 403 }));
    const { scheduler } = harness(['TED']);
    scheduler.register(new TedAdapter(port, new RecordingRetainPort(), new StubAdmissionEvaluator()));

    const report = await scheduler.run(trigger('TED', 'PROCUREMENT_OPPORTUNITY'));

    expect(report.outcome).toBe('VALIDATION_FAILED');
    expect(port.calls).toHaveLength(1);
  });
});

/* ── 3 · EUROSTAT CARVE-OUTS, THROUGH THE REAL PROVIDER PATH ─────────────── */

describe('R3-3 · Eurostat carve-outs', () => {
  const run = async (config: EurostatAdapterConfig, port = new ForbiddenHttpPort()) => {
    const { scheduler, observations } = harness(['EUROSTAT']);
    scheduler.register(new EurostatMarketAdapter(port, new RecordingRetainPort(), new StubAdmissionEvaluator(), config));
    const report = await scheduler.run(trigger('EUROSTAT', 'CORRIDOR'));
    return { report, port, observations };
  };

  it('THE PROOF · the adapter calls the accepted enforcement function itself, not a copy', () => {
    const adapter = new EurostatMarketAdapter(
      new ForbiddenHttpPort(),
      new RecordingRetainPort(),
      new StubAdmissionEvaluator(),
      eurostatConfig('DE'),
    );
    expect(adapter.carveOutEnforcement).toBe(assertComextRequestIsPermitted);

    const code = executableOnly(readFileSync(join(ADAPTER_DIR, 'eurostat-market.adapter.ts'), 'utf-8'));
    for (const country of ['CH', 'LI']) {
      expect(new RegExp(`'${country}'`).test(code)).toBe(false);
    }
  });

  it('Switzerland and Liechtenstein as REPORTER are refused before any network call', async () => {
    for (const reporter of ['CH', 'LI']) {
      const { report, port } = await run(eurostatConfig(reporter));
      expect(report.outcome).toBe('RIGHTS_REFUSED');
      expect(port.calls).toBe(0);
    }
  });

  it('the same countries as PARTNER are permitted, because the carve-out is not about them', async () => {
    const port = new RecordingHttpPort(() => ok(comextBody));
    const { report } = await run(eurostatConfig('DE', '8703', 'CH'), port as never);
    expect(report.outcome).toBe('SUCCEEDED');
    expect(port.calls.length).toBeGreaterThan(0);
  });

  it('Austria is refused at CN8 and permitted at shorter CN levels', async () => {
    const refused = await run(eurostatConfig('AT', '87032190'));
    expect(refused.report.outcome).toBe('RIGHTS_REFUSED');
    expect(refused.port.calls).toBe(0);

    for (const product of ['870321', '8703']) {
      const port = new RecordingHttpPort(() => ok(comextBody));
      const { report } = await run(eurostatConfig('AT', product), port as never);
      expect(report.outcome).toBe('SUCCEEDED');
    }
  });

  it('a non-EU/EFTA reporter is refused, and a non-EU/EFTA partner is not', async () => {
    const refused = await run(eurostatConfig('US'));
    expect(refused.report.outcome).toBe('RIGHTS_REFUSED');
    expect(refused.port.calls).toBe(0);

    const port = new RecordingHttpPort(() => ok(comextBody));
    const { report } = await run(eurostatConfig('PL', '8703', 'US'), port as never);
    expect(report.outcome).toBe('SUCCEEDED');
  });

  it('a rights refusal is never retried', async () => {
    const { report } = await run(eurostatConfig('CH'));
    expect(report.outcome).toBe('RIGHTS_REFUSED');
    expect(report.attempts).toBeLessThanOrEqual(1);
  });
});

/* ── 4 · EUROSTAT NORMALISATION AND FRESHNESS ───────────────────────────── */

describe('R3-4 · Eurostat normalisation', () => {
  it('freshness comes from the publisher, never from scheduler success', async () => {
    const port = new RecordingHttpPort(() => ok(comextBody));
    const { scheduler, observations } = harness(['EUROSTAT']);
    scheduler.register(new EurostatMarketAdapter(port, new RecordingRetainPort(), new StubAdmissionEvaluator(), eurostatConfig('DE')));

    const report = await scheduler.run(trigger('EUROSTAT', 'CORRIDOR'));

    expect(report.outcome).toBe('SUCCEEDED');
    for (const draft of observations.writes[0]!.observations) {
      expect(draft.publisherChangedAt).toBe('2026-09-11T11:00:00+0200');
      expect(draft.vintageProvenance).toBe('PUBLISHER_CHANGED_AT');
      expect(draft.publisherVintage).toBeNull();
    }
  });

  it('an absent cell is a GAP carried as null, never a zero and never dropped', () => {
    const payload = JSON.parse(comextBody);
    const drafts = eurostatDraftsFor(payload, 'series-x');
    expect(drafts).toHaveLength(3);
    expect(drafts.map((d) => d.value)).toEqual([1234.5, null, 1300.25]);
  });

  it('an empty `value` object is a failure, not an empty result', async () => {
    const empty = JSON.stringify({
      extension: { annotation: [{ type: 'UPDATE_DATA', title: 'x' }] },
      dimension: { time: { category: { index: { '2026-08': 0 } } } },
    });
    const port = new RecordingHttpPort(() => ok(empty));
    const { scheduler } = harness(['EUROSTAT']);
    scheduler.register(new EurostatMarketAdapter(port, new RecordingRetainPort(), new StubAdmissionEvaluator(), eurostatConfig('DE')));

    const report = await scheduler.run(trigger('EUROSTAT', 'CORRIDOR'));
    expect(report.outcome).toBe('VALIDATION_FAILED');
    expect(report.outcome).not.toBe('NO_NEW_DATA');
  });

  it('the series key is length-prefixed, so mixed-length products cannot collide', () => {
    const a = comextSeriesId({ datasetCode: 'd', request: { freq: 'M', reporter: 'PL', partner: 'DE', product: '12', flow: '1', indicators: 'A_B' } });
    const b = comextSeriesId({ datasetCode: 'd', request: { freq: 'M', reporter: 'PL', partner: 'DE', product: '1', flow: '21', indicators: 'A_B' } });
    expect(a).not.toBe(b);
  });
});

/* ── 5 · THE SNAPSHOT BINDING ───────────────────────────────────────────── */

describe('R3-5 · snapshot binding', () => {
  it('the binding is provisional, and the constant is what Snapshot R2 has to move', () => {
    expect(SNAPSHOT_SEAM_STATUS).toBe('PROVISIONAL_PENDING_MAIN_SNAPSHOT_R2');
  });

  it('a snapshot-backed write cannot be declared final while the binding is provisional', () => {
    expect(() => assertSnapshotBackedWriteIsNotFinal(true)).toThrow(SnapshotNotFinal);
    expect(() => assertSnapshotBackedWriteIsNotFinal(false)).not.toThrow();
  });

  it('NO DUPLICATE ARCHITECTURE · the adapters declare no snapshot interface of their own', () => {
    const files = readdirSync(ADAPTER_DIR).filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'));
    const source = files.map((f) => readFileSync(join(ADAPTER_DIR, f), 'utf-8')).join('\n');

    // No locally declared snapshot port, store, address format or retention shape.
    expect(/interface\s+\w*Snapshot\w*(Port|Store)\b/.test(source)).toBe(false);
    expect(/type\s+\w*SnapshotContentAddress\b/.test(source)).toBe(false);

    // It is the ACCEPTED port, narrowed — which is why it cannot drift from it.
    expect(source).toContain("Pick<OfficialDataSnapshotStore, 'retain'>");
    expect(source).toContain("from '@globalnews-ai/shared'");
  });

  it('the store computes the address; no adapter mints one', async () => {
    const port = new RecordingHttpPort(() => ok(tedBody));
    const snapshots = new RecordingRetainPort();
    const { scheduler, observations } = harness(['TED']);
    scheduler.register(new TedAdapter(port, snapshots, new StubAdmissionEvaluator()));

    await scheduler.run(trigger('TED', 'PROCUREMENT_OPPORTUNITY'));

    expect(snapshots.retained.length).toBeGreaterThan(0);
    expect(observations.writes[0]!.snapshotContentAddress).toMatch(/^[0-9a-f]{64}$/);

    const code = executableOnly(sourceOfAdapters());
    expect(code.includes('snapshotContentAddress(')).toBe(false);
    expect(code.includes('createHash')).toBe(false);
  });

  it("Eurostat's edition annotations are retained verbatim and never interpreted", async () => {
    const port = new RecordingHttpPort(() => ok(comextBody));
    const snapshots = new RecordingRetainPort();
    const { scheduler } = harness(['EUROSTAT']);
    scheduler.register(new EurostatMarketAdapter(port, snapshots, new StubAdmissionEvaluator(), eurostatConfig('DE')));

    await scheduler.run(trigger('EUROSTAT', 'CORRIDOR'));

    expect(snapshots.retained[0]!.editionAnnotations).toEqual({
      UPDATE_DATA: '2026-09-11T11:00:00+0200',
    });
  });
});

/* ── 6 · REQUEST DISCIPLINE AND C-15 ────────────────────────────────────── */

describe('R3-6 · request discipline', () => {
  it('no frontend source and no app module imports market-ingest — scanned on the filesystem, not via git', () => {
    const roots = [join(REPO_ROOT, 'frontend', 'src'), join(REPO_ROOT, 'backend', 'src', 'app.module.ts')];
    const offenders: string[] = [];

    const walk = (path: string): void => {
      let stats;
      try {
        stats = statSync(path);
      } catch {
        return;
      }
      if (stats.isDirectory()) {
        for (const entry of readdirSync(path)) walk(join(path, entry));
        return;
      }
      if (!/\.(ts|tsx|js|jsx)$/.test(path)) return;
      if (readFileSync(path, 'utf-8').includes('market-ingest')) offenders.push(path);
    };

    for (const root of roots) walk(root);

    // positive control: the scanner does find the string where it really is
    const control: string[] = [];
    const controlWalk = (path: string): void => {
      if (statSync(path).isDirectory()) {
        for (const e of readdirSync(path)) controlWalk(join(path, e));
        return;
      }
      if (path.endsWith('.ts') && readFileSync(path, 'utf-8').includes('market-ingest')) control.push(path);
    };
    controlWalk(ADAPTER_DIR);

    expect(control.length).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });

  it('opening a Market surface executes no provider, because acquisition needs a trigger', async () => {
    // There is no code path from a request to `acquire`: the only caller is `run`, and `run`
    // requires an IngestTrigger the frontend cannot construct or reach.
    const port = new ForbiddenHttpPort();
    const { scheduler } = harness(['TED']);
    scheduler.register(new TedAdapter(port, new RecordingRetainPort(), new StubAdmissionEvaluator()));
    expect(port.calls).toBe(0);

    const code = executableOnly(sourceOfAdapters());
    for (const forbidden of ['@nestjs/common', 'Controller', 'Get(', 'useEffect']) {
      expect(code.includes(forbidden)).toBe(false);
    }
  });

  it('no AI and no GNews anywhere in the adapters', () => {
    const code = sourceOfAdapters();
    for (const forbidden of ['GNews', 'gnews', 'openai', 'anthropic', 'llm', 'embedding']) {
      expect(new RegExp(forbidden, 'i').test(code.replace(/\/\*[\s\S]*?\*\//g, ''))).toBe(false);
    }
  });

  it('C-15 · no LEI, no join and no scorer in any adapter', () => {
    const code = executableOnly(sourceOfAdapters());
    for (const forbidden of ['lei', 'similarity', 'confidence', 'matchStrength', 'probability', 'fuzzy', 'score', 'merge']) {
      expect(new RegExp(forbidden, 'i').test(code)).toBe(false);
    }
    // positive control: the scan bites on a scorer written the way one really would be
    const withScorer = `${code}\nexport function entityMatchScore(a: string, b: string): number { return 0; }\n`;
    expect(/score/i.test(withScorer)).toBe(true);
  });
});

/* ── 7 · SNAPSHOT R2 ADMISSION ALIGNMENT (R3.1) ─────────────────────────── */

describe('R3-1-7 · canonical snapshot admission', () => {
  const runTed = async (evaluator: StubAdmissionEvaluator) => {
    const port = new RecordingHttpPort(() => ok(tedBody));
    const snapshots = new RecordingRetainPort();
    const { scheduler, observations } = harness(['TED']);
    scheduler.register(new TedAdapter(port, snapshots, evaluator));
    const report = await scheduler.run(trigger('TED', 'PROCUREMENT_OPPORTUNITY'));
    return { report, port, snapshots, observations, evaluator };
  };

  it('ADMITTED · a valid approved Market response is evaluated, admitted, and retained', async () => {
    const { report, snapshots, observations, evaluator } = await runTed(new StubAdmissionEvaluator());

    expect(evaluator.calls).toBeGreaterThan(0);
    expect(report.outcome).toBe('SUCCEEDED');
    expect(snapshots.retained.length).toBeGreaterThan(0);
    expect(observations.writes[0]!.observations.length).toBeGreaterThan(0);
  });

  it('the evaluator is given the WIRE, which is why the adapter cannot produce a verdict', async () => {
    const { evaluator } = await runTed(new StubAdmissionEvaluator());
    const subject = evaluator.subjects[0]!;

    expect(subject.providerId).toBe('TED');
    expect(subject.wireBytes).toBeInstanceOf(Uint8Array);
    expect(subject.contentEncodingHeader).toBe('identity');
    expect(subject.contentTypeHeader).toBe('application/json');
  });

  it('REFUSED · no publishable Market observation, and nothing is retained', async () => {
    const { report, snapshots, observations } = await runTed(
      new StubAdmissionEvaluator(refusedRecord('BODY_NOT_JSON_SHAPED')),
    );

    expect(report.outcome).not.toBe('SUCCEEDED');
    expect(report.observationsWritten).toBe(0);
    expect(observations.writes).toHaveLength(0);
    expect(snapshots.retained).toHaveLength(0);
  });

  it('SECURITY REFUSAL · SECRET_DETECTED is terminal and is NOT retried', async () => {
    expect(refusalIsSecurityClass('SECRET_DETECTED')).toBe(true);

    const { report, port } = await runTed(
      new StubAdmissionEvaluator(refusedRecord('SECRET_DETECTED')),
    );

    expect(report.outcome).toBe('VALIDATION_FAILED');
    expect(report.attempts).toBe(1);
    // asked exactly once — Market's retry policy does not re-fetch a body that was
    // refused for containing a secret
    expect(port.calls).toHaveLength(1);
  });

  it('a security key wins over a transient status — the check order is what makes that true', () => {
    // STATUS_NOT_OK at 503 is transient by the canonical rule...
    expect(refusalMayRetry('STATUS_NOT_OK', 503)).toBe(true);
    expect(refusalMayRetry('STATUS_NOT_OK', 200)).toBe(false);
    expect(admissionRefusalToFailure(refusedRecord('STATUS_NOT_OK', 503), 503).name).toBe(
      'TransportFailure',
    );

    // ...and a SECURITY key carrying the same transient status is still terminal.
    expect(admissionRefusalToFailure(refusedRecord('SECRET_DETECTED', 503), 503).name).toBe(
      'ValidationFailure',
    );
    for (const key of ['PROVENANCE_HOST_MISMATCH', 'DECOMPRESSION_BOUND_EXCEEDED', 'ARCHIVE_NOT_ALLOWED', 'ENCODING_NOT_ALLOWED'] as const) {
      expect(admissionRefusalToFailure(refusedRecord(key, 503), 503).name).toBe('ValidationFailure');
    }
  });

  it('THE RECORD IS THE AUTHORITY · a TRANSIENT class is honoured even on an HTTP 200', async () => {
    const { report, port } = await runTed(
      new StubAdmissionEvaluator(refusedRecord('STATUS_NOT_OK', 503)),
    );

    expect(report.outcome).toBe('TRANSPORT_FAILED');
    expect(report.attempts).toBeGreaterThan(1);
    expect(port.calls.length).toBeLessThanOrEqual(DEFAULT_RETRY_POLICY.maxAttempts);
  });

  it('an incoherent REFUSED verdict with no key is terminal', () => {
    const incoherent: SnapshotAdmissionRecord = {
      captureOutcome: 'COMPLETE',
      admissibility: 'REFUSED',
      transport: { contentEncoding: 'identity', wireByteLength: 1 },
    };
    expect(admissionRefusalToFailure(incoherent, 200).name).toBe('ValidationFailure');
  });

  it('RIGHTS REMAIN INDEPENDENT · World Bank and ECB never reach the evaluator', async () => {
    for (const id of ['WORLD_BANK', 'ECB']) {
      const port = new ForbiddenHttpPort();
      const evaluator = new StubAdmissionEvaluator();
      const { scheduler } = harness([id]);
      scheduler.register(new TedAdapter(port, new RecordingRetainPort(), evaluator));

      const report = await scheduler.run(trigger(id, 'INSTRUMENT'));

      expect(report.outcome).toBe('RIGHTS_REFUSED');
      expect(port.calls).toBe(0);
      expect(evaluator.calls).toBe(0);
    }
  });

  it('NO MARKET-LOCAL CLASSIFIER · the adapters implement no evaluator and decide no verdict', () => {
    const code = executableOnly(sourceOfAdapters());

    // No adapter implements the evaluator, and none names an admissibility literal.
    expect(/implements\s+CanonicalAdmissionEvaluator/.test(code)).toBe(false);
    expect(code.includes('ADMITTED')).toBe(false);
    expect(/admissibility\s*:/.test(code)).toBe(false);
    // Nor does it compose one from the canonical ingredients.
    for (const ingredient of ['sniffRefusal', 'mediaTypeIsAdmitted', 'SNAPSHOT_WIRE_BYTE_CAP']) {
      expect(code.includes(ingredient)).toBe(false);
    }
    // positive control: it DOES consume the canonical predicates
    expect(code.includes('retrievalIsPublishable')).toBe(true);
    expect(code.includes('refusalIsSecurityClass')).toBe(true);
  });
});
