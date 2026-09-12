import {
  BOUNDARY_ACCEPTANCE,
  BOUNDARY_FILES,
  SECTORS_DO_NOT_TILE_RWANDA,
  assertNotDerivedExtent,
  boundaryGeometryAwaitingBytesOnly,
  checkLakeKivuInvariant,
  importBoundaryLayer,
  loadRwandaBoundaryGeometry,
  looksLikeBoundingBox,
  rwandaBoundaryCoverageResolved,
  validateBoundaryDataManifest,
  type BoundaryDataManifestEntry,
  type BoundaryFeature,
  type BoundaryFeatureCollection,
} from './rwanda-boundary-geometry';
import {
  LAKE_KIVU_DISTRICT_IDS,
  NISR_ATTRIBUTION,
  nisrDistricts,
  nisrSectors,
} from './rwanda-nisr.authority';

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * THE IMPORT PATH, PROVED AGAINST CONSTRUCTED DATA.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This file exercises the MACHINERY: every acceptance check, every reject path
 * individually, the bounding-box refusal, the Lake Kivu invariant in all four
 * of its states, and the manifest contract. It uses synthetic fixtures because
 * a validator is only trustworthy if you can show it FAILING on demand, and
 * real data — correctly — never fails.
 *
 * Its companion, `rwanda-boundary-activation.spec.ts`, runs the same machinery
 * against the real official polygons now shipping in `data/`, with their
 * digests pinned. Together: this one proves the checks work, that one proves
 * the shipped data passes them.
 *
 * FIXTURES LIVE IN THIS SPEC, NEVER IN `data/`. No fixture-only data reaches
 * the deployable product; a synthetic polygon on disk is exactly the kind of
 * thing that gets mistaken for real geometry later.
 */

/* ── FIXTURES ───────────────────────────────────────────────────────────── */

/** A small irregular pentagon inside Rwanda — NOT a bounding box. */
function realPolygon(seed: number): BoundaryFeature['geometry'] {
  const lon = 29.0 + (seed % 40) * 0.01;
  const lat = -2.0 + (seed % 40) * 0.01;

  return {
    type: 'Polygon',
    coordinates: [
      [
        [lon, lat],
        [lon + 0.006, lat + 0.001],
        [lon + 0.004, lat + 0.005],
        [lon + 0.001, lat + 0.004],
        [lon - 0.001, lat + 0.002],
        [lon, lat],
      ],
    ],
  };
}

/** Exactly what a serialised DerivedExtent looks like. */
function bboxPolygon(): BoundaryFeature['geometry'] {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [29.0, -2.0],
        [29.1, -2.0],
        [29.1, -1.9],
        [29.0, -1.9],
        [29.0, -2.0],
      ],
    ],
  };
}

const KIVU = new Set(LAKE_KIVU_DISTRICT_IDS);

function districtFixture(): BoundaryFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: nisrDistricts().map((district, i) => ({
      type: 'Feature' as const,
      geometry: realPolygon(i),
      properties: {
        district_id: Number(district.districtId),
        district: district.name.rawSourceName,
        province_id: Number(district.provinceId),
        /* Kivu districts are LARGER than the sum of their sectors — the lake. */
        Shape__Area: KIVU.has(district.districtId) ? district.sectors / 0.8 : district.sectors,
      },
    })),
  };
}

function sectorFixture(): BoundaryFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: nisrSectors().map((sector, i) => ({
      type: 'Feature' as const,
      geometry: realPolygon(i),
      properties: {
        sector_id: Number(sector.sectorId),
        sector: sector.name.rawSourceName,
        district_id: Number(sector.districtId),
        province_id: Number(sector.provinceId),
        Shape__Area: 1,
      },
    })),
  };
}

const areaOf = (f: BoundaryFeature): number => Number(f.properties.Shape__Area) || 0;

/* ── 1 · THE HAPPY PATH ─────────────────────────────────────────────────── */

describe('1 · a correct import is accepted', () => {
  it('accepts 30 district features', () => {
    const result = importBoundaryLayer('ADMIN2', districtFixture());

    expect(result.rejects).toEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.featureCount).toBe(30);
    expect(result.geometryTypes).toEqual(['Polygon']);
  });

  it('accepts 416 sector features', () => {
    const result = importBoundaryLayer('ADMIN3', sectorFixture());

    expect(result.rejects).toEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.featureCount).toBe(416);
  });

  it('requires exactly the counts the contract declares', () => {
    expect(BOUNDARY_ACCEPTANCE.expectedFeatures.ADMIN2).toBe(30);
    expect(BOUNDARY_ACCEPTANCE.expectedFeatures.ADMIN3).toBe(416);
  });
});

/* ── 2 · EVERY REJECT PATH ACTUALLY FIRES ───────────────────────────────── */

describe('2 · a validator that cannot fail is worthless', () => {
  it('rejects a wrong feature count', () => {
    const short = { ...districtFixture(), features: districtFixture().features.slice(0, 29) };

    expect(importBoundaryLayer('ADMIN2', short).rejects.map((r) => r.code)).toContain('COUNT');
  });

  it('rejects null geometry', () => {
    const fixture = districtFixture();
    const features = [...fixture.features];
    features[0] = { ...features[0], geometry: null };

    const codes = importBoundaryLayer('ADMIN2', { ...fixture, features }).rejects.map((r) => r.code);
    expect(codes).toContain('NULL-GEOM');
  });

  it('rejects a non-areal geometry type — a SECTOR IS AN AREA', () => {
    const fixture = sectorFixture();
    const features = [...fixture.features];
    features[0] = {
      ...features[0],
      geometry: { type: 'Point' as never, coordinates: [29.0, -2.0] },
    };

    const result = importBoundaryLayer('ADMIN3', { ...fixture, features });
    expect(result.rejects.map((r) => r.code)).toContain('GEOM-TYPE');
  });

  it('rejects a coordinate outside Rwanda — a reject, never a clamp', () => {
    const fixture = districtFixture();
    const features = [...fixture.features];
    features[0] = {
      ...features[0],
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [45, 10],
            [45.01, 10],
            [45.01, 10.01],
            [45, 10.01],
            [45.005, 10.005],
            [45, 10],
          ],
        ],
      },
    };

    expect(
      importBoundaryLayer('ADMIN2', { ...fixture, features }).rejects.map((r) => r.code),
    ).toContain('ENVELOPE');
  });

  it('rejects a non-WGS84 crs', () => {
    const result = importBoundaryLayer('ADMIN2', {
      ...districtFixture(),
      crs: { type: 'name', properties: { name: 'EPSG:3857' } },
    });

    expect(result.rejects.map((r) => r.code)).toContain('CRS');
  });

  it('rejects duplicate ids', () => {
    const fixture = districtFixture();
    const features = [...fixture.features];
    features[1] = { ...features[1], properties: { ...features[1].properties, district_id: Number(features[0].properties.district_id) } };

    const codes = importBoundaryLayer('ADMIN2', { ...fixture, features }).rejects.map((r) => r.code);
    expect(codes).toContain('DUPLICATE');
  });

  it('rejects a unit the authority does not have', () => {
    const fixture = districtFixture();
    const features = [...fixture.features];
    features[0] = { ...features[0], properties: { ...features[0].properties, district_id: 99 } };

    const codes = importBoundaryLayer('ADMIN2', { ...fixture, features }).rejects.map((r) => r.code);
    expect(codes).toContain('ORPHAN');
    /* And the unit it displaced now has no geometry. */
    expect(codes).toContain('ID-MISMATCH');
  });

  it('rejects a sector id not prefixed by its district id', () => {
    const fixture = sectorFixture();
    const features = [...fixture.features];
    features[0] = { ...features[0], properties: { ...features[0].properties, district_id: 55 } };

    expect(
      importBoundaryLayer('ADMIN3', { ...fixture, features }).rejects.map((r) => r.code),
    ).toContain('CODE-SHAPE');
  });

  it('rejects an absent collection rather than treating it as empty success', () => {
    const result = importBoundaryLayer('ADMIN2', undefined);

    expect(result.accepted).toBe(false);
    expect(result.rejects.map((r) => r.code)).toContain('COUNT');
  });
});

/* ── 3 · THE BBOX REFUSAL ───────────────────────────────────────────────── */

describe('3 · a bounding box is never a boundary', () => {
  it('recognises a five-point rectangle as a bbox', () => {
    const ring = [
      [29.0, -2.0],
      [29.1, -2.0],
      [29.1, -1.9],
      [29.0, -1.9],
      [29.0, -2.0],
    ];

    expect(looksLikeBoundingBox(ring)).toBe(true);
  });

  it('does not mistake a real irregular polygon for a bbox', () => {
    const ring = (realPolygon(1) as { coordinates: number[][][] }).coordinates[0];

    expect(looksLikeBoundingBox(ring)).toBe(false);
  });

  it('rejects an import that substitutes a derived extent for a polygon', () => {
    const fixture = districtFixture();
    const features = [...fixture.features];
    features[0] = { ...features[0], geometry: bboxPolygon() };

    const findings = assertNotDerivedExtent('ADMIN2', features);
    expect(findings.map((f) => f.code)).toEqual(['DERIVED-EXTENT']);
    expect(findings[0].message).toContain('ext');

    expect(
      importBoundaryLayer('ADMIN2', { ...fixture, features }).rejects.map((r) => r.code),
    ).toContain('DERIVED-EXTENT');
  });
});

/* ── 4 · THE LAKE KIVU INVARIANT ────────────────────────────────────────── */

describe('4 · the sectors must NOT tile Rwanda', () => {
  it('holds when exactly the five Kivu districts are short', () => {
    const result = checkLakeKivuInvariant(districtFixture(), sectorFixture(), areaOf);

    expect(result.holds).toBe(true);
    expect(result.shortDistrictIds).toEqual([...LAKE_KIVU_DISTRICT_IDS].sort());
    expect(result.findings).toEqual([]);
  });

  it('REJECTS when the gap disappears — someone tiled the lake', () => {
    const districts = districtFixture();
    /* Make every district an exact dissolve of its sectors: too tidy. */
    const features = districts.features.map((f) => ({
      ...f,
      properties: {
        ...f.properties,
        Shape__Area:
          nisrDistricts().find((d) => d.districtId === String(f.properties.district_id))?.sectors ?? 0,
      },
    }));

    const result = checkLakeKivuInvariant({ ...districts, features }, sectorFixture(), areaOf);

    expect(result.holds).toBe(false);
    expect(result.shortDistrictIds).toEqual([]);
    expect(result.findings[0].code).toBe('KIVU-INVARIANT');
  });

  it('REJECTS when a sixth district is short — the source changed shape', () => {
    const districts = districtFixture();
    const features = districts.features.map((f) =>
      String(f.properties.district_id) === '51'
        ? { ...f, properties: { ...f.properties, Shape__Area: Number(f.properties.Shape__Area) * 2 } }
        : f,
    );

    const result = checkLakeKivuInvariant({ ...districts, features }, sectorFixture(), areaOf);

    expect(result.holds).toBe(false);
    expect(result.shortDistrictIds).toContain('51');
  });

  it('detection is relative, so it survives a precision change', () => {
    const scale = (c: BoundaryFeatureCollection, k: number): BoundaryFeatureCollection => ({
      ...c,
      features: c.features.map((f) => ({
        ...f,
        properties: { ...f.properties, Shape__Area: Number(f.properties.Shape__Area) * k },
      })),
    });

    const result = checkLakeKivuInvariant(scale(districtFixture(), 1e-6), scale(sectorFixture(), 1e-6), areaOf);

    expect(result.holds).toBe(true);
  });

  it('states the product rule it protects', () => {
    expect(SECTORS_DO_NOT_TILE_RWANDA).toBe(true);
  });
});

/* ── 5 · THE DATA MANIFEST CONTRACT ─────────────────────────────────────── */

describe('5 · geometry is invisible to C/PA/SC, so the manifest is binding', () => {
  const valid: BoundaryDataManifestEntry = {
    file: 'rwanda-boundary-districts.geojson',
    sha256: 'a'.repeat(64),
    bytes: 123456,
    featureCount: 30,
    geometryType: 'Polygon',
    authority: 'NISR',
    sourceLayer: 'https://services5.arcgis.com/…/Distrct_Boundary/FeatureServer/0',
    vintage: '2022 (NISR district boundaries produced 2006, updated 2022)',
    licence: 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
    attribution: NISR_ATTRIBUTION,
  };

  it('accepts a complete entry', () => {
    expect(validateBoundaryDataManifest('ADMIN2', valid)).toEqual([]);
  });

  it('refuses a file with no manifest row at all', () => {
    const findings = validateBoundaryDataManifest('ADMIN2', undefined);

    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain('invisible to C/PA/SC');
  });

  it('refuses a malformed digest', () => {
    expect(validateBoundaryDataManifest('ADMIN2', { ...valid, sha256: 'nope' })).not.toEqual([]);
  });

  it('refuses a feature count that disagrees with the contract', () => {
    expect(validateBoundaryDataManifest('ADMIN2', { ...valid, featureCount: 29 })).not.toEqual([]);
  });

  it('refuses reworded attribution — it is a licence condition, not a courtesy', () => {
    const findings = validateBoundaryDataManifest('ADMIN2', {
      ...valid,
      attribution: 'Boundary data from NISR, CC BY 4.0.',
    });

    expect(findings.map((f) => f.message).join(' ')).toContain('verbatim');
  });

  it('refuses a missing licence or vintage', () => {
    expect(validateBoundaryDataManifest('ADMIN2', { ...valid, licence: 'Public domain' })).not.toEqual([]);
    expect(validateBoundaryDataManifest('ADMIN2', { ...valid, vintage: 'unknown' })).not.toEqual([]);
  });
});

/* ── 6 · THE LOADER, WITH THE OFFICIAL FILES PRESENT ────────────────────── */

describe('6 · the loader picks up the shipped official files', () => {
  it('names the exact files it loads', () => {
    expect(BOUNDARY_FILES.ADMIN2).toBe('rwanda-boundary-districts.geojson');
    expect(BOUNDARY_FILES.ADMIN3).toBe('rwanda-boundary-sectors.geojson');
  });

  it('finds both, and accepts both', () => {
    /*
     * SUPERSEDED. This section previously asserted the opposite — that no
     * geometry file existed and coverage was PENDING — which was the honest
     * state while the bytes were unobtainable. The official polygons are now
     * shipped and verified, so asserting absence would be asserting something
     * false about the product.
     *
     * The ABSENT branch is still covered, and deliberately: section 2 proves
     * `importBoundaryLayer(rung, undefined)` rejects rather than silently
     * succeeding, so removing the files would still fail loudly.
     */
    for (const state of loadRwandaBoundaryGeometry()) {
      expect(state.present).toBe(true);
      expect(state.ref).not.toBeNull();
      expect(state.result.accepted).toBe(true);
    }
  });

  it('no bytes remain outstanding', () => {
    expect(boundaryGeometryAwaitingBytesOnly()).toBe(false);
  });

  it('resolved coverage is PRESENT, 30 of 30 and 416 of 416', () => {
    const coverage = rwandaBoundaryCoverageResolved();
    const admin2 = coverage.find((row) => row.rung === 'ADMIN2')!;
    const admin3 = coverage.find((row) => row.rung === 'ADMIN3')!;

    expect(admin2.status).toBe('PRESENT');
    expect(admin2.presentFeatures).toBe(30);
    expect(admin2.expectedFeatures).toBe(30);
    expect(admin3.status).toBe('PRESENT');
    expect(admin3.presentFeatures).toBe(416);
    expect(admin3.expectedFeatures).toBe(416);
  });

  it('the identity accessors still carry no geometry — the coverages stay independent', () => {
    for (const record of [...nisrDistricts(), ...nisrSectors()]) {
      expect(record.boundaryGeometry).toBeNull();
    }
  });

  it('administrative IDENTITY is what it always was', () => {
    expect(nisrDistricts()).toHaveLength(30);
    expect(nisrSectors()).toHaveLength(416);
  });
});
