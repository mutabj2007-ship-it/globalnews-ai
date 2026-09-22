import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client, Pool } from 'pg';
import {
  admitRetainedEvidence,
  assertAdmittedRetainedEvidence,
  NO_RETAINED_CAPTURE_APPROVAL,
  RetainedEvidenceRefused,
  sha256,
  timestamp,
  MAX_RETAINED_ARTIFACT_BYTES,
  type AdmittedRetainedEvidence,
  type ReviewedCapture,
  type SourceFact,
} from './retained-evidence';
import { HumanitarianRetainedRepository } from './retained-evidence.repository';
import {
  __resetHumanitarianAuthorityForTests,
  loadHumanitarianAuthority,
} from '../humanitarian-authority.loader';

const fields: SourceFact[] = [
  'eventId',
  'observationId',
  'productId',
  'featureId',
  'sourceRevisionId',
  'predecessorRevisionId',
  'geometryRevisionId',
  'publisherReleasedAt',
  'publisherRevisedAt',
  'countryIso2',
  'geometryType',
  'crs',
  'coordinates',
];
const resolver = { resolve: () => ({ presentationPartitionKey: 'synthetic-public-partition' }) };
let sequence = 0;
function source(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    eventId: 'EMSR999',
    observationId: 'synthetic-extent-' + ++sequence,
    productId: 'PRODUCT',
    featureId: 'FEATURE',
    sourceRevisionId: 'v1',
    predecessorRevisionId: null,
    geometryRevisionId: 'g1',
    publisherReleasedAt: '2026-01-01T01:00:00Z',
    publisherRevisedAt: '2026-01-01T02:00:00Z',
    countryIso2: 'PL',
    geometryType: 'Polygon',
    crs: 'EPSG:4326',
    coordinates: [
      [
        [11, 48],
        [12, 48],
        [12, 49],
        [11, 48],
      ],
    ],
    ...over,
  };
}
function review(bytes: Uint8Array, over: Partial<ReviewedCapture> = {}): ReviewedCapture {
  return {
    approvalId: 'SYNTHETIC-TEST-ONLY',
    artifactSha256: sha256(bytes),
    sourceId: 'COPERNICUS_EMS',
    sourceUrl: 'https://example.invalid/synthetic-capture',
    capturedAt: '2026-01-02T00:00:00Z',
    citation: 'Synthetic test attribution; not publisher evidence',
    facts: {
      eventId: ['eventId'],
      observationId: ['observationId'],
      productId: ['productId'],
      featureId: ['featureId'],
      sourceRevisionId: ['sourceRevisionId'],
      predecessorRevisionId: ['predecessorRevisionId'],
      geometryRevisionId: ['geometryRevisionId'],
      publisherReleasedAt: ['publisherReleasedAt'],
      publisherRevisedAt: ['publisherRevisedAt'],
      countryIso2: ['countryIso2'],
      geometryType: ['geometryType'],
      crs: ['crs'],
      coordinates: ['coordinates'],
    },
    ...over,
  };
}
async function admit(
  body: Record<string, unknown>,
  reviewOver: Partial<ReviewedCapture> = {},
  recordedAt = '2026-01-03T00:00:00Z',
) {
  const bytes = Buffer.from(JSON.stringify(body));
  return admitRetainedEvidence(
    bytes,
    { review: () => review(bytes, reviewOver) },
    resolver,
    recordedAt,
  );
}
async function install() {
  __resetHumanitarianAuthorityForTests();
  await loadHumanitarianAuthority(
    {
      readGovernedRows: async () => ({
        classes: [
          {
            classId: 'SYNTHETIC-P',
            declaredAt: '2025-01-01T00:00:00Z',
            basis: 'Synthetic test class',
            partitionUnitLevel: 'DISTRICT',
          },
        ],
        partitions: [
          {
            partitionKey: 'SYNTHETIC-DARK',
            unitLevel: 'DISTRICT',
            declaredAt: '2025-01-01T00:00:00Z',
            minimumMembership: 2,
            declaredEligibleMembership: 20,
            coversClassIds: ['SYNTHETIC-P'],
          },
        ],
      }),
    },
    { epoch: 1, loadedAt: '2025-01-02T00:00:00Z' },
  );
}

describe('offline retained evidence admission', () => {
  beforeEach(install);
  it('requires installed authority and independent hash-bound review', async () => {
    const bytes = Buffer.from(JSON.stringify(source()));
    await expect(
      admitRetainedEvidence(bytes, NO_RETAINED_CAPTURE_APPROVAL, resolver, '2026-01-03T00:00:00Z'),
    ).rejects.toThrow(/approval/);
    await expect(
      admitRetainedEvidence(
        bytes,
        { review: () => review(bytes, { artifactSha256: '0'.repeat(64) }) },
        resolver,
        '2026-01-03T00:00:00Z',
      ),
    ).rejects.toThrow(/approval/);
    __resetHumanitarianAuthorityForTests();
    await expect(admit(source())).rejects.toThrow(/NOT_INSTALLED/);
  });
  it('does not trust flags or inferred needs in the raw body', async () => {
    const value = await admit(
      source({
        admitted: true,
        severity: 5,
        casualties: 1000,
        population: 20000,
        status: 'active',
      }),
    );
    expect(value.observation.observationKind).toBe('SOURCE_INUNDATION_EXTENT');
    expect(value.observation.temporal.occurredAt).toBeUndefined();
    expect(JSON.stringify(value.observation)).not.toMatch(/casualties|population|severity|active/);
    expect(value.observation.provenance.jurisdiction).toBeUndefined();
    expect(value.observation.claim.geometry.origin).toBe('SOURCE_NATIVE');
    expect(value.observation.sourceReference.citation).toContain('Synthetic test');
    expect(value.artifactSha256).toBe(sha256(Buffer.from(value.rawBase64, 'base64')));
  });
  it.each(fields)('requires artifact proof of %s', async (field) => {
    const body = source();
    delete body[field];
    await expect(admit(body)).rejects.toThrow();
  });
  it.each(['2026-02-30T01:00:00Z', '2026-01-01', 'yesterday', '2026-01-01T25:00:00Z'])(
    'rejects malformed or date-only time %s',
    (time) => {
      expect(() => timestamp(time)).toThrow();
    },
  );
  it.each([
    { countryIso2: 'ZZ' },
    { countryIso2: 'pl' },
    { countryIso2: 'Poland' },
    { coordinates: [] },
    {
      coordinates: [
        [
          [1, 1],
          [2, 1],
          [2, 2],
        ],
      ],
    },
    { geometryType: 'Point' },
    { crs: 'EPSG:3035' },
    { predecessorRevisionId: 'v1' },
    { publisherRevisedAt: '2025-12-01T00:00:00Z' },
    { publisherRevisedAt: '2026-02-01T00:00:00Z' },
  ])('fails closed on geography, geometry or chronology %j', async (over) => {
    await expect(admit(source(over))).rejects.toThrow();
  });
  it('preserves explicit occurrence separately from release, revision, capture and observation', async () => {
    const value = await admit(source({ occurredAt: '2026-01-01T00:00:00Z' }), {
      occurredAt: ['occurredAt'],
    });
    expect(value.observation.temporal).toEqual({
      occurredAt: '2026-01-01T00:00:00Z',
      publisherVintage: '2026-01-01T02:00:00Z',
      retrievedAt: '2026-01-02T00:00:00Z',
      temporalBasis: 'PUBLISHER_VINTAGE',
    });
    expect(value.publisherReleasedAt).toBe('2026-01-01T01:00:00Z');
    expect(value.observation.revision.recordedAt).toBe('2026-01-03T00:00:00Z');
    await expect(
      admit(source({ occurredAt: '2026-01-01T03:00:00Z' }), { occurredAt: ['occurredAt'] }),
    ).rejects.toThrow(/chronology/);
    await expect(admit(source(), {}, '2026-01-01T00:00:00Z')).rejects.toThrow(/Capture follows/);
  });
  it('refuses malformed UTF8, duplicate keys, oversized and self-authorizing artifacts', async () => {
    for (const bytes of [
      Buffer.from([0xff]),
      Buffer.from('{"eventId":"A","eventId":"B"}'),
      Buffer.alloc(MAX_RETAINED_ARTIFACT_BYTES + 1),
      Buffer.from('{"approved":true}'),
    ]) {
      await expect(
        admitRetainedEvidence(
          bytes,
          { review: () => review(bytes) },
          resolver,
          '2026-01-03T00:00:00Z',
        ),
      ).rejects.toThrow();
    }
  });
  it('refuses unresolved, undeclared and disagreeing authority keying', async () => {
    const bytes = Buffer.from(JSON.stringify(source()));
    for (const resolve of [
      () => null,
      () => ({ presentationPartitionKey: 'x', protectionClassId: 'undeclared' }),
    ]) {
      await expect(
        admitRetainedEvidence(
          bytes,
          { review: () => review(bytes) },
          { resolve },
          '2026-01-03T00:00:00Z',
        ),
      ).rejects.toThrow();
    }
    let count = 0;
    await expect(
      admitRetainedEvidence(
        bytes,
        { review: () => review(bytes) },
        { resolve: () => ({ presentationPartitionKey: String(++count) }) },
        '2026-01-03T00:00:00Z',
      ),
    ).rejects.toThrow(/changed/);
  });
  it('snapshots reviewed provenance before asynchronous intake', async () => {
    const bytes = Buffer.from(JSON.stringify(source()));
    const approved = { ...review(bytes) };
    const value = await admitRetainedEvidence(
      bytes,
      { review: () => approved },
      {
        resolve: () => {
          approved.sourceUrl = 'http://mutated.invalid';
          return { presentationPartitionKey: 'synthetic-public-partition' };
        },
      },
      '2026-01-03T00:00:00Z',
    );
    expect(value.observation.provenance.sourceUrl).toBe(
      'https://example.invalid/synthetic-capture',
    );
  });
  it('preserves the governed geometry refusal code privately', async () => {
    await expect(
      admit(
        source({
          coordinates: [
            [
              [1, 1],
              [2, 1],
              [2, 2],
              [3, 3],
            ],
          ],
        }),
      ),
    ).rejects.toMatchObject({ geometryRefusalCodes: ['GEOMETRY_RING_NOT_CLOSED'] });
  });
  it('seals admissions against mutation, forgery and subsequent authority reset', async () => {
    const value = await admit(source());
    expect(Object.isFrozen(value.observation.claim.geometry.coordinates)).toBe(true);
    expect(() =>
      assertAdmittedRetainedEvidence(JSON.parse(JSON.stringify(value)) as AdmittedRetainedEvidence),
    ).toThrow(/Unadmitted/);
    expect(() => {
      (value.observation.claim as { countryIso2: string }).countryIso2 = 'RW';
    }).toThrow();
    __resetHumanitarianAuthorityForTests();
    expect(() => assertAdmittedRetainedEvidence(value)).toThrow();
  });
});

const DB = process.env.HUMANITARIAN_RETAINED_TEST_DATABASE_URL;
if (DB) {
  const url = new URL(DB);
  if (
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    !/^\/codex_hum_r2_[a-z0-9_]+$/.test(url.pathname)
  ) {
    throw new Error(
      'Retained proof requires an explicitly disposable local codex_hum_r2_* database',
    );
  }
}
const live = DB ? describe : describe.skip;
const roleSuffix = randomBytes(4).toString('hex');
const role = (name: string): string => name + '_' + roleSuffix;
const scopeRoles = (sql: string): string =>
  sql.replace(
    /hum_(authority_writer|projection_writer|reader_role|producer_role|retention_writer)\b/g,
    (name) => role(name),
  );
live('GX-14 retained evidence against disposable PostgreSQL', () => {
  let owner: Client;
  let pool: Pool;
  let repository: HumanitarianRetainedRepository;
  beforeAll(async () => {
    owner = new Client({ connectionString: DB });
    await owner.connect();
    const existing = await owner.query("SELECT to_regnamespace('hum_authority') AS schema");
    if (existing.rows[0].schema !== null) throw new Error('Test database is not empty');
    await owner.query(
      scopeRoles(readFileSync(join(__dirname, '../sql/gx14-authority-store.sql'), 'utf8')),
    );
    await owner.query(
      scopeRoles(readFileSync(join(__dirname, '../sql/retained-evidence-store.sql'), 'utf8')),
    );
    pool = new Pool({ connectionString: DB, options: '-c role=' + role('hum_retention_writer') });
    repository = new HumanitarianRetainedRepository(pool);
  });
  beforeEach(install);
  afterAll(async () => {
    await pool?.end();
    await owner?.end();
  });
  it('retains exact raw bytes and immutable provenance under the authority schema', async () => {
    const value = await admit(source());
    const result = await repository.append(value);
    expect(result.outcome).toBe('APPENDED');
    expect(result.revisionOrdinal).toBe(0);
    const raw = await owner.query(
      'SELECT * FROM hum_authority.retained_capture WHERE capture_key=$1',
      [value.captureKey],
    );
    expect(raw.rows[0].raw_bytes.toString('base64')).toBe(value.rawBase64);
    const row = await owner.query(
      'SELECT evidence FROM hum_authority.retained_observation_revision WHERE observation_key=$1',
      [result.observationKey],
    );
    expect(row.rows[0].evidence.observation.provenance).toEqual(value.observation.provenance);
    expect(row.rows[0].evidence.authorityDigest).toBe(value.authorityDigest);
  });
  it('deduplicates repeated/concurrent appends; recaptures do not rewrite first observation time', async () => {
    const body = source(),
      value = await admit(body);
    const results = await Promise.all([
      repository.append(value),
      repository.append(value),
      repository.append(value),
    ]);
    expect(results.filter((r) => r.outcome === 'APPENDED')).toHaveLength(1);
    const recaptured = await admit(
      body,
      { capturedAt: '2026-01-04T00:00:00Z' },
      '2026-01-05T00:00:00Z',
    );
    expect((await repository.append(recaptured)).outcome).toBe('DUPLICATE');
    const rows = await owner.query(
      'SELECT evidence FROM hum_authority.retained_observation_revision WHERE observation_key=$1',
      [value.observation.observationKey],
    );
    expect(rows.rowCount).toBe(1);
    expect(rows.rows[0].evidence.observation.temporal.retrievedAt).toBe('2026-01-02T00:00:00Z');
    expect(
      (
        await owner.query(
          'SELECT capture_key FROM hum_authority.retained_capture WHERE observation_key=$1',
          [value.observation.observationKey],
        )
      ).rowCount,
    ).toBe(2);
  });
  it('appends a source/geometry revision without silently replacing historical evidence', async () => {
    const body = source(),
      first = await admit(body);
    await repository.append(first);
    const second = await admit(
      {
        ...body,
        productId: 'PRODUCT-V2',
        sourceRevisionId: 'v2',
        predecessorRevisionId: 'v1',
        geometryRevisionId: 'g2',
        publisherRevisedAt: '2026-01-02T01:00:00Z',
        coordinates: [
          [
            [13, 48],
            [14, 48],
            [14, 49],
            [13, 48],
          ],
        ],
      },
      { capturedAt: '2026-01-03T00:00:00Z' },
      '2026-01-04T00:00:00Z',
    );
    expect(second.observation.observationKey).toBe(first.observation.observationKey);
    expect((await repository.append(second)).revisionOrdinal).toBe(1);
    const rows = await owner.query(
      'SELECT evidence FROM hum_authority.retained_observation_revision WHERE observation_key=$1 ORDER BY revision_ordinal',
      [first.observation.observationKey],
    );
    expect(rows.rowCount).toBe(2);
    expect(rows.rows[0].evidence.observation).toEqual(first.observation);
    expect(rows.rows[1].evidence.observation.revision).toEqual({
      revisionOrdinal: 1,
      supersedesRevisionOrdinal: 0,
      revisionKind: 'SOURCE_REVISION',
      recordedAt: '2026-01-04T00:00:00Z',
    });
  });
  it('refuses reused revision ids, forks, stale time, missing predecessors and unversioned geometry changes atomically', async () => {
    const body = source();
    const first = await admit(body);
    await repository.append(first);
    const changes = [
      { sourceRevisionId: 'v1', countryIso2: 'RW' },
      { sourceRevisionId: 'v2', predecessorRevisionId: 'missing' },
      { sourceRevisionId: 'v2', predecessorRevisionId: 'v1' },
      {
        sourceRevisionId: 'v2',
        predecessorRevisionId: 'v1',
        publisherRevisedAt: '2026-01-02T01:00:00Z',
        coordinates: [
          [
            [13, 48],
            [14, 48],
            [14, 49],
            [13, 48],
          ],
        ],
      },
    ];
    for (const change of changes) {
      const next = await admit(
        { ...body, ...change },
        { capturedAt: '2026-01-03T00:00:00Z' },
        '2026-01-04T00:00:00Z',
      );
      await expect(repository.append(next)).rejects.toBeInstanceOf(RetainedEvidenceRefused);
      expect(
        (
          await owner.query(
            'SELECT capture_key FROM hum_authority.retained_capture WHERE capture_key=$1',
            [next.captureKey],
          )
        ).rowCount,
      ).toBe(0);
    }
    const orphan = await admit(
      source({ predecessorRevisionId: 'missing', sourceRevisionId: 'v2' }),
    );
    await expect(repository.append(orphan)).rejects.toThrow(/predecessor/);
  });
  it('preserves metadata-only geometry revisions and permits only one concurrent successor', async () => {
    const body = source();
    const first = await admit(body);
    await repository.append(first);
    const a = await admit(
      {
        ...body,
        sourceRevisionId: 'v2',
        predecessorRevisionId: 'v1',
        publisherRevisedAt: '2026-01-02T01:00:00Z',
        productId: 'PRODUCT-V2',
      },
      { capturedAt: '2026-01-03T00:00:00Z' },
      '2026-01-04T00:00:00Z',
    );
    const b = await admit(
      {
        ...body,
        sourceRevisionId: 'fork',
        predecessorRevisionId: 'v1',
        publisherRevisedAt: '2026-01-02T02:00:00Z',
      },
      { capturedAt: '2026-01-03T00:00:00Z' },
      '2026-01-04T00:00:00Z',
    );
    expect(a.geometrySha256).toBe(first.geometrySha256);
    const results = await Promise.allSettled([repository.append(a), repository.append(b)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });
  it('denies raw evidence to reader, producer and projection roles; denies all ordinary mutations', async () => {
    const value = await admit(source());
    await repository.append(value);
    for (const baseRole of ['hum_reader_role', 'hum_producer_role', 'hum_projection_writer']) {
      const client = new Client({ connectionString: DB, options: '-c role=' + role(baseRole) });
      await client.connect();
      try {
        for (const table of ['retained_capture', 'retained_observation_revision']) {
          await expect(client.query('SELECT * FROM hum_authority.' + table)).rejects.toMatchObject({
            code: '42501',
          });
        }
      } finally {
        await client.end();
      }
    }
    for (const table of ['retained_capture', 'retained_observation_revision']) {
      await expect(pool.query('DELETE FROM hum_authority.' + table)).rejects.toMatchObject({
        code: '42501',
      });
      await expect(owner.query('DELETE FROM hum_authority.' + table)).rejects.toThrow(
        /append-only/,
      );
      await expect(owner.query('TRUNCATE hum_authority.' + table + ' CASCADE')).rejects.toThrow(
        /append-only/,
      );
    }
    await expect(
      owner.query('UPDATE hum_authority.retained_capture SET approval_id=approval_id'),
    ).rejects.toThrow(/append-only/);
  });
  it('rolls back a capture if the observation insert fails after it', async () => {
    const value = await admit(source());
    await owner.query(
      "CREATE FUNCTION hum_authority.synthetic_insert_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic insert failure'; END; $$",
    );
    await owner.query(
      'CREATE TRIGGER synthetic_insert_failure BEFORE INSERT ON hum_authority.retained_observation_revision FOR EACH ROW EXECUTE FUNCTION hum_authority.synthetic_insert_failure()',
    );
    try {
      await expect(repository.append(value)).rejects.toThrow(/synthetic insert failure/);
      expect(
        (
          await owner.query(
            'SELECT capture_key FROM hum_authority.retained_capture WHERE capture_key=$1',
            [value.captureKey],
          )
        ).rowCount,
      ).toBe(0);
    } finally {
      await owner.query(
        'DROP TRIGGER synthetic_insert_failure ON hum_authority.retained_observation_revision',
      );
      await owner.query('DROP FUNCTION hum_authority.synthetic_insert_failure()');
    }
  });
  it('refuses unadmitted objects before opening a database connection', async () => {
    const connect = jest.fn();
    const isolated = new HumanitarianRetainedRepository({ connect } as unknown as Pool);
    await expect(isolated.append({} as AdmittedRetainedEvidence)).rejects.toThrow(/Unadmitted/);
    expect(connect).not.toHaveBeenCalled();
  });
});
