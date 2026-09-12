import { projectPoint, simplifyRing, ringToPathD, geometryToPathD } from './equirectangularProjection';

describe('equirectangularProjection (CTO Frontend Visual Revision — Hero world geometry)', () => {
  const viewport = { width: 360, height: 180 };

  describe('projectPoint', () => {
    it('projects the equator/prime-meridian origin to the viewport center', () => {
      expect(projectPoint([0, 0], viewport)).toEqual([180, 90]);
    });

    it('projects the north-pole/dateline corner to the top-left', () => {
      expect(projectPoint([-180, 90], viewport)).toEqual([0, 0]);
    });

    it('projects the south-pole/dateline corner to the bottom-right', () => {
      expect(projectPoint([180, -90], viewport)).toEqual([360, 180]);
    });
  });

  describe('simplifyRing', () => {
    it('reduces point count while preserving the first and last point', () => {
      const ring = Array.from({ length: 10 }, (_, i) => [i, i] as [number, number]);
      const simplified = simplifyRing(ring, 3);
      expect(simplified.length).toBeLessThan(ring.length);
      expect(simplified[0]).toEqual(ring[0]);
      expect(simplified[simplified.length - 1]).toEqual(ring[ring.length - 1]);
    });

    it('returns the ring unchanged when keepEvery is 1', () => {
      const ring = Array.from({ length: 10 }, (_, i) => [i, i] as [number, number]);
      expect(simplifyRing(ring, 1)).toEqual(ring);
    });
  });

  describe('ringToPathD', () => {
    it('produces a valid closed SVG path for a simple square ring', () => {
      const square: [number, number][] = [
        [-10, -10],
        [10, -10],
        [10, 10],
        [-10, 10],
        [-10, -10],
      ];
      const pathD = ringToPathD(square, viewport, 1);
      expect(pathD.startsWith('M')).toBe(true);
      expect(pathD.trim().endsWith('Z')).toBe(true);
      expect((pathD.match(/L/g) ?? []).length).toBe(4);
    });
  });

  describe('geometryToPathD', () => {
    const square: [number, number][] = [
      [-10, -10],
      [10, -10],
      [10, 10],
      [-10, 10],
      [-10, -10],
    ];

    it('handles a Polygon geometry', () => {
      const pathD = geometryToPathD({ type: 'Polygon', coordinates: [square] }, viewport);
      expect(pathD.startsWith('M')).toBe(true);
      expect(pathD).toContain('Z');
    });

    it('handles a MultiPolygon geometry, producing one subpath per polygon', () => {
      const pathD = geometryToPathD({ type: 'MultiPolygon', coordinates: [[square], [square]] }, viewport);
      expect((pathD.match(/M/g) ?? []).length).toBe(2);
    });

    it('handles null/undefined geometry gracefully without throwing', () => {
      expect(geometryToPathD(null, viewport)).toBe('');
      expect(geometryToPathD(undefined, viewport)).toBe('');
    });
  });
});
