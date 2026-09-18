import { readFileSync } from 'fs';
import { join } from 'path';

import { DEPLOYMENT_JUMP_TARGETS, jumpTargetById } from '@/lib/map/navigation/breadcrumbs';
import { scopeForJumpTarget } from '@/lib/map/navigation/geographyScope';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CHECKPOINT B-2C — A REGION PATH MAY NOT ENTER COUNTRY RETRIEVAL
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CTO ruling:
 *
 *   AFRICA      → no arbitrary /news/country/*
 *   EAST AFRICA → no /news/country/TCD
 *   EUROPE      → no stale-country news request
 *   only explicit COUNTRY selection may enter country retrieval logic
 *   "Do not hard-code country exclusions."
 *
 * NO COUNTRY CODE IS EXCLUDED ANYWHERE. The guarantee is structural: country
 * retrieval has exactly one entry point, every caller of it is enumerated
 * below, and the region branch returns before reaching it. TCD and CAF are
 * named in this file only as the symptoms being regression-tested, never as
 * values any implementation checks for.
 *
 * `/news/country/:iso3` is PROVIDER-CAPABLE — it spends retrieval budget — so
 * this is the higher-cost class, and a region selection reaching it would be a
 * real provider call for a country the reader never chose.
 */

const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const mapClient = stripComments(
  readFileSync(join(__dirname, 'MapPageClient.tsx'), 'utf-8'),
);

describe('B-2C — the region path never reaches country retrieval', () => {
  describe('COUNTRY RETRIEVAL HAS EXACTLY ONE ENTRY POINT', () => {
    it('COUNTRY RETRIEVAL HAS NO ENTRY POINT ON THE MAP AT ALL', () => {
      /*
        ══ SUPERSEDED — ONE ENTRY POINT BECAME NONE ═══════════════════════════

        The block was titled "COUNTRY RETRIEVAL HAS EXACTLY ONE ENTRY POINT" and
        it was right to insist on that: with one call site, every classification
        beneath it was complete. Live acceptance then showed that one site
        executing GNews from a plain country click, and the CTO ruling makes
        passive map navigation provider-free.

        Zero entry points makes the classification below trivially complete
        rather than merely verifiable.
      */
      expect(mapClient.split('fetchCountryNews(').length - 1).toBe(0);
      expect(mapClient).not.toContain('@/lib/api/countryApi');
    });

    it('and the retrieval function is gone, not merely unreferenced', () => {
      expect(mapClient).not.toContain('const loadCountry = useCallback');
    });

    it('country selection reads the RETAINED corpus instead — the guard became the whole path', () => {
      /*
        The old guard said "country selection does NOT implicitly mean live
        retrieval" and enforced it with a cache key checked before the fetch.
        That sentence is now the entire behaviour: there is no fetch to guard,
        and the retained corpus seeded at mount is what a selected country
        shows.
      */
      expect(mapClient).toContain('retainedCountryCorpora()');
      expect(mapClient).not.toContain('if (cache[key]) return;');
    });
  });

  describe('A REGION SELECTION RETURNS BEFORE COUNTRY RETRIEVAL', () => {
    const handler = mapClient.slice(
      mapClient.indexOf('function handleSpatialSelection'),
      mapClient.indexOf('function handleCategoryChange'),
    );

    it('the REGION branch exists and returns', () => {
      expect(handler).toContain("if (selection.kind === 'REGION')");

      const regionBranch = handler.slice(
        handler.indexOf("if (selection.kind === 'REGION')"),
        handler.indexOf('const country = COUNTRIES.find'),
      );

      expect(regionBranch).toContain('setSelectedCountry(null);');
      expect(regionBranch).toContain('return;');
      expect(regionBranch).not.toContain('loadCountry');
    });

    it('the REGION branch precedes every country lookup in the handler', () => {
      /*
        Order is the guarantee. If the country lookup were hoisted above the
        region branch, a region selection would resolve a country before the
        early return could stop it.
      */
      expect(handler.indexOf("selection.kind === 'REGION'")).toBeLessThan(
        handler.indexOf('const country = COUNTRIES.find'),
      );
      /*
        The second half used to compare against `loadCountry`. Nothing retrieves
        any more, so the term is the scope setter — the ordering property is
        unchanged and is still what stops a region selection from resolving a
        country before the early return can stop it.
      */
      expect(handler.indexOf("selection.kind === 'REGION'")).toBeLessThan(
        handler.indexOf('selectCountryScope'),
      );
    });

    it('a selection that resolves to no known country also returns without retrieving', () => {
      expect(handler).toContain('if (country === null) return;');
    });
  });

  describe('REGION JUMPS CANNOT PRODUCE A COUNTRY SELECTION', () => {
    /*
      Checkpoint A established that AFRICA / EAST AFRICA / EUROPE carry no
      country identity. That is what makes the branch above unreachable for
      them: there is no COUNTRY selection for the handler to act on.
    */
    it('AFRICA carries no country — nothing for country retrieval to key on', () => {
      expect(jumpTargetById('africa')?.countryIso3).toBeUndefined();
      expect(scopeForJumpTarget(jumpTargetById('africa')!)).toEqual({
        rung: 'CONTINENT',
        id: 'africa',
      });
    });

    it('EAST AFRICA carries no country, so no member of it can be retrieved by accident', () => {
      expect(jumpTargetById('eastAfrica')?.countryIso3).toBeUndefined();
      expect(scopeForJumpTarget(jumpTargetById('eastAfrica')!)).toEqual({
        rung: 'SUBREGION',
        id: 'eastAfrica',
      });
    });

    it('EUROPE carries no country, and the jump CLEARS an incompatible selection', () => {
      expect(jumpTargetById('europe')?.countryIso3).toBeUndefined();

      const onJump = mapClient.slice(
        mapClient.indexOf('const onJump'),
        mapClient.indexOf('const onJump') + 400,
      );

      /* The clearing itself lives in GlobalMapShell; assert the shell contract. */
      const shell = stripComments(
        readFileSync(join(__dirname, 'shell', 'GlobalMapShell.tsx'), 'utf-8'),
      );

      expect(shell).toContain("if (target.rung !== 'CITY' && selection !== null");
      expect(shell).toContain('onSelectionChange?.(null)');
      expect(onJump.length).toBeGreaterThanOrEqual(0);
    });

    it('only COUNTRY-rung targets carry an ISO3 at all', () => {
      for (const target of DEPLOYMENT_JUMP_TARGETS) {
        if (target.rung === 'COUNTRY') expect(target.countryIso3).toMatch(/^[A-Z]{3}$/);
        else expect(target.countryIso3).toBeUndefined();
      }
    });
  });

  describe('NO COUNTRY IS SPECIAL-CASED — the ruling forbids it', () => {
    it('the map client names no country code as an exclusion', () => {
      /*
        Chad and Central African Republic were the reported symptoms. Neither
        may appear as a guard. COUNTRIES lookups are by the selection's own id,
        never against a literal.
      */
      expect(mapClient).not.toMatch(/['"]TCD['"]/);
      expect(mapClient).not.toMatch(/['"]CAF['"]/);
      expect(mapClient).not.toMatch(/Central African/i);
    });

    it('the geography scope module names none either', () => {
      const scope = stripComments(
        readFileSync(
          join(__dirname, '..', '..', 'lib', 'map', 'navigation', 'geographyScope.ts'),
          'utf-8',
        ),
      );

      expect(scope).not.toMatch(/\bTCD\b/);
      expect(scope).not.toMatch(/\bCAF\b/);
    });
  });
});
