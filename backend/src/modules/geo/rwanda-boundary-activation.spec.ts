import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  BOUNDARY_FILES,
  boundaryGeometryAwaitingBytesOnly,
  checkLakeKivuInvariant,
  importBoundaryLayer,
  loadBoundaryLayer,
  nisrDistrictsWithGeometry,
  nisrSectorsWithGeometry,
  rwandaBoundaryCoverageResolved,
  rwandaGeometryDataIdentity,
  type BoundaryFeature,
  type BoundaryFeatureCollection,
} from './rwanda-boundary-geometry';
import { LAKE_KIVU_DISTRICT_IDS, nisrDistricts, nisrSectors } from './rwanda-nisr.authority';

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * ACTIVATION — THE OFFICIAL POLYGONS ARE HERE, AND THIS PROVES IT.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The companion spec, `rwanda-boundary-geometry.spec.ts`, proves the import PATH
 * against synthetic fixtures: every check, every refusal, every reject code.
 * This file is the other half — it runs the same machinery against the REAL
 * files now shipping in `data/`, so the claim "30/30 and 416/416 boundary
 * coverage" is a measurement rather than an assertion.
 *
 * THE DIGESTS ARE PINNED. They were computed at the official source, in the
 * browser, before a single byte was transported, and the transport was verified
 * against them. Pinning them here means a swapped, truncated or re-encoded file
 * fails this suite rather than shipping as official geography.
 */

const DIGESTS = {
  districts: '4e5217c6f83a21d26c65c82e902da7b2af02a93cdcf068b15022d9b7f017c9cd',
  sectors: 'fb97d28a91f95e7c218c12be7813ba9a9732796f2e8dd81ab72a39e65a936b3c',
} as const;

function collection(file: string): BoundaryFeatureCollection {
  return JSON.parse(
    readFileSync(join(__dirname, 'data', file), 'utf8'),
  ) as BoundaryFeatureCollection;
}

const areaOf = (f: BoundaryFeature): number => Number(f.properties.Shape__Area) || 0;

describe('1 · the official files are present and are the ones we verified', () => {
  it('both files load and carry the pinned digests', () => {
    const identity = rwandaGeometryDataIdentity();
    const admin2 = identity.find((row) => row.rung === 'ADMIN2')!;
    const admin3 = identity.find((row) => row.rung === 'ADMIN3')!;

    expect(admin2.file).toBe(BOUNDARY_FILES.ADMIN2);
    expect(admin3.file).toBe(BOUNDARY_FILES.ADMIN3);
    expect(admin2.sha256).toBe(DIGESTS.districts);
    expect(admin3.sha256).toBe(DIGESTS.sectors);
  });

  it('the loader no longer reports that bytes are outstanding', () => {
    expect(boundaryGeometryAwaitingBytesOnly()).toBe(false);
  });
});

describe('2 · every acceptance check passes against the real data', () => {
  it('districts: 30 features, zero rejects', () => {
    const result = importBoundaryLayer('ADMIN2', collection(BOUNDARY_FILES.ADMIN2));

    expect(result.rejects).toEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.featureCount).toBe(30);
  });

  it('sectors: 416 features, zero rejects', () => {
    const result = importBoundaryLayer('ADMIN3', collection(BOUNDARY_FILES.ADMIN3));

    expect(result.rejects).toEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.featureCount).toBe(416);
  });

  it('geometry is areal — Polygon and MultiPolygon only', () => {
    for (const rung of ['ADMIN2', 'ADMIN3'] as const) {
      for (const type of loadBoundaryLayer(rung).result.geometryTypes) {
        expect(['Polygon', 'MultiPolygon']).toContain(type);
      }
    }
  });

  it('every authority unit has geometry and no geometry is an orphan', () => {
    /*
     * The import already rejects on either condition; this asserts the positive
     * directly so the coverage claim reads as a measurement of both sets.
     */
    const districtIds = new Set(
      collection(BOUNDARY_FILES.ADMIN2).features.map((f) => String(f.properties.district_id)),
    );
    const sectorIds = new Set(
      collection(BOUNDARY_FILES.ADMIN3).features.map((f) => String(f.properties.sector_id)),
    );

    expect(districtIds.size).toBe(30);
    expect(sectorIds.size).toBe(416);

    for (const district of nisrDistricts()) expect(districtIds.has(district.districtId)).toBe(true);
    for (const sector of nisrSectors()) expect(sectorIds.has(sector.sectorId)).toBe(true);
  });
});

describe('3 · the Lake Kivu invariant holds in the shipped data', () => {
  it('exactly the five Kivu-shore districts are short of their sectors', () => {
    const result = checkLakeKivuInvariant(
      collection(BOUNDARY_FILES.ADMIN2),
      collection(BOUNDARY_FILES.ADMIN3),
      areaOf,
    );

    expect(result.holds).toBe(true);
    expect(result.shortDistrictIds).toEqual([...LAKE_KIVU_DISTRICT_IDS].sort());
    expect(result.findings).toEqual([]);
  });

  it('the measured gap reproduces G’s server-side figure', () => {
    const d = collection(BOUNDARY_FILES.ADMIN2).features.reduce((a, f) => a + areaOf(f), 0);
    const s = collection(BOUNDARY_FILES.ADMIN3).features.reduce((a, f) => a + areaOf(f), 0);

    /*
     * G measured 0.0821116108730742 server-side, independently of this
     * transport. Agreement to 1e-12 is the strongest available evidence that
     * the bytes on disk are the bytes NISR published.
     */
    expect(Math.abs(d - s - 0.0821116108730742)).toBeLessThan(1e-12);
  });

  it('THE SECTORS STILL DO NOT TILE RWANDA — and that is required, not tolerated', () => {
    const d = collection(BOUNDARY_FILES.ADMIN2).features.reduce((a, f) => a + areaOf(f), 0);
    const s = collection(BOUNDARY_FILES.ADMIN3).features.reduce((a, f) => a + areaOf(f), 0);

    expect(d).toBeGreaterThan(s);
  });
});

describe('4 · coverage is now PRESENT, in both dimensions', () => {
  it('reports 30/30 and 416/416 boundary features', () => {
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

  it('each coverage row carries a boundaryGeometry ref under NISR authority', () => {
    for (const row of rwandaBoundaryCoverageResolved()) {
      expect(row.refs).toHaveLength(1);
      expect(row.refs[0].authority).toBe('NISR');
      expect(row.refs[0].crs).toBe('EPSG:4326');
      expect(row.refs[0].sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(row.refs[0].sourceLayer).toContain('services5.arcgis.com');
    }
  });
});

describe('5 · polygons land in boundaryGeometry and never in ext', () => {
  it('every district and sector record now carries boundaryGeometry', () => {
    for (const record of [...nisrDistrictsWithGeometry(), ...nisrSectorsWithGeometry()]) {
      expect(record.boundaryGeometry).not.toBeNull();
      expect(record.boundaryGeometry!.authority).toBe('NISR');
    }
  });

  it('the identity-only accessors are untouched — the two coverages stay independent', () => {
    /*
     * `nisrDistricts()` must keep answering the IDENTITY question without
     * geometry. If attaching boundaries had mutated it, a geometry failure
     * would start looking like an identity failure.
     */
    for (const record of [...nisrDistricts(), ...nisrSectors()]) {
      expect(record.boundaryGeometry).toBeNull();
    }
  });

  it('no boundary polygon was written into any ext field', () => {
    /*
     * `ext` is the settlement-derived camera box the boundary-join contract
     * forbids drawing as a border. The NISR records have no `ext` at all, and
     * that separation is what lets a consumer tell a real boundary from a box.
     */
    for (const record of [...nisrDistrictsWithGeometry(), ...nisrSectorsWithGeometry()]) {
      expect((record as unknown as Record<string, unknown>).ext).toBeUndefined();
    }
  });
});
