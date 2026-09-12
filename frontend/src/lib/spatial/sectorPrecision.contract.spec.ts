import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  FOCUS_MAX_ZOOM,
  HALO_RADIUS_KM,
  haloRadiusKm,
  haloRadiusKmWithGeometry,
  isFinerThan,
  precisionRank,
  rendersAsPoint,
  referenceCeilingForZoom,
  type DisplayPrecision,
} from '@/lib/map/spatial/precisionModel';
import {
  PRODUCIBLE_SPATIAL_PRECISION,
  displayCeilingFor,
  type SpatialPrecision,
} from '@/lib/spatial/spatialPrecision';
import { PRODUCIBLE_GEO_PRECISION, type GeoPrecision } from '@/lib/spatial/geoResolution';

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * THE SECTOR PRECISION CONTRACT, AS ONE GOLDEN TEST
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * SECTOR is a precision token in FIVE separate vocabularies — two in the
 * backend, three in the frontend — plus every table keyed by DisplayPrecision.
 * The failure mode this file exists to prevent is not "SECTOR is missing"; it
 * is "SECTOR landed in four of the five", which produces a system that can
 * resolve a sector and cannot draw it, or can draw it and refuses to produce
 * it, and which typechecks perfectly in both states.
 *
 * So the vocabularies are asserted TOGETHER, in one file, including the two
 * that live in the backend workspace and are read here as text — the same
 * cross-workspace technique `adminCapabilityParity.spec.ts` already uses.
 *
 * THE GOVERNING SENTENCE: SECTOR IS AN ADMINISTRATIVE AREA. Everything below
 * follows from that one fact, and each assertion names which consequence it is
 * checking.
 */

const BACKEND = join(__dirname, '..', '..', '..', '..', 'backend', 'src', 'modules', 'geo');

function backendSource(file: string): string {
  return readFileSync(join(BACKEND, file), 'utf8');
}

describe('THE FIVE VOCABULARIES MOVED TOGETHER', () => {
  it('1 · GeoNodePrecision (backend) declares SECTOR', () => {
    const source = backendSource('gazetteer-search.ts');
    const declaration = source.slice(
      source.indexOf('export type GeoNodePrecision'),
      source.indexOf(';', source.indexOf('export type GeoNodePrecision')),
    );

    expect(declaration).toContain("'SECTOR'");
    expect(declaration).toContain("'DISTRICT'");
  });

  it('1b · GeoNodeKind (backend) declares admin3', () => {
    const source = backendSource('gazetteer-search.ts');
    const declaration = source.slice(
      source.indexOf('export type GeoNodeKind'),
      source.indexOf(';', source.indexOf('export type GeoNodeKind')),
    );

    expect(declaration).toContain("'admin3'");
  });

  it('2 · GeoPrecision (backend) declares SECTOR', () => {
    const source = backendSource('geo-resolver.ts');
    const declaration = source.slice(
      source.indexOf('export type GeoPrecision'),
      source.indexOf(';', source.indexOf('export type GeoPrecision')),
    );

    expect(declaration).toContain("'SECTOR'");
  });

  it('3 · PRODUCIBLE_GEO_PRECISION (backend) includes SECTOR', () => {
    const source = backendSource('geo-resolver.ts');
    const declaration = source.slice(
      source.indexOf('export const PRODUCIBLE_GEO_PRECISION'),
      source.indexOf('];', source.indexOf('export const PRODUCIBLE_GEO_PRECISION')),
    );

    expect(declaration).toContain("'SECTOR'");
  });

  it('4 · the frontend GeoPrecision mirror agrees with the backend, arm for arm', () => {
    const backend = backendSource('geo-resolver.ts');
    const backendArms = new Set(
      (
        backend
          .slice(
            backend.indexOf('export type GeoPrecision'),
            backend.indexOf(';', backend.indexOf('export type GeoPrecision')),
          )
          .match(/'[A-Z]+'/g) ?? []
      ).map((arm) => arm.replaceAll("'", '')),
    );

    const mirrored: GeoPrecision[] = [
      'EXACT',
      'CITY',
      'SECTOR',
      'DISTRICT',
      'PROVINCE',
      'COUNTRY',
      'REGION',
      'UNKNOWN',
      'NONE',
    ];

    expect(backendArms).toEqual(new Set(mirrored));
    expect(PRODUCIBLE_GEO_PRECISION).toContain('SECTOR');
  });

  it('5 · SpatialPrecision and PRODUCIBLE_SPATIAL_PRECISION include SECTOR', () => {
    const sector: SpatialPrecision = 'SECTOR';

    expect(sector).toBe('SECTOR');
    expect(PRODUCIBLE_SPATIAL_PRECISION).toContain('SECTOR');
  });
});

describe('THE TEMPORARY ADMIN3 → DISTRICT DEPENDENCY IS GONE', () => {
  it('precisionForRung maps ADMIN3 to SECTOR, not to DISTRICT', () => {
    const source = backendSource('administrative-ladder.contract.ts');
    const arm = source.slice(source.indexOf("case 'ADMIN3':"), source.indexOf("case 'CITY':"));

    expect(arm).toContain("return 'SECTOR';");
    expect(arm).not.toContain("return 'DISTRICT';");
  });

  it('the ladder still refuses to let navigation raise evidence', () => {
    const source = backendSource('administrative-ladder.contract.ts');

    /*
     * The guard that the old stand-in leaned on must survive its removal.
     * Dropping it alongside the stand-in would turn "a reader navigated to a
     * sector" into "there is sector-precise evidence here", which is the one
     * inference the whole ladder exists to forbid.
     */
    expect(source).toContain('assertNavigationDoesNotRaiseEvidence');
  });
});

describe('DisplayPrecision-KEYED TABLES ALL CARRY SECTOR', () => {
  /*
   * `Record<DisplayPrecision, …>` makes a missing key a compile error, so these
   * assertions are about the VALUES being deliberate rather than about the keys
   * existing. A table filled in to satisfy the compiler with a copied
   * neighbour's number would typecheck and be wrong.
   */
  it('rank places SECTOR between DISTRICT and CITY', () => {
    expect(precisionRank('SECTOR')).toBeGreaterThan(precisionRank('DISTRICT'));
    expect(precisionRank('SECTOR')).toBeLessThan(precisionRank('CITY'));
    expect(isFinerThan('SECTOR', 'DISTRICT')).toBe(true);
    expect(isFinerThan('SECTOR', 'CITY')).toBe(false);
  });

  it('the halo fallback is 8 km', () => {
    expect(HALO_RADIUS_KM.SECTOR).toBe(8);
    expect(haloRadiusKm('SECTOR')).toBe(8);
  });

  it('the camera fallback sits between DISTRICT and CITY', () => {
    expect(FOCUS_MAX_ZOOM.SECTOR).toBeGreaterThan(FOCUS_MAX_ZOOM.DISTRICT);
    expect(FOCUS_MAX_ZOOM.SECTOR).toBeLessThan(FOCUS_MAX_ZOOM.CITY);
  });

  it('every DisplayPrecision-keyed table answers for SECTOR without falling back', () => {
    const sector: DisplayPrecision = 'SECTOR';

    expect(HALO_RADIUS_KM[sector]).not.toBeUndefined();
    expect(FOCUS_MAX_ZOOM[sector]).not.toBeUndefined();
    expect(precisionRank(sector)).not.toBe(precisionRank('UNKNOWN'));
  });
});

describe('SECTOR IS AN AREA', () => {
  it('rendersAsPoint(SECTOR) is false', () => {
    expect(rendersAsPoint('SECTOR')).toBe(false);
  });

  it('is false whether or not geometry is held — absence does not make it a point', () => {
    /*
     * The no-polygon case is today's case for all 416 sectors. A centroid may
     * move the camera and may not become the marker, so the answer here cannot
     * depend on geometry at all — and the function has no parameter through
     * which geometry could reach it.
     */
    expect(rendersAsPoint('SECTOR')).toBe(false);
    expect(rendersAsPoint.length).toBe(1);
  });

  it('only EXACT and CITY render as points, and SECTOR is in neither', () => {
    const points = (
      ['EXACT', 'CITY', 'SECTOR', 'DISTRICT', 'PROVINCE', 'COUNTRY', 'REGION', 'UNKNOWN', 'NONE'] as DisplayPrecision[]
    ).filter(rendersAsPoint);

    expect(points).toEqual(['EXACT', 'CITY']);
  });
});

describe('THE 8 KM FALLBACK IS SUBORDINATE TO AUTHORITATIVE GEOMETRY', () => {
  it('a verified polygon extent wins over the nominal radius', () => {
    expect(haloRadiusKmWithGeometry('SECTOR', 4.5)).toBe(4.5);
    expect(haloRadiusKmWithGeometry('SECTOR', 21)).toBe(21);
  });

  it('the nominal radius is reached only when no polygon extent exists', () => {
    expect(haloRadiusKmWithGeometry('SECTOR', null)).toBe(8);
  });

  it('subordination is not SECTOR-specific — it holds for every precision', () => {
    expect(haloRadiusKmWithGeometry('DISTRICT', 12)).toBe(12);
    expect(haloRadiusKmWithGeometry('COUNTRY', 40)).toBe(40);
    expect(haloRadiusKmWithGeometry('DISTRICT', null)).toBe(45);
  });
});

describe('ZOOM ALONE NEVER MANUFACTURES SECTOR GEOGRAPHY', () => {
  it('the reference ceiling never reaches SECTOR, at any zoom', () => {
    for (let zoom = 0; zoom <= 22; zoom += 1) {
      expect(referenceCeilingForZoom(zoom, 'EXACT')).not.toBe('SECTOR');
    }
  });

  it('a SECTOR record is still drawn coarser on a country-only surface', () => {
    expect(displayCeilingFor('SECTOR')).toBe('country');
  });
});
