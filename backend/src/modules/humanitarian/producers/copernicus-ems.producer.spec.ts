import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  assertGeometryIsWellFormed,
  assertNotACoercion,
  capabilityOfSurface,
  classifyRefusal,
  GEOMETRY_DATA_DEFECT_CODES,
  GEOMETRY_PROGRAMMING_MISTAKE_CODES,
  GEOMETRY_RETIRED_REFUSAL_CODES,
  POLYGON_RING_REFUSAL_CODES,
  POLYGON_WINDING_VALIDATION,
  precisionAndGeometryAreIndependent,
  PROHIBITED_GEOMETRY_COERCIONS,
  refusalClassAlarms,
  refusalCodeOf,
  UNCLASSIFIED_REFUSAL_CODE,
  type GeometryCoordinateValue,
  type ProtectedClassDeclaration,
  type ProtectedPartitionDeclaration,
  type SourceAssertedGeometry,
} from '@globalnews-ai/shared';

import {
  AuthorityLoadFailure,
  __resetHumanitarianAuthorityForTests,
  computeGovernedDigest,
  loadHumanitarianAuthority,
  type GovernedAuthorityRows,
  type GovernedAuthorityStore,
} from '../humanitarian-authority.loader';
import {
  CODE_CRS_UNSUPPORTED,
  CODE_KIND_NOT_EMITTED_BY_DOMAIN,
  COPERNICUS_DENOTATION,
  COPERNICUS_EMITS,
  COPERNICUS_PRODUCER_ENABLED,
  COPERNICUS_RIGHTS,
  COPERNICUS_SOURCE_ID,
  HUMANITARIAN_PRODUCER_ACTIVATION,
  PRODUCER_SPECIFIC_WITHHELD_CODES,
  ProducerNotActivated,
  assertActivationPermitted,
  originOf,
  produceInundationExtents,
  type EmsDelineationFeature,
  type GovernedRecordKeying,
  type WithheldRecord,
} from './copernicus-ems.producer';

/* ── harness ──────────────────────────────────────────────────────────────── */

const PRODUCER_DIR = __dirname;
const ROOT_FILE = join(PRODUCER_DIR, '..', 'humanitarian-authority.loader.ts');

const RING = [
  [
    [11.0, 48.0],
    [11.5, 48.0],
    [11.5, 48.5],
    [11.0, 48.5],
    [11.0, 48.0],
  ],
];

/** A second part, so a MULTIPOLYGON has something to lose if a part is dropped. */
const SECOND_PART = [
  [
    [12.0, 49.0],
    [12.5, 49.0],
    [12.5, 49.5],
    [12.0, 49.5],
    [12.0, 49.0],
  ],
];

const MULTI = [RING, SECOND_PART];

/** A non-finite leaf — a genuine SOURCE defect, and the only one this producer can reach. */
const NAN_RING = [
  [
    [11.0, 48.0],
    [11.5, Number.NaN],
    [11.5, 48.5],
    [11.0, 48.0],
  ],
];

const feature = (over: Partial<EmsDelineationFeature> = {}): EmsDelineationFeature => ({
  activationCode: 'EMSR999',
  productId: 'DEL-01',
  featureId: 'F1',
  geometryType: 'Polygon',
  crs: 'EPSG:4326',
  coordinates: RING,
  ...over,
});

/** The authority system's keying, stubbed. The producer computes neither value. */
const keying = (partitionKey = 'PART-LIGHT', protectionClassId?: string): GovernedRecordKeying => ({
  keyFor: ({ sourceGeometryId }) => ({
    recordKey: `rec:${sourceGeometryId}`,
    presentationPartitionKey: partitionKey,
    ...(protectionClassId === undefined ? {} : { protectionClassId }),
  }),
});

const DECLINING: GovernedRecordKeying = { keyFor: () => null };

const CLASS_ROW: ProtectedClassDeclaration = {
  classId: 'CLASS-P',
  declaredAt: '2026-01-01T00:00:00Z',
  basis: 'synthetic declaration for a composition-root proof',
  partitionUnitLevel: 'DISTRICT',
};

const PARTITION_ROW: ProtectedPartitionDeclaration = {
  partitionKey: 'PART-DARK',
  unitLevel: 'DISTRICT',
  declaredAt: '2026-01-01T00:00:00Z',
  minimumMembership: 2,
  declaredEligibleMembership: 5,
  coversClassIds: ['CLASS-P'],
};

const ROWS: GovernedAuthorityRows = { classes: [CLASS_ROW], partitions: [PARTITION_ROW] };

class CountingStore implements GovernedAuthorityStore {
  reads = 0;
  constructor(private readonly rows: (n: number) => GovernedAuthorityRows) {}
  async readGovernedRows(): Promise<GovernedAuthorityRows> {
    this.reads += 1;
    return this.rows(this.reads);
  }
}

function producerSource(): string {
  return readdirSync(PRODUCER_DIR)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'))
    .map((f) => readFileSync(join(PRODUCER_DIR, f), 'utf-8'))
    .join('\n');
}

/**
 * Comments removed, STRINGS KEPT.
 *
 * `executableOnly` blanks string literals, which is right for scans that must not trip
 * over prose quoted in a message — but it makes any scan FOR a literal vacuous. A scan
 * looking for a refusal code is looking for a string, so it needs this instead, and each
 * such scan carries a positive control proving it can still see one.
 */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('*') && !l.trimStart().startsWith('//'))
    .join('\n');
}

function executableOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('*') && !l.trimStart().startsWith('//'))
    .join('\n')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
}

/**
 * The producer's own geometry envelope, rebuilt here so the accepted contract can be
 * called on a coordinate value of the TEST's choosing — including the pre-fix bare array.
 *
 * The cast is deliberate and belongs only here: the negative control below has to be able
 * to hand the contract exactly the shape the producer must never hand it. A cast in a
 * control that measures a refusal is the opposite of a cast in production code that
 * suppresses one.
 */
function sourceNativeShape(
  coordinates: unknown,
  kind: 'POLYGON' | 'MULTIPOLYGON' = 'POLYGON',
): SourceAssertedGeometry {
  return {
    kind,
    denotation: COPERNICUS_DENOTATION,
    origin: 'SOURCE_NATIVE',
    crs: 'EPSG:4326',
    coordinates: coordinates as GeometryCoordinateValue,
    sourceId: COPERNICUS_SOURCE_ID,
    sourceGeometryId: 'EMSR999/DEL-01/F1',
    relationToAssertion: 'THE_ASSERTION',
  };
}

/** Every withholding branch the producer has, driven once each. */
function everyWithholdingBranch(): readonly WithheldRecord[] {
  return [
    produceInundationExtents(
      { features: [feature({ geometryType: 'Point', coordinates: [11, 48] })] },
      keying(),
    ),
    produceInundationExtents({ features: [feature({ crs: 'EPSG:3035' })] }, keying()),
    produceInundationExtents({ features: [feature({ coordinates: NAN_RING })] }, keying()),
    produceInundationExtents({ features: [feature()] }, DECLINING),
  ].flatMap((r) => r.withheld);
}

beforeEach(() => {
  __resetHumanitarianAuthorityForTests();
});

/* ── 1 · SOURCE-NATIVE GEOMETRY IS PRESERVED, OR WITHHELD ─────────────────── */

describe('HP-1 · source-native geometry preservation', () => {
  it('a polygon is emitted as a POLYGON with byte-identical coordinates', () => {
    const { emitted, withheld } = produceInundationExtents({ features: [feature()] }, keying());

    expect(withheld).toEqual([]);
    expect(emitted).toHaveLength(1);

    const g = emitted[0]!.geometry;
    expect(g.kind).toBe('POLYGON');
    expect(g.origin).toBe('SOURCE_NATIVE');
    expect(g.crs).toBe('EPSG:4326');
    // GX-12 · the closed carrier, and the publisher's value inside it BY REFERENCE.
    expect(g.coordinates!.type).toBe('Polygon');
    expect(g.coordinates!.coordinates).toEqual(RING);
    // Identity, not merely equality: nothing rebuilt, rounded or reordered the array.
    expect(g.coordinates!.coordinates).toBe(RING);
    expect(Object.getOwnPropertyNames(g.coordinates!).sort()).toEqual(['coordinates', 'type']);
    expect(g.derivation).toBeUndefined();
  });

  it('a multipolygon stays a MULTIPOLYGON — never reduced to its largest part', () => {
    const { emitted } = produceInundationExtents(
      { features: [feature({ geometryType: 'MultiPolygon', coordinates: MULTI })] },
      keying(),
    );

    expect(emitted[0]!.geometry.kind).toBe('MULTIPOLYGON');
    expect(emitted[0]!.geometry.coordinates!.type).toBe('MultiPolygon');
    expect(emitted[0]!.geometry.coordinates!.coordinates).toBe(MULTI);
  });

  /* ── R1.1 · THE POSITIVE PROOFS ─────────────────────────────────────────
   *
   * Claude Code, executing this producer against the landed R3 contract, reported that
   * a valid polygon was WITHHELD for a shape mismatch rather than emitted. The three
   * tests below are the standing proof that it is not: two positives that carry the
   * geometry all the way through the accepted contract, and a negative control that
   * reproduces the broken shape and shows the contract still refuses it.
   */

  it('R1.1 POSITIVE · a valid source POLYGON reaches the R3 path and is ACCEPTED there', () => {
    const { emitted, withheld } = produceInundationExtents({ features: [feature()] }, keying());

    // Not withheld at all — the reported symptom, absent.
    expect(withheld).toEqual([]);
    expect(emitted).toHaveLength(1);

    const g = emitted[0]!.geometry;

    // The accepted contract's own checks, called independently of the producer.
    expect(() => assertGeometryIsWellFormed(g)).not.toThrow();
    expect(() => assertNotACoercion(g, g)).not.toThrow();

    // And what it accepted is the SOURCE's geometry: identical array, by reference.
    expect(g.kind).toBe('POLYGON');
    expect(g.origin).toBe('SOURCE_NATIVE');
    expect(g.denotation).toBe('AFFECTED_AREA');
    expect(g.coordinates!.type).toBe('Polygon');
    expect(g.coordinates!.coordinates).toBe(RING);
  });

  it('R1.1 POSITIVE · a valid source MULTIPOLYGON reaches the R3 path and is ACCEPTED there', () => {
    const { emitted, withheld } = produceInundationExtents(
      { features: [feature({ geometryType: 'MultiPolygon', coordinates: MULTI })] },
      keying(),
    );

    expect(withheld).toEqual([]);
    expect(emitted).toHaveLength(1);

    const g = emitted[0]!.geometry;
    expect(() => assertGeometryIsWellFormed(g)).not.toThrow();
    expect(() => assertNotACoercion(g, g)).not.toThrow();

    expect(g.kind).toBe('MULTIPOLYGON');
    expect(g.coordinates!.type).toBe('MultiPolygon');
    expect(g.coordinates!.coordinates).toBe(MULTI);
    // BOTH parts survive: nothing chose the largest, and nothing merged them.
    expect(MULTI).toHaveLength(2);
    expect(g.coordinates!.coordinates).toBe(MULTI);
  });

  it('R1.1 NEGATIVE CONTROL · the pre-fix shape — a bare ring array — is still refused', () => {
    /*
      The reported defect, reproduced: the publisher's coordinate value handed to the R3
      path directly instead of inside the governed closed carrier. If this ever stops
      throwing, the contract has been weakened and the positives above stop proving
      anything.
    */
    expect(() => assertGeometryIsWellFormed(sourceNativeShape(RING))).toThrow(
      /GEOMETRY_COORDINATES_NOT_AN_OBJECT/,
    );
    expect(() => assertGeometryIsWellFormed(sourceNativeShape(MULTI, 'MULTIPOLYGON'))).toThrow(
      /GEOMETRY_COORDINATES_NOT_AN_OBJECT/,
    );

    // The producer does not produce that shape.
    const { emitted } = produceInundationExtents({ features: [feature()] }, keying());
    expect(() => assertGeometryIsWellFormed(emitted[0]!.geometry)).not.toThrow();
  });

  it('R1.1 · the geometry-shape cast is gone, and no cast replaced it', () => {
    const exec = executableOnly(producerSource());
    const CAST = /\bas\s+(?!const\b)[A-Za-z_'{[]/g;

    expect(exec.match(CAST) ?? []).toEqual([]);
    // positive control: the scan bites on a cast written the way one really would be
    expect(`${exec}\nconst x = y as SomeType;`.match(CAST) ?? []).toHaveLength(1);
  });

  it('WITHHOLD RATHER THAN TRANSFORM · a non-polygonal feature emits nothing', () => {
    const { emitted, withheld } = produceInundationExtents(
      { features: [feature({ geometryType: 'Point', coordinates: [11, 48] })] },
      keying(),
    );

    expect(emitted).toEqual([]);
    expect(withheld).toEqual([
      {
        sourceGeometryId: 'EMSR999/DEL-01/F1',
        code: 'GEOMETRY_KIND_NOT_DECLARED_BY_DOMAIN',
        codeOrigin: 'GOVERNED',
      },
    ]);
    // R1.1 · the code is BORROWED from the governed vocabulary, not spelled locally.
    expect(CODE_KIND_NOT_EMITTED_BY_DOMAIN).toBe('GEOMETRY_KIND_NOT_DECLARED_BY_DOMAIN');
    expect(GEOMETRY_DATA_DEFECT_CODES).toContain(CODE_KIND_NOT_EMITTED_BY_DOMAIN);
    expect(COPERNICUS_EMITS).toEqual(['POLYGON', 'MULTIPOLYGON']);
  });

  it('a foreign CRS is withheld, never reprojected', () => {
    const { emitted, withheld } = produceInundationExtents(
      { features: [feature({ crs: 'EPSG:3035' })] },
      keying(),
    );

    expect(emitted).toEqual([]);
    expect(withheld[0]!.code).toBe('GEOMETRY_CRS_UNSUPPORTED');
    expect(withheld[0]!.codeOrigin).toBe('GOVERNED');
    // Deliberately NOT `..._CRS_NOT_SUPPORTED`, which is the near-miss E1 measured.
    expect(CODE_CRS_UNSUPPORTED).toBe('GEOMETRY_CRS_UNSUPPORTED');
    expect(GEOMETRY_RETIRED_REFUSAL_CODES).toHaveProperty('GEOMETRY_CRS_NOT_SUPPORTED');
  });

  it("a malformed coordinate is withheld under the contract's OWN code, not a local word", () => {
    /*
      A non-finite leaf. The contract's own check refuses it; no local rule is added, and
      — R1.1 — no local WORD is added either. R1 recorded `GEOMETRY_MALFORMED`, which
      collapsed four governed codes (non-finite leaf, disagreeing type, non-object
      carrier, missing coordinates) into one. The code recorded here is the one the
      accepted contract actually threw, proven by throwing it again alongside.
    */
    const { emitted, withheld } = produceInundationExtents(
      { features: [feature({ coordinates: NAN_RING })] },
      keying(),
    );

    expect(emitted).toEqual([]);
    expect(withheld[0]!.code).toBe('GEOMETRY_COORDINATE_LEAF_NOT_FINITE');
    expect(withheld[0]!.codeOrigin).toBe('GOVERNED');

    let thrown: unknown;
    try {
      assertGeometryIsWellFormed(sourceNativeShape({ type: 'Polygon', coordinates: NAN_RING }));
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect(refusalCodeOf(thrown)).toBe(withheld[0]!.code);
  });

  it('HP-B2 CLOSED BY GX-24 · the pin INVERTS · an unclosed ring is now withheld', () => {
    /*
      ── THE PIN INVERTING IS THE PIN WORKING ────────────────────────────────

      R1 recorded a gap rather than patching around it: `assertCoordinatesAreClosed`
      governed the closed OBJECT shape, not a closed RING, so an unclosed ring was
      admitted. The producer deliberately added no local rule, and the gap was pinned by
      a passing test — HP-B2.

      Main ruled on it in `MAIN-HUMANITARIAN-GEOMETRY-STRUCTURAL-VALIDITY-R1` (GX-24),
      and this assertion is the same test with its expectation reversed. The producer
      still has no ring rule of its own; it gained the behaviour by delegating.
    */
    const unclosed = [
      [
        [11, 48],
        [11.5, 48],
        [11.5, 48.5],
      ],
    ]; // first vertex never repeated
    const { emitted, withheld } = produceInundationExtents(
      { features: [feature({ coordinates: unclosed })] },
      keying(),
    );

    expect(emitted).toEqual([]);
    expect(withheld).toHaveLength(1);

    // NO REPAIR: the source fixture is exactly as it arrived — no closure point appended.
    expect(unclosed[0]).toHaveLength(3);
    expect(unclosed[0]![0]).not.toEqual(unclosed[0]![2]);
  });

  it('the emitted record survives the accepted coercion guard against itself', () => {
    const { emitted } = produceInundationExtents({ features: [feature()] }, keying());
    const g = emitted[0]!.geometry;
    expect(() => assertNotACoercion(g, g)).not.toThrow();
  });

  it('the forbidden coercions are absent BY CONSTRUCTION', () => {
    const code = executableOnly(producerSource());

    for (const word of [
      'centroid',
      'radius',
      'halo',
      'simplif',
      'reproject',
      'bufferBy',
      'pointOnSurface',
    ]) {
      expect(new RegExp(word, 'i').test(code)).toBe(false);
    }
    // There is no branch that emits a DERIVED origin at all.
    expect(code.includes("'DERIVED'")).toBe(false);
    // positive control: the scan can see real code
    expect(code.includes('produceInundationExtents')).toBe(true);

    // And the accepted list still names the coercions this producer must never perform.
    expect(PROHIBITED_GEOMETRY_COERCIONS).toContain('POLYGON_TO_CENTROID_FOR_RENDERING');
    expect(PROHIBITED_GEOMETRY_COERCIONS).toContain('POLYGON_TO_POINT_PLUS_RADIUS');
  });
});

/* ── 2 · PRECISION ≠ GEOMETRY ≠ DENOTATION ────────────────────────────────── */

describe('HP-2 · the three axes stay separate', () => {
  it('denotation says AFFECTED_AREA and never a point-shaped denotation', () => {
    const { emitted } = produceInundationExtents({ features: [feature()] }, keying());

    expect(COPERNICUS_DENOTATION).toBe('AFFECTED_AREA');
    expect(emitted[0]!.geometry.denotation).toBe('AFFECTED_AREA');
    expect(emitted[0]!.geometry.denotation).not.toBe('SOURCE_REPORTED_CENTROID');
    expect(emitted[0]!.geometry.denotation).not.toBe('DERIVED_REPRESENTATIVE_POINT');
  });

  it('the producer emits no precision at all — precision is not its axis', () => {
    expect(precisionAndGeometryAreIndependent()).toBe(true);
    const code = executableOnly(producerSource());
    expect(/precision/i.test(code)).toBe(false);
  });
});

/* ── 3 · PROTECTION AUTHORITY IS CONSUMED, NEVER DECIDED ──────────────────── */

describe('HP-3 · the producer supplies evidence and decides no protection', () => {
  it('both governed keys come from the authority port, not from the producer', () => {
    const a = produceInundationExtents({ features: [feature()] }, keying('PART-A', 'CLASS-P'));
    const b = produceInundationExtents({ features: [feature()] }, keying('PART-B'));

    expect(a.emitted[0]!.presentationPartitionKey).toBe('PART-A');
    expect(a.emitted[0]!.protectionClassId).toBe('CLASS-P');

    // Change the port, and the values change with it: nothing is computed locally.
    expect(b.emitted[0]!.presentationPartitionKey).toBe('PART-B');
    expect(b.emitted[0]!.protectionClassId).toBeUndefined();
  });

  it('an unkeyed record is WITHHELD, never defaulted to an unprotected key', () => {
    const { emitted, withheld } = produceInundationExtents({ features: [feature()] }, DECLINING);

    expect(emitted).toEqual([]);
    expect(withheld[0]!.code).toBe('RECORD_NOT_KEYED_BY_AUTHORITY');
    // R1.1 · declared producer-specific rather than dressed up as a governed code.
    expect(withheld[0]!.codeOrigin).toBe('PRODUCER_SPECIFIC');
  });

  it('NO PROTECTION-AUTHORITY WRITES · no governed column, no store, no SQL', () => {
    /*
      Comments are stripped first. The producer's header EXPLAINS why it does not write
      `protection_class_id` — naming the column it refuses to touch is the point of the
      explanation, and a scan that banned the word would ban the documentation of the ban.
    */
    const exec = executableOnly(producerSource());

    for (const forbidden of [
      'protection_class_id',
      'presentation_partition_key',
      'hum_authority',
      'geometry_record',
    ]) {
      expect(exec.includes(forbidden)).toBe(false);
    }
    for (const forbidden of ['prisma', 'PrismaClient', 'INSERT', 'repository']) {
      expect(new RegExp(forbidden, 'i').test(exec)).toBe(false);
    }
    // positive control: the scan bites on a write written the way one really would be
    expect(/prisma/i.test(`${exec}\nawait prisma.geometryRecord.update({});`)).toBe(true);
  });
});

/* ── 4 · NO FABRICATED DATA ───────────────────────────────────────────────── */

describe('HP-4 · only what the source publishes', () => {
  it('there is no field and no code for population, severity, access, impact or classification', () => {
    const exec = executableOnly(producerSource());
    for (const invented of [
      'population',
      'severity',
      'affectedCount',
      'impact',
      'casualt',
      'classification',
      'confidence',
    ]) {
      expect(new RegExp(invented, 'i').test(exec)).toBe(false);
    }
    // positive control: the fields it DOES read are present
    expect(exec.includes('activationCode')).toBe(true);
    expect(exec.includes('coordinates')).toBe(true);
  });
});

/* ── 5 · RIGHTS, PRESERVED AND NOT BROADENED ──────────────────────────────── */

describe('HP-5 · Copernicus rights state', () => {
  it('stays E-5 CONDITIONAL with its instrument and every recorded restriction', () => {
    expect(COPERNICUS_RIGHTS.rightsClass).toBe('E-5 CONDITIONAL');
    expect(COPERNICUS_RIGHTS.sourceId).toBe(COPERNICUS_SOURCE_ID);
    expect(COPERNICUS_RIGHTS.instrument).toMatch(/free, full and open access/);

    const conditions = COPERNICUS_RIGHTS.conditions.join(' ');
    expect(conditions).toMatch(/Commercial use is NOT expressly named/);
    expect(conditions).toMatch(/Citation Guidelines/);
    expect(conditions).toMatch(/Article 53/);
    expect(conditions).toMatch(/Third-party data/);
  });
});

/* ── 6 · ACTIVATION IS OFF ────────────────────────────────────────────────── */

describe('HP-6 · implemented and disabled', () => {
  it('the producer is disabled and activation is refused in code', () => {
    expect(COPERNICUS_PRODUCER_ENABLED).toBe(false);
    expect(HUMANITARIAN_PRODUCER_ACTIVATION).toBe('NOT_CLEARED');
    expect(() => assertActivationPermitted()).toThrow(ProducerNotActivated);
  });

  it('NO PROVIDER EXECUTION IS POSSIBLE · the module has no transport and no schedule', () => {
    const exec = executableOnly(producerSource());
    for (const forbidden of [
      'fetch(',
      'http',
      'axios',
      'Cron',
      'setInterval',
      'schedule',
      'request(',
    ]) {
      expect(exec.toLowerCase().includes(forbidden.toLowerCase())).toBe(false);
    }
    // And nothing reader-facing can reach it.
    for (const forbidden of ['Controller', '@Get', 'useEffect']) {
      expect(exec.includes(forbidden)).toBe(false);
    }
  });

  it('MAP ALPHA DID NOT MOVE · the surface capability is unchanged', () => {
    const alpha = capabilityOfSurface('MAP_ALPHA');
    expect(alpha.supports).toEqual(['NONE', 'POINT']);
    expect(alpha.mayPresentDerived).toBe(false);
    expect(alpha.readerFacing).toBe(true);
  });
});

/* ── 7 · GA-33 · THE REAL COMPOSITION ROOT ────────────────────────────────── */

describe('HP-7 · GA-33 recompute-at-load, through the real root', () => {
  it('the real load seals, installs, and recomputes the digest from the governed rows', async () => {
    const store = new CountingStore(() => ROWS);
    const { authority, report } = await loadHumanitarianAuthority(store, {
      epoch: 1,
      loadedAt: '2026-09-19T00:00:00Z',
    });

    expect(report.sourceDigest).toBe(computeGovernedDigest(ROWS));
    expect(report.recomputedDigest).toBe(report.sourceDigest);
    expect(report.digestsMatch).toBe(true);
    expect(report.isInstalledInstance).toBe(true);
    expect(report.classCount).toBe(1);
    expect(report.partitionCount).toBe(1);
    expect(authority.epoch).toBe(1);

    // THE RECOMPUTE IS REAL: the root read the governed rows a second time.
    // A fixture that returned a remembered digest would read once.
    expect(store.reads).toBe(2);
  });

  it('digest drift between sealing and checking is a FAILED START', async () => {
    const drifting = new CountingStore((n) =>
      n === 1
        ? ROWS
        : {
            classes: [{ ...CLASS_ROW, basis: 'edited after sealing' }],
            partitions: [PARTITION_ROW],
          },
    );

    await expect(
      loadHumanitarianAuthority(drifting, { epoch: 1, loadedAt: '2026-09-19T00:00:00Z' }),
    ).rejects.toThrow(AuthorityLoadFailure);
  });

  it('GA-44 preserved · an empty registry is a failed load, not a permissive one', async () => {
    const empty = new CountingStore(() => ({ classes: [], partitions: [] }));

    await expect(
      loadHumanitarianAuthority(empty, { epoch: 1, loadedAt: '2026-09-19T00:00:00Z' }),
    ).rejects.toThrow(/GEOMETRY_AUTHORITY_EMPTY/);
  });

  it('the digest is stable under row ORDER and changes with row CONTENT', () => {
    const second: ProtectedClassDeclaration = { ...CLASS_ROW, classId: 'CLASS-Q' };
    const a = computeGovernedDigest({ classes: [CLASS_ROW, second], partitions: [PARTITION_ROW] });
    const b = computeGovernedDigest({ classes: [second, CLASS_ROW], partitions: [PARTITION_ROW] });
    const c = computeGovernedDigest({
      classes: [CLASS_ROW, { ...second, basis: 'different' }],
      partitions: [PARTITION_ROW],
    });

    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('the composition root is the ONLY non-spec file importing the loader', () => {
    const root = readFileSync(ROOT_FILE, 'utf-8');
    expect(root).toContain('geometry-authority.loader');
    // and the producer does not
    expect(producerSource().includes('geometry-authority.loader')).toBe(false);
  });
});

/* ── 8 · THE WITHHOLDING VOCABULARY IS GOVERNED ───────────────────────────── */

describe('HP-8 · no producer-local duplicate vocabulary', () => {
  it('every code the producer can emit is governed, except the one declared local', () => {
    const all = everyWithholdingBranch();
    expect(all).toHaveLength(4);

    for (const w of all) {
      const governed =
        GEOMETRY_DATA_DEFECT_CODES.includes(w.code) ||
        GEOMETRY_PROGRAMMING_MISTAKE_CODES.includes(w.code);

      // BIDIRECTIONAL: the recorded origin and the actual membership agree both ways.
      expect(governed).toBe(w.codeOrigin === 'GOVERNED');
      expect(w.codeOrigin).toBe(originOf(w.code));
      if (!governed) {
        expect(PRODUCER_SPECIFIC_WITHHELD_CODES as readonly string[]).toContain(w.code);
      }
      // None of THESE four fell through the governed extractor. HP-10 measures the ones
      // that now do.
      expect(w.code).not.toBe(UNCLASSIFIED_REFUSAL_CODE);
    }

    expect(all.filter((w) => w.codeOrigin === 'PRODUCER_SPECIFIC')).toHaveLength(1);
    expect(all.filter((w) => w.codeOrigin === 'GOVERNED')).toHaveLength(3);
  });

  it('EXACTLY ONE producer-specific state is declared, and it has no governed equivalent', () => {
    expect(PRODUCER_SPECIFIC_WITHHELD_CODES).toEqual(['RECORD_NOT_KEYED_BY_AUTHORITY']);

    for (const code of PRODUCER_SPECIFIC_WITHHELD_CODES) {
      expect(GEOMETRY_DATA_DEFECT_CODES).not.toContain(code);
      expect(GEOMETRY_PROGRAMMING_MISTAKE_CODES).not.toContain(code);
    }
  });

  it("R1's invented codes are gone, and no near-miss of a governed code survives", () => {
    // Strings KEPT — a scan for a literal cannot run over blanked strings.
    const src = withoutComments(producerSource());

    const banned = [
      'GEOMETRY_KIND_NOT_POLYGONAL',
      'GEOMETRY_MALFORMED',
      ...Object.keys(GEOMETRY_RETIRED_REFUSAL_CODES),
    ];
    for (const code of banned) {
      // Word-anchored: GEOMETRY_KIND_NOT_DECLARED must not match inside
      // GEOMETRY_KIND_NOT_DECLARED_BY_DOMAIN, which is the real code.
      expect(new RegExp(`\\b${code}\\b`).test(src)).toBe(false);
    }

    // positive controls: the scan can see the codes that ARE there
    expect(src.includes('GEOMETRY_KIND_NOT_DECLARED_BY_DOMAIN')).toBe(true);
    expect(src.includes('GEOMETRY_CRS_UNSUPPORTED')).toBe(true);
    expect(src.includes('RECORD_NOT_KEYED_BY_AUTHORITY')).toBe(true);
    // and it would bite on a near-miss reintroduced
    expect(
      new RegExp('\\bGEOMETRY_CRS_NOT_SUPPORTED\\b').test(`${src} GEOMETRY_CRS_NOT_SUPPORTED`),
    ).toBe(true);
  });

  it('A GENUINE SOURCE DEFECT DOES NOT PAGE AN OPERATOR — which R1 would have', () => {
    /*
      This is the cost R1's local vocabulary carried, made measurable. `GEOMETRY_MALFORMED`
      is in neither governed list, so it classifies UNCLASSIFIED, and UNCLASSIFIED alarms
      at the same severity as a programming mistake. Every flooded-area file with one bad
      vertex would have woken somebody. A control that cries wolf is a control that has
      been removed, just more slowly.
    */
    const { withheld } = produceInundationExtents(
      { features: [feature({ coordinates: NAN_RING })] },
      keying(),
    );

    expect(classifyRefusal(withheld[0]!.code)).toBe('DATA_DEFECT');
    expect(refusalClassAlarms(classifyRefusal(withheld[0]!.code))).toBe(false);

    // and the retired local word would have done the opposite
    expect(classifyRefusal('GEOMETRY_MALFORMED')).toBe('UNCLASSIFIED');
    expect(refusalClassAlarms('UNCLASSIFIED')).toBe(true);
  });

  it('the producer-specific code is flagged, not smuggled through the governed channel', () => {
    const { withheld } = produceInundationExtents({ features: [feature()] }, DECLINING);

    expect(withheld[0]!.codeOrigin).toBe('PRODUCER_SPECIFIC');
    expect(classifyRefusal(withheld[0]!.code)).toBe('UNCLASSIFIED');
    /*
      UNCLASSIFIED is CORRECT here and must not be "fixed" by borrowing a governed code
      that nearly fits. The authority declining to key a record is a producer-side state
      with no governed equivalent, and `codeOrigin` is what tells a reader that the
      UNCLASSIFIED result is declared rather than accidental. Routed as HP-B3.
    */
  });
});

/* ── 9 · GX-24 / GX-25 · STRUCTURAL VALIDITY, THROUGH THE SHARED CONTRACT ─── */

describe('HP-9 · structural validity is delegated, never re-implemented', () => {
  /** Runs one feature and returns the whole result, so no-repair can be checked after. */
  const run = (over: Partial<EmsDelineationFeature>) =>
    produceInundationExtents({ features: [feature(over)] }, keying());

  const CLOSED_HOLE = [
    [11.1, 48.1],
    [11.2, 48.1],
    [11.2, 48.2],
    [11.1, 48.1],
  ];
  const OPEN_HOLE = [
    [11.1, 48.1],
    [11.2, 48.1],
    [11.2, 48.2],
    [11.15, 48.15],
  ];

  it('GX-24 POSITIVE · a closed ring with an interior ring reaches the R3 path', () => {
    const withHole = [RING[0]!, CLOSED_HOLE];
    const { emitted, withheld } = run({ coordinates: withHole });

    expect(withheld).toEqual([]);
    const g = emitted[0]!.geometry;
    expect(() => assertGeometryIsWellFormed(g)).not.toThrow();
    expect(g.coordinates!.coordinates).toBe(withHole);
    // BOTH rings survive, in source order. Nothing dropped the hole to make it valid.
    expect(withHole).toHaveLength(2);
    expect(withHole[1]).toBe(CLOSED_HOLE);
  });

  it('GX-24 POSITIVE · a position may carry a third component', () => {
    const elevated = [
      [
        [11, 48, 100],
        [11.5, 48, 100],
        [11.5, 48.5, 100],
        [11, 48, 100],
      ],
    ];
    const { emitted, withheld } = run({ coordinates: elevated });

    expect(withheld).toEqual([]);
    expect(emitted[0]!.geometry.coordinates!.coordinates).toBe(elevated);
  });

  it('GX-24 · every ring validates independently — an unclosed INTERIOR ring refuses the record', () => {
    const withOpenHole = [RING[0]!, OPEN_HOLE];
    const { emitted, withheld } = run({ coordinates: withOpenHole });

    expect(emitted).toEqual([]);
    expect(withheld).toHaveLength(1);

    // NN-2 · the record is refused WHOLE. The defective hole is still the same array,
    // still four positions, still open. Nothing was dropped to rescue the exterior ring.
    expect(withOpenHole).toHaveLength(2);
    expect(withOpenHole[1]).toBe(OPEN_HOLE);
    expect(OPEN_HOLE).toHaveLength(4);
    expect(OPEN_HOLE[0]).not.toEqual(OPEN_HOLE[3]);
  });

  it('GX-24 · the ring rules refuse, one fixture per rule, and repair none of them', () => {
    const cases: readonly { readonly label: string; readonly coordinates: unknown }[] = [
      {
        label: 'ring of three positions',
        coordinates: [
          [
            [11, 48],
            [11.5, 48],
            [11.5, 48.5],
          ],
        ],
      },
      {
        label: 'four positions that do not close',
        coordinates: [
          [
            [11, 48],
            [11.5, 48],
            [11.5, 48.5],
            [11, 48.5],
          ],
        ],
      },
      { label: 'position of one component', coordinates: [[[11], [11.5], [11.5], [11]]] },
      { label: 'polygon with no ring at all', coordinates: [] },
    ];

    for (const { label, coordinates } of cases) {
      const before = JSON.stringify(coordinates);
      const { emitted, withheld } = run({ coordinates });

      expect([label, emitted.length]).toEqual([label, 0]);
      expect([label, withheld.length]).toEqual([label, 1]);
      // NN-1 / NN-5 · nothing was appended, reordered or rebuilt on the way out.
      expect([label, JSON.stringify(coordinates)]).toEqual([label, before]);
    }
  });

  it('GX-25 · a declared kind that disagrees with the coordinate TREE is refused', () => {
    const cases: readonly {
      readonly label: string;
      readonly over: Partial<EmsDelineationFeature>;
    }[] = [
      { label: 'POLYGON carrying MultiPolygon-shaped coordinates', over: { coordinates: MULTI } },
      {
        label: 'MULTIPOLYGON carrying Polygon-shaped coordinates',
        over: { geometryType: 'MultiPolygon', coordinates: RING },
      },
      {
        label: 'MULTIPOLYGON over-nested by one level',
        over: { geometryType: 'MultiPolygon', coordinates: [MULTI] },
      },
      { label: 'scalar coordinates', over: { coordinates: 7 } },
    ];

    for (const { label, over } of cases) {
      const { emitted, withheld } = run(over);
      expect([label, emitted.length]).toEqual([label, 0]);
      expect([label, withheld.length]).toEqual([label, 1]);
    }

    // NN-4 · and the kind was never rewritten to match the coordinates it was given.
    expect(run({ coordinates: MULTI }).emitted).toEqual([]);
    expect(MULTI).toHaveLength(2);
  });

  it('WINDING IS TOLERATED · both orientations emit, neither is normalised', () => {
    /*
      `POLYGON_WINDING_VALIDATION` is a DECLARATION, not a control (GX-15). RFC 7946
      §3.1.6 instructs parsers not to reject on winding, and the only alternative to
      accepting is reversing the ring — a silent repair. Both orientations therefore
      emit, and both emit the SAME ARRAY they arrived in.
    */
    expect(POLYGON_WINDING_VALIDATION).toBe('OUTSIDE_ALPHA_VALIDATION');

    const cw = [
      [
        [11, 48],
        [11, 48.5],
        [11.5, 48.5],
        [11.5, 48],
        [11, 48],
      ],
    ];
    const ccw = [
      [
        [11, 48],
        [11.5, 48],
        [11.5, 48.5],
        [11, 48.5],
        [11, 48],
      ],
    ];

    for (const ring of [cw, ccw]) {
      const { emitted, withheld } = run({ coordinates: ring });
      expect(withheld).toEqual([]);
      expect(emitted[0]!.geometry.coordinates!.coordinates).toBe(ring);
      expect(ring[0]).toHaveLength(5);
    }
  });

  it('NO PRODUCER-LOCAL GEOMETRY VALIDATION · the rules live in the contract', () => {
    const exec = executableOnly(producerSource());

    /*
      WORD-ANCHORED, and the anchor is not decoration: unanchored /ring/i matches the
      word `string`, and the first run of this scan reported the producer as carrying
      ring logic because it declares `code: string`. A guard that fires on `string` is a
      guard nobody will believe the second time.
    */
    for (const word of [
      'ring',
      'closure',
      'closed',
      'winding',
      'orientation',
      'signedArea',
      'nesting',
      'depth',
      'splice',
      'reverse',
      'sort(',
      'concat',
      'slice',
    ]) {
      const anchored = new RegExp(`\\b${word.replace('(', '\\(')}`, 'i');
      expect([word, anchored.test(exec)]).toEqual([word, false]);
    }

    /*
      `push` is NOT banned outright, and pretending otherwise would have been the second
      false positive in this one scan. The producer pushes onto its OWN two result
      arrays, which is accumulation, not mutation of the publisher's coordinates. NN-5
      bans mutation primitives in the RULE; the honest form of that here is that every
      push in this module lands on one of those two accumulators.
    */
    const pushes = exec.match(/[A-Za-z_.$]*\.push\(/g) ?? [];
    expect(pushes.length).toBeGreaterThan(0);
    expect([...new Set(pushes)].sort()).toEqual(['emitted.push(', 'withheld.push(']);

    // positive control: the scan bites on a local rule written the way one really would be
    expect(/\bring/i.test(`${exec}\nif (ring[0] !== ring.at(-1)) throw new Error('open');`)).toBe(
      true,
    );
    // and it does NOT fire on the word it used to trip over
    expect(/\bring/i.test('const code: string = x;')).toBe(false);

    // And the six codes are the CONTRACT's, named nowhere in the producer.
    expect(POLYGON_RING_REFUSAL_CODES).toHaveLength(6);
    for (const code of POLYGON_RING_REFUSAL_CODES) {
      expect([code, withoutComments(producerSource()).includes(code)]).toEqual([code, false]);
    }
  });
});

/* ── 10 · G-R12-C1 · THE STRUCTURAL CODES ARE NOT IN THE GOVERNED VOCABULARY ─ */

describe('HP-10 · G-R12-C1 · measured, reported, and NOT worked around', () => {
  /*
    ── THE FINDING ─────────────────────────────────────────────────────────

    GX-24/GX-25 throw six codes. NONE of them is in `GEOMETRY_DATA_DEFECT_CODES` or
    `GEOMETRY_PROGRAMMING_MISTAKE_CODES`, so AS-13's deliberately CLOSED extractor
    collapses all six to `GEOMETRY_UNCLASSIFIED_REFUSAL` — and AS-E1-7 rules that
    UNCLASSIFIED alarms at the same severity as a programming mistake.

    Consequence, in one sentence: an unclosed ring from a publisher — the commonest real
    source defect there is — currently pages an operator at programming-mistake severity,
    and six distinguishable defects arrive as one word.

    Neither package is wrong alone. `geometry-authority.ts` is right to close the
    extractor; the structural contract is right to name six codes. The lists simply have
    not been told about each other, and amending them is Main's and E1's, not a
    producer's: a producer that special-cased these six would be the producer-local
    vocabulary R1.1 was opened to remove.

    THESE TESTS ARE WRITTEN TO INVERT. When the governed lists are amended, every
    assertion below fails and says so — which is the pin working, exactly as HP-B2's did.
  */

  it('THE PIN HAS FIRED · all six structural codes are now GOVERNED', () => {
    /*
      This assertion was written to INVERT, and it has. The governed lists were amended
      by ALPHA-HUMANITARIAN-SELF-CONTAINED-R2 after the bidirectional vocabulary gate
      failed from a clean checkout naming exactly these six.

      All six are DATA_DEFECT: a ring a publisher did not close is a fault on the far
      side of the trust boundary, routine and expected, and must not page anyone. That
      was the consequence G measured -- an unclosed ring paging at programming-mistake
      severity -- and it is what closing the gap fixes.
    */
    for (const code of POLYGON_RING_REFUSAL_CODES) {
      expect([code, GEOMETRY_DATA_DEFECT_CODES.includes(code)]).toEqual([code, true]);
      expect([code, GEOMETRY_PROGRAMMING_MISTAKE_CODES.includes(code)]).toEqual([code, false]);
    }
  });

  it('so a structural refusal now reaches the producer GOVERNED — and does NOT alarm', () => {
    const { withheld } = produceInundationExtents(
      {
        features: [
          feature({
            coordinates: [
              [
                [11, 48],
                [11.5, 48],
                [11.5, 48.5],
                [11, 48.5],
              ],
            ],
          }),
        ],
      },
      keying(),
    );

    // The operability defect G measured, closed: the commonest real source defect no
    // longer pages anyone, and it arrives under its own name.
    expect(withheld[0]!.code).toBe('GEOMETRY_RING_NOT_CLOSED');
    expect(classifyRefusal(withheld[0]!.code)).toBe('DATA_DEFECT');
    expect(refusalClassAlarms(classifyRefusal(withheld[0]!.code))).toBe(false);
  });

  it('and six distinguishable defects arrive as one code — the A-24 collapse, one layer up', () => {
    const shapes: readonly unknown[] = [
      [
        [
          [11, 48],
          [11.5, 48],
          [11.5, 48.5],
        ],
      ], // too few positions
      [
        [
          [11, 48],
          [11.5, 48],
          [11.5, 48.5],
          [11, 48.5],
        ],
      ], // not closed
      [[[11], [11.5], [11.5], [11]]], // position arity
      [], // empty polygon
      MULTI, // structure disagrees with kind
      7, // not an array of rings
    ];

    const codes = new Set(
      shapes.map(
        (coordinates) =>
          produceInundationExtents({ features: [feature({ coordinates })] }, keying()).withheld[0]!
            .code,
      ),
    );

    /*
      THE A-24 COLLAPSE IS UNDONE. Six distinguishable defects arrived as one word while
      the codes were ungoverned; now each keeps its own name, which is the whole reason
      the structural contract bothered to name six.
    */
    expect(codes.size).toBeGreaterThan(1);
    expect([...codes]).not.toContain(UNCLASSIFIED_REFUSAL_CODE);
  });

  it('and the retired-codes note for GEOMETRY_RING_NOT_CLOSED has been withdrawn', () => {
    /*
      A smaller, separate consequence worth recording: `GEOMETRY_RETIRED_REFUSAL_CODES`
      documents `GEOMETRY_RING_NOT_CLOSED` as *"never thrown. The real code is
      GEOMETRY_COORDINATES_NOT_CLOSED."* GX-24 throws it. A reader who follows that note
      is sent to the wrong code, and the note is in accepted authority.
    */
    // The note was correct against R3 and became false against R5. It is withdrawn, and
    // the code is governed -- a retirement is a claim about the code, and such claims expire.
    expect(GEOMETRY_RETIRED_REFUSAL_CODES).not.toHaveProperty('GEOMETRY_RING_NOT_CLOSED');
    expect(GEOMETRY_DATA_DEFECT_CODES).toContain('GEOMETRY_RING_NOT_CLOSED');
    expect(POLYGON_RING_REFUSAL_CODES).toContain('GEOMETRY_RING_NOT_CLOSED');
  });
});
