import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * PATCH B — THE MAP KEEPS ITS PLACE.
 *
 * OBSERVED ON PRODUCTION: selecting Spain on
 * https://frontend-production-c606.up.railway.app/map left the address bar
 * completely unchanged. Measured on the release line in Chromium, all three
 * viewports, the same three rows:
 *
 *     URL carries the selected country     no   no   no
 *     selection survives Back              no   no   no
 *     selection survives reload            no   no   no
 *
 * The selection lived only in React state, so a reader who opened a story and
 * pressed Back came home to an empty map, a refresh discarded the country, and
 * no country view could be linked or bookmarked at all.
 *
 * THIS PATCH IS ONE FILE AND IS INDEPENDENT OF PATCH A. It shares no path, no
 * symbol and no import with the paint-expression correction, and the two apply
 * in either order — a test at the bottom pins that this file does not reach into
 * the renderer.
 */
const SRC = readFileSync(join(__dirname, 'MapPageClient.tsx'), 'utf8');
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

describe('the selection is carried in the URL', () => {
  it('the country and the category are written to the address bar', () => {
    /*
      ══ SUPERSEDED BY R2 — AND THIS TRIPWIRE FIRED CORRECTLY ═══════════════

      It pinned `params.set('country', selectedCountry.iso3)`, which is exactly
      the line MAP-EAST-AFRICA-REGION-COLLAPSE-1 required be changed: writing
      the country from `selectedCountry` ALONE is what allowed
      `?country=CAN&sel=region:eastern-africa` — the panel describing one place
      and the rail another.

      THE PROPERTY IT PROTECTS IS UNCHANGED and is re-asserted below: the
      country IS still written to the address bar. What changed is that the
      SEMANTIC SELECTION now decides whether it may be.
    */
    expect(CODE).toMatch(/countryParamFor\(spatialSelection/);
    expect(CODE).toMatch(/params\.set\('country', countryParam\)/);
    expect(CODE).toMatch(/params\.set\('category', category\)/);
  });

  it('a clean /map still opens with nothing selected', () => {
    expect(CODE).toMatch(/query\.length > 0 \? `\/map\?\$\{query\}` : '\/map'/);
  });
});

describe('the read happens once, from the address bar itself', () => {
  it('it reads window.location.search, not useSearchParams', () => {
    /* `useSearchParams()` is empty on the first client render unless the route
       is wrapped in Suspense, and a `useState` initialiser runs exactly once —
       together they capture nothing and the restore silently never happens. */
    expect(CODE).toMatch(/new URLSearchParams\(window\.location\.search\)/);
    expect(CODE).not.toMatch(/useSearchParams/);
  });

  it('the country is resolved from the catalogue, not trusted from the URL', () => {
    expect(CODE).toMatch(/COUNTRIES\.find\(\(c\) => c\.iso3 === iso3\)/);
  });

  it('a category from the address bar is validated against the taxonomy', () => {
    /* otherwise `?category=<anything>` reaches the country feed as a filter
       nobody defined */
    expect(CODE).toMatch(/NEWS_CATEGORIES as readonly string\[\]\)\.includes\(raw\)/);
  });

  it('restoring reuses the EXISTING load path — no new fetch, no new contract', () => {
    /*
      ══ SUPERSEDED BY R2 — THIS ASSERTION PINNED THE QUOTA LEAK ════════════

      It required the mount effect to call `loadCountry`, which is precisely
      what MAP-GNEWS-QUOTA-REGRESSION-1 measured: hydration retrieved whatever
      `?country=` was in the address bar, with no user in the loop, so every
      load, reload and shared link spent provider quota.

      A test that pins a defect makes the defect load-bearing, so the
      expectation MOVES WITH THE FIX rather than being deleted.

      The property this block really guards — that restore reuses the EXISTING
      path and introduces no second contract — is re-asserted: the mount effect
      still restores both layers of the selection, and there is still exactly
      one retrieval entry point in the file.
    */
    const mount = CODE.slice(
      CODE.indexOf('const params = new URLSearchParams(window.location.search)'),
      CODE.indexOf('setRestored(true);'),
    );

    expect(mount.length).toBeGreaterThan(0);
    expect(mount).not.toContain('loadCountry');
    expect(mount).toContain('setSelectedCountry(country)');
    expect(mount).toContain('setSpatialSelection');
    expect(CODE.split('fetchCountryNews(').length - 1).toBe(1);
    expect(CODE).not.toMatch(/fetch\(|new Request/);
  });
});

describe('one writer, and never before the read', () => {
  it('the URL is not written until the read has completed', () => {
    /* otherwise the first render erases the selection it should restore */
    expect(CODE).toMatch(/if \(!restored\) return;/);
  });

  it('there is exactly ONE writer, so restore cannot fight a click', () => {
    expect((CODE.match(/router\.replace\(/g) ?? []).length).toBe(1);
  });

  it('replace, not push — selecting a country must not manufacture history', () => {
    for (const push of CODE.match(/router\.push\(`?[^`)]*/g) ?? []) {
      /* every push in this file navigates AWAY, to a different route */
      expect(push).toMatch(/\/search\?/);
    }
    expect(CODE).not.toMatch(/router\.push\(\s*(query|`\/map)/);
  });

  it('the URL write does not scroll the page', () => {
    expect(CODE).toMatch(/\{ scroll: false \}/);
  });
});

describe('this patch is independent of Patch A and of the rest of the Map', () => {
  it('it does not touch the renderer', () => {
    for (const forbidden of ['setPaintProperty', 'countMatchExpression', 'countPairs',
                             'maplibregl', 'setTerrain', 'setProjection']) {
      expect(`${forbidden}: ${CODE.includes(forbidden)}`).toBe(`${forbidden}: false`);
    }
  });

  it('the router and the two catalogues it validates against are still imported', () => {
    const imports = (SRC.match(/^import .*$/gm) ?? []).join('\n');
    expect(imports).toMatch(/import \{ useRouter \} from 'next\/navigation'/);
    expect(imports).toMatch(/import \{ COUNTRIES, NEWS_CATEGORIES \} from '@globalnews-ai\/shared'/);
  });
});

/*
  ══ TWO EXCLUSIONS RETIRED, AND WHAT REPLACED THEM ═══════════════════════════

  Product Owner ruling, MAIN-CONVERGED-ALPHA-POST-AUTH-1-R4. This file used to
  assert two prohibitions that later authority overtook:

    1. `expect(imports).not.toMatch(/GlobalMapShell|MobileSpatialShell|mapShellVariant/)`
       — written when the Map patch lane deliberately held the Spatial shell out
       of this component. SUPERSEDED by the accepted Spatial Map integration,
       which requires the shell to be wired here and nowhere else.

    2. `expect(CODE).not.toMatch(/CountryFollowControl|useCountryFollows/)`
       — "Patch C, held behind sign-in". THE CONDITION HAS CLEARED: Auth R2 is
       working and H-FOLLOW-AUTHENTICATED-ALPHA-1 is accepted.

  RETIRING A PROHIBITION IS NOT THE SAME AS DELETING A TEST. Each is replaced
  below by the invariant the ruling names, so the surface it guarded is still
  guarded — by a statement of what must be true rather than of what must be
  absent. NOTHING IN PATCH B WAS WEAKENED: every URL-state assertion above is
  untouched, and the renderer-independence check still stands.
*/
describe('SPATIAL IS WIRED HERE — the retired exclusion, restated as a requirement', () => {
  it('the route resolves its variant through the approved resolver, not an ad-hoc read', () => {
    expect(CODE).toMatch(/mapShellVariant\(\)/);
    expect(SRC).toMatch(/import \{ mapShellVariant \} from '@\/lib\/map\/mapShellFlag'/);
    /* the flag is read through ONE authority — never re-derived from env here */
    expect(CODE).not.toMatch(/process\.env\.NEXT_PUBLIC_MAP_SHELL/);
  });

  it('the shell variant selects Spatial — both compositions are mounted', () => {
    expect(CODE).toMatch(/GlobalMapShell/);
    expect(CODE).toMatch(/MobileSpatialShell/);
  });

  it('unset or false PRESERVES THE LEGACY FALLBACK — shipped and selectable, NOT co-mounted', () => {
    /*
      WORDING CORRECTED FOR R5. This used to say the legacy renderer "must still
      be mounted in this file". H's Gate N result withdrew that phrasing: legacy
      must remain SHIPPED — importable and selectable by the flag — and must NOT
      be mounted alongside Spatial. Mutual exclusivity itself is proved in
      `mapShellRouteWiring.spec.ts`; what this file checks is that the legacy
      path is still present to be selected.
    */
    expect(CODE).toMatch(/WorldMap/);
    expect(CODE).toMatch(/mapVariant/);
    /* and that selection is a branch, not two things drawn at once */
    expect(CODE).toMatch(/if \(mapVariant === 'shell'\)/);
  });
});

describe('FOLLOW IS PERMITTED, WATCH IS NOT — the second retired exclusion', () => {
  it('Follow may be wired on the authenticated surface', () => {
    expect(CODE).toMatch(/useCountryFollows/);
  });

  it('the accepted follows contract is CONSUMED, not rebuilt', () => {
    /* no second fetch path and no private follow state — the defect the Follow
       authority exists to prevent */
    expect(CODE).not.toMatch(/fetch\(|new Request/);
  });

  it('WATCH / MONITORING ACTIVATION REMAINS FORBIDDEN — Follow is not Watch', () => {
    for (const forbidden of ['WatchComposer', 'Watchboard', 'WatchCta', 'ActivationPanel',
                             'useWatch', 'createWatch', 'watchModel', 'watchCtaLadder']) {
      expect(`${forbidden}: ${CODE.includes(forbidden)}`).toBe(`${forbidden}: false`);
    }
  });
});

describe('THE PROTECTIONS THE RULING REQUIRES TO SURVIVE THE AMENDMENT', () => {
  it('PATCH B URL persistence is still functional', () => {
    /*
      ══ SUPERSEDED BY R2 — AND THIS TRIPWIRE FIRED CORRECTLY ═══════════════

      It pinned `params.set('country', selectedCountry.iso3)`, which is exactly
      the line MAP-EAST-AFRICA-REGION-COLLAPSE-1 required be changed: writing
      the country from `selectedCountry` ALONE is what allowed
      `?country=CAN&sel=region:eastern-africa` — the panel describing one place
      and the rail another.

      THE PROPERTY IT PROTECTS IS UNCHANGED and is re-asserted below: the
      country IS still written to the address bar. What changed is that the
      SEMANTIC SELECTION now decides whether it may be.
    */
    expect(CODE).toMatch(/countryParamFor\(spatialSelection/);
    expect(CODE).toMatch(/params\.set\('country', countryParam\)/);
    expect(CODE).toMatch(/params\.set\('category', category\)/);
    expect(CODE).toMatch(/if \(!restored\) return;/);
    expect((CODE.match(/router\.replace\(/g) ?? []).length).toBe(1);
    expect(CODE).toMatch(/\{ scroll: false \}/);
  });

  it('NEWS_CATEGORIES runtime validation is still functional', () => {
    expect(CODE).toMatch(/NEWS_CATEGORIES as readonly string\[\]\)\.includes\(raw\)/);
  });
});
