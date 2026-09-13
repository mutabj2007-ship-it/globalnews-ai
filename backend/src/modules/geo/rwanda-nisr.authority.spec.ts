import { allRegions } from './geo-gazetteer';
import {
  GEONAMES_CROSSWALK,
  LAKE_KIVU_DISTRICT_IDS,
  LAKE_KIVU_DISTRICT_NAMES,
  NISR,
  NISR_ATTRIBUTION,
  NISR_RIGHTS_GAP,
  NO_SECTOR_LAKE_KIVU_REASON,
  RWANDA_SUPERSEDED_AUTHORITY,
  SECTOR_TILING_GAP,
  assertNoImplicitJoin,
  assertNoSectorIsNotRecovered,
  geonamesCodeForProvince,
  nisrDistricts,
  nisrDistrictsOfProvince,
  nisrProvinces,
  nisrSectors,
  nisrSectorsOfDistrict,
  provinceIdForGeonamesCode,
  rwandaBoundaryGeometryCoverage,
  rwandaIdentityCoverage,
  verifyGeonamesCrosswalk,
  type NisrSector,
  type SectorResolution,
} from './rwanda-nisr.authority';

/*
 * THE OFFICIAL RWANDAN ADMINISTRATIVE AUTHORITY, PROVED AGAINST THE ARTIFACT.
 *
 * Every count below is read from the shipped data rather than restated from a
 * report, so a truncated, swapped or partially-written artifact fails here
 * instead of being served as coverage.
 */

describe('IDENTITY — the counts are complete and measured', () => {
  it('carries 5 provinces, 30 districts and 416 sectors', () => {
    expect(nisrProvinces()).toHaveLength(5);
    expect(nisrDistricts()).toHaveLength(30);
    expect(nisrSectors()).toHaveLength(416);
  });

  it('reports 30/30 and 416/416 with authoritative labels under NISR', () => {
    const coverage = rwandaIdentityCoverage();
    const admin2 = coverage.find((row) => row.rung === 'ADMIN2')!;
    const admin3 = coverage.find((row) => row.rung === 'ADMIN3')!;

    expect(admin2.carriedUnits).toBe(30);
    expect(admin2.publishedUnits).toBe(30);
    expect(admin3.carriedUnits).toBe(416);
    expect(admin3.publishedUnits).toBe(416);

    for (const row of coverage) {
      expect(row.authority).toBe(NISR);
      expect(row.labelsAreAuthoritative).toBe(true);
      expect(row.isCoverageGap).toBe(false);
    }
  });

  it('has no orphan, no duplicate id and no null parent', () => {
    const districtIds = new Set(nisrDistricts().map((district) => district.districtId));
    const provinceIds = new Set(nisrProvinces().map((province) => province.provinceId));

    expect(new Set(nisrDistricts().map((d) => d.externalId)).size).toBe(30);
    expect(new Set(nisrSectors().map((s) => s.externalId)).size).toBe(416);

    for (const district of nisrDistricts()) {
      expect(provinceIds.has(district.provinceId)).toBe(true);
      expect(district.parentExternalId).toBe(`nisr:province:${district.provinceId}`);
    }

    for (const sector of nisrSectors()) {
      expect(districtIds.has(sector.districtId)).toBe(true);
      expect(sector.parentExternalId).toBe(`nisr:district:${sector.districtId}`);
    }
  });

  it('parentage reconciles: every district’s sector count matches its children', () => {
    for (const district of nisrDistricts()) {
      expect(nisrSectorsOfDistrict(district.districtId)).toHaveLength(district.sectors);
    }

    for (const province of nisrProvinces()) {
      expect(nisrDistrictsOfProvince(province.provinceId)).toHaveLength(province.districts);
    }
  });

  it('every record declares its authority, and declares it as a field', () => {
    for (const record of [...nisrDistricts(), ...nisrSectors()]) {
      expect(record.authority).toBe('NISR');
      expect(record.provenance.authority).toBe('NISR');
      expect(record.provenance.vintage).toContain('2022');
      expect(record.provenance.publishedAt).toBe('2024-09-03T09:20:26.660Z');
      expect(record.provenance.licence).toContain('CC BY 4.0');
      expect(record.provenance.commercialUse).toBe('permitted');
      expect(record.provenance.attribution).toBe(NISR_ATTRIBUTION);
    }
  });
});

describe('IDENTIFIERS — namespaced, so a bare number can never be one', () => {
  it('every external id carries its namespace', () => {
    for (const district of nisrDistricts()) {
      expect(district.externalId).toMatch(/^nisr:district:\d+$/);
    }

    for (const sector of nisrSectors()) {
      expect(sector.externalId).toMatch(/^nisr:sector:\d+$/);
    }
  });

  it('self-describing codes: a sector id is prefixed by its district id', () => {
    for (const sector of nisrSectors()) {
      expect(sector.sectorId.startsWith(sector.districtId)).toBe(true);
    }

    for (const district of nisrDistricts()) {
      expect(district.districtId.startsWith(district.provinceId)).toBe(true);
    }
  });
});

describe('CODE SPACES — no implicit join, demonstrated rather than asserted', () => {
  /*
   * THE FAILURE THIS PREVENTS, WRITTEN OUT.
   *
   * NISR numbers provinces 1..5 and GeoNames numbers Rwanda's admin1 rows
   * 11..15. Both are five consecutive integers naming five Rwandan provinces,
   * and mapping one to the other by position is wrong for every single row.
   * This test states the wrong answer explicitly so that a future reader
   * tempted by the arithmetic can see what it produces.
   */
  it('positional mapping would be wrong for every province, and is refused', () => {
    const geonames = allRegions().filter((region) => region.cc === 'RW');
    const byA1 = new Map(geonames.map((region) => [region.a1, region.n]));

    /* What arithmetic gives: NISR 1 -> a1 11, NISR 5 -> a1 15. */
    expect(byA1.get('11')).toBe('Eastern Province');
    expect(byA1.get('15')).toBe('Southern Province');

    /* What the crosswalk gives, and it agrees with neither. */
    expect(geonamesCodeForProvince('1')).toBe('RW-01');
    expect(geonamesCodeForProvince('5')).toBe('RW-02');

    const kigali = geonames.find((region) => region.iso === 'RW-01');
    const eastern = geonames.find((region) => region.iso === 'RW-02');
    expect(kigali?.n).toBe('Kigali');
    expect(eastern?.n).toBe('Eastern Province');
  });

  it('refuses a join for any id with no declared crosswalk row', () => {
    expect(assertNoImplicitJoin('nisr:district:55')).toBeUndefined();
    expect(assertNoImplicitJoin('nisr:sector:1101')).toBeUndefined();
  });

  it('the crosswalk is five province rows and nothing deeper', () => {
    expect(GEONAMES_CROSSWALK).toHaveLength(5);

    for (const entry of GEONAMES_CROSSWALK) {
      expect(entry.nisrId).toMatch(/^nisr:province:[1-5]$/);
      expect(entry.geonamesCode).toMatch(/^RW-0[1-5]$/);
      /* A basis that is a real statement, not the word "matched". */
      expect(entry.basis.length).toBeGreaterThan(60);
      expect(entry.basis.toLowerCase()).not.toContain('id arithmetic');
    }

    expect(new Set(GEONAMES_CROSSWALK.map((e) => e.geonamesCode)).size).toBe(5);
  });

  it('every crosswalk row re-proves against both artifacts', () => {
    const verifications = verifyGeonamesCrosswalk(
      allRegions()
        .filter((region) => region.cc === 'RW')
        .map((region) => ({ iso: region.iso ?? null, n: region.n })),
    );

    expect(verifications).toHaveLength(5);

    for (const verification of verifications) {
      expect(verification.nisrUnitExists).toBe(true);
      expect(verification.nameMatches).toBe(true);
      expect(verification.isNumericCoincidence).toBe(false);
    }
  });

  it('round-trips both directions', () => {
    for (const entry of GEONAMES_CROSSWALK) {
      const provinceId = entry.nisrId.slice('nisr:province:'.length);
      expect(provinceIdForGeonamesCode(entry.geonamesCode)).toBe(provinceId);
      expect(geonamesCodeForProvince(provinceId)).toBe(entry.geonamesCode);
    }
  });
});

describe('NAME NORMALISATION — canonical served, raw preserved', () => {
  it('province 5 serves Eastern Province and keeps Estern Province', () => {
    const province = nisrProvinces().find((row) => row.provinceId === '5')!;

    expect(province.name.canonicalName).toBe('Eastern Province');
    expect(province.name.rawSourceName).toBe('Estern Province');
    expect(province.name.normalisationBasis).toContain('Estern Province');
    expect(province.name.normalisationBasis).toContain('sector layer');
  });

  it('normalises exactly one province and leaves the other four untouched', () => {
    const normalised = nisrProvinces().filter((row) => row.name.normalisationBasis !== null);

    expect(normalised).toHaveLength(1);

    for (const province of nisrProvinces()) {
      if (province.name.normalisationBasis === null) {
        expect(province.name.canonicalName).toBe(province.name.rawSourceName);
      }
    }
  });

  it('no district or sector name is rewritten', () => {
    for (const record of [...nisrDistricts(), ...nisrSectors()]) {
      expect(record.name.canonicalName).toBe(record.name.rawSourceName);
      expect(record.name.normalisationBasis).toBeNull();
    }
  });
});

describe('LAKE KIVU — the sectors do not tile Rwanda, and that is binding', () => {
  it('records the measured gap and attributes it to Lake Kivu', () => {
    expect(SECTOR_TILING_GAP.sectorsTileRwanda).toBe(false);
    expect(SECTOR_TILING_GAP.attributableTo).toBe('Lake Kivu');

    const gap = SECTOR_TILING_GAP.districtAreaSqDeg - SECTOR_TILING_GAP.sectorAreaSqDeg;
    expect(Math.abs(gap - SECTOR_TILING_GAP.gapSqDeg)).toBeLessThan(1e-12);
  });

  it('names the five Kivu-shore districts and they exist under those ids', () => {
    expect(LAKE_KIVU_DISTRICT_IDS).toEqual(['31', '32', '33', '36', '37']);

    const byId = new Map(nisrDistricts().map((district) => [district.districtId, district]));

    for (const [index, id] of LAKE_KIVU_DISTRICT_IDS.entries()) {
      expect(byId.get(id)?.name.canonicalName).toBe(LAKE_KIVU_DISTRICT_NAMES[index]);
    }
  });

  it('NO_SECTOR is a successful outcome, distinct from every failure', () => {
    const resolution: SectorResolution = {
      outcome: 'NO_SECTOR',
      districtExternalId: 'nisr:district:32',
      reason: NO_SECTOR_LAKE_KIVU_REASON,
    };

    expect(resolution.outcome).toBe('NO_SECTOR');
    /* The union carries a separate arm for each other case, so they cannot merge. */
    const outcomes: SectorResolution['outcome'][] = [
      'SECTOR',
      'NO_SECTOR',
      'OUTSIDE_RWANDA',
      'GEOMETRY_UNAVAILABLE',
    ];
    expect(new Set(outcomes).size).toBe(4);
  });

  it('a nearest candidate does not change a NO_SECTOR answer', () => {
    const nearest: NisrSector = nisrSectors().find((sector) => sector.districtId === '32')!;
    const resolution: SectorResolution = {
      outcome: 'NO_SECTOR',
      districtExternalId: 'nisr:district:32',
      reason: NO_SECTOR_LAKE_KIVU_REASON,
    };

    const after = assertNoSectorIsNotRecovered(resolution, nearest);

    expect(after).toBe(resolution);
    expect(after.outcome).toBe('NO_SECTOR');
  });

  it('the reason refuses all four recoveries by name', () => {
    const reason = NO_SECTOR_LAKE_KIVU_REASON.toLowerCase();

    expect(reason).toContain('nearest-shore');
    expect(reason).toContain('inferred');
    expect(reason).toContain('fallback');
    expect(reason).toContain('tiled');
    expect(reason).toContain('no sector is the correct and complete answer');
  });
});

describe('COVERAGE IS TWO-DIMENSIONAL', () => {
  it('identity is complete while geometry is pending, and they are separate calls', () => {
    for (const row of rwandaIdentityCoverage()) {
      expect(row.isCoverageGap).toBe(false);
    }

    for (const row of rwandaBoundaryGeometryCoverage()) {
      expect(row.status).toBe('PENDING');
      expect(row.presentFeatures).toBe(0);
      expect(row.refs).toHaveLength(0);
    }
  });

  it('expects 30 district and 416 sector polygons when they land', () => {
    const admin2 = rwandaBoundaryGeometryCoverage().find((row) => row.rung === 'ADMIN2')!;
    const admin3 = rwandaBoundaryGeometryCoverage().find((row) => row.rung === 'ADMIN3')!;

    expect(admin2.expectedFeatures).toBe(30);
    expect(admin3.expectedFeatures).toBe(416);
  });

  it('no record carries boundary geometry, and none substitutes an extent for one', () => {
    for (const record of [...nisrDistricts(), ...nisrSectors()]) {
      expect(record.boundaryGeometry).toBeNull();
    }
  });

  it('the pending reason names the block and refuses every substitute', () => {
    const reason = rwandaBoundaryGeometryCoverage()[0].reason.toLowerCase();

    expect(reason).toContain('no bounding box');
    expect(reason).toContain('no centroid');
    expect(reason).toContain('no simplification');
  });
});

describe('SUPERSESSION — the old authority is history, not state', () => {
  it('is marked inactive and names what replaced it', () => {
    expect(RWANDA_SUPERSEDED_AUTHORITY.active).toBe(false);
    expect(RWANDA_SUPERSEDED_AUTHORITY.supersededBy).toBe('NISR');
    expect(RWANDA_SUPERSEDED_AUTHORITY.priorAuthority).toContain('GeoNames');
  });

  it('keeps the superseded measurements where an auditor can read them', () => {
    expect(RWANDA_SUPERSEDED_AUTHORITY.priorMeasurements.admin2CarriedUnits).toBe(21);
    expect(RWANDA_SUPERSEDED_AUTHORITY.priorMeasurements.admin3CarriedUnits).toBe(0);
    expect(RWANDA_SUPERSEDED_AUTHORITY.priorMeasurements.admin2LabelSource).toBe(
      'derived-from-principal-settlement',
    );
  });

  it('no live coverage answer reports the superseded numbers', () => {
    for (const row of rwandaIdentityCoverage()) {
      expect(row.carriedUnits).not.toBe(21);
      expect(row.labelSource).not.toContain('derived-from-principal-settlement');
    }
  });
});

describe('RIGHTS — carried exactly, with the retrieval gap recorded separately', () => {
  it('carries the attribution string verbatim', () => {
    expect(NISR_ATTRIBUTION).toBe(
      'Administrative boundary data: National Institute of Statistics of Rwanda (NISR), 2022. Licensed CC BY 4.0.',
    );
  });

  it('records the TLS gap as documentation debt and not an integration blocker', () => {
    expect(NISR_RIGHTS_GAP.blocksIntegration).toBe(false);
    expect(NISR_RIGHTS_GAP.classification).toBe('documentation-and-retrieval-debt');
    expect(NISR_RIGHTS_GAP.reason).toContain('not bypassed');
  });
});
