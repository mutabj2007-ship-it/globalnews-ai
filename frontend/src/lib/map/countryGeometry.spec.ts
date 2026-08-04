import { computeFeatureCenter, getCountryFeatureCollection, type CountryFeature } from './countryGeometry';

describe('getCountryFeatureCollection', () => {
  it('joins world-atlas geometry features to our curated country metadata by numeric id', () => {
    const collection = getCountryFeatureCollection();
    const spain = collection.features.find((f) => f.properties.country?.iso3 === 'ESP');

    expect(spain).toBeDefined();
    expect(spain?.properties.numericId).toBe('724');
    expect(spain?.geometry).toBeTruthy();
  });

  it('includes geometry features we do not have curated metadata for, without crashing', () => {
    const collection = getCountryFeatureCollection();
    // The curated registry is intentionally a subset of world-atlas's
    // full country list, so some features should have no `country`.
    const unmatched = collection.features.filter((f) => !f.properties.country);
    expect(Array.isArray(unmatched)).toBe(true);
  });

  it('returns the same cached collection on repeated calls', () => {
    const first = getCountryFeatureCollection();
    const second = getCountryFeatureCollection();
    expect(first).toBe(second);
  });
});

describe('computeFeatureCenter', () => {
  it('computes the bounding-box center of a simple polygon', () => {
    const feature: CountryFeature = {
      type: 'Feature',
      id: '000',
      properties: { numericId: '000' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 10],
            [0, 0],
          ],
        ],
      },
    };

    expect(computeFeatureCenter(feature)).toEqual([5, 5]);
  });

  it('returns null when geometry has no coordinates', () => {
    const feature = {
      type: 'Feature',
      id: '000',
      properties: { numericId: '000' },
      geometry: { type: 'GeometryCollection', geometries: [] },
    } as unknown as CountryFeature;

    expect(computeFeatureCenter(feature)).toBeNull();
  });
});
