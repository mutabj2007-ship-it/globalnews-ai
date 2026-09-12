import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  LOCATION_ASSETS, locationImageAlt, registeredAssetPaths, resolveLocationImage,
  type LocationAssetRegistry,
} from './locationAssets';

const TEST_REGISTRY: LocationAssetRegistry = {
  city: { kigali: { src: '/location-assets/kigali.jpg', displayName: 'Kigali' } },
  country: { rwanda: { src: '/location-assets/rwanda.jpg', displayName: 'Rwanda' } },
};

/* PAF acceptance test 14 — geographic precision */
describe('PAF-14 — the image is bound to RESOLVED precision', () => {
  it('city precision may show a city asset', () => {
    expect(resolveLocationImage({ precision: 'city', resolvedPlace: 'Kigali' }, TEST_REGISTRY))
      .toEqual({ kind: 'asset', src: '/location-assets/kigali.jpg', place: 'Kigali' });
  });

  it('country precision shows a COUNTRY asset — never the city one', () => {
    const decision = resolveLocationImage({ precision: 'country', resolvedPlace: 'Rwanda' }, TEST_REGISTRY);
    expect(decision).toEqual({ kind: 'asset', src: '/location-assets/rwanda.jpg', place: 'Rwanda' });
  });

  it('a country-resolved analysis CANNOT reach a city asset, even one that exists', () => {
    // Kigali is registered under `city`. A country-resolved lookup must
    // not find it, because precision is part of the key.
    expect(resolveLocationImage({ precision: 'country', resolvedPlace: 'Kigali' }, TEST_REGISTRY))
      .toEqual({ kind: 'no-verified-asset', place: 'Kigali' });
  });

  it('unresolved suppresses the image entirely — no illustration, no flag, no map screenshot', () => {
    expect(resolveLocationImage({ precision: 'unresolved', resolvedPlace: 'Rwanda' }, TEST_REGISTRY))
      .toEqual({ kind: 'suppressed-unresolved' });
    expect(resolveLocationImage({ precision: 'unresolved', resolvedPlace: null }, TEST_REGISTRY))
      .toEqual({ kind: 'suppressed-unresolved' });
  });
});

/* PAF acceptance test 15 — MUSANZE. The mandatory geographic gate. */
describe('PAF-15 — a locality the evidence did not resolve can never reach the image', () => {
  it('"Musanze" is not a key the module will match at either precision', () => {
    expect(resolveLocationImage({ precision: 'city', resolvedPlace: 'Musanze' }, TEST_REGISTRY))
      .toEqual({ kind: 'no-verified-asset', place: 'Musanze' });
    expect(resolveLocationImage({ precision: 'country', resolvedPlace: 'Musanze' }, TEST_REGISTRY))
      .toEqual({ kind: 'no-verified-asset', place: 'Musanze' });
  });

  it('THE REAL CASE: query names Musanze, evidence resolves Rwanda only -> Rwanda asset', () => {
    // This is exactly what resolveGeography() produces for
    // "What is happening in Musanze, Rwanda?" — precision 'country',
    // city null, countryName 'Rwanda'. The frame passes the RESOLVED
    // place; "Musanze" is not a value it holds.
    const decision = resolveLocationImage({ precision: 'country', resolvedPlace: 'Rwanda' }, TEST_REGISTRY);
    expect(decision).toEqual({ kind: 'asset', src: '/location-assets/rwanda.jpg', place: 'Rwanda' });
    expect(JSON.stringify(decision)).not.toMatch(/musanze/i);
  });

  it('the alt text of that render names Rwanda and nothing finer', () => {
    const alt = locationImageAlt('Rwanda');
    expect(alt).toBe('Representative location imagery of Rwanda. Not imagery of this story.');
    expect(alt).not.toMatch(/musanze/i);
  });

  it('there is NO parameter through which a query string could enter this module', () => {
    const source = readFileSync(join(__dirname, 'locationAssets.ts'), 'utf8');
    expect(source).not.toMatch(/\bquery\s*:\s*string/);
    expect(source).not.toMatch(/normalizedQuery/);
    expect(source).not.toMatch(/\bsearchParams\b/);
  });
});

/* PAF acceptance test 17 — imagery source integrity */
describe('PAF-17 — curated, self-hosted, deterministic; never article imagery', () => {
  it('the module cannot reach article imagery — no import, no reference', () => {
    const source = readFileSync(join(__dirname, 'locationAssets.ts'), 'utf8');
    expect(source).not.toMatch(/imageUrl/);
    expect(source).not.toMatch(/NewsArticle/);
    expect(source).not.toMatch(/from '.*news'/);
  });

  it('makes no network request and constructs no URL', () => {
    const source = readFileSync(join(__dirname, 'locationAssets.ts'), 'utf8');
    expect(source).not.toMatch(/fetch\(|https?:\/\/|new URL\(/);
  });

  it('EVERY registered asset path resolves to a file committed under frontend/public', () => {
    const publicDir = join(__dirname, '..', '..', '..', 'public');
    const missing = registeredAssetPaths().filter((p) => !existsSync(join(publicDir, p)));
    expect(missing).toEqual([]);
  });

  it('the R1 registry ships empty, so every place renders the truthful no-asset state', () => {
    expect(registeredAssetPaths()).toEqual([]);
    expect(resolveLocationImage({ precision: 'city', resolvedPlace: 'Kigali' }))
      .toEqual({ kind: 'no-verified-asset', place: 'Kigali' });
    expect(resolveLocationImage({ precision: 'country', resolvedPlace: 'Rwanda' }))
      .toEqual({ kind: 'no-verified-asset', place: 'Rwanda' });
  });

  it('the registry is bounded — R1 is not a world-city catalogue', () => {
    const total = Object.keys(LOCATION_ASSETS.city).length + Object.keys(LOCATION_ASSETS.country).length;
    expect(total).toBeLessThanOrEqual(24);
  });
});
